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

  public async hasRealAdapter(): Promise<boolean> {
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

  public async isBluetoothServiceActive(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('systemctl is-active bluetooth 2>/dev/null || pgrep -x bluetoothd', { timeout: 1500 }, (err, stdout) => {
        if (!err && (stdout.includes('active') || stdout.trim().length > 0)) {
          return resolve(true);
        }
        resolve(false);
      });
    });
  }

  public async getStatus(): Promise<BluetoothStatusResponse> {
    const hasAdapter = await this.hasRealAdapter();
    const serviceRunning = await this.isBluetoothServiceActive();

    if (!hasAdapter) {
      // Real detection: No Bluetooth adapter hardware detected on system
      return {
        hasAdapter: false,
        adapterName: undefined,
        adapterMac: undefined,
        powered: false,
        serviceRunning,
        scanning: false,
        connectedDevices: [],
        pairedDevices: [],
        discoveredDevices: [],
        statusText: serviceRunning
          ? '藍芽守護進程運行中，但未偵測到實體藍芽介面 (hci0)；請在主機插入 USB 藍芽轉接器'
          : '未偵測到本機實體藍芽硬體 (若為實體 Linux 主機請執行 sudo ./setup 安裝驅動並插入藍芽轉接器)',
        error: '未偵測到實體藍芽硬體 (No Bluetooth adapter detected)',
      };
    }

    // Real adapter present, query bluetoothctl
    return new Promise((resolve) => {
      exec('timeout 2 bluetoothctl show 2>/dev/null', { timeout: 2500 }, (err, stdout) => {
        const output = stdout || '';
        const powered = output.includes('Powered: yes');
        const nameMatch = output.match(/Name:\s+(.*)/i);
        const macMatch = output.match(/Controller\s+([0-9A-F:]{17})/i);

        const adapterName = nameMatch ? nameMatch[1].trim() : 'Linux 實體藍芽介面';
        const adapterMac = macMatch ? macMatch[1].trim() : undefined;

        // Query real paired devices
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
                connected: false,
                isAudio: true,
              });
            }
          }

          // Query real connected devices
          exec('timeout 2 bluetoothctl devices Connected 2>/dev/null', { timeout: 2500 }, (cErr, cStdout) => {
            const connectedLines = (cStdout || '').split('\n').filter(Boolean);
            const connectedMacs = new Set<string>();

            for (const line of connectedLines) {
              const match = line.match(/^Device\s+([0-9A-F:]{17})/i);
              if (match) connectedMacs.add(match[1].trim().toUpperCase());
            }

            for (const dev of realDevices) {
              if (connectedMacs.has(dev.mac.toUpperCase())) {
                dev.connected = true;
              }
            }

            // Include any devices found in current scan
            const allDiscovered = [...realDevices];
            this.discoveredDevices.forEach((dev) => {
              if (!allDiscovered.some((d) => d.mac.toUpperCase() === dev.mac.toUpperCase())) {
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
                ? `藍芽控制器已就緒 (${adapterName})${connected.length > 0 ? ` - 已連線至 ${connected[0].name}` : ' - 待命'}`
                : '藍芽控制器電源已關閉',
            });
          });
        });
      });
    });
  }

  public async startScan(): Promise<{ success: boolean; message: string }> {
    const hasAdapter = await this.hasRealAdapter();
    if (!hasAdapter) {
      return {
        success: false,
        message: '未偵測到實體藍芽控制器，無法啟動硬體掃描',
      };
    }

    this.isScanning = true;
    if (this.scanTimeoutTimer) clearTimeout(this.scanTimeoutTimer);

    this.scanTimeoutTimer = setTimeout(() => {
      this.isScanning = false;
      exec('bluetoothctl scan off 2>/dev/null || true');
    }, 10000);

    return new Promise((resolve) => {
      // Start background scan with bluetoothctl and parse discovered devices
      const scanProc = spawn('bluetoothctl', ['scan', 'on'], { stdio: ['ignore', 'pipe', 'ignore'] });
      scanProc.stdout?.on('data', (data) => {
        const text = data.toString();
        const matches = text.matchAll(/Device\s+([0-9A-F:]{17})\s+(.*)/gi);
        for (const m of matches) {
          const mac = m[1].trim();
          const name = m[2].trim();
          if (name && !this.discoveredDevices.has(mac)) {
            this.discoveredDevices.set(mac, {
              mac,
              name,
              paired: false,
              connected: false,
              isAudio: true,
            });
          }
        }
      });

      setTimeout(() => {
        try {
          scanProc.kill();
        } catch {}
      }, 10000);

      resolve({
        success: true,
        message: '已啟動實體藍芽掃描，正在搜尋周邊裝置 (10 秒)...',
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
      return {
        success: false,
        message: '未偵測到實體藍芽控制器，無法連線至藍芽設備',
      };
    }

    return new Promise((resolve) => {
      // Trust, pair, and connect via bluetoothctl
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
      return { success: false, message: '未偵測到實體藍芽控制器' };
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
      return { success: false, message: '未偵測到實體藍芽控制器' };
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
      return { success: false, message: '未偵測到實體藍芽控制器' };
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
