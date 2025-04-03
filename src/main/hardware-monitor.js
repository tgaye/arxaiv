// src/main/hardware-monitor.js
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs-extra');

class HardwareMonitor {
  constructor() {
    this.process = null;
    this.monitorPath = this._getMonitorPath();
    this.callbacks = [];
    this.updateInterval = null;
    this.lastStats = null;
    this.isWindows = os.platform() === 'win32';
    this.vramWarningThreshold = 0.8; // Default 80%
  }

  _getMonitorPath() {
    // Path to the LibreHardwareMonitor CLI wrapper (we'll create this)
    const binDir = path.join(__dirname, '../../bin');
    
    let binName;
    if (this.isWindows) {
      binName = 'LibreHardwareMonitorCLI.exe';
    } else {
      binName = 'LibreHardwareMonitorCLI';
    }
    
    return path.join(binDir, binName);
  }

  async initialize() {
    try {
      // First try to get hardware info from LibreHardwareMonitor
      const hwInfo = await this._getHardwareInfo();
      
      // If successful, return the info
      if (hwInfo && hwInfo.gpuInfo && hwInfo.gpuInfo.length > 0) {
        console.log('[Hardware Monitor] Successfully retrieved data from LibreHardwareMonitor');
        return hwInfo;
      }
      
      // Fallback to the existing monitoring method
      console.log('[Hardware Monitor] Falling back to GPU Monitor');
      const GPUMonitor = require('./gpu-monitor');
      const gpuMonitor = new GPUMonitor();
      const result = await gpuMonitor.initialize();
      
      // Store a reference to the gpuMonitor for later use
      this.fallbackMonitor = gpuMonitor;
      
      return result;
    } catch (error) {
      console.error('[Hardware Monitor] Error initializing hardware monitor:', error);
      return {
        gpuCount: 0,
        gpuInfo: [],
        vramWarningThreshold: this.vramWarningThreshold
      };
    }
  }

  async _getHardwareInfo() {
    return new Promise((resolve, reject) => {
      // Check if the monitor executable exists
      if (!fs.existsSync(this.monitorPath)) {
        console.warn(`LibreHardwareMonitor CLI not found at: ${this.monitorPath}`);
        // Resolve with null to allow fallback
        resolve(null);
        return;
      }

      // Execute the monitor CLI
      const process = spawn(this.monitorPath, ['--json', '--once']);
      let data = '';
      let error = '';

      process.stdout.on('data', (chunk) => {
        data += chunk.toString();
      });

      process.stderr.on('data', (chunk) => {
        error += chunk.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          console.error(`Hardware monitor process exited with code ${code}: ${error}`);
          resolve(null);
          return;
        }

        try {
          const hwData = JSON.parse(data);
          const gpuInfo = this._parseGpuInfo(hwData);
          resolve({
            gpuCount: gpuInfo.length,
            gpuInfo: gpuInfo,
            vramWarningThreshold: this.vramWarningThreshold
          });
        } catch (err) {
          console.error('Error parsing hardware info:', err);
          resolve(null);
        }
      });

      process.on('error', (err) => {
        console.error('Failed to start hardware monitor process:', err);
        resolve(null);
      });
    });
  }

  _parseGpuInfo(hwData) {
    // This parsing will depend on the output format of LibreHardwareMonitor CLI
    // Here's a placeholder implementation that should be adjusted
    const gpuData = [];

    if (hwData && hwData.gpu) {
      hwData.gpu.forEach(gpu => {
        const memoryTotal = gpu.memoryTotal || 0;
        const memoryUsed = gpu.memoryUsed || 0;
        const vramUsagePercent = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;

        gpuData.push({
          name: gpu.name,
          utilizationGpu: gpu.load || 0,
          memoryTotal: memoryTotal,
          memoryUsed: memoryUsed,
          vramUsagePercent: vramUsagePercent,
          temperature: gpu.temperature || 0,
          isVramWarning: vramUsagePercent > (this.vramWarningThreshold * 100)
        });
      });
    }

    return gpuData;
  }

  startMonitoring(intervalMs = 1000) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    console.log(`[Hardware Monitor] Starting monitoring with interval ${intervalMs}ms`);
    
    // If we're using the fallback monitor, let it handle the monitoring
    if (this.fallbackMonitor) {
      console.log('[Hardware Monitor] Using fallback monitor for ongoing monitoring');
      this.fallbackMonitor.onUpdate((data) => {
        this.callbacks.forEach(callback => callback(data));
      });
      return this.fallbackMonitor.startMonitoring(intervalMs);
    }
    
    // Otherwise use our own monitoring
    this.updateInterval = setInterval(async () => {
      try {
        const hwInfo = await this._getHardwareInfo();
        
        if (hwInfo && hwInfo.gpuInfo && hwInfo.gpuInfo.length > 0) {
          this.callbacks.forEach(callback => {
            callback(hwInfo.gpuInfo);
          });
        } else {
          console.log('[Hardware Monitor] No data from hardware monitor, not using fallback during runtime');
        }
      } catch (error) {
        console.error('[Hardware Monitor] Error monitoring hardware:', error);
      }
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.fallbackMonitor) {
      this.fallbackMonitor.stopMonitoring();
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  onUpdate(callback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  getVramWarningThreshold() {
    return this.vramWarningThreshold;
  }

  setVramWarningThreshold(threshold) {
    this.vramWarningThreshold = threshold;
    return this.vramWarningThreshold;
  }

  estimateVramRequirement(modelSizeInBytes) {
    const estimatedVramMB = (modelSizeInBytes / (1024 * 1024)) * 1.5;
    return Math.ceil(estimatedVramMB);
  }
}

module.exports = HardwareMonitor;