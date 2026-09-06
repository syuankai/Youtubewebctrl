import { spawn, ChildProcess, exec } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { bluetoothController } from './bluetoothController';
import { redisCache } from './redisCache';

export interface PlayerStatus {
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
  position: number;
  volume: number;
  isMuted: boolean;
  loop: 'none' | 'one' | 'all';
  lastError: string | null;
  queue: QueueItem[];
  history: HistoryItem[];
  backendInfo: {
    mpvAlive: boolean;
    ipcConnected: boolean;
    ytdlpAvailable: boolean;
    socketPath: string;
    audioOutput: string;
    currentAudioDevice?: string;
    pid?: number;
  };
}

export interface SoundCardDevice {
  id: string;
  name: string;
  type: 'alsa' | 'pulse' | 'pipewire' | 'bluetooth' | 'other';
  isDefault?: boolean;
}

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  duration?: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  playedAt: number;
}

const SOCKET_PATH = '/tmp/mpv-yt-audio.sock';

// Ensure ALSA configuration doesn't error out when running in a headless / container environment
function ensureAlsaFallbackConfig() {
  try {
    const hasPhysicalCards =
      fs.existsSync('/proc/asound/cards') &&
      fs.readFileSync('/proc/asound/cards', 'utf8').trim() !== '' &&
      !fs.readFileSync('/proc/asound/cards', 'utf8').includes('--- no soundcards ---');

    if (!hasPhysicalCards && !fs.existsSync('/etc/asound.conf')) {
      fs.writeFileSync(
        '/etc/asound.conf',
        '# Fallback ALSA configuration for headless / container environments\npcm.!default {\n    type null\n}\nctl.!default {\n    type null\n}\n',
        'utf8'
      );
    }
  } catch {
    // Non-root or read-only filesystem, ignore
  }
}

function detectAudioOutput(): { ao: string; description: string } {
  if (process.env.MPV_AO) {
    return { ao: process.env.MPV_AO, description: `自訂音訊輸出 (${process.env.MPV_AO})` };
  }

  // Check physical ALSA soundcards
  let hasAlsaHardware = false;
  try {
    if (fs.existsSync('/proc/asound/cards')) {
      const cards = fs.readFileSync('/proc/asound/cards', 'utf8').trim();
      if (cards && !cards.includes('--- no soundcards ---')) {
        hasAlsaHardware = true;
      }
    } else if (fs.existsSync('/dev/snd')) {
      const devices = fs.readdirSync('/dev/snd');
      if (devices.some((d) => d.startsWith('pcm') || d.startsWith('control'))) {
        hasAlsaHardware = true;
      }
    }
  } catch {
    // ignore
  }

  // Check PulseAudio / PipeWire
  let hasSoundServer = false;
  try {
    if (process.env.PULSE_SERVER) {
      hasSoundServer = true;
    } else {
      const uid = process.getuid ? process.getuid() : 1000;
      const xdg = process.env.XDG_RUNTIME_DIR || `/run/user/${uid}`;
      if (fs.existsSync(path.join(xdg, 'pulse/native')) || fs.existsSync(path.join(xdg, 'pipewire-0'))) {
        hasSoundServer = true;
      }
    }
  } catch {
    // ignore
  }

  if (hasSoundServer) {
    return {
      ao: 'pulse,pipewire,alsa,null',
      description: 'PulseAudio / PipeWire (本機硬體揚聲器)',
    };
  }

  if (hasAlsaHardware) {
    return {
      ao: 'alsa,pulse,pipewire,null',
      description: 'ALSA (本機硬體揚聲器)',
    };
  }

  // Headless container / cloud environment without physical sound card
  return {
    ao: 'null',
    description: '容器虛擬環境 (Null Audio / 支援瀏覽器同步串流)',
  };
}

class MpvController {
  private mpvProcess: ChildProcess | null = null;
  private ipcClient: net.Socket | null = null;
  private isConnected = false;
  private pendingRequests = new Map<number, (res: any) => void>();
  private requestIdCounter = 1;
  private statusPollTimer: NodeJS.Timeout | null = null;
  private lastPosition = 0;
  private lastDuration = 0;
  private currentVolume = 80;
  private isMuted = false;
  private isPaused = false;
  private isIdle = true;
  private currentUrl = '';
  private currentTitle = '';
  private currentChannel = '';
  private currentThumbnail = '';
  private currentLoading = false;
  private lastError: string | null = null;
  private queue: QueueItem[] = [];
  private history: HistoryItem[] = [];
  private loopMode: 'none' | 'one' | 'all' = 'none';
  private detectedAudioOutput = 'ALSA / PulseAudio / PipeWire (Linux Local Speaker)';
  private currentAudioDevice = 'auto';
  private isYtdlpAvailable = false;

