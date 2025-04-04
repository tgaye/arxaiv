// src/main/resource-throttle.js
const os = require('os');
const { EventEmitter } = require('events');

/**
 * ResourceThrottle manages and limits resource usage across the application
 * It monitors CPU, memory, and other resources to prevent system overload
 */
class ResourceThrottle extends EventEmitter {
  constructor(safetyManager) {
    super();
    this.safetyManager = safetyManager;
    
    // Default thresholds
    this.thresholds = {
      cpu: 85,           // Throttle when CPU usage > 85%
      memory: 85,        // Throttle when memory usage > 85%
      taskQueueSize: 5,  // Maximum number of pending tasks
      operationInterval: 500  // Minimum ms between high-resource operations
    };
    
    // Current state
    this.currentState = {
      throttled: false,
      cpuUsage: 0,
      memoryUsage: 0,
      taskQueue: [],
      lastOperationTime: 0
    };
    
    // Register with safety manager if available
    if (this.safetyManager) {
      const componentRegistration = this.safetyManager.registerComponent('ResourceThrottle', this);
      this.updateHealth = componentRegistration.updateHealth;
      this.reportIssue = componentRegistration.reportIssue;
      this.updateHealth('healthy');
    }
    
    // Start monitoring
    this.monitorInterval = setInterval(() => this.checkResources(), 1000);
    
    // Log initial state
    this.log('ResourceThrottle initialized');
  }
  
  log(message) {
    console.log(`[ResourceThrottle] ${message}`);
    if (this.safetyManager) {
      this.safetyManager.logSafetyEvent(`[ResourceThrottle] ${message}`);
    }
  }
  
