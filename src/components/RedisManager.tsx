import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Server,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  HardDrive,
  Activity,
} from 'lucide-react';
import { RedisCacheStatus } from '../types';

interface RedisManagerProps {
  onCacheUpdated?: () => void;
}

export const RedisManager: React.FC<RedisManagerProps> = ({ onCacheUpdated }) => {
  const [status, setStatus] = useState<RedisCacheStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; pingMs: number | null; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/redis/status');
      if (res.ok) {
        const data: RedisCacheStatus = await res.json();
        setStatus(data);
        if (data.isCustomConfig && data.redisUrl) {
          setCustomUrl(data.redisUrl);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleTestConnection = async () => {
    if (!customUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/redis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redisUrl: customUrl.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setFeedback(`測試連線成功！Ping 延遲: ${data.pingMs} ms`);
      } else {
        setFeedback(`連線失敗: ${data.error}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, pingMs: null, error: err.message });
      setFeedback(`測試失敗: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleApplyConfig = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/redis/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redisUrl: customUrl.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(customUrl.trim() ? '已成功套用自訂 Redis 連線！' : '已重設並還原 Redis 設定！');
        setStatus(data.status);
        if (onCacheUpdated) onCacheUpdated();
      } else {
        setFeedback(`套用失敗: ${data.error || '請檢查格式'}`);
      }
    } catch (err: any) {
      setFeedback(`套用出錯: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/redis/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFeedback(`已清空快取 (${data.clearedKeys} 筆項目)`);
        setConfirmClear(false);
        fetchStatus();
        if (onCacheUpdated) onCacheUpdated();
      }
    } catch (err: any) {
      setFeedback(`清空失敗: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  const isConnected = status?.connected ?? false;
  const isEnabled = status?.enabled ?? false;

  return (
    <div
      id="redis-manager-container"
      className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-sm transition-all space-y-3 sm:space-y-4"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${
              isConnected
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : isEnabled
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            <Database className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                Redis 高速緩存加速
              </h3>
              {/* Connection Badge */}
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  已連線
                </span>
              ) : isEnabled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  重試中
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                  <HardDrive className="w-3 h-3" />
                  本機 LRU
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate">
              快取 YouTube 串流網址與歌曲元資訊，大幅降低解析延遲
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="p-1.5 sm:p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="重新讀取 Redis 狀態"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-all cursor-pointer min-h-[36px]"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden xs:inline">自訂</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Metrics Row (2x2 on mobile, 4 columns on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Metric 1: Ping / Mode */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5">
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium flex items-center gap-1">
            <Activity className="w-3 h-3 text-zinc-400" />
            {isConnected ? '延遲 (Ping)' : '運行模式'}
          </div>
          <div className="text-xs sm:text-sm font-semibold text-zinc-200 mt-1">
            {isConnected && status?.pingMs !== null ? (
              <span className="text-emerald-400 font-mono">{status.pingMs} ms</span>
            ) : isConnected ? (
              <span className="text-emerald-400">已就緒</span>
            ) : (
              <span className="text-zinc-400">LRU 記憶體</span>
            )}
          </div>
        </div>

        {/* Metric 2: Keys Count */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5">
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            快取項目數
          </div>
          <div className="text-xs sm:text-sm font-semibold text-zinc-200 mt-1 font-mono truncate">
            {status ? `${status.keysCount} 筆` : '--'}
          </div>
        </div>

        {/* Metric 3: Hit Rate */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5">
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-sky-400" />
            命中率
          </div>
          <div className="text-xs sm:text-sm font-semibold text-zinc-200 mt-1 font-mono truncate">
            {status ? `${status.hitRate}%` : '0%'}
          </div>
        </div>

        {/* Metric 4: Memory Usage */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5">
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium flex items-center gap-1">
            <Server className="w-3 h-3 text-purple-400" />
            快取記憶體
          </div>
          <div className="text-xs sm:text-sm font-semibold text-zinc-200 mt-1 truncate font-mono" title={status?.memoryUsed}>
            {status?.memoryUsed || '--'}
          </div>
        </div>
      </div>

      {/* Expanded Custom Redis Configuration Section */}
      {isExpanded && (
        <div className="pt-3 border-t border-zinc-800/80 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              自訂部署的 Redis 連線字串 (Redis URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="redis://:password@192.168.1.100:6379/0 或 redis://localhost:6379"
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700/80 rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !customUrl.trim()}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 min-h-[36px]"
                >
                  <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : 'text-sky-400'}`} />
                  <span>測試連線</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyConfig}
                  disabled={saving}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 min-h-[36px]"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                  <span>套用連線</span>
                </button>
              </div>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-1">
              密碼含有特殊符號時請進行 URL encode，例如 <code>redis://default:mypassword@redis-host:6379</code>。若留空套用則還原為預設。
            </p>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-2.5 rounded-lg text-xs border ${
                testResult?.success || feedback.includes('成功')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback}
            </div>
          )}

          {/* Docker & Deployment Hint */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-400 space-y-2">
            <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-rose-400" />
              如何透過 Docker 快速啟動自己的 Redis 服務？
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              在終端機執行下列指令，即可在背景建立獨立的 Redis 容器並自動持久化：
            </p>
            <pre className="p-2 bg-zinc-900 rounded border border-zinc-800 text-[11px] text-zinc-300 font-mono overflow-x-auto select-all">
              docker run -d --name my-redis -p 6379:6379 -v redis-data:/data redis:7-alpine redis-server --appendonly yes
            </pre>
            <p className="text-[11px] text-zinc-500">
              啟動後，於上方輸入 <code>redis://localhost:6379</code> 或在 Docker Compose 內直接連結即可享受快取加速！
            </p>
          </div>

          {/* Action Row with Inline Confirmation for Clear */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={clearing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer min-h-[34px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空快取暫存 ({status?.keysCount || 0} 筆)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 p-1 bg-zinc-950 rounded-lg border border-rose-500/40">
                <span className="text-xs text-rose-300 px-1 font-medium">確定要清空快取？</span>
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={clearing}
                  className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded font-medium cursor-pointer"
                >
                  {clearing ? '清空中...' : '確認清空'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  取消
                </button>
              </div>
            )}

            {status?.isCustomConfig && (
              <button
                type="button"
                onClick={() => {
                  setCustomUrl('');
                  handleApplyConfig();
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 cursor-pointer"
              >
                重設為系統預設 / 清除自訂 Redis
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
