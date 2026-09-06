import React, { useState } from 'react';
import { Play, Trash2, Clock, Music2, Sparkles, ListPlus } from 'lucide-react';
import { QueueItem, HistoryItem } from '../types';

interface PlaylistQueueProps {
  queue: QueueItem[];
  history: HistoryItem[];
  onPlay: (url: string, title?: string) => Promise<void>;
  onRemoveQueue: (id: string) => void;
  onClearQueue: () => void;
}

const SAMPLE_STREAMS = [
  {
    title: 'Lofi Chill Study Radio',
    channel: '24/7 Lo-Fi Beats',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    badge: '即時串流',
  },
  {
    title: 'Synthwave / Retro Electro Radio',
    channel: 'Night Drive Cyberpunk',
    url: 'https://stream.zeno.fm/0r0xa792kwzuv',
    badge: '電子音樂',
  },
  {
    title: 'Relaxing Coffee Shop Jazz',
    channel: 'Smooth Acoustic Jazz',
    url: 'https://stream.zeno.fm/s4932ubmg8uv',
    badge: '爵士放鬆',
  },
  {
    title: 'Classical Peaceful Piano',
    channel: 'Piano Solo Classics',
    url: 'https://stream.zeno.fm/cvm02p2mg8uv',
    badge: '古典鋼琴',
  },
];

export const PlaylistQueue: React.FC<PlaylistQueueProps> = ({
  queue,
  history,
  onPlay,
  onRemoveQueue,
  onClearQueue,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'history' | 'queue'>('presets');

  return (
    <div id="playlist-queue-container" className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 shadow-xl space-y-4">
      {/* Tabs Row with Mobile Horizontal Scroll */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            id="tab-presets"
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer min-h-[36px] ${
              activeTab === 'presets'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>快速試聽</span>
          </button>
          <button
            type="button"
            id="tab-history"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer min-h-[36px] ${
              activeTab === 'history'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>歷史 ({history.length})</span>
          </button>
          <button
            type="button"
            id="tab-queue"
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer min-h-[36px] ${
              activeTab === 'queue'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>待播 ({queue.length})</span>
          </button>
        </div>

        {activeTab === 'queue' && queue.length > 0 && (
          <button
            type="button"
            onClick={onClearQueue}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 shrink-0 p-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">清空</span>
          </button>
        )}
      </div>

      {/* Tab: Presets */}
      {activeTab === 'presets' && (
        <div className="space-y-2.5">
          <p className="text-[11px] sm:text-xs text-zinc-400">
            點選推薦串流，即可直接測試 Linux 後台播放、暫停、跳轉 5 秒與音量調整：
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            {SAMPLE_STREAMS.map((item, idx) => (
              <div
                key={idx}
                id={`preset-stream-${idx}`}
                onClick={() => onPlay(item.url, item.title)}
                className="group p-2.5 sm:p-3 rounded-xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-red-500/30 cursor-pointer transition-all flex items-center justify-between gap-2.5 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center text-zinc-400 transition-colors shrink-0">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-zinc-200 truncate group-hover:text-red-300 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate">{item.channel}</p>
                  </div>
                </div>
                <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              <Music2 className="w-7 h-7 mx-auto mb-2 opacity-40" />
              尚未有播放紀錄，貼上 YouTube 網址即可開始聆聽。
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => onPlay(item.url, item.title)}
                className="group p-2.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/70 hover:border-zinc-700 cursor-pointer transition-all flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Play className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400 shrink-0" />
                  <span className="text-xs text-zinc-200 truncate group-hover:text-red-200">
                    {item.title}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                  {new Date(item.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {queue.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              <ListPlus className="w-7 h-7 mx-auto mb-2 opacity-40" />
              待播清單是空的
            </div>
          ) : (
            queue.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-zinc-200 truncate">{item.title}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlay(item.url, item.title)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="立即播放"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveQueue(item.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="移除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
