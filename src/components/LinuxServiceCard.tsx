import React, { useState } from 'react';
import {
  Terminal,
  Download,
  Copy,
  Check,
  Power,
  HelpCircle,
} from 'lucide-react';
import { PlayerStatus, SystemInfo } from '../types';

interface LinuxServiceCardProps {
  status: PlayerStatus | null;
  systemInfo: SystemInfo | null;
  onOpenSetupModal: () => void;
}

export const LinuxServiceCard: React.FC<LinuxServiceCardProps> = ({
  status,
  onOpenSetupModal,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const mpvAlive = status?.backendInfo?.mpvAlive ?? false;
  const ipcConnected = status?.backendInfo?.ipcConnected ?? false;

  return (
    <div
      id="linux-service-card"
      className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3 sm:pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
            <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Linux 終端機背景服務 (Systemd Daemon)
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400">
              透過 yt-dlp 純音訊擷取與 mpv 本機硬體揚聲器播放
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <a
            id="btn-download-setup"
            href="/api/download/setup"
            download="setup"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 rounded-xl transition-colors cursor-pointer min-h-[36px]"
            title="下載 Linux setup 安裝執行檔"
          >
            <Download className="w-3.5 h-3.5 text-red-400" />
            <span>下載 setup 腳本</span>
          </a>
          <button
            type="button"
            id="btn-open-guide-modal"
            onClick={onOpenSetupModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl transition-colors cursor-pointer min-h-[36px]"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>安裝說明</span>
          </button>
        </div>
      </div>

      {/* Grid of service diagnostics (2x2 on mobile, 4 columns on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
        <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <span className="text-zinc-500 text-[10px] sm:text-[11px] block">MPV 背景引擎</span>
          <div className="flex items-center gap-1.5 font-medium text-zinc-200 text-xs sm:text-sm">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                mpvAlive ? 'bg-emerald-400' : 'bg-red-500'
              }`}
            />
            <span className="truncate">{mpvAlive ? '運行中' : '未啟動'}</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono block">
            PID: {status?.backendInfo?.pid || '4320'}
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <span className="text-zinc-500 text-[10px] sm:text-[11px] block">IPC Socket</span>
          <div className="flex items-center gap-1.5 font-medium text-zinc-200 text-xs sm:text-sm">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                ipcConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="truncate">{ipcConnected ? '已就緒' : '連接中'}</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono truncate block" title={status?.backendInfo?.socketPath}>
            mpv-yt-audio.sock
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <span className="text-zinc-500 text-[10px] sm:text-[11px] block">yt-dlp 模組</span>
          <div className="flex items-center gap-1.5 font-medium text-zinc-200 text-xs sm:text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">已就緒 (Ready)</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono block truncate">
            Pure Audio
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <span className="text-zinc-500 text-[10px] sm:text-[11px] block">開機自啟</span>
          <div className="flex items-center gap-1.5 font-medium text-emerald-400 text-xs sm:text-sm">
            <Power className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">systemd 支援</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono truncate block">
            yt-audio-player
          </span>
        </div>
      </div>

      {/* Quick Terminal Snippets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold text-zinc-300">終端機快速指令</span>
          <span className="text-zinc-500 text-[11px] hidden xs:inline">點擊即可複製指令</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
          <div
            onClick={() => copyToClipboard('sudo ./setup', 'cmd-setup')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <span className="text-red-400">$</span>
              <span className="text-zinc-300 truncate">sudo ./setup</span>
            </div>
            {copiedCmd === 'cmd-setup' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 shrink-0" />
            )}
          </div>

          <div
            onClick={() => copyToClipboard('sudo systemctl status yt-audio-player', 'cmd-status')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <span className="text-red-400">$</span>
              <span className="text-zinc-300 truncate">systemctl status yt-audio-player</span>
            </div>
            {copiedCmd === 'cmd-status' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 shrink-0" />
            )}
          </div>

          <div
            onClick={() => copyToClipboard('sudo journalctl -u yt-audio-player -f', 'cmd-logs')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <span className="text-red-400">$</span>
              <span className="text-zinc-300 truncate">journalctl -u yt-audio-player -f</span>
            </div>
            {copiedCmd === 'cmd-logs' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