  async checkResources() {
    try {
      // Get CPU usage (simple approach - more complex monitoring might be better)
      const cpuUsage = await this.getCpuUsage();
      
      // Get memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memUsage = ((totalMem - freeMem) / totalMem) * 100;
      
      // Update current state
      this.currentState.cpuUsage = cpuUsage;
      this.currentState.memoryUsage = memUsage;
      
      // Check if we should throttle
      const shouldThrottle = 
        cpuUsage > this.thresholds.cpu || 
        memUsage > this.thresholds.memory;
      
      // State transition
      if (shouldThrottle && !this.currentState.throttled) {
        this.currentState.throttled = true;
        this.log(`Throttling activated: CPU=${cpuUsage.toFixed(1)}%, Memory=${memUsage.toFixed(1)}%`);
        this.emit('throttle-begin', { cpuUsage, memUsage });
      } else if (!shouldThrottle && this.currentState.throttled) {
        this.currentState.throttled = false;
        this.log(`Throttling deactivated: CPU=${cpuUsage.toFixed(1)}%, Memory=${memUsage.toFixed(1)}%`);
        this.emit('throttle-end', { cpuUsage, memUsage });
        
        // Process pending tasks when throttling ends
        this.processPendingTasks();
      }
      
      // Report resource usage to safety manager
      if (this.safetyManager && cpuUsage > 90) {
        this.reportIssue({
          message: `High CPU usage detected: ${cpuUsage.toFixed(1)}%`,
          severity: cpuUsage > 95 ? 'critical' : 'warning'
        });
      }
    } catch (error) {
      this.log(`Error checking resources: ${error.message}`);
    }
  }
  
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      // Measure over a short interval for responsiveness
      setTimeout(() => {
        const elapUsage = process.cpuUsage(startUsage);
        const elapTime = process.hrtime(startTime);
        
        const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1e6;
        const cpuPercent = (100 * (elapUsage.user + elapUsage.system) / 1000) / elapTimeMS;
        
        resolve(cpuPercent);
      }, 100);
    });
  }
  
  async runThrottledOperation(operation, priority = 'normal') {
    // Don't throttle critical operations
    if (priority === 'critical') {
      return operation();
    }
    
    // If not throttled and queue is empty, run immediately
    if (!this.currentState.throttled && this.currentState.taskQueue.length === 0) {
      const now = Date.now();
      const timeSinceLastOp = now - this.currentState.lastOperationTime;
      
      // Ensure minimum interval between operations
      if (timeSinceLastOp >= this.thresholds.operationInterval) {
        this.currentState.lastOperationTime = now;
        return operation();
      }
    }
    
    // Otherwise, queue the operation
    return new Promise((resolve, reject) => {
      // Check if queue is full
      if (this.currentState.taskQueue.length >= this.thresholds.taskQueueSize) {
        if (priority === 'low') {
          // Reject low priority tasks when queue is full
          return reject(new Error('Task queue full, low priority task rejected'));
        }
        
        // For normal priority, remove lowest priority task if queue is full
        const lowestPriorityIndex = this.currentState.taskQueue.findIndex(task => task.priority === 'low');
        if (lowestPriorityIndex >= 0) {
          const removedTask = this.currentState.taskQueue.splice(lowestPriorityIndex, 1)[0];
          removedTask.reject(new Error('Task removed from queue to make room for higher priority task'));
        } else {
          // If no low priority tasks, reject this one
          return reject(new Error('Task queue full, cannot schedule more operations'));
        }
      }
      
      // Add to queue
      this.currentState.taskQueue.push({
        operation,
        resolve,
        reject,
        priority,
        queueTime: Date.now()
      });
      
      this.log(`Operation queued (priority: ${priority}), queue size: ${this.currentState.taskQueue.length}`);
      
      // Try to process the queue
      this.processPendingTasks();
    });
  }
  
  processPendingTasks() {
    // Don't process if throttled
    if (this.currentState.throttled) {
      return;
    }
    
    // Process one task from the queue
    if (this.currentState.taskQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastOp = now - this.currentState.lastOperationTime;
      
      // Respect operation interval
      if (timeSinceLastOp < this.thresholds.operationInterval) {
        // Schedule processing after the interval
        setTimeout(() => this.processPendingTasks(), 
                   this.thresholds.operationInterval - timeSinceLastOp);
        return;
      }
      
      // Sort queue by priority: high > normal > low
      this.currentState.taskQueue.sort((a, b) => {
        const priorityWeight = { high: 3, normal: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      });
      
      // Take the highest priority task
      const task = this.currentState.taskQueue.shift();
      this.currentState.lastOperationTime = now;
      
      // Execute the task
      try {
        const result = task.operation();
        
        // Handle promises
        if (result && typeof result.then === 'function') {
          result
            .then(task.resolve)
            .catch(task.reject)
            .finally(() => {
              // Process next task after this one completes
              setTimeout(() => this.processPendingTasks(), 
                         this.thresholds.operationInterval);
            });
        } else {
          // Handle synchronous result
          task.resolve(result);
          
          // Schedule next task
          setTimeout(() => this.processPendingTasks(), 
                     this.thresholds.operationInterval);
        }
      } catch (error) {
        task.reject(error);
        
// Schedule next task even if this one failed
setTimeout(() => this.processPendingTasks(), 
this.thresholds.operationInterval);
}
}
}

getResourceStatus() {
return {
throttled: this.currentState.throttled,
cpuUsage: this.currentState.cpuUsage,
memoryUsage: this.currentState.memoryUsage,
queuedTasks: this.currentState.taskQueue.length,
thresholds: this.thresholds
};
}

setThresholds(newThresholds) {
this.thresholds = {
...this.thresholds,
...newThresholds
};

this.log(`Thresholds updated: CPU=${this.thresholds.cpu}%, Memory=${this.thresholds.memory}%`);
}

forceCleanup() {
// Clear the queue and reject all pending tasks
const pendingTasks = [...this.currentState.taskQueue];
this.currentState.taskQueue = [];

pendingTasks.forEach(task => {
task.reject(new Error('Force cleanup initiated, task cancelled'));
});

this.log(`Force cleanup: Cancelled ${pendingTasks.length} pending tasks`);

// Clear the monitoring interval
if (this.monitorInterval) {
clearInterval(this.monitorInterval);
}

return pendingTasks.length;
}
}

module.exports = ResourceThrottle;