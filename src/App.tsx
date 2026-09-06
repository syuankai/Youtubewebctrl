import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Server,
  HelpCircle,
  Headphones,
  Bluetooth,
  Database,
  Sliders,
} from 'lucide-react';
import { PlayerStatus, SystemInfo, AudioQuality } from './types';
import { NowPlayingCard } from './components/NowPlayingCard';
import { PlayerControls } from './components/PlayerControls';
import { LinuxServiceCard } from './components/LinuxServiceCard';
import { PlaylistQueue } from './components/PlaylistQueue';
import { SetupInstructionsModal } from './components/SetupInstructionsModal';
import { SoundCardSelector } from './components/SoundCardSelector';
import { BluetoothManager } from './components/BluetoothManager';
import { RedisManager } from './components/RedisManager';

export default function App() {
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [showBluetoothPanel, setShowBluetoothPanel] = useState(false);
  const [showRedisPanel, setShowRedisPanel] = useState(true);
  const [browserAudioSync, setBrowserAudioSync] = useState(false);
  const browserAudioRef = useRef<HTMLAudioElement | null>(null);

  // Poll status from backend service
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data: PlayerStatus = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore network hiccups
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const res = await fetch('/api/system-info');
      if (res.ok) {
        const data: SystemInfo = await res.json();
        setSystemInfo(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchSystemInfo();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync browser audio when toggled
  useEffect(() => {
    if (!browserAudioRef.current) return;
    if (browserAudioSync && status?.state === 'playing') {
      if (browserAudioRef.current.paused) {
        browserAudioRef.current.play().catch(() => {});
      }
    } else if (!browserAudioSync || status?.state === 'paused' || status?.state === 'idle') {
      if (!browserAudioRef.current.paused) {
        browserAudioRef.current.pause();
      }
    }
  }, [browserAudioSync, status?.state, status?.url]);

  // Action API helpers with Optimistic UI
  const handlePlay = async (url: string, title?: string) => {
    setLoading(true);
    // Optimistic loading state
    setStatus((prev) =>
      prev
        ? { ...prev, state: 'loading', url, title: title || prev.title }
        : null
    );
    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title }),
      });
      const data = await res.json();
      if (data.status) {
        setStatus(data.status);
      }
      if (browserAudioRef.current && browserAudioSync) {
        browserAudioRef.current.src = `/api/stream?url=${encodeURIComponent(url)}`;
        browserAudioRef.current.play().catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setStatus((prev) => (prev ? { ...prev, state: 'paused' } : null));
    const res = await fetch('/api/pause', { method: 'POST' });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleResume = async () => {
    setStatus((prev) => (prev ? { ...prev, state: 'playing' } : null));
    const res = await fetch('/api/resume', { method: 'POST' });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleTogglePause = async () => {
    setStatus((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        state: prev.state === 'playing' ? 'paused' : 'playing',
      };
    });
    const res = await fetch('/api/toggle-pause', { method: 'POST' });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleSeek = async (seconds: number) => {
    setStatus((prev) => {
      if (!prev) return null;
      const newPos = Math.max(0, Math.min(prev.duration, prev.position + seconds));
      return { ...prev, position: newPos };
    });
    const res = await fetch('/api/seek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds }),
    });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleSeekTo = async (position: number) => {
    setStatus((prev) => (prev ? { ...prev, position } : null));
    const res = await fetch('/api/seek-to', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position }),
    });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleVolumeChange = async (volume: number) => {
    setStatus((prev) => (prev ? { ...prev, volume, isMuted: false } : null));
    const res = await fetch('/api/volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume }),
    });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleToggleMute = async () => {
    setStatus((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null));
    const res = await fetch('/api/toggle-mute', { method: 'POST' });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleStop = async () => {
    setStatus((prev) => (prev ? { ...prev, state: 'idle', position: 0 } : null));
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    if (data.status) setStatus(data.status);
    if (browserAudioRef.current) {
      browserAudioRef.current.pause();
    }
  };

  const handleLoopChange = async (loop: 'none' | 'one' | 'all') => {
    setStatus((prev) => (prev ? { ...prev, loop } : null));
    const res = await fetch('/api/loop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loop }),
    });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleAudioQualityChange = async (quality: AudioQuality) => {
    setStatus((prev) => (prev ? { ...prev, audioQuality: quality } : null));
    try {
      const res = await fetch('/api/audio-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality }),
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      if (browserAudioRef.current && browserAudioSync && status?.url) {
        browserAudioRef.current.src = `/api/stream?url=${encodeURIComponent(status.url)}&quality=${quality}`;
        if (status?.state === 'playing') {
          browserAudioRef.current.play().catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  };

  const handleRemoveQueue = async (id: string) => {
    const res = await fetch(`/api/queue/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  const handleClearQueue = async () => {
    const res = await fetch('/api/queue/clear', { method: 'POST' });
    const data = await res.json();
    if (data.status) setStatus(data.status);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white antialiased">
      {/* Hidden browser audio sync player */}
      <audio
        ref={browserAudioRef}
        src={status?.url ? `/api/stream?url=${encodeURIComponent(status.url)}&quality=${status.audioQuality || 'high'}` : undefined}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-md shadow-red-950/50 shrink-0">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-bold text-xs sm:text-base tracking-tight text-zinc-100 truncate">
                YouTube Linux 音樂背景服務
              </h1>
              <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-red-600/10 text-red-400 font-mono border border-red-500/20 shrink-0">
                yt-dlp + mpv
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
              Linux 終端機背景守護進程 • 輕量高響應控制台
            </p>
          </div>
        </div>

        {/* Desktop Header Action Group */}
        <div className="hidden lg:flex items-center gap-2.5">
          <SoundCardSelector onDeviceChange={() => fetchStatus()} />

          <button
            type="button"
            id="btn-toggle-bt-panel"
            onClick={() => setShowBluetoothPanel(!showBluetoothPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              showBluetoothPanel
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5 text-sky-400" />
            <span>藍芽音訊</span>
          </button>

          <button
            type="button"
            id="btn-toggle-redis-panel"
            onClick={() => setShowRedisPanel(!showRedisPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              showRedisPanel
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-rose-400" />
            <span>Redis 快取</span>
          </button>

          <button
            type="button"
            id="btn-browser-sync"
            onClick={() => setBrowserAudioSync(!browserAudioSync)}
            title={browserAudioSync ? '關閉瀏覽器同步發聲' : '開啟瀏覽器同步發聲'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              browserAudioSync
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>{browserAudioSync ? '瀏覽器發聲中' : '同步至瀏覽器'}</span>
          </button>

          <button
            type="button"
            id="btn-nav-setup"
            onClick={() => setIsSetupModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-200 text-xs font-semibold border border-zinc-700/80 transition-all cursor-pointer shadow-sm"
          >
            <Server className="w-3.5 h-3.5 text-red-400" />
            <span>部署指南</span>
          </button>
        </div>

        {/* Mobile Top Header Quick Buttons */}
        <div className="flex lg:hidden items-center gap-1.5">
          <button
            type="button"
            id="btn-mobile-sync"
            onClick={() => setBrowserAudioSync(!browserAudioSync)}
            title={browserAudioSync ? '關閉同步' : '同步耳機發聲'}
            className={`p-2 rounded-xl border text-xs cursor-pointer ${
              browserAudioSync
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
          >
            <Headphones className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="btn-mobile-setup"
            onClick={() => setIsSetupModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-800 text-xs font-medium cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-red-400" />
            <span>說明</span>
          </button>
        </div>
      </header>

      {/* Mobile Tool Bar (Scrollable Action Pills) */}
      <div className="lg:hidden border-b border-zinc-850 bg-zinc-950/95 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="shrink-0">
          <SoundCardSelector onDeviceChange={() => fetchStatus()} compact={true} />
        </div>

        <button
          type="button"
          id="btn-m-toggle-bt"
          onClick={() => setShowBluetoothPanel(!showBluetoothPanel)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border shrink-0 transition-all cursor-pointer ${
            showBluetoothPanel
              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
        >
          <Bluetooth className="w-3 h-3 text-sky-400" />
          <span>藍芽</span>
        </button>

        <button
          type="button"
          id="btn-m-toggle-redis"
          onClick={() => setShowRedisPanel(!showRedisPanel)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border shrink-0 transition-all cursor-pointer ${
            showRedisPanel
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
        >
          <Database className="w-3 h-3 text-rose-400" />
          <span>Redis 快取</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* 1. Current playback display (Optimized for mobile & desktop) */}
        <NowPlayingCard status={status} onQuickPlay={handlePlay} />

        {/* 2. Interactive Player Controls (Play/Pause, Skip 5s, Volume, Timeline, Audio Quality) */}
        <PlayerControls
          status={status}
          onPlay={handlePlay}
          onPause={handlePause}
          onResume={handleResume}
          onTogglePause={handleTogglePause}
          onSeek={handleSeek}
          onSeekTo={handleSeekTo}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
          onStop={handleStop}
          onLoopChange={handleLoopChange}
          onAudioQualityChange={handleAudioQualityChange}
          loading={loading}
        />

        {/* 3. Bluetooth Audio Device Connection Manager */}
        {showBluetoothPanel && (
          <BluetoothManager onAudioDeviceChanged={() => fetchStatus()} />
        )}

        {/* 4. Redis Cache Acceleration Manager */}
        {showRedisPanel && (
          <RedisManager onCacheUpdated={() => fetchStatus()} />
        )}

        {/* 5. Playlist presets, recent history & queue */}
        <PlaylistQueue
          queue={status?.queue || []}
          history={status?.history || []}
          onPlay={handlePlay}
          onRemoveQueue={handleRemoveQueue}
          onClearQueue={handleClearQueue}
        />

        {/* 6. Linux Background Daemon Status & Quick Commands */}
        <LinuxServiceCard
          status={status}
          systemInfo={systemInfo}
          onOpenSetupModal={() => setIsSetupModalOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-3 sm:py-4 px-4 text-center text-[11px] sm:text-xs text-zinc-500">
        <p>
          Linux 終端機背景音樂守護服務 • 支援 systemd 開機自啟動與 Docker Compose • 執行 <code className="text-zinc-400">sudo ./setup</code> 或 <code className="text-zinc-400">docker compose up -d</code> 即可立即享用
        </p>
      </footer>

      {/* Setup Guide Modal */}
      <SetupInstructionsModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
    </div>
  );
}
