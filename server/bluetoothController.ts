import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface BluetoothDevice {
  mac: string;
  name: string;
  rssi?: number;
  paired: boolean;
  connected: boolean;
  trusted?: boolean;
  isAudio?: boolean;
}

export interface BluetoothStatusResponse {
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

class BluetoothController {
  private isScanning = false;
  private scanTimeoutTimer: NodeJS.Timeout | null = null;
  private discoveredDevices = new Map<string, BluetoothDevice>();
  private simulatedDevices = new Map<string, BluetoothDevice>([
    [
      '00:1B:66:82:11:22',
      {
        mac: '00:1B:66:82:11:22',
        name: 'Sony WH-1000XM5 (藍芽耳機)',
        paired: true,
        connected: false,
        trusted: true,
        isAudio: true,
        rssi: -58,
      },
    ],
    [
      'A4:C1:38:D9:88:99',
      {
        mac: 'A4:C1:38:D9:88:99',
        name: 'JBL Flip 6 (可攜式藍芽喇叭)',
        paired: false,
        connected: false,
        trusted: false,
        isAudio: true,
        rssi: -64,
      },
    ],
    [
      'F8:4E:17:33:55:77',
      {
        mac: 'F8:4E:17:33:55:77',
        name: 'Bose SoundLink Revolve',
        paired: false,
        connected: false,
        trusted: false,
        isAudio: true,
        rssi: -72,
      },
    ],
  ]);

  private hasRealAdapter(): Promise<boolean> {
    return new Promise((resolve) => {
      // 1. Check /sys/class/bluetooth
      if (fs.existsSync('/sys/class/bluetooth')) {
        try {
          const files = fs.readdirSync('/sys/class/bluetooth');
          if (files.some((f) => f.startsWith('hci'))) {
            return resolve(true);
          }
        } catch {
          // ignore
        }
      }

      // 2. Try hciconfig or rfkill
      exec('rfkill list bluetooth 2>/dev/null || hciconfig 2>/dev/null', { timeout: 1500 }, (err, stdout) => {
        if (!err && stdout && (stdout.includes('hci') || stdout.includes('Bluetooth'))) {
          return resolve(true);
        }
        resolve(false);
      });
    });
  }

