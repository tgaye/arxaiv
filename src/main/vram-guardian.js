// src/main/vram-guardian.js
const si = require('systeminformation');
const { exec } = require('child_process');
const { platform } = require('os');

class VRAMGuardian {
  constructor(safetyManager) {
    this.safetyManager = safetyManager;
    this.monitorInterval = null;
    this.checkIntervalMs = 1000; // Check every second
    this.lastMetrics = null;
    this.criticalVramThreshold = 95; // 95% is critical
    this.highVramThreshold = 80; // 80% is high
    this.criticalTempThreshold = 90; // 90°C is critical
    this.highTempThreshold = 80; // 80°C is high
    this.isWindows = platform() === 'win32';
    this.isLinux = platform() === 'linux';
    this.isMacOS = platform() === 'darwin';
    this.isNvidiaAvailable = false;
    this.checkNvidiaAvailability();
  }
  
  async checkNvidiaAvailability() {
    // Only check on Windows or Linux
    if (!this.isWindows && !this.isLinux) {
      this.isNvidiaAvailable = false;
      return;
    }
    
    const command = this.isWindows ? 'where nvidia-smi' : 'which nvidia-smi';
    
    try {
      const { stdout } = await this.execPromise(command);
      this.isNvidiaAvailable = !!stdout.trim();
    } catch (error) {
      this.isNvidiaAvailable = false;
    }
  }
  
  execPromise(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }
  
  async getNvidiaMetrics() {
    if (!this.isNvidiaAvailable) {
      return null;
    }
    
    try {
      const { stdout } = await this.execPromise(
        'nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu,utilization.gpu --format=csv,noheader,nounits'
      );
      
      if (!stdout || !stdout.trim()) {
        return null;
      }
      
      return stdout.trim().split('\n').map(line => {
        const [name, memoryUsed, memoryTotal, temperature, utilization] = line.split(', ').map(s => s.trim());
        
        const memoryUsedMB = parseInt(memoryUsed, 10);
        const memoryTotalMB = parseInt(memoryTotal, 10);
        const vramUsagePercent = memoryTotalMB > 0 ? (memoryUsedMB / memoryTotalMB) * 100 : 0;
        
        return {
          name,
          memoryUsedMB,
          memoryTotalMB,
          vramUsagePercent,
          temperature: parseInt(temperature, 10),
          utilization: parseInt(utilization, 10)
        };
      });
    } catch (error) {
      return null;
    }
  }
  
  async getSiMetrics() {
    try {
      const graphics = await si.graphics();
      
      return graphics.controllers.map(gpu => {
        const memoryUsedMB = gpu.memoryUsed || 0;
        const memoryTotalMB = gpu.memoryTotal || 0;
        const vramUsagePercent = memoryTotalMB > 0 ? (memoryUsedMB / memoryTotalMB) * 100 : 0;
        
        return {
          name: gpu.name || 'Unknown GPU',
          memoryUsedMB,
          memoryTotalMB,
          vramUsagePercent,
          temperature: gpu.temperatureGpu,
          utilization: gpu.utilizationGpu || 0
        };
      });
    } catch (error) {
      return null;
    }
  }
  
  async checkGpuMetrics() {
    try {
      // First try NVIDIA metrics if available
      const nvidiaMetrics = await this.getNvidiaMetrics();
      if (nvidiaMetrics && nvidiaMetrics.length > 0) {
        this.lastMetrics = nvidiaMetrics;
        return nvidiaMetrics;
      }
      
      // Fall back to systeminformation
      const siMetrics = await this.getSiMetrics();
      if (siMetrics && siMetrics.length > 0) {
        this.lastMetrics = siMetrics;
        return siMetrics;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  async checkVramSafety() {
    const metrics = await this.checkGpuMetrics();
    
    if (!metrics || metrics.length === 0) {
      return { safe: true, metrics: [] };
    }
    
    let allSafe = true;
    let criticalGpu = null;
    
    // Check each GPU for critical conditions
    for (const gpu of metrics) {
      const isCriticalVram = gpu.vramUsagePercent >= this.criticalVramThreshold;
      const isCriticalTemp = gpu.temperature && gpu.temperature >= this.criticalTempThreshold;
      
      if (isCriticalVram || isCriticalTemp) {
        allSafe = false;
        criticalGpu = gpu;
        
        // Report to safety manager
        this.safetyManager.handleCriticalGpuMetrics({
          vramUsagePercent: gpu.vramUsagePercent,
          temperature: gpu.temperature,
          gpuName: gpu.name
        });
        
        break;
      }
    }
    
    return {
      safe: allSafe,
      metrics,
      criticalGpu
    };
  }
  
  startMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    
    this.monitorInterval = setInterval(async () => {
      await this.checkVramSafety();
    }, this.checkIntervalMs);
    
    return true;
  }
  
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      return true;
    }
    return false;
  }
  
  setThresholds(thresholds) {
    if (thresholds.criticalVram) this.criticalVramThreshold = thresholds.criticalVram;
    if (thresholds.highVram) this.highVramThreshold = thresholds.highVram;
    if (thresholds.criticalTemp) this.criticalTempThreshold = thresholds.criticalTemp;
    if (thresholds.highTemp) this.highTempThreshold = thresholds.highTemp;
  }
  
  getLastMetrics() {
    return this.lastMetrics;
  }
  
  async forceGpuReset() {
    // Forced cleanup to try to reset GPU state
    if (global.gc) {
      try {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        // Ignore GC errors
      }
    }
    
    // For NVIDIA GPUs, we can try to reset the GPU application clocks
    if (this.isNvidiaAvailable) {
      try {
        // This is a less aggressive approach than full GPU reset
        await this.execPromise('nvidia-smi -rac');
      } catch (e) {
        // Ignore errors, this is a best-effort attempt
      }
    }
    
    return true;
  }
}

module.exports = VRAMGuardian;