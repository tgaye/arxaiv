const si = require('systeminformation');
const { exec } = require('child_process');
const { platform } = require('os');

class GPUMonitor {
  constructor() {
    this.gpuInfo = null;
    this.gpuCount = 0;
    this.updateInterval = null;
    this.callbacks = [];
    this.vramWarningThreshold = 0.8; // Default 80%
    this.lastGPUStats = null;
  }

  async getNvidiaGPUStats() {
    return new Promise((resolve, reject) => {
      // Check if we're on a supported platform
      if (platform() !== 'win32' && platform() !== 'linux') {
        console.error('[GPU Monitor] Unsupported platform for nvidia-smi:', platform());
        resolve(null);
        return;
      }

      // Comprehensive nvidia-smi check
      exec('where nvidia-smi || which nvidia-smi', (whichError, whichStdout, whichStderr) => {
        if (whichError) {
          console.error('[GPU Monitor] nvidia-smi not found in system PATH:', whichError);
          resolve(null);
          return;
        }

        console.log('[GPU Monitor] nvidia-smi path:', whichStdout.trim());

        // Execute nvidia-smi with full command
        exec('nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits', 
          (error, stdout, stderr) => {
            // Detailed error logging
            if (error) {
              console.error('[GPU Monitor] nvidia-smi command failed:', {
                error: error.message,
                stderr: stderr,
                code: error.code,
                signal: error.signal
              });
              resolve(null);
              return;
            }

            // Check if output is empty
            if (!stdout || stdout.trim() === '') {
              console.warn('[GPU Monitor] nvidia-smi returned empty output');
              resolve(null);
              return;
            }

            try {
              const gpuData = stdout.trim().split('\n').map(line => {
                const [name, utilization, memoryUsed, memoryTotal, temperature] = line.split(', ');
                
                // Additional parsing safety
                const memoryTotalNum = parseInt(memoryTotal);
                const memoryUsedNum = parseInt(memoryUsed);
                const utilizationNum = parseFloat(utilization);
                const temperatureNum = parseFloat(temperature);

                if (isNaN(memoryTotalNum) || isNaN(memoryUsedNum)) {
                  console.warn('[GPU Monitor] Invalid memory parsing:', { memoryTotal, memoryUsed });
                }

                const vramUsagePercent = memoryTotalNum > 0 ? (memoryUsedNum / memoryTotalNum) * 100 : 0;

                const gpuStats = {
                  name,
                  utilizationGpu: isNaN(utilizationNum) ? 0 : utilizationNum,
                  memoryTotal: memoryTotalNum * 1024 * 1024, // Convert to bytes
                  memoryUsed: memoryUsedNum * 1024 * 1024,  // Convert to bytes
                  vramUsagePercent,
                  temperature: isNaN(temperatureNum) ? 0 : temperatureNum,
                  isVramWarning: vramUsagePercent > (this.vramWarningThreshold * 100)
                };

                // console.log('[GPU Monitor] Parsed GPU Stats:', JSON.stringify(gpuStats, null, 2));

                return gpuStats;
              });

              resolve(gpuData);
            } catch (parseError) {
              console.error('[GPU Monitor] Error parsing nvidia-smi output:', {
                error: parseError,
                rawOutput: stdout
              });
              resolve(null);
            }
          }
        );
      });
    });
  }

  async initialize() {
    try {
      // First try NVIDIA GPU stats
      const nvidiaStats = await this.getNvidiaGPUStats();
      if (nvidiaStats && nvidiaStats.length > 0) {
        this.gpuInfo = nvidiaStats;
        this.gpuCount = nvidiaStats.length;
        
        console.log('Detected NVIDIA GPUs:', this.gpuCount);
        console.log('NVIDIA GPU Info:', this.gpuInfo);
        
        return {
          gpuCount: this.gpuCount,
          gpuInfo: this.gpuInfo,
          vramWarningThreshold: this.vramWarningThreshold
        };
      }

      // Fallback to systeminformation
      const graphics = await si.graphics();
      this.gpuInfo = graphics.controllers;
      this.gpuCount = this.gpuInfo.length;
     
      console.log('Detected GPUs:', this.gpuCount);
      console.log('GPU Info:', this.gpuInfo);
     
      return {
        gpuCount: this.gpuCount,
        gpuInfo: this.gpuInfo,
        vramWarningThreshold: this.vramWarningThreshold
      };
    } catch (error) {
      console.error('Error initializing GPU monitor:', error);
      return {
        gpuCount: 0,
        gpuInfo: [],
        vramWarningThreshold: this.vramWarningThreshold
      };
    }
  }

    startMonitoring(intervalMs = 5000) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    console.log(`[GPU Monitor] Starting monitoring with interval ${intervalMs}ms`);
    
    this.updateInterval = setInterval(async () => {
      try {
        // First try NVIDIA GPU stats
        const nvidiaStats = await this.getNvidiaGPUStats();
        if (nvidiaStats && nvidiaStats.length > 0) {
          this.callbacks.forEach(callback => {
            callback(nvidiaStats);
          });
          return;
        }

        // Fallback to systeminformation
        console.log('[GPU Monitor] Falling back to systeminformation');
        const graphics = await si.graphics();
       
        const gpuData = graphics.controllers.map(gpu => {
          const memoryTotal = gpu.memoryTotal || 0;
          const memoryUsed = gpu.memoryUsed || 0;
          const vramUsagePercent = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;
         
          const utilizationGpu = gpu.utilizationGpu ||
            (gpu.utilizationMemory ? Math.max(gpu.utilizationMemory, gpu.utilizationGpu || 0) : 0);
         
          return {
            name: gpu.name,
            utilizationGpu: Math.min(100, Math.max(0, utilizationGpu)),
            memoryTotal: memoryTotal,
            memoryUsed: memoryUsed,
            vramUsagePercent: vramUsagePercent,
            temperature: gpu.temperatureGpu,
            isVramWarning: vramUsagePercent > (this.vramWarningThreshold * 100)
          };
        });
       
        this.callbacks.forEach(callback => {
          callback(gpuData);
        });
      } catch (error) {
        console.error('[GPU Monitor] Error monitoring GPU:', error);
      }
    }, intervalMs);
  }


  // Remaining methods stay the same as in previous implementation

  setVramWarningThreshold(threshold) {
    this.vramWarningThreshold = threshold;
    return this.vramWarningThreshold;
  }

  getVramWarningThreshold() {
    return this.vramWarningThreshold;
  }

  stopMonitoring() {
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

  estimateVramRequirement(modelSizeInBytes) {
    const estimatedVramMB = (modelSizeInBytes / (1024 * 1024)) * 1.5;
    return Math.ceil(estimatedVramMB);
  }
}

module.exports = GPUMonitor;