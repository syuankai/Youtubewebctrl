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
    pid?: number;
  };
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

export interface SoundCardDevice {
  id: string;
  name: string;
  type: 'alsa' | 'pulse' | 'pipewire' | 'bluetooth' | 'other';
  isDefault?: boolean;
}

export interface BluetoothDevice {
  mac: string;
  name: string;
  rssi?: number;
  paired: boolean;
  connected: boolean;
  trusted?: boolean;
  isAudio?: boolean;
}

export interface BluetoothStatus {
  hasAdapter: boolean;
  adapterName?: string;
  adapterMac?: string;
  powered: boolean;
  serviceRunning: boolean;
  scanning: boolean;
  connectedDevices: BluetoothDevice[];
  pairedDevices: BluetoothDevice[];
  discoveredDevices: BluetoothDevice[];
  statusText: string;
  error?: string | null;
}

export interface SystemInfo {
  os: string;
  systemd: string;
  ipAddresses: string[];
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  uptime: number;
  nodeVersion: string;
}

export interface RedisCacheStatus {
  enabled: boolean;
  connected: boolean;
  redisUrl: string;
  isCustomConfig: boolean;
  pingMs: number | null;
  keysCount: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  memoryUsed: string;
  error?: string | null;
}