  private isBluetoothServiceActive(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('systemctl is-active bluetooth 2>/dev/null || pgrep -x bluetoothd', { timeout: 1500 }, (err, stdout) => {
        if (!err && (stdout.includes('active') || stdout.trim().length > 0)) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  public async getStatus(): Promise<BluetoothStatusResponse> {
    const hasAdapter = await this.hasRealAdapter();
    const serviceRunning = await this.isBluetoothServiceActive();

    if (!hasAdapter) {
      // Container or hardware without bluetooth adapter
      const paired = Array.from(this.simulatedDevices.values()).filter((d) => d.paired);
      const connected = Array.from(this.simulatedDevices.values()).filter((d) => d.connected);
      const discovered = Array.from(this.simulatedDevices.values());

      return {
        hasAdapter: false,
        adapterName: '未偵測到實體藍芽控制器',
        adapterMac: undefined,
        powered: false,
        serviceRunning,
        scanning: this.isScanning,
        connectedDevices: connected,
        pairedDevices: paired,
        discoveredDevices: discovered,
        statusText: serviceRunning
          ? '藍芽守護進程運行中，但未偵測到實體藍芽控制器 (hci0)'
          : '未偵測到藍芽硬體 (實體主機請執行 sudo ./setup 並插入 USB 藍芽轉接器)',
        error: '未偵測到實體藍芽硬體適配器',
      };
    }

    // Real adapter present, query bluetoothctl
    return new Promise((resolve) => {
      exec('timeout 2 bluetoothctl show 2>/dev/null', { timeout: 2500 }, (err, stdout) => {
        const output = stdout || '';
        const powered = output.includes('Powered: yes');
        const nameMatch = output.match(/Name:\s+(.*)/i);
        const macMatch = output.match(/Controller\s+([0-9A-F:]{17})/i);

        const adapterName = nameMatch ? nameMatch[1].trim() : 'Linux Bluetooth Adapter';
        const adapterMac = macMatch ? macMatch[1].trim() : undefined;

        // Query paired and connected devices
        exec('timeout 2 bluetoothctl devices 2>/dev/null', { timeout: 2500 }, (dErr, dStdout) => {
          const deviceLines = (dStdout || '').split('\n').filter(Boolean);
          const realDevices: BluetoothDevice[] = [];

          for (const line of deviceLines) {
            // format: Device XX:XX:XX:XX:XX:XX Name
            const match = line.match(/^Device\s+([0-9A-F:]{17})\s+(.*)/i);
            if (match) {
              const mac = match[1].trim();
              const name = match[2].trim();
              realDevices.push({
                mac,
                name: name || mac,
                paired: true,
                connected: false, // will update below
                isAudio: true,
              });
            }
          }

          // Check connected devices
          exec('timeout 2 bluetoothctl devices Connected 2>/dev/null', { timeout: 2500 }, (cErr, cStdout) => {
            const connectedLines = (cStdout || '').split('\n').filter(Boolean);
            const connectedMacs = new Set<string>();

            for (const line of connectedLines) {
              const match = line.match(/^Device\s+([0-9A-F:]{17})/i);
              if (match) connectedMacs.add(match[1].trim());
            }

            for (const dev of realDevices) {
              if (connectedMacs.has(dev.mac)) {
                dev.connected = true;
              }
            }

            // Include any devices found in current scan
            const allDiscovered = [...realDevices];
            this.discoveredDevices.forEach((dev) => {
              if (!allDiscovered.some((d) => d.mac.toLowerCase() === dev.mac.toLowerCase())) {
                allDiscovered.push(dev);
              }
            });

            const connected = allDiscovered.filter((d) => d.connected);
            const paired = allDiscovered.filter((d) => d.paired);

            resolve({
              hasAdapter: true,
              adapterName,
              adapterMac,
              powered,
              serviceRunning,
              scanning: this.isScanning,
              connectedDevices: connected,
              pairedDevices: paired,
              discoveredDevices: allDiscovered,
              statusText: powered
                ? `藍芽已就緒 (${adapterName})${connected.length > 0 ? ` - 已連線至 ${connected[0].name}` : ''}`
                : '藍芽已停用 (電源已關閉)',
            });
          });
        });
      });
    });
  }

  public async startScan(): Promise<{ success: boolean; message: string }> {
    const hasAdapter = await this.hasRealAdapter();

    this.isScanning = true;
    if (this.scanTimeoutTimer) clearTimeout(this.scanTimeoutTimer);

    this.scanTimeoutTimer = setTimeout(() => {
      this.isScanning = false;
      if (hasAdapter) {
        exec('bluetoothctl scan off 2>/dev/null || true');
      }
    }, 10000);

    if (!hasAdapter) {
      // In simulated / container mode: simulate discovery of nearby audio devices
      return {
        success: true,
        message: '已開始掃描周邊藍芽音訊設備 (持續 10 秒)',
      };
    }

    return new Promise((resolve) => {
      // Start background scan with bluetoothctl
      exec('timeout 8 bluetoothctl scan on 2>/dev/null &', { timeout: 2000 }, (err) => {
        resolve({
          success: !err,
          message: err ? '啟動藍芽掃描失敗' : '已啟動藍芽掃描，正在搜尋周邊裝置...',
        });
      });
    });
  }

  public async stopScan(): Promise<void> {
    this.isScanning = false;
    if (this.scanTimeoutTimer) {
      clearTimeout(this.scanTimeoutTimer);
      this.scanTimeoutTimer = null;
    }
    const hasAdapter = await this.hasRealAdapter();
    if (hasAdapter) {
      exec('bluetoothctl scan off 2>/dev/null || true');
    }
  }

  public async connectDevice(mac: string): Promise<{ success: boolean; message: string }> {
    const hasAdapter = await this.hasRealAdapter();

    if (!hasAdapter) {
      // Simulated container connection
      const dev = this.simulatedDevices.get(mac);
      if (dev) {
        // Disconnect other simulated devices first
        this.simulatedDevices.forEach((d) => {
          d.connected = false;
        });
        dev.connected = true;
        dev.paired = true;
        dev.trusted = true;
        return {
          success: true,
          message: `已成功連線至藍芽設備: ${dev.name}`,
        };
      }
      return { success: false, message: '找不到指定的藍芽裝置' };
    }

    return new Promise((resolve) => {
      // Trust, pair, and connect
      const cmd = `bluetoothctl trust "${mac}" && bluetoothctl pair "${mac}" ; timeout 10 bluetoothctl connect "${mac}"`;
      exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
        const output = (stdout || '') + (stderr || '');
        if (output.includes('Connection successful') || output.includes('Connected: yes')) {
          resolve({ success: true, message: `已成功連線至 ${mac}` });
        } else if (!err) {
          resolve({ success: true, message: `連線指令已發送至 ${mac}` });
        } else {
          resolve({
            success: false,
            message: `連線失敗: ${output.slice(0, 100) || err.message}`,
          });
        }
      });
    });
  }

  public async disconnectDevice(mac: string): Promise<{ success: boolean; message: string }> {
    const hasAdapter = await this.hasRealAdapter();

    if (!hasAdapter) {
      const dev = this.simulatedDevices.get(mac);
      if (dev) {
        dev.connected = false;
        return { success: true, message: `已中斷連線: ${dev.name}` };
      }
      return { success: false, message: '找不到指定的藍芽裝置' };
    }

    return new Promise((resolve) => {
      exec(`timeout 5 bluetoothctl disconnect "${mac}"`, { timeout: 6000 }, (err, stdout) => {
        if (!err && (stdout.includes('Successful') || stdout.includes('Disconnected'))) {
          resolve({ success: true, message: `已成功中斷與 ${mac} 的連線` });
        } else {
          resolve({ success: true, message: `已發送中斷指令至 ${mac}` });
        }
      });
    });
  }

  public async pairDevice(mac: string): Promise<{ success: boolean; message: string }> {
    const hasAdapter = await this.hasRealAdapter();

    if (!hasAdapter) {
      const dev = this.simulatedDevices.get(mac);
      if (dev) {
        dev.paired = true;
        dev.trusted = true;
        return { success: true, message: `已成功配對: ${dev.name}` };
      }
      return { success: false, message: '找不到指定的藍芽裝置' };
    }

    return new Promise((resolve) => {
      exec(`bluetoothctl trust "${mac}" && timeout 10 bluetoothctl pair "${mac}"`, { timeout: 12000 }, (err, stdout) => {
        resolve({
          success: !err,
          message: !err ? `配對成功: ${mac}` : `配對失敗: ${(stdout || '').slice(0, 80)}`,
        });
      });
    });
  }

  public async removeDevice(mac: string): Promise<{ success: boolean; message: string }> {
    const hasAdapter = await this.hasRealAdapter();

    if (!hasAdapter) {
      const dev = this.simulatedDevices.get(mac);
      if (dev) {
        dev.paired = false;
        dev.connected = false;
        return { success: true, message: `已解除配對: ${dev.name}` };
      }
      return { success: false, message: '找不到指定的藍芽裝置' };
    }

    return new Promise((resolve) => {
      exec(`timeout 5 bluetoothctl remove "${mac}"`, { timeout: 6000 }, (err) => {
        resolve({
          success: !err,
          message: !err ? `已成功移除設備: ${mac}` : `移除失敗`,
        });
      });
    });
  }

  public async togglePower(enable: boolean): Promise<{ success: boolean; powered: boolean }> {
    const hasAdapter = await this.hasRealAdapter();

    if (!hasAdapter) {
      return { success: false, powered: false };
    }

    return new Promise((resolve) => {
      const cmd = enable ? 'bluetoothctl power on' : 'bluetoothctl power off';
      exec(cmd, { timeout: 3000 }, (err) => {
        resolve({
          success: !err,
          powered: enable,
        });
      });
    });
  }

  public async getConnectedAudioDevices(): Promise<BluetoothDevice[]> {
    const status = await this.getStatus();
    return status.connectedDevices;
  }
}

export const bluetoothController = new BluetoothController();
