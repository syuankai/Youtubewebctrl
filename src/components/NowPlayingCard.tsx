import React from 'react';
import { Radio, Volume2, VolumeX, Disc3, Server, AlertCircle, Sparkles, Wifi, Mic } from 'lucide-react';
import { PlayerStatus, AudioQuality } from '../types';

interface NowPlayingCardProps {
  status: PlayerStatus | null;
  onQuickPlay: (url: string, title: string) => void;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({ status }) => {
  const isPlaying = status?.state === 'playing';
  const isLoading = status?.state === 'loading';
  const isPaused = status?.state === 'paused';
  const quality: AudioQuality = status?.audioQuality || 'high';

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      const remMins = mins % 60;
      return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getQualityBadge = () => {
    if (quality === 'saver') {
      return {
        icon: Wifi,
        label: '節省流量',
        bitrate: '96k',
        color: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
      };
    }
    if (quality === 'voice') {
      return {
        icon: Mic,
        label: '純語音',
        bitrate: '64k',
        color: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
      };
    }
    return {
      icon: Sparkles,
      label: '高音質',
      bitrate: '320k',
      color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    };
  };

  const qualityBadge = getQualityBadge();
  const QualityIcon = qualityBadge.icon;

  return (
    <div
      id="now-playing-card"
      className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 shadow-xl text-zinc-100 transition-all"
    >
      {/* Ambient background glow when playing */}
      {isPlaying && (
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Header bar of the card */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-zinc-200 uppercase truncate">
              Linux 後台音訊串流
            </h2>
            <div className="text-[11px] sm:text-xs text-zinc-400 flex items-center gap-1.5 truncate">
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                  isPlaying
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : isPaused
                    ? 'bg-amber-400'
                    : isLoading
                    ? 'bg-blue-400 animate-ping'
                    : 'bg-zinc-500'
                }`}
              />
              <span className="truncate">
                {isPlaying && '正在播放 (Playing)'}
                {isPaused && '已暫停 (Paused)'}
                {isLoading && '解析串流中...'}
                {status?.state === 'idle' && '待命就緒 (Idle)'}
                {status?.state === 'error' && '播放錯誤 (Error)'}
              </span>
            </div>
          </div>
        </div>

        {/* Status badges: Quality + Backend daemon engine badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            id="badge-nowplaying-quality"
            title={`目前音質: ${qualityBadge.label} (${qualityBadge.bitrate})`}
            className={`flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 py-1 rounded-full border ${qualityBadge.color}`}
          >
            <QualityIcon className="w-3 h-3 shrink-0" />
            <span className="hidden xs:inline">{qualityBadge.label}</span>
            <span className="text-[9px] font-mono opacity-80">{qualityBadge.bitrate}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-300">
            <Server className="w-3 h-3 text-red-400 shrink-0" />
            <span className="hidden md:inline">mpv + yt-dlp</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>
      </div>

      {/* Main Track Display */}
      <div className="flex flex-row items-center gap-3.5 sm:gap-6 my-1 sm:my-2">
        {/* Album / Artwork Visualizer */}
        <div className="relative group shrink-0 w-20 h-20 xs:w-24 xs:h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700/60 shadow-md flex items-center justify-center">
          {status?.thumbnail ? (
            <img
              src={status.thumbnail}
              alt={status.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-500 p-2 text-center">
              <Disc3
                className={`w-8 h-8 sm:w-12 sm:h-12 text-zinc-600 ${
                  isPlaying ? 'animate-[spin_4s_linear_infinite] text-red-500/80' : ''
                }`}
              />
              <span className="text-[9px] sm:text-[10px] tracking-wider uppercase mt-1 text-zinc-400">Pure Audio</span>
            </div>
          )}

          {/* Equalizer Wave Overlay when playing */}
          {isPlaying && (
            <div className="absolute inset-x-0 bottom-0 h-8 sm:h-10 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center gap-0.5 sm:gap-1 px-2 pb-1.5">
              <span className="w-0.5 sm:w-1 bg-red-400 rounded-full animate-[bounce_0.8s_infinite] h-3 sm:h-4" />
              <span className="w-0.5 sm:w-1 bg-red-400 rounded-full animate-[bounce_0.6s_infinite_0.2s] h-5 sm:h-6" />
              <span className="w-0.5 sm:w-1 bg-red-400 rounded-full animate-[bounce_0.9s_infinite_0.4s] h-4 sm:h-5" />
              <span className="w-0.5 sm:w-1 bg-red-400 rounded-full animate-[bounce_0.7s_infinite_0.1s] h-6 sm:h-7" />
              <span className="w-0.5 sm:w-1 bg-red-400 rounded-full animate-[bounce_0.85s_infinite_0.3s] h-2 sm:h-3" />
            </div>
          )}
        </div>

        {/* Track Info Details */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono truncate max-w-[150px] sm:max-w-none">
              {status?.channel || 'YouTube 純音訊'}
            </span>
            {status?.backendInfo?.audioOutput && (
              <span className="text-[10px] sm:text-xs text-zinc-400 flex items-center gap-1">
                {status.isMuted ? (
                  <VolumeX className="w-3 h-3 text-zinc-500" />
                ) : (
                  <Volume2 className="w-3 h-3 text-emerald-400" />
                )}
                <span>{status.isMuted ? '靜音' : `${status.volume}%`}</span>
              </span>
            )}
          </div>

          <h1
            id="current-track-title"
            className="text-sm sm:text-lg md:text-xl font-bold text-zinc-100 line-clamp-2 tracking-tight mb-1 sm:mb-2 leading-tight"
            title={status?.title || '等待播放指令'}
          >
            {status?.title || '等待播放 YouTube 音樂...'}
          </h1>

          {status?.url ? (
            <p className="text-[11px] sm:text-xs text-zinc-400 font-mono truncate max-w-full mb-1 sm:mb-2" title={status.url}>
              🔗 {status.url}
            </p>
          ) : (
            <p className="text-[11px] sm:text-xs text-zinc-400 mb-1 sm:mb-2 line-clamp-1">
              輸入 YouTube 網址或點選下方推薦音樂試聽
            </p>
          )}

          {/* Time indicator */}
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono text-zinc-400">
            <span className="text-zinc-200 font-semibold">{formatTime(status?.position || 0)}</span>
            <span>/</span>
            <span>{formatTime(status?.duration || 0)}</span>
          </div>
        </div>
      </div>

      {/* Error alert banner if any */}
      {status?.lastError && (
        <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="truncate">{status.lastError}</span>
        </div>
      )}
    </div>
  );
};
