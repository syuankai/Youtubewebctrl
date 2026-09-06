import React, { useState, useEffect } from 'react';
import { Volume2, RefreshCw, AlertCircle, Check, Headphones, Radio, Cpu } from 'lucide-react';
import { SoundCardDevice } from '../types';

interface SoundCardSelectorProps {
  onDeviceChange?: (deviceId: string) => void;
  compact?: boolean;
}

export const SoundCardSelector: React.FC<SoundCardSelectorProps> = ({ onDeviceChange, compact = false }) => {
  const [devices, setDevices] = useState<SoundCardDevice[]>([]);
  const [currentDevice, setCurrentDevice] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [switching, setSwitching] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const fetchSoundCards = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/soundcards');
      const data = await res.json();
      if (data.success && Array.isArray(data.devices) && data.devices.length > 0) {
        setDevices(data.devices);
        setCurrentDevice(data.currentDevice || data.devices[0].id);
        setErrorText(null);
      } else {
        // As requested: 如果讀取失敗或無音效卡，網頁端回傳［無裝置］
        setDevices([]);
        setCurrentDevice('');
        setErrorText('無裝置');
      }
    } catch {
      setDevices([]);
      setCurrentDevice('');
      setErrorText('無裝置');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSoundCards();
  }, []);

  const handleSelectDevice = async (deviceId: string) => {
    setSwitching(true);
    try {
      const res = await fetch('/api/soundcards/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentDevice(deviceId);
        if (onDeviceChange) onDeviceChange(deviceId);
      }
    } catch {
      // ignore
    } finally {
      setSwitching(false);
      setIsOpen(false);
    }
  };

  const getDeviceIcon = (dev: SoundCardDevice) => {
    if (dev.type === 'bluetooth') return <Headphones className="w-4 h-4 text-sky-400 shrink-0" />;
    if (dev.type === 'pulse' || dev.type === 'pipewire') return <Radio className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />;
  };

  const selectedDeviceObj = devices.find((d) => d.id === currentDevice);

  return (
    <div id="soundcard-selector-container" className="relative">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {!compact && (
          <label className="text-xs font-semibold text-zinc-400 tracking-wider hidden sm:flex items-center gap-1.5 whitespace-nowrap">
            <Cpu className="w-3.5 h-3.5 text-red-400" />
            聲卡
          </label>
        )}

        {loading ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-850 border border-zinc-700/60 text-xs text-zinc-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            <span className="hidden xs:inline">讀取音效...</span>
          </div>
        ) : errorText || devices.length === 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono font-bold">[無裝置]</span>
            <button
              type="button"
              id="btn-retry-soundcards"
              onClick={fetchSoundCards}
              title="重新偵測聲卡"
              className="ml-1 p-1 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              id="soundcard-dropdown-btn"
              onClick={() => setIsOpen(!isOpen)}
              disabled={switching}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 transition-all cursor-pointer shadow-sm active:scale-98 max-w-[180px] xs:max-w-[220px] sm:max-w-[260px]"
            >
              {selectedDeviceObj ? getDeviceIcon(selectedDeviceObj) : <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              <span className="truncate font-medium text-[11px] sm:text-xs">
                {selectedDeviceObj ? selectedDeviceObj.name : currentDevice || '自動選擇'}
              </span>
              <span className="text-zinc-500 text-[10px] shrink-0">▼</span>
            </button>

            {isOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
                  onClick={() => setIsOpen(false)}
                />
                <div
                  id="soundcard-dropdown-menu"
                  className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-72 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 z-50 divide-y divide-zinc-800 text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-2.5 py-1.5 flex items-center justify-between text-zinc-400 font-medium">
                    <span>可用音效輸出裝置 ({devices.length})</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchSoundCards();
                      }}
                      className="p-1 hover:text-white rounded transition-colors cursor-pointer"
                      title="刷新音效清單"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="pt-1 space-y-1">
                    {devices.map((dev) => {
                      const isSelected = dev.id === currentDevice;
                      return (
                        <button
                          key={dev.id}
                          type="button"
                          id={`soundcard-item-${dev.id.replace(/[^a-zA-Z0-9]/g, '_')}`}
                          onClick={() => handleSelectDevice(dev.id)}
                          className={`w-full text-left px-2.5 py-2.5 rounded-lg flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-red-500/15 text-red-300 font-medium border border-red-500/30'
                              : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            {getDeviceIcon(dev)}
                            <div className="truncate min-w-0">
                              <p className="truncate font-medium text-xs">{dev.name}</p>
                              <p className="text-[10px] text-zinc-500 font-mono truncate">{dev.id}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-red-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