  constructor() {
    ensureAlsaFallbackConfig();
    this.checkYtdlp();
    this.initMpv();
    this.startStatusPolling();
  }

  private checkYtdlp() {
    exec('yt-dlp --version', { timeout: 3000 }, (err, stdout) => {
      this.isYtdlpAvailable = !err && Boolean(stdout && stdout.trim());
    });
  }

  public async initMpv() {
    // Clean up previous socket if existing
    if (fs.existsSync(SOCKET_PATH)) {
      try {
        fs.unlinkSync(SOCKET_PATH);
      } catch (e) {
        // ignore
      }
    }

    const { ao, description } = detectAudioOutput();
    this.detectedAudioOutput = description;

    // Spawn mpv in background
    const args = [
      '--no-video',
      '--idle=yes',
      `--input-ipc-server=${SOCKET_PATH}`,
      '--ytdl-format=bestaudio/best',
      '--audio-display=no',
      `--ao=${ao}`,
      '--volume=80',
      '--keep-open=no',
      '--msg-level=ao/alsa=no,ao=warn',
      '--ytdl-raw-options=js-runtimes=node',
    ];

    const possibleCookies = ['./cookies.txt', '/etc/yt-audio-player/cookies.txt'];
    for (const cPath of possibleCookies) {
      if (fs.existsSync(cPath)) {
        args.push(`--ytdl-raw-options-append=cookies=${path.resolve(cPath)}`);
        break;
      }
    }

    try {
      this.mpvProcess = spawn('mpv', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: false,
      });

      this.mpvProcess.stderr?.on('data', (data) => {
        const msg = data.toString();
        // Ignore benign ALSA/driver probing logs in container / headless environments
        if (
          msg.includes('ALSA lib') ||
          msg.includes('Playback open error') ||
          msg.includes('Cannot connect to server socket') ||
          msg.includes('jack server is not running') ||
          msg.includes('JackShmReadWritePtr') ||
          msg.includes("can't load config client.conf")
        ) {
          return;
        }
        if (msg.includes('error') || msg.includes('Failed')) {
          console.log('[mpv-stderr]', msg.trim());
        }
      });

      this.mpvProcess.on('exit', (code, signal) => {
        console.log(`[mpv] process exited with code ${code}, signal ${signal}. Restarting in 2s...`);
        this.isConnected = false;
        this.ipcClient = null;
        setTimeout(() => this.initMpv(), 2000);
      });

      // Wait a moment for socket to be created, then connect
      setTimeout(() => this.connectIpc(), 600);
    } catch (err: any) {
      console.error('[mpv] failed to spawn mpv:', err);
      this.lastError = `MPV 啟動失敗: ${err.message}`;
    }
  }

  private connectIpc(retries = 5) {
    if (this.isConnected && this.ipcClient) return;

    if (!fs.existsSync(SOCKET_PATH)) {
      if (retries > 0) {
        setTimeout(() => this.connectIpc(retries - 1), 500);
      }
      return;
    }

    const client = net.createConnection(SOCKET_PATH);

    client.on('connect', () => {
      this.isConnected = true;
      this.ipcClient = client;
      console.log('[mpv IPC] Connected to socket at', SOCKET_PATH);

      // Register property observations
      this.sendCommand(['observe_property', 1, 'time-pos']);
      this.sendCommand(['observe_property', 2, 'duration']);
      this.sendCommand(['observe_property', 3, 'pause']);
      this.sendCommand(['observe_property', 4, 'volume']);
      this.sendCommand(['observe_property', 5, 'idle-active']);
      this.sendCommand(['observe_property', 6, 'media-title']);
      this.sendCommand(['observe_property', 7, 'eof-reached']);
    });

    let buffer = '';
    client.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          this.handleIpcMessage(parsed);
        } catch (e) {
          // ignore parsing error for partial chunks
        }
      }
    });

    client.on('error', (err) => {
      this.isConnected = false;
      this.ipcClient = null;
    });

    client.on('close', () => {
      this.isConnected = false;
      this.ipcClient = null;
    });
  }

  private handleIpcMessage(msg: any) {
    if (msg.request_id && this.pendingRequests.has(msg.request_id)) {
      const resolver = this.pendingRequests.get(msg.request_id);
      this.pendingRequests.delete(msg.request_id);
      resolver?.(msg);
    }

    if (msg.event === 'property-change') {
      switch (msg.name) {
        case 'time-pos':
          if (typeof msg.data === 'number') {
            this.lastPosition = Math.max(0, Math.floor(msg.data));
            if (this.currentLoading) {
              this.currentLoading = false;
            }
          }
          break;
        case 'duration':
          if (typeof msg.data === 'number') {
            this.lastDuration = Math.floor(msg.data);
          }
          break;
        case 'pause':
          this.isPaused = Boolean(msg.data);
          break;
        case 'volume':
          if (typeof msg.data === 'number') {
            this.currentVolume = Math.round(msg.data);
          }
          break;
        case 'media-title':
          if (msg.data && typeof msg.data === 'string' && !this.currentTitle) {
            this.currentTitle = msg.data;
          }
          break;
        case 'idle-active':
          this.isIdle = Boolean(msg.data);
          break;
        case 'eof-reached':
          if (msg.data === true) {
            this.handlePlaybackEnded();
          }
          break;
      }
    } else if (msg.event === 'end-file') {
      if (msg.reason === 'eof') {
        this.handlePlaybackEnded();
      }
    }
  }

  private handlePlaybackEnded() {
    if (this.loopMode === 'one' && this.currentUrl) {
      this.play(this.currentUrl, this.currentTitle);
    } else if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        if (this.loopMode === 'all' && this.currentUrl) {
          this.queue.push({
            id: Date.now().toString(),
            url: this.currentUrl,
            title: this.currentTitle,
            channel: this.currentChannel,
            thumbnail: this.currentThumbnail,
            duration: this.lastDuration,
          });
        }
        this.play(next.url, next.title);
      }
    } else {
      this.isIdle = true;
      this.currentLoading = false;
    }
  }

  private sendCommand(command: any[]): Promise<any> {
    return new Promise((resolve) => {
      if (!this.isConnected || !this.ipcClient) {
        this.connectIpc();
        return resolve({ error: 'not_connected' });
      }

      const reqId = this.requestIdCounter++;
      const payload = JSON.stringify({ command, request_id: reqId }) + '\n';

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId);
          resolve({ error: 'timeout' });
        }
      }, 3000);

      this.pendingRequests.set(reqId, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      try {
        this.ipcClient.write(payload);
      } catch (err) {
        this.pendingRequests.delete(reqId);
        clearTimeout(timer);
        resolve({ error: 'write_failed' });
      }
    });
  }

  private startStatusPolling() {
    if (this.statusPollTimer) clearInterval(this.statusPollTimer);
    this.statusPollTimer = setInterval(async () => {
      if (this.isConnected && !this.isIdle) {
        const posRes = await this.sendCommand(['get_property', 'time-pos']);
        if (posRes && typeof posRes.data === 'number') {
          this.lastPosition = Math.floor(posRes.data);
          this.currentLoading = false;
        }

        const durRes = await this.sendCommand(['get_property', 'duration']);
        if (durRes && typeof durRes.data === 'number') {
          this.lastDuration = Math.floor(durRes.data);
        }

        const pauseRes = await this.sendCommand(['get_property', 'pause']);
        if (pauseRes && typeof pauseRes.data === 'boolean') {
          this.isPaused = pauseRes.data;
        }
      }
    }, 1000);
  }

  public async fetchMetadata(url: string): Promise<{ title: string; channel: string; thumbnail: string; duration: number }> {
    // 1. Check Redis / Memory cache first for lightning-fast sub-millisecond response
    try {
      const cached = await redisCache.getMetadata(url);
      if (cached) {
        return cached;
      }
    } catch {}

    return new Promise((resolve) => {
      // Use yt-dlp to quickly get metadata
      exec(`yt-dlp --dump-single-json --no-playlist --no-warnings "${url}"`, { timeout: 10000 }, (err, stdout) => {
        if (err || !stdout) {
          return resolve({
            title: url,
            channel: 'YouTube Audio',
            thumbnail: '',
            duration: 0,
          });
        }
        try {
          const info = JSON.parse(stdout);
          const meta = {
            title: info.title || url,
            channel: info.uploader || info.channel || 'YouTube',
            thumbnail: info.thumbnail || '',
            duration: Math.floor(info.duration || 0),
          };
          // Asynchronously write to Redis cache
          redisCache.setMetadata(url, meta).catch(() => {});
          resolve(meta);
        } catch {
          resolve({
            title: url,
            channel: 'YouTube Audio',
            thumbnail: '',
            duration: 0,
          });
        }
      });
    });
  }

  public async play(url: string, givenTitle?: string): Promise<boolean> {
    if (!url) return false;
    this.currentUrl = url;
    this.currentLoading = true;
    this.lastError = null;
    this.isIdle = false;
    this.lastPosition = 0;
    this.isPaused = false;

    if (givenTitle) {
      this.currentTitle = givenTitle;
    } else {
      this.currentTitle = '載入中... (Loading audio)';
    }

    // Try sending loadfile to mpv
    const res = await this.sendCommand(['loadfile', url, 'replace']);

    // Asynchronously fetch rich metadata to update display
    this.fetchMetadata(url).then((meta) => {
      this.currentTitle = meta.title;
      this.currentChannel = meta.channel;
      this.currentThumbnail = meta.thumbnail;
      if (meta.duration > 0) this.lastDuration = meta.duration;

      // Add to history
      const existingIdx = this.history.findIndex((h) => h.url === url);
      if (existingIdx !== -1) {
        this.history.splice(existingIdx, 1);
      }
      this.history.unshift({
        id: Date.now().toString(),
        url,
        title: meta.title,
        playedAt: Date.now(),
      });
      if (this.history.length > 20) this.history.pop();
    });

    if (res?.error && res.error !== 'success') {
      console.warn('[mpv] loadfile returned:', res.error);
    }

    return true;
  }

  public async pause(): Promise<boolean> {
    await this.sendCommand(['set_property', 'pause', true]);
    this.isPaused = true;
    return true;
  }

  public async resume(): Promise<boolean> {
    await this.sendCommand(['set_property', 'pause', false]);
    this.isPaused = false;
    return true;
  }

  public async togglePause(): Promise<boolean> {
    if (this.isPaused) {
      return this.resume();
    } else {
      return this.pause();
    }
  }

  public async seekRelative(seconds: number): Promise<boolean> {
    // Relative seek (+5 or -5 seconds)
    const res = await this.sendCommand(['seek', seconds, 'relative']);
    this.lastPosition = Math.max(0, this.lastPosition + seconds);
    return !res?.error || res.error === 'success';
  }

  public async seekTo(position: number): Promise<boolean> {
    const target = Math.max(0, Math.floor(position));
    const res = await this.sendCommand(['seek', target, 'absolute']);
    this.lastPosition = target;
    return !res?.error || res.error === 'success';
  }

  public async setVolume(vol: number): Promise<boolean> {
    const safeVol = Math.max(0, Math.min(100, Math.round(vol)));
    this.currentVolume = safeVol;
    this.isMuted = safeVol === 0;
    const res = await this.sendCommand(['set_property', 'volume', safeVol]);
    return !res?.error || res.error === 'success';
  }

  public async toggleMute(): Promise<boolean> {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      await this.sendCommand(['set_property', 'mute', true]);
    } else {
      await this.sendCommand(['set_property', 'mute', false]);
      await this.sendCommand(['set_property', 'volume', this.currentVolume || 80]);
    }
    return this.isMuted;
  }

  public async stop(): Promise<boolean> {
    await this.sendCommand(['stop']);
    this.isIdle = true;
    this.isPaused = false;
    this.currentLoading = false;
    this.lastPosition = 0;
    return true;
  }

  public setLoop(loop: 'none' | 'one' | 'all') {
    this.loopMode = loop;
  }

  public addToQueue(item: Omit<QueueItem, 'id'>) {
    this.queue.push({
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
    });
  }

  public removeFromQueue(id: string) {
    this.queue = this.queue.filter((q) => q.id !== id);
  }

  public clearQueue() {
    this.queue = [];
  }

  public async getSoundCards(): Promise<{ devices: SoundCardDevice[]; currentDevice: string; error?: string }> {
    const devices: SoundCardDevice[] = [];

    // 1. Try ALSA cards parsing from /proc/asound/cards
    try {
      if (fs.existsSync('/proc/asound/cards')) {
        const content = fs.readFileSync('/proc/asound/cards', 'utf8').trim();
        if (content && !content.includes('--- no soundcards ---')) {
          const cardBlocks = content.split(/\n(?=\s*\d+\s+\[)/);
          for (const block of cardBlocks) {
            const match = block.match(/^\s*(\d+)\s+\[([^\]]+)\]:\s+([^\n]+)/);
            if (match) {
              const cardNum = match[1];
              const cardShort = match[2].trim();
              const cardLong = match[3].trim();
              devices.push({
                id: `alsa/hw:${cardNum},0`,
                name: `ALSA: ${cardLong} (${cardShort})`,
                type: 'alsa',
                isDefault: cardNum === '0',
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Try aplay -l if no ALSA cards found
    if (devices.length === 0) {
      try {
        const aplayOut = await new Promise<string>((resolve) => {
          exec('aplay -l 2>/dev/null', { timeout: 1500 }, (err, stdout) => {
            resolve(stdout || '');
          });
        });
        if (aplayOut && !aplayOut.includes('no soundcards')) {
          const lines = aplayOut.split('\n');
          for (const line of lines) {
            const match = line.match(/^card\s+(\d+):\s+([^,]+),\s+device\s+(\d+):\s+([^\n]+)/i);
            if (match) {
              const card = match[1];
              const cardName = match[2].trim();
              const dev = match[3];
              const devName = match[4].trim();
              devices.push({
                id: `alsa/hw:${card},${dev}`,
                name: `ALSA 聲卡 ${card}: ${cardName} - ${devName}`,
                type: 'alsa',
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Try pactl list sinks short (PulseAudio / PipeWire / Bluetooth)
    try {
      const pactlOut = await new Promise<string>((resolve) => {
        exec('pactl list sinks short 2>/dev/null', { timeout: 1500 }, (err, stdout) => {
          resolve(stdout || '');
        });
      });
      if (pactlOut) {
        const lines = pactlOut.split('\n').filter(Boolean);
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const sinkName = parts[1].trim();
            const isBt = sinkName.startsWith('bluez_sink');
            devices.push({
              id: `pulse/${sinkName}`,
              name: isBt ? `藍芽揚聲器 (${sinkName.replace('bluez_sink.', '')})` : `Pulse/PipeWire: ${sinkName}`,
              type: isBt ? 'bluetooth' : 'pulse',
            });
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Include connected Bluetooth audio devices
    try {
      const btDevices = await bluetoothController.getConnectedAudioDevices();
      for (const bt of btDevices) {
        if (!devices.some((dev) => dev.id === `bluetooth/${bt.mac}`)) {
          devices.push({
            id: `bluetooth/${bt.mac}`,
            name: `藍芽揚聲器/耳機: ${bt.name}`,
            type: 'bluetooth',
          });
        }
      }
    } catch {
      // ignore
    }

    // If reading failed or no real physical/sound-server/bluetooth devices exist:
    if (devices.length === 0) {
      return {
        devices: [],
        currentDevice: '',
        error: '無裝置',
      };
    }

    return {
      devices,
      currentDevice: this.currentAudioDevice || devices[0].id,
    };
  }

  public async setAudioDevice(deviceId: string): Promise<boolean> {
    this.currentAudioDevice = deviceId;
    if (this.isConnected) {
      const res = await this.sendCommand(['set_property', 'audio-device', deviceId]);
      return !res?.error || res.error === 'success';
    }
    return true;
  }

  public getStatus(): PlayerStatus {
    let state: 'idle' | 'loading' | 'playing' | 'paused' | 'error' = 'idle';

    if (this.lastError) {
      state = 'error';
    } else if (this.currentLoading) {
      state = 'loading';
    } else if (this.isIdle) {
      state = 'idle';
    } else if (this.isPaused) {
      state = 'paused';
    } else {
      state = 'playing';
    }

    return {
      state,
      url: this.currentUrl,
      title: this.currentTitle || '無播放曲目',
      channel: this.currentChannel || '',
      thumbnail: this.currentThumbnail || '',
      duration: this.lastDuration || 0,
      position: this.lastPosition || 0,
      volume: this.currentVolume,
      isMuted: this.isMuted,
      loop: this.loopMode,
      lastError: this.lastError,
      queue: this.queue,
      history: this.history,
      backendInfo: {
        mpvAlive: Boolean(this.mpvProcess && !this.mpvProcess.killed),
        ipcConnected: this.isConnected,
        ytdlpAvailable: this.isYtdlpAvailable,
        socketPath: SOCKET_PATH,
        audioOutput: this.detectedAudioOutput,
        currentAudioDevice: this.currentAudioDevice,
        pid: this.mpvProcess?.pid,
      },
    };
  }
}

export const mpvController = new MpvController();
