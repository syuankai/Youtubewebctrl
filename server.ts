import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { mpvController, AUDIO_QUALITY_PRESETS, AudioQuality } from './server/mpvController.js';
import { bluetoothController } from './server/bluetoothController.js';
import { redisCache } from './server/redisCache.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// ==========================================
// 1. Playback & Controller API Endpoints
// ==========================================

// Get current player status (lightweight, rapid polling friendly)
app.get('/api/status', (req, res) => {
  res.json(mpvController.getStatus());
});

// Play a YouTube URL (pure audio stream)
app.post('/api/play', async (req, res) => {
  const { url, title, quality } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '請提供有效的 YouTube 網址' });
  }

  try {
    if (quality && ['high', 'saver', 'voice'].includes(quality)) {
      await mpvController.setAudioQuality(quality as AudioQuality);
    }
    const success = await mpvController.play(url.trim(), title);
    res.json({ success, status: mpvController.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '播放失敗' });
  }
});

// Switch audio quality (high quality, data saver, voice mode)
app.post('/api/audio-quality', async (req, res) => {
  const { quality } = req.body;
  if (!quality || !['high', 'saver', 'voice'].includes(quality)) {
    return res.status(400).json({ error: '請提供有效音質選項 (high, saver, voice)' });
  }

  try {
    const success = await mpvController.setAudioQuality(quality as AudioQuality);
    res.json({
      success,
      quality,
      preset: AUDIO_QUALITY_PRESETS[quality as AudioQuality],
      status: mpvController.getStatus(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '設定音質失敗' });
  }
});

// Pause playback
app.post('/api/pause', async (req, res) => {
  await mpvController.pause();
  res.json({ success: true, status: mpvController.getStatus() });
});

// Resume playback
app.post('/api/resume', async (req, res) => {
  await mpvController.resume();
  res.json({ success: true, status: mpvController.getStatus() });
});

// Toggle pause/resume
app.post('/api/toggle-pause', async (req, res) => {
  await mpvController.togglePause();
  res.json({ success: true, status: mpvController.getStatus() });
});

// Seek relative (+5 seconds or -5 seconds)
app.post('/api/seek', async (req, res) => {
  const seconds = Number(req.body.seconds ?? 5);
  await mpvController.seekRelative(seconds);
  res.json({ success: true, status: mpvController.getStatus() });
});

// Seek to absolute time (seconds)
app.post('/api/seek-to', async (req, res) => {
  const position = Number(req.body.position ?? 0);
  await mpvController.seekTo(position);
  res.json({ success: true, status: mpvController.getStatus() });
});

// Adjust volume (0 - 100)
app.post('/api/volume', async (req, res) => {
  const volume = Number(req.body.volume ?? 80);
  await mpvController.setVolume(volume);
  res.json({ success: true, status: mpvController.getStatus() });
});

// Toggle mute
app.post('/api/toggle-mute', async (req, res) => {
  const isMuted = await mpvController.toggleMute();
  res.json({ success: true, isMuted, status: mpvController.getStatus() });
});

// Stop playback
app.post('/api/stop', async (req, res) => {
  await mpvController.stop();
  res.json({ success: true, status: mpvController.getStatus() });
});

// Change loop mode
app.post('/api/loop', (req, res) => {
  const { loop } = req.body;
  if (['none', 'one', 'all'].includes(loop)) {
    mpvController.setLoop(loop);
  }
  res.json({ success: true, status: mpvController.getStatus() });
});

// Queue management
app.post('/api/queue', (req, res) => {
  const { url, title, channel, thumbnail, duration } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  mpvController.addToQueue({ url, title: title || url, channel, thumbnail, duration });
  res.json({ success: true, status: mpvController.getStatus() });
});

app.delete('/api/queue/:id', (req, res) => {
  mpvController.removeFromQueue(req.params.id);
  res.json({ success: true, status: mpvController.getStatus() });
});

app.post('/api/queue/clear', (req, res) => {
  mpvController.clearQueue();
  res.json({ success: true, status: mpvController.getStatus() });
});

// Quick metadata inspection
app.get('/api/info', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const meta = await mpvController.fetchMetadata(url);
  res.json(meta);
});

// ==========================================
// 2. Sound Card & Audio Device Selection
// ==========================================
app.get('/api/soundcards', async (req, res) => {
  try {
    const result = await mpvController.getSoundCards();
    res.json({
      success: true,
      devices: result.devices,
      currentDevice: result.currentDevice,
      error: result.error || null,
    });
  } catch (err: any) {
    res.json({
      success: false,
      devices: [],
      currentDevice: '',
      error: '無裝置',
    });
  }
});

app.post('/api/soundcards/select', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: '請提供有效的音效設備 ID' });
  }

  const success = await mpvController.setAudioDevice(deviceId);
  res.json({ success, currentDevice: deviceId });
});

// ==========================================
// 3. Bluetooth Audio Device Management
// ==========================================
app.get('/api/bluetooth/status', async (req, res) => {
  try {
    const status = await bluetoothController.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || '無法取得藍芽狀態' });
  }
});

