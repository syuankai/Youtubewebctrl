import React, { useState } from 'react';
import {
  X,
  Terminal,
  Download,
  Copy,
  Check,
  Power,
  ShieldCheck,
  FolderArchive,
  ExternalLink,
  Layers,
  GitBranch,
} from 'lucide-react';

interface SetupInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupInstructionsModal: React.FC<SetupInstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'docker' | 'systemd'>('docker');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div
        id="setup-instructions-dialog"
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-700/80 p-4 sm:p-7 shadow-2xl text-zinc-100 space-y-5 my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 sm:pb-4 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-red-600/10 text-red-400 border border-red-500/20 shrink-0">
              <Terminal className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-zinc-100 truncate">
                服務部署與自啟動設定指南
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                支援 Docker 容器化一鍵啟動 (含 Redis 快取) 或 Linux 原生 systemd 守護服務
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('docker')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
              activeTab === 'docker'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate">Docker 容器 (含 Redis 快取)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('systemd')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
              activeTab === 'systemd'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">Linux 原生 systemd</span>
          </button>
        </div>

        {/* Tab Content: Docker */}
        {activeTab === 'docker' && (
          <div className="space-y-4 sm:space-y-5 text-sm">
            {/* Step 1: Docker Compose */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold shrink-0">
                  1
                </span>
                <span>使用 Docker Compose 啟動播放器 + Redis 服務 (推薦)</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 flex items-center justify-between border border-zinc-800/80 gap-2">
                <code className="truncate">docker compose up -d --build</code>
                <button
                  type="button"
                  onClick={() => copyText('docker compose up -d --build', 'docker-up')}
                  className="text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0 p-1"
                >
                  {copiedId === 'docker-up' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-zinc-400 pl-7">
                💡 <code className="text-zinc-300">docker-compose.yml</code> 會同時啟動 <code className="text-rose-400">redis:7-alpine</code> 快取容器與具備硬體音效存取權限 (ALSA/PulseAudio/PipeWire) 的播放器容器。
              </p>
            </div>

            {/* Step 2: Custom External Redis */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold shrink-0">
                  2
                </span>
                <span>連接外部或雲端部署的 Redis</span>
              </div>
              <p className="text-xs text-zinc-400 pl-7">
                若已有獨立部署的 Redis（如 AWS ElastiCache、Upstash 或自架伺服器），可在容器環境變數中設定 <code className="text-zinc-300 font-mono">REDIS_URL</code>，或直接於網頁控制台「Redis 快取」面板輸入連線字串套用：
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 flex items-center justify-between border border-zinc-800/80 gap-2">
                <code className="truncate">docker run -d --net=host -e REDIS_URL=redis://user:pass@192.168.1.50:6379/0 yt-audio-player</code>
                <button
                  type="button"
                  onClick={() => copyText('docker run -d --net=host -e REDIS_URL=redis://user:pass@192.168.1.50:6379/0 yt-audio-player', 'docker-run-redis')}
                  className="text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0 p-1"
                >
                  {copiedId === 'docker-run-redis' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Step 3: CI/CD GitHub Actions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold shrink-0">
                  3
                </span>
                <span className="flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                  GitHub Actions 自動建置與發布 Multi-Arch 鏡像
                </span>
              </div>
              <p className="text-xs text-zinc-400 pl-7">
                專案已設定 <code className="text-zinc-300 font-mono">.github/workflows/docker-build.yml</code>，每次 push 到 main 分支時會自動透過 Docker Buildx 構建 <code className="text-emerald-400 font-mono">linux/amd64</code> 與 <code className="text-emerald-400 font-mono">linux/arm64</code> (支援樹莓派) 雙架構鏡像，並推送至 GitHub Packages (GHCR)。
              </p>
            </div>
          </div>
        )}

        {/* Tab Content: Native Systemd */}
        {activeTab === 'systemd' && (
          <div className="space-y-4 sm:space-y-5 text-sm">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-red-400 shrink-0">
                    1
                  </span>
                  <span>下載或解壓縮並賦予執行權限</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 flex items-center justify-between border border-zinc-800/80 gap-2">
                  <code>chmod +x ./setup</code>
                  <button
                    type="button"
                    onClick={() => copyText('chmod +x ./setup', 'step1')}
                    className="text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0 p-1"
                  >
                    {copiedId === 'step1' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-red-400 shrink-0">
                    2
                  </span>
                  <span>執行 setup 自動安裝組件與 systemd 註冊</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 flex items-center justify-between border border-zinc-800/80 gap-2">
                  <code>sudo ./setup</code>
                  <button
                    type="button"
                    onClick={() => copyText('sudo ./setup', 'step2')}
                    className="text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0 p-1"
                  >
                    {copiedId === 'step2' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-400 pl-7">
                  💡 <code className="text-zinc-300">setup</code> 會自動：偵測系統安裝 mpv、ffmpeg、curl、nodejs、更新最新版 yt-dlp，建立 <code className="text-zinc-300">/etc/systemd/system/yt-audio-player.service</code>，並設定開機自啟動！
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-red-400 shrink-0">
                    3
                  </span>
                  <span>常用 systemd 指令</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div
                    onClick={() => copyText('sudo systemctl status yt-audio-player', 'cmd1')}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700"
                  >
                    <span className="text-zinc-300 truncate">systemctl status yt-audio-player</span>
                    {copiedId === 'cmd1' ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                  </div>

                  <div
                    onClick={() => copyText('sudo journalctl -u yt-audio-player -f', 'cmd2')}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700"
                  >
                    <span className="text-zinc-300 truncate">journalctl -u yt-audio-player -f</span>
                    {copiedId === 'cmd2' ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                  </div>

                  <div
                    onClick={() => copyText('sudo systemctl restart yt-audio-player', 'cmd3')}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700"
                  >
                    <span className="text-zinc-300 truncate">systemctl restart yt-audio-player</span>
                    {copiedId === 'cmd3' ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                  </div>

                  <div
                    onClick={() => copyText('sudo ./uninstall.sh', 'cmd4')}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700"
                  >
                    <span className="text-zinc-300 truncate">sudo ./uninstall.sh (移除)</span>
                    {copiedId === 'cmd4' ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-800 pt-3 sm:pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
          >
            關閉說明
          </button>
        </div>
      </div>
    </div>
  );
};
