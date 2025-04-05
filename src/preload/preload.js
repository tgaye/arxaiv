// src/preload/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Debug logging
console.log("Preload script is executing...");

// Global error handler to catch renderer exceptions
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  
  // Report critical errors to main process
  ipcRenderer.send('report-critical-error', { 
    message: event.error.message,
    stack: event.error.stack
  });
});

// Safety monitoring
let lastVramWarningTime = 0;
const VRAM_WARNING_COOLDOWN = 30000; // 30 seconds between warnings

// Handle safety warnings from main process
ipcRenderer.on('safety-warning', (_, warning) => {
  // Check for VRAM warnings and implement cooldown
  if (warning.type === 'vram-warning') {
    const now = Date.now();
    if (now - lastVramWarningTime < VRAM_WARNING_COOLDOWN) {
      return; // Skip to avoid spamming warnings
    }
    lastVramWarningTime = now;
  }
  
  // Dispatch custom event to UI
  window.dispatchEvent(new CustomEvent('safety-warning', { detail: warning }));
  
  // Show notification if urgent
  if (warning.severity === 'critical') {
    const notification = new Notification('ArxAIv Safety Alert', {
      body: warning.message,
      icon: '../assets/icon.png'
    });
    
    notification.onclick = () => {
      console.log('Safety notification clicked');
    };
  }
});

// Handle critical errors from main process
ipcRenderer.on('critical-error', (_, error) => {
  console.error('Critical error from main process:', error);
  
  // Show error dialog
  const errorContainer = document.createElement('div');
  errorContainer.className = 'critical-error-overlay';
  errorContainer.innerHTML = `
    <div class="critical-error-dialog">
      <div class="critical-error-header">
        <h2>Critical Error</h2>
      </div>
      <div class="critical-error-content">
        <p>${error.message}</p>
        ${error.instructions ? `<p class="instructions">${error.instructions}</p>` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(errorContainer);
});

// Handle app shutting down
ipcRenderer.on('app-shutting-down', () => {
  console.log('Application is shutting down...');
  
  // Show shutdown UI
  const shutdownContainer = document.createElement('div');
  shutdownContainer.className = 'shutdown-overlay';
  shutdownContainer.innerHTML = `
    <div class="shutdown-dialog">
      <h2>Shutting Down</h2>
      <p>ArxAIv is shutting down safely to protect your system resources.</p>
      <div class="shutdown-spinner"></div>
    </div>
  `;
  
  document.body.appendChild(shutdownContainer);
});

// Expose IPC methods to renderer
contextBridge.exposeInMainWorld('api', {
  getModels: () => ipcRenderer.invoke('get-models'),
  setDefaultModel: (modelPath) => ipcRenderer.invoke('set-default-model', modelPath),
  selectCodeDirectory: () => ipcRenderer.invoke('select-code-directory'), 
  loadModel: (modelPath) => {
    console.log('Calling loadModel from renderer');
    return new Promise((resolve, reject) => {
      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('Model loading timed out after 30 seconds');
        resolve({
          success: false,
          error: 'Model loading timed out after 30 seconds'
        });
      }, 30000);
      
      ipcRenderer.invoke('load-model', modelPath)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          console.error('Error loading model:', error);
          reject(error);
        });
    });
  },
  
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listDirectory: (dirPath) => ipcRenderer.invoke('list-directory', dirPath),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),


  getGPUInfo: () => {
    console.log('Calling getGPUInfo from renderer');
    return ipcRenderer.invoke('get-gpu-info');
  },
  
  getVramWarningThreshold: () => ipcRenderer.invoke('get-vram-warning-threshold'),
  
  setVramWarningThreshold: (threshold) => ipcRenderer.invoke('set-vram-warning-threshold', threshold),
  
  onGPUStatsUpdate: (callback) => {
    ipcRenderer.on('gpu-stats-update', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('gpu-stats-update');
  },
  
  sendMessage: (data) => {
    return new Promise((resolve, reject) => {
      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('sendMessage timed out after 3 minutes');
        resolve({
          success: false,
          error: 'Request timed out after 3 minutes'
        });
      }, 3 * 60 * 1000);
      
      ipcRenderer.invoke('send-message', data)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          console.error('Error sending message:', error);
          reject(error);
        });
    });
  },
  
  selectModelDirectory: () => {
    console.log("selectModelDirectory called in preload");
    return ipcRenderer.invoke('select-model-directory');
  },
  
  onResponseChunk: (callback) => {
    ipcRenderer.on('response-chunk', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('response-chunk');
  },
  
  generateHTML: (data) => {
    console.log('Sending HTML generation request to main process');
    return new Promise((resolve, reject) => {
      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('HTML generation request timed out after 60 seconds');
        resolve({
          success: false,
          error: 'Request timed out after 60 seconds',
          html: `
            <!DOCTYPE html>
            <html>
              <head><title>Error</title></head>
              <body style="font-family: sans-serif; padding: 20px; background: #0d1117; color: #c9d1d9;">
                <h1 style="color: #58a6ff;">Request Timeout</h1>
                <p>The HTML generation request timed out. The process may have crashed.</p>
                <p>Please try again when system resources are available.</p>
              </body>
            </html>
          `,
          method: 'timeout-fallback'
        });
      }, 60000);
      
      ipcRenderer.invoke('generate-html', data)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          console.error('Error in HTML generation:', error);
          resolve({
            success: false,
            error: error.message,
            html: `
              <!DOCTYPE html>
              <html>
                <head><title>Error</title></head>
                <body style="font-family: sans-serif; padding: 20px; background: #0d1117; color: #c9d1d9;">
                  <h1 style="color: #58a6ff;">Error Generating Page</h1>
                  <p>${error.message}</p>
                </body>
              </html>
            `,
            method: 'error-fallback'
          });
        });
    });
  },
  
  generateFallbackHTML: (data) => ipcRenderer.invoke('generate-fallback-html', data),
  
  generateConversationSummary: (data) => ipcRenderer.invoke('generate-conversation-summary', data),
  
  onHtmlGenerationStatus: (callback) => {
    ipcRenderer.on('html-generation-status', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('html-generation-status');
  },
  
  onConversationSummary: (callback) => {
    ipcRenderer.on('conversation-summary', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('conversation-summary');
  },
  
  getSystemResources: () => ipcRenderer.invoke('get-system-resources'),
  
  forceGpuReset: () => ipcRenderer.invoke('force-gpu-reset'),
  
  onSafetyWarning: (callback) => {
    window.addEventListener('safety-warning', (event) => callback(event.detail));
    return () => window.removeEventListener('safety-warning', callback);
  },
  readHtmlFile: (filePath) => {
    return ipcRenderer.invoke('read-html-file', filePath);
  }
});

// Debug
console.log("API exposed in preload:", {
  getModels: typeof ipcRenderer.invoke === 'function',
  selectModelDirectory: typeof ipcRenderer.invoke === 'function'
});