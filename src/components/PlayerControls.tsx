import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  Link as LinkIcon,
  ClipboardPaste,
  Repeat,
  Repeat1,
} from 'lucide-react';
import { PlayerStatus } from '../types';

interface PlayerControlsProps {
  status: PlayerStatus | null;
  onPlay: (url: string) => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onTogglePause: () => Promise<void>;
  onSeek: (seconds: number) => Promise<void>;
  onSeekTo: (position: number) => Promise<void>;
  onVolumeChange: (volume: number) => Promise<void>;
  onToggleMute: () => Promise<void>;
  onStop: () => Promise<void>;
  onLoopChange: (loop: 'none' | 'one' | 'all') => Promise<void>;
  loading: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  status,
  onPlay,
  onTogglePause,
  onSeek,
  onSeekTo,
  onVolumeChange,
  onToggleMute,
  onStop,
  onLoopChange,
  loading,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localVolume, setLocalVolume] = useState(status?.volume ?? 80);

  // Sync volume state
  React.useEffect(() => {
    if (status?.volume !== undefined) {
      setLocalVolume(status.volume);
    }
  }, [status?.volume]);

  const isPlaying = status?.state === 'playing';
  const isPaused = status?.state === 'paused';
  const isLoading = status?.state === 'loading' || loading || isSubmitting;

  const handlePlaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    try {
      setIsSubmitting(true);
      await onPlay(urlInput.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
      }
    } catch {
      // clipboard access might be restricted in some iframes
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onSeekTo(val);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalVolume(val);
    onVolumeChange(val);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const duration = status?.duration || 100;
  const position = status?.position || 0;
  const progressPercent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const cycleLoopMode = () => {
    const current = status?.loop || 'none';
    if (current === 'none') onLoopChange('one');
    else if (current === 'one') onLoopChange('all');
    else onLoopChange('none');
  };

  return (
    <div id="player-controls-container" className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 shadow-xl space-y-5">
      {/* 1. YouTube URL Input Form */}
      <form onSubmit={handlePlaySubmit} className="space-y-2 sm:space-y-3">
        <label htmlFor="yt-url-input" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          輸入 YouTube 影片 / 音樂網址
        </label>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <LinkIcon className="w-4 h-4" />
            </div>
            <input
              id="yt-url-input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="貼上 YouTube 網址 (https://youtu.be/...)"
              className="w-full pl-9 pr-20 py-2.5 sm:py-3 text-xs sm:text-sm bg-zinc-950 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            />
            <div className="absolute inset-y-0 right-1 flex items-center">
              <button
                type="button"
                id="btn-paste-url"
                onClick={handlePaste}
                title="從剪貼簿貼上"
                className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer min-h-[36px]"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span className="text-[11px]">貼上</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="btn-submit-play"
            disabled={!urlInput.trim() || isLoading}
            className="px-5 py-2.5 sm:py-3 bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs sm:text-sm rounded-xl shadow-lg shadow-red-900/30 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer min-h-[42px]"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isLoading ? '載入中...' : '開始播放'}</span>
          </button>
        </div>
      </form>

      {/* 2. Timeline Progress Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="relative group flex items-center py-1">
          <input
            id="timeline-slider"
            type="range"
            min={0}
            max={status?.duration || 100}
            value={position}
            onChange={handleProgressChange}
            disabled={!status?.duration}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500 focus:outline-none"
            style={{
              background: `linear-gradient(to right, #ef4444 ${progressPercent}%, #27272a ${progressPercent}%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] sm:text-xs font-mono text-zinc-400 select-none">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 3. Main Playback Control Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 pt-1">
        {/* Core Actions: Loop, Rewind 5s, Play/Pause, Forward 5s, Stop */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3 w-full md:w-auto">
          {/* Loop mode button */}
          <button
            type="button"
            id="btn-loop-mode"
            onClick={cycleLoopMode}
            title={`目前循環模式: ${
              status?.loop === 'one' ? '單曲循環' : status?.loop === 'all' ? '全部循環' : '不循環'
            }`}
            className={`p-2.5 sm:p-3 rounded-xl border transition-all flex items-center justify-center text-xs cursor-pointer min-w-[42px] min-h-[42px] ${
              status?.loop !== 'none'
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {status?.loop === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>

          {/* Skip -5 seconds */}
          <button
            type="button"
            id="btn-seek-backward-5s"
            onClick={() => onSeek(-5)}
            disabled={status?.state === 'idle'}
            title="倒退 5 秒 (-5s)"
            className="group relative p-2.5 sm:p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700/60 transition-all cursor-pointer min-w-[42px] min-h-[42px] flex items-center justify-center"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-zinc-950 px-1 rounded text-red-400 border border-zinc-800">
              5s
            </span>
          </button>

          {/* Primary Play / Pause button */}
          <button
            type="button"
            id="btn-toggle-play"
            onClick={onTogglePause}
            disabled={status?.state === 'idle' && !status?.url}
            title={isPlaying ? '暫停播放' : '繼續播放'}
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-lg shadow-red-900/40 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
            ) : (
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white translate-x-0.5" />
            )}
          </button>

          {/* Skip +5 seconds */}
          <button
            type="button"
            id="btn-seek-forward-5s"
            onClick={() => onSeek(5)}
            disabled={status?.state === 'idle'}
            title="快轉 5 秒 (+5s)"
            className="group relative p-2.5 sm:p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700/60 transition-all cursor-pointer min-w-[42px] min-h-[42px] flex items-center justify-center"
          >
            <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-zinc-950 px-1 rounded text-red-400 border border-zinc-800">
              5s
            </span>
          </button>

          {/* Stop button */}
          <button
            type="button"
            id="btn-stop-audio"
            onClick={onStop}
            disabled={status?.state === 'idle'}
            title="停止播放"
            className="p-2.5 sm:p-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-95 text-zinc-400 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700/60 transition-all cursor-pointer min-w-[42px] min-h-[42px] flex items-center justify-center"
          >
            <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </button>
        </div>

        {/* Volume Control Slider & Mute Toggle */}
        <div className="flex items-center gap-2.5 w-full md:w-56 bg-zinc-950/60 md:bg-transparent p-2 md:p-0 rounded-xl border md:border-none border-zinc-800/80">
          <button
            type="button"
            id="btn-toggle-mute"
            onClick={onToggleMute}
            title={status?.isMuted ? '取消靜音' : '靜音'}
            className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer shrink-0 min-h-[36px]"
          >
            {status?.isMuted || localVolume === 0 ? (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            ) : localVolume < 50 ? (
              <Volume1 className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          <div className="flex-1 flex items-center gap-2">
            <input
              id="volume-slider"
              type="range"
              min={0}
              max={100}
              value={status?.isMuted ? 0 : localVolume}
              onChange={handleVolumeChange}
              title={`音量: ${localVolume}%`}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500 focus:outline-none"
            />
            <span className="text-xs font-mono text-zinc-400 w-8 text-right select-none">
              {status?.isMuted ? '0%' : `${localVolume}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