app.post('/api/bluetooth/scan', async (req, res) => {
  try {
    const result = await bluetoothController.startScan();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/bluetooth/scan/stop', async (req, res) => {
  try {
    await bluetoothController.stopScan();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/bluetooth/connect', async (req, res) => {
  const { mac } = req.body;
  if (!mac) return res.status(400).json({ error: '請提供藍芽設備 MAC 地址' });

  try {
    const result = await bluetoothController.connectDevice(mac);
    // If successfully connected, trigger soundcard detection refresh
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/bluetooth/disconnect', async (req, res) => {
  const { mac } = req.body;
  if (!mac) return res.status(400).json({ error: '請提供藍芽設備 MAC 地址' });

  try {
    const result = await bluetoothController.disconnectDevice(mac);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/bluetooth/pair', async (req, res) => {
  const { mac } = req.body;
  if (!mac) return res.status(400).json({ error: '請提供藍芽設備 MAC 地址' });

  try {
    const result = await bluetoothController.pairDevice(mac);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/bluetooth/device/:mac', async (req, res) => {
  const { mac } = req.params;
  try {
    const result = await bluetoothController.removeDevice(mac);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/bluetooth/power', async (req, res) => {
  const { powered } = req.body;
  try {
    const result = await bluetoothController.togglePower(Boolean(powered));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. Redis Cache Management API
// ==========================================
app.get('/api/redis/status', async (req, res) => {
  try {
    const status = await redisCache.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || '無法取得 Redis 狀態' });
  }
});

app.post('/api/redis/config', async (req, res) => {
  const { redisUrl } = req.body;
  try {
    const result = await redisCache.updateConfig(redisUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/redis/test', async (req, res) => {
  const { redisUrl } = req.body;
  if (!redisUrl) return res.status(400).json({ error: '請提供 Redis 連線字串' });
  try {
    const result = await redisCache.testConnection(redisUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/redis/clear', async (req, res) => {
  try {
    const result = await redisCache.clearCache();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// System diagnostics & status (systemd, mpv, audio, yt-dlp)
app.get('/api/system-info', (req, res) => {
  exec('uname -a && yt-dlp --version && mpv --version | head -n 1', (err, stdout) => {
    exec('systemctl status yt-audio-player --lines=5 2>/dev/null || echo "Systemd service: not in system mode or container"', (sErr, sStdout) => {
      exec('hostname -I 2>/dev/null || echo "127.0.0.1"', (hErr, hStdout) => {
        res.json({
          os: stdout || 'Linux Container',
          systemd: sStdout || 'Active in current process',
          ipAddresses: (hStdout || '').trim().split(/\s+/).filter(Boolean),
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          nodeVersion: process.version,
        });
      });
    });
  });
});

// In-browser stream proxy (allows listening directly in browser if desired, piped from yt-dlp)
app.get('/api/stream', async (req, res) => {
  const status = mpvController.getStatus();
  const targetUrl = (req.query.url as string) || status.url;
  const qualityQuery = (req.query.quality as AudioQuality) || status.audioQuality || 'high';
  const quality: AudioQuality = ['high', 'saver', 'voice'].includes(qualityQuery) ? qualityQuery : 'high';
  const preset = AUDIO_QUALITY_PRESETS[quality] || AUDIO_QUALITY_PRESETS.high;

  if (!targetUrl) {
    return res.status(400).send('No audio URL playing');
  }

  // 1. Check Redis / Memory cache first for stream URL by quality
  try {
    const cachedStreamUrl = await redisCache.getStreamUrl(targetUrl, quality);
    if (cachedStreamUrl) {
      return res.redirect(cachedStreamUrl);
    }
  } catch {}

  // Use yt-dlp to extract direct audio URL with format and --audio-quality
  exec(`yt-dlp -f "${preset.ytdlFormat}" --audio-quality ${preset.audioQuality} -g "${targetUrl}"`, { timeout: 8000 }, (err, directUrl) => {
    if (!err && directUrl && directUrl.trim().startsWith('http')) {
      const cleanUrl = directUrl.trim();
      redisCache.setStreamUrl(targetUrl, cleanUrl, quality).catch(() => {});
      return res.redirect(cleanUrl);
    }

    // Fallback to streaming pipe with --audio-quality parameter
    res.setHeader('Content-Type', 'audio/webm');
    const ytdl = spawn('yt-dlp', [
      '-f', preset.ytdlFormat,
      '--audio-quality', preset.audioQuality,
      '-o', '-',
      targetUrl,
    ]);
    ytdl.stdout.pipe(res);
    req.on('close', () => {
      ytdl.kill();
    });
  });
});

// Download setup script directly
app.get('/api/download/setup', (req, res) => {
  const setupPath = path.join(process.cwd(), 'setup');
  if (fs.existsSync(setupPath)) {
    res.download(setupPath, 'setup');
  } else {
    res.status(404).send('Setup script not found');
  }
});

// Download full tar.gz package for offline / remote deployment
app.get('/api/download/package', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="yt-audio-player.tar.gz"');
  res.setHeader('Content-Type', 'application/gzip');

  const tar = spawn('tar', [
    '-czf',
    '-',
    'setup',
    'uninstall.sh',
    'yt-audio-player.service',
    'package.json',
    'server.ts',
    'server',
    'src',
    'index.html',
    'vite.config.ts',
    'tsconfig.json',
  ], { cwd: process.cwd() });

  tar.stdout.pipe(res);
  tar.stderr.on('data', (d) => console.error('tar err:', d.toString()));
});

// ==========================================
// 2. Vite Middleware / SPA Static Serving
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[YouTube Linux Audio Service] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
