// src/main/safety-manager.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

class SafetyManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.emergencyShutdownTriggered = false;
    this.warningThresholds = {
      vramUsagePercent: 80, // Default 80%
      gpuTemperature: 85,   // Default 85°C
      emergencyVram: 95,    // Emergency shutdown at 95%
      emergencyTemp: 95     // Emergency shutdown at 95°C
    };
    this.activeTasks = new Map();
    this.logPath = path.join(app.getPath('userData'), 'logs');
    
    // Ensure log directory exists
    fs.ensureDirSync(this.logPath);
    
    // Log file for safety events
    this.safetyLogPath = path.join(this.logPath, 'safety-events.log');
    
    this.logSafetyEvent('SafetyManager initialized');
  }
  
  logSafetyEvent(message, error = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (error) {
      logMessage += `\nERROR: ${error.message}\n${error.stack || 'No stack trace'}\n`;
    }
    
    console.log(logMessage);
    
    // Append to log file
    fs.appendFileSync(this.safetyLogPath, logMessage + '\n');
  }
  
  registerTask(taskId, taskType, processRef = null) {
    this.activeTasks.set(taskId, {
      id: taskId,
      type: taskType,
      startTime: Date.now(),
      process: processRef
    });
    
    this.logSafetyEvent(`Task registered: ${taskType} (ID: ${taskId})`);
    
    // Return a function to mark task as completed
    return () => this.completeTask(taskId);
  }
  
  completeTask(taskId) {
    if (this.activeTasks.has(taskId)) {
      const task = this.activeTasks.get(taskId);
      const duration = Date.now() - task.startTime;
      this.logSafetyEvent(`Task completed: ${task.type} (ID: ${taskId}) - Duration: ${duration}ms`);
      this.activeTasks.delete(taskId);
      return true;
    }
    return false;
  }
  
  handleCriticalGpuMetrics(metrics) {
    const { vramUsagePercent, temperature, gpuName } = metrics;
    
    // Check for emergency conditions
    if (vramUsagePercent > this.warningThresholds.emergencyVram) {
      this.triggerEmergencyShutdown(`CRITICAL: VRAM usage at ${vramUsagePercent.toFixed(1)}% on ${gpuName}`);
      return true;
    }
    
    if (temperature && temperature > this.warningThresholds.emergencyTemp) {
      this.triggerEmergencyShutdown(`CRITICAL: GPU temperature at ${temperature}°C on ${gpuName}`);
      return true;
    }
    
    // Check for warning conditions
    if (vramUsagePercent > this.warningThresholds.vramUsagePercent) {
      this.sendWarningToRenderer({
        type: 'vram-warning',
        message: `High VRAM usage detected: ${vramUsagePercent.toFixed(1)}%`,
        severity: 'warning',
        data: { vramUsagePercent, gpuName }
      });
    }
    
    if (temperature && temperature > this.warningThresholds.gpuTemperature) {
      this.sendWarningToRenderer({
        type: 'temperature-warning',
        message: `High GPU temperature: ${temperature}°C`,
        severity: 'warning',
        data: { temperature, gpuName }
      });
    }
    
    return false;
  }
  
  sendWarningToRenderer(warning) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('safety-warning', warning);
      this.logSafetyEvent(`Warning sent to renderer: ${warning.type} - ${warning.message}`);
    }
  }
  
  triggerEmergencyShutdown(reason) {
    // Only trigger once
    if (this.emergencyShutdownTriggered) return;
    
    this.emergencyShutdownTriggered = true;
    this.logSafetyEvent(`EMERGENCY SHUTDOWN TRIGGERED: ${reason}`);
    
    // Kill all active tasks
    this.activeTasks.forEach((task, taskId) => {
      if (task.process && typeof task.process.kill === 'function') {
        try {
          this.logSafetyEvent(`Killing process for task: ${task.type} (ID: ${taskId})`);
          task.process.kill('SIGKILL');
        } catch (error) {
          this.logSafetyEvent(`Failed to kill process for task: ${task.type}`, error);
        }
      }
    });
    
    // Clear GPU memory
    if (global.gc) {
      try {
        this.logSafetyEvent('Forcing garbage collection');
        global.gc();
      } catch (error) {
        this.logSafetyEvent('Failed to force garbage collection', error);
      }
    }
    
    // Send critical error to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('critical-error', {
        type: 'emergency-shutdown',
        message: reason,
        instructions: 'The application will restart to prevent system crash.'
      });
      
      // Give the renderer time to show the message
      setTimeout(() => {
        this.logSafetyEvent('Restarting application after emergency shutdown');
        app.relaunch();
        app.exit(0);
      }, 3000);
    } else {
      // If no window is available, just exit immediately
      this.logSafetyEvent('Exiting application after emergency shutdown (no window available)');
      app.exit(1);
    }
  }
  
  setWarningThresholds(thresholds) {
    this.warningThresholds = {
      ...this.warningThresholds,
      ...thresholds
    };
    
    this.logSafetyEvent(`Warning thresholds updated: ${JSON.stringify(this.warningThresholds)}`);
  }
  
  getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      cpuModel: os.cpus()[0].model,
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    };
  }
}

module.exports = SafetyManager;