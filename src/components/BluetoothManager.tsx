import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  BluetoothSearching,
  BluetoothConnected,
  BluetoothOff,
  RefreshCw,
  Power,
  Trash2,
  AlertTriangle,
  Headphones,
  Sliders,
} from 'lucide-react';
import { BluetoothDevice, BluetoothStatus } from '../types';

interface BluetoothManagerProps {
  onAudioDeviceChanged?: () => void;
}

export const BluetoothManager: React.FC<BluetoothManagerProps> = ({ onAudioDeviceChanged }) => {
  const [status, setStatus] = useState<BluetoothStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bluetooth/status');
      const data = await res.json();
      setStatus(data);
      setScanning(Boolean(data.scanning));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleStartScan = async () => {
    setScanning(true);
    setNotice({ type: 'info', text: '正在搜尋周圍藍芽音訊裝置 (10秒)...' });
    try {
      const res = await fetch('/api/bluetooth/scan', { method: 'POST' });
      const data = await res.json();
      if (data.message) {
        setNotice({ type: data.success ? 'success' : 'error', text: data.message });
      }
      setTimeout(fetchStatus, 2000);
    } catch (err: any) {
      setNotice({ type: 'error', text: '啟動掃描失敗: ' + (err.message || '未知錯誤') });
    }
  };

  const handleConnect = async (mac: string, name: string) => {
    setActionInProgress(mac);
    setNotice({ type: 'info', text: `正在連線至 ${name}...` });
    try {
      const res = await fetch('/api/bluetooth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ type: 'success', text: `已成功連線至 ${name}` });
        if (onAudioDeviceChanged) onAudioDeviceChanged();
      } else {
        setNotice({ type: 'error', text: data.message || '連線失敗' });
      }
      await fetchStatus();
    } catch (err: any) {
      setNotice({ type: 'error', text: '連線錯誤: ' + (err.message || '未知錯誤') });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDisconnect = async (mac: string, name: string) => {
    setActionInProgress(mac);
    try {
      const res = await fetch('/api/bluetooth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac }),
      });
      const data = await res.json();
      setNotice({ type: 'info', text: data.message || `已中斷與 ${name} 的連線` });
      await fetchStatus();
      if (onAudioDeviceChanged) onAudioDeviceChanged();
    } catch (err: any) {
      setNotice({ type: 'error', text: '中斷失敗: ' + (err.message || '未知錯誤') });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemove = async (mac: string) => {
    try {
      const res = await fetch(`/api/bluetooth/device/${encodeURIComponent(mac)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      setNotice({ type: 'info', text: data.message || '已移除配對資訊' });
      await fetchStatus();
    } catch (err: any) {
      setNotice({ type: 'error', text: '移除失敗: ' + (err.message || '未知錯誤') });
    }
  };

  const handleTogglePower = async (currentPower: boolean) => {
    try {
      const res = await fetch('/api/bluetooth/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ power: !currentPower }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => (prev ? { ...prev, powered: !currentPower } : null));
        setNotice({ type: 'info', text: !currentPower ? '已開啟藍芽控制器' : '已關閉藍芽控制器' });
      }
    } catch {
      // ignore
    }
  };

  const connectedList = status?.connectedDevices || [];
  const discoveredList = (status?.discoveredDevices || []).filter(
    (d) => !connectedList.some((c) => c.mac.toUpperCase() === d.mac.toUpperCase())
  );

  return (
    <div
      id="bluetooth-manager-container"
      className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-6 shadow-xl space-y-4"
    >
      {/* Header with Title and Control Buttons */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border shrink-0 ${
              status?.hasAdapter
                ? status?.powered
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
          >
            {status?.hasAdapter ? (
              status?.powered ? (
                <Bluetooth className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
              ) : (
                <BluetoothOff className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500" />
              )
            ) : (
              <Bluetooth className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-100 text-xs sm:text-sm tracking-wide truncate">
                藍芽音訊設備連線
              </h3>
              {status?.hasAdapter && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    status.powered ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {status.powered ? '已啟用' : '已關閉'}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate">
              {status?.adapterName || 'Linux 藍芽控制器管理與揚聲器配對'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {status?.hasAdapter && (
            <button
              type="button"
              id="btn-toggle-bt-power"
              onClick={() => handleTogglePower(status.powered)}
              title={status.powered ? '關閉藍芽' : '開啟藍芽'}
              className={`p-2 rounded-xl border transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                status.powered
                  ? 'bg-sky-500/20 border-sky-500/30 text-sky-400 hover:bg-sky-500/30'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Power className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            id="btn-scan-bluetooth"
            onClick={handleStartScan}
            disabled={scanning}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer min-h-[38px] ${
              scanning
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 cursor-wait'
                : 'bg-zinc-800 hover:bg-zinc-750 border-zinc-700 text-zinc-200'
            }`}
          >
            {scanning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>掃描中...</span>
              </>
            ) : (
              <>
                <BluetoothSearching className="w-3.5 h-3.5 text-sky-400" />
                <span>搜尋設備</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notice Message */}
      {notice && (
        <div
          className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between border ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : notice.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
          }`}
        >
          <span className="truncate pr-2">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs text-zinc-400 hover:text-white p-1 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hardware Container Alert */}
      {!status?.hasAdapter && (
        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-start gap-2.5 sm:gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-zinc-200">未偵測到實體藍芽控制器</p>
            <p className="text-zinc-400 leading-relaxed text-[11px] sm:text-xs">
              當前運行於雲端容器環境。在實體 Linux 樹莓派或迷你主機上運行時，請插入 USB 藍芽接收器並執行{' '}
              <code className="px-1.5 py-0.5 rounded bg-zinc-900 font-mono text-red-300">sudo ./setup</code>，
              腳本將自動安裝 BlueZ 驅動並設定音訊傳輸。
            </p>
          </div>
        </div>
      )}

      {/* Connected Devices Section */}
      {connectedList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <BluetoothConnected className="w-4 h-4" />
              已連線之藍芽音訊設備 ({connectedList.length})
            </span>
          </div>

          <div className="grid gap-2">
            {connectedList.map((dev) => (
              <div
                key={dev.mac}
                id={`bt-device-connected-${dev.mac.replace(/:/g, '_')}`}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 gap-2"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">{dev.name}</p>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-medium shrink-0">
                        已連線
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-mono truncate">{dev.mac}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    id={`btn-disconnect-${dev.mac.replace(/:/g, '_')}`}
                    onClick={() => handleDisconnect(dev.mac, dev.name)}
                    disabled={actionInProgress === dev.mac}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer min-h-[36px]"
                  >
                    {actionInProgress === dev.mac ? '處理中...' : '中斷連線'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovered / Available Devices Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
          <span>周邊藍芽耳機 / 揚聲器清單 ({discoveredList.length})</span>
          <span className="text-[10px] sm:text-[11px] text-zinc-500 hidden xs:inline">點擊連線即可串流輸出</span>
        </div>

        {discoveredList.length === 0 ? (
          <div className="text-center py-5 border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500 space-y-1">
            <BluetoothSearching className="w-5 h-5 mx-auto text-zinc-600 mb-1" />
            <p>尚未搜尋到周邊藍芽裝置</p>
            <p className="text-[11px] text-zinc-600">請將藍芽耳機或喇叭設為「配對模式」，然後點擊「搜尋設備」</p>
          </div>
        ) : (
          <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
            {discoveredList.map((dev) => {
              const isConnecting = actionInProgress === dev.mac;
              return (
                <div
                  key={dev.mac}
                  id={`bt-device-item-${dev.mac.replace(/:/g, '_')}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-all text-xs gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        dev.connected
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-zinc-200 truncate">{dev.name}</span>
                        {dev.paired && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 shrink-0">
                            已配對
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">{dev.mac}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {dev.connected ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnect(dev.mac, dev.name)}
                        disabled={isConnecting}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 min-h-[34px] cursor-pointer"
                      >
                        {isConnecting ? '處理中...' : '中斷'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`btn-connect-${dev.mac.replace(/:/g, '_')}`}
                        onClick={() => handleConnect(dev.mac, dev.name)}
                        disabled={isConnecting}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-sm transition-all active:scale-95 min-h-[34px] cursor-pointer"
                      >
                        {isConnecting ? '連線中...' : '連線'}
                      </button>
                    )}

                    {dev.paired && !dev.connected && (
                      <button
                        type="button"
                        onClick={() => handleRemove(dev.mac)}
                        title="解除配對"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
