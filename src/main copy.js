const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const ModelManager = require('./main/model-manager');
const LLMService = require('./main/llm-service');
const GPUMonitor = require('./main/gpu-monitor');
const HTMLValidator = require('./main/html-validator');
const HTMLGenerator = require('./main/html-generator');
const ConversationManager = require('./main/conversation-manager');

// Initialize services
let mainWindow;
const modelManager = new ModelManager();
let llmService = null;
const gpuMonitor = new GPUMonitor();
let htmlValidator = null;
let htmlGenerator = null;
let conversationManager = null;

// Error logging helper
function logError(message, error) {
  console.error(message, error);
  try {
    fs.appendFileSync(
      path.join(__dirname, '../../debug-main.txt'), 
      `\n${new Date().toISOString()}: ${message}: ${error.message}\n${error.stack}\n`
    );
  } catch (err) {
    console.error('Failed to write to debug log:', err);
  }
}

// Initialize HTML-related services
function initializeServices(llmServiceInstance) {
  try {
    htmlValidator = new HTMLValidator();
    htmlGenerator = new HTMLGenerator(llmServiceInstance);
    conversationManager = new ConversationManager(llmServiceInstance);
  } catch (error) {
    logError('Failed to initialize services', error);
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Hot reload for development
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: false // We'll use webpack for the renderer
    });
  } catch (_) { console.log('Error with electron-reloader'); }
}

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: process.env.NODE_ENV === 'development' 
        ? MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY 
        : path.join(__dirname, 'preload.js'),
      webSecurity: process.env.NODE_ENV !== 'development',
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    backgroundColor: '#0d1117',
  });

  // Set CSP in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self' ws:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"]
        }
      });
    });
  }
  
  // Load the app's HTML
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// Set up GPU monitoring
const setupGpuMonitoring = async () => {
  try {
    // Initialize GPU monitoring
    const gpuInfo = await gpuMonitor.initialize();
    
    try {
      // Start monitoring
      gpuMonitor.startMonitoring(1000);
      
      // Set up update events
      gpuMonitor.onUpdate((gpuData) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('gpu-stats-update', gpuData);
        }
      });
    } catch (monitorError) {
      console.error('Error starting GPU monitoring:', monitorError);
      // Continue even if monitoring fails
    }
    
    return gpuInfo;
  } catch (error) {
    console.error('Error setting up GPU monitoring:', error);
    return {
      gpuCount: 0,
      gpuInfo: [],
      vramWarningThreshold: gpuMonitor.getVramWarningThreshold()
    };
  }
};

// Init app when ready
app.whenReady().then(async () => {
  createWindow();
  await modelManager.initialize();
  await setupGpuMonitoring();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-create window on macOS when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up on quit
app.on('will-quit', () => {
  if (gpuMonitor) {
    gpuMonitor.stopMonitoring();
  }
  if (llmService) {
    llmService.unloadModel();
  }
});

// ========== IPC HANDLERS ==========

// Model listing
ipcMain.handle('get-models', async () => {
  try {
    return await modelManager.getModels();
  } catch (error) {
    logError('Error getting models', error);
    return [];
  }
});

// Model loading
ipcMain.handle('load-model', async (event, modelPath) => {
  try {
    console.log(`Loading model from path: ${modelPath}`);
    
    // Unload previous model if one is loaded
    if (llmService) {
      llmService.unloadModel();
    }
    
    // Create new LLM service with selected model
    llmService = new LLMService(modelPath);
    await llmService.loadModel();
    
    // Initialize HTML services
    initializeServices(llmService);
    
    return { 
      success: true, 
      message: `Model loaded: ${path.basename(modelPath)}` 
    };
  } catch (error) {
    logError('Error loading model', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// GPU settings
ipcMain.handle('get-vram-warning-threshold', () => {
  return gpuMonitor.getVramWarningThreshold();
});

ipcMain.handle('set-vram-warning-threshold', (event, threshold) => {
  return gpuMonitor.setVramWarningThreshold(threshold);
});

// GPU info
ipcMain.handle('get-gpu-info', async () => {
  try {
    return await gpuMonitor.initialize();
  } catch (error) {
    logError('Error getting GPU info', error);
    return {
      gpuCount: 0,
      gpuInfo: [],
      vramWarningThreshold: gpuMonitor.getVramWarningThreshold()
    };
  }
});

// Chat message handling
ipcMain.handle('send-message', async (event, { message, conversationId }) => {
  try {
    if (!llmService) {
      throw new Error('No model loaded');
    }
    
    // Stream response
    const responsePromise = llmService.generateResponse(message, (chunk) => {
      // Send chunks to renderer
      mainWindow.webContents.send('response-chunk', { chunk, conversationId });
    });
    
    // Wait for full response
    const fullResponse = await responsePromise;
    return { success: true, response: fullResponse };
  } catch (error) {
    logError('Error generating response', error);
    return { success: false, error: error.message };
  }
});

// Model directory selection
ipcMain.handle('select-model-directory', async () => {
  try {
    // Set default path
    const defaultPath = path.join(
      process.env.USERPROFILE || process.env.HOME, 
      '.lmstudio', 
      'models', 
      'lmstudio-community'
    );
    
    // Show dialog
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Models Directory',
      defaultPath: defaultPath
    });
    
    if (!result.canceled) {
      const dirPath = result.filePaths[0];
      await modelManager.setModelDirectory(dirPath);
      return { success: true, path: dirPath };
    }
    return { success: false };
  } catch (error) {
    logError('Error selecting directory', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-html', async (event, { conversationId, messages, summary }) => {
  console.log(`Starting HTML generation for conversation ${conversationId}`);
  
  // SAFETY CHECK 1: Verify we have valid messages
  if (!Array.isArray(messages) || messages.length === 0) {
    console.log('Aborting HTML generation: No valid messages provided');
    return {
      success: false,
      error: 'No valid messages to generate HTML from',
      html: getEnhancedFallbackHTML([], summary || ''),
      method: 'fallback'
    };
  }
  
  // SAFETY CHECK 2: Memory preparation - force garbage collection if possible
  try {
    if (global.gc) {
      console.log('Running garbage collection before HTML generation');
      global.gc();
      // Wait for GC to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (gcError) {
    console.log('Note: Garbage collection not available');
  }
  
  // SAFETY CHECK 3: Check GPU status before proceeding
  let gpuStatus = null;
  try {
    gpuStatus = await gpuMonitor.initialize();
    const primaryGpu = gpuStatus.gpuInfo && gpuStatus.gpuInfo[0];
    
    if (primaryGpu && primaryGpu.vramUsagePercent > 50) {
      console.log(`Dangerous GPU memory usage detected (${primaryGpu.vramUsagePercent.toFixed(1)}%), using static HTML generation instead`);
      
      // If GPU is already under heavy load, don't risk LLM-based generation
      return {
        success: true,
        html: getEnhancedFallbackHTML(messages, summary || ''),
        isValid: true,
        method: 'static-fallback'
      };
    }
  } catch (gpuError) {
    console.error('Error checking GPU status:', gpuError);
    // Continue with caution if we can't check the GPU
  }
  
  // SAFETY CHECK 4: Ensure LLM resources are properly managed
  if (llmService) {
    try {
      // Store model path for later
      const modelPath = llmService.modelPath;
      
      // Fully unload the model before HTML generation to free up all GPU resources
      console.log('Unloading LLM to free GPU resources');
      llmService.unloadModel();
      llmService = null;
      
      // Force garbage collection again
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Stop all GPU monitoring
      if (gpuMonitor) {
        const wasMonitoring = gpuMonitor.updateInterval !== null;
        if (wasMonitoring) {
          console.log('Stopping GPU monitoring');
          gpuMonitor.stopMonitoring();
        }
        
        // Create a simple static HTML without using any GPU resources
        console.log('Generating static HTML without using GPU resources');
        const staticHtml = getEnhancedFallbackHTML(messages, summary || '');
        
        // Resume GPU monitoring if it was active
        if (wasMonitoring) {
          try {
            console.log('Resuming GPU monitoring');
            gpuMonitor.startMonitoring(1000);
          } catch (error) {
            console.error('Error resuming GPU monitoring:', error);
          }
        }
        
        // Reload the model
        try {
          console.log('Reloading LLM model');
          llmService = new LLMService(modelPath);
          await llmService.loadModel();
          
          // Reinitialize services
          initializeServices(llmService);
        } catch (reloadError) {
          console.error('Error reloading model:', reloadError);
          // Continue without model loaded - user will need to reload manually
        }
        
        return {
          success: true,
          html: staticHtml,
          isValid: true,
          method: 'static-safe' // Indicate we used the safe generation method
        };
      } else {
        // If no GPU monitor, just create static HTML
        return {
          success: true,
          html: getEnhancedFallbackHTML(messages, summary || ''),
          isValid: true,
          method: 'static-no-monitor'
        };
      }
    } catch (error) {
      console.error('Error in HTML generation safety process:', error);
      return {
        success: false,
        error: error.message,
        html: getEnhancedFallbackHTML(messages, summary || ''),
        method: 'fallback-error'
      };
    }
  } else {
    // No model loaded, generate static HTML
    return {
      success: true,
      html: getEnhancedFallbackHTML(messages, summary || ''),
      isValid: true,
      method: 'static-no-model'
    };
  }
});

// Fallback HTML generation
ipcMain.handle('generate-fallback-html', async (event, { conversationId, messages }) => {
  try {
    if (!llmService) {
      throw new Error('No model loaded');
    }
    
    if (!htmlGenerator) {
      initializeServices(llmService);
    }
    
    // Generate fallback HTML
    const fallbackHtml = await llmService.generateFallbackHTML(messages);
    
    return {
      success: true,
      html: fallbackHtml
    };
  } catch (error) {
    logError('Error generating fallback HTML', error);
    return {
      success: false,
      error: error.message,
      html: htmlGenerator ? htmlGenerator.getMinimalHTML(messages) : `
        <html>
          <head><title>Fallback Error</title></head>
          <body style="font-family: sans-serif; padding: 20px;">
            <h1>Error Generating Page</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `
    };
  }
});

// Conversation summary generation
ipcMain.handle('generate-conversation-summary', async (event, { conversationId, messages }) => {
  try {
    if (!llmService) {
      throw new Error('No model loaded');
    }
    
    if (!conversationManager) {
      initializeServices(llmService);
    }
    
    // Generate summary
    const summary = await conversationManager.updateSummary(conversationId, messages);
    
    // Notify renderer
    mainWindow.webContents.send('conversation-summary', {
      conversationId,
      summary
    });
    
    return { success: true, summary };
  } catch (error) {
    logError('Error generating conversation summary', error);
    return { success: false, error: error.message };
  }
});

// ========== HELPER FUNCTIONS ==========

// Enhanced fallback HTML generation
function getEnhancedFallbackHTML(messages, summary = '') {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ArxAIv Conversation Explorer</title>
      <style>
        :root {
          --bg-primary: #0d1117;
          --bg-secondary: #161b22;
          --text-primary: #c9d1d9;
          --text-secondary: #8b949e;
          --accent-primary: #58a6ff;
          --accent-secondary: #7ee787;
          --user-bg: rgba(31, 111, 235, 0.2);
          --user-border: #1f6feb;
          --assistant-bg: rgba(35, 134, 54, 0.2);
          --assistant-border: #238636;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          line-height: 1.6;
          padding: 2rem;
        }
        
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        
        header {
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(88, 166, 255, 0.2);
        }
        
        h1 {
          color: var(--accent-primary);
          font-size: 2.2rem;
          margin-bottom: 0.5rem;
        }
        
        .subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
        }
        
        .metadata {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          margin-top: 1rem;
          padding: 0.8rem 1rem;
          background-color: var(--bg-secondary);
          border-radius: 6px;
        }
        
        .metadata-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .metadata-label {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        
        .metadata-value {
          color: var(--accent-primary);
          font-weight: 500;
        }
        
        .summary-section {
          margin: 2rem 0;
          padding: 1.5rem;
          background-color: var(--bg-secondary);
          border-left: 4px solid var(--accent-secondary);
          border-radius: 6px;
        }
        
        h2 {
          color: var(--accent-primary);
          margin-bottom: 1rem;
          font-size: 1.6rem;
        }
        
        h3 {
          color: var(--accent-primary);
          margin: 1.5rem 0 1rem 0;
          font-size: 1.4rem;
        }
        
        .messages {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .message {
          padding: 1.2rem;
          border-radius: 8px;
          position: relative;
        }
        
        .message.user {
          background-color: var(--user-bg);
          border-left: 4px solid var(--user-border);
        }
        
        .message.assistant {
          background-color: var(--assistant-bg);
          border-left: 4px solid var(--assistant-border);
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.8rem;
        }
        
        .role-label {
          background-color: rgba(255, 255, 255, 0.1);
          padding: 0.2rem 0.8rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05rem;
        }
        
        .user .role-label {
          background-color: var(--user-border);
          color: white;
        }
        
        .assistant .role-label {
          background-color: var(--assistant-border);
          color: white;
        }
        
        .message-content {
          white-space: pre-wrap;
          overflow-wrap: break-word;
        }
        
        .message-content code {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          background-color: rgba(0, 0, 0, 0.3);
          padding: 0.1rem 0.3rem;
          border-radius: 3px;
          font-size: 0.9em;
        }
        
        .message-content pre {
          background-color: rgba(0, 0, 0, 0.3);
          padding: 1rem;
          border-radius: 6px;
          overflow-x: auto;
          margin: 1rem 0;
        }
        
        .message-content pre code {
          background-color: transparent;
          padding: 0;
        }
        
        .timestamp {
          color: var(--text-secondary);
          font-size: 0.8rem;
        }
        
        footer {
          margin-top: 3rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(88, 166, 255, 0.2);
          color: var(--text-secondary);
          font-size: 0.9rem;
          text-align: center;
        }
        
        .note {
          background-color: rgba(255, 255, 255, 0.05);
          padding: 1rem;
          border-radius: 6px;
          margin: 2rem 0;
          font-style: italic;
          color: var(--text-secondary);
        }
        
        @media (max-width: 768px) {
          body {
            padding: 1rem;
          }
          
          h1 {
            font-size: 1.8rem;
          }
          
          .metadata {
            flex-direction: column;
            gap: 0.8rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>ArxAIv Conversation Explorer</h1>
          <div class="subtitle">Interactive conversation visualization</div>
          
          <div class="metadata">
            <div class="metadata-item">
              <div class="metadata-label">Messages:</div>
              <div class="metadata-value">${messages.length}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Generated:</div>
              <div class="metadata-value">${new Date().toLocaleString()}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Content Type:</div>
              <div class="metadata-value">AI Conversation</div>
            </div>
          </div>
        </header>
        
        ${summary ? `
          <section class="summary-section">
            <h2>Conversation Summary</h2>
            <p>${summary}</p>
          </section>
        ` : ''}
        
        <div class="note">
          Note: This is a fallback visualization created when LLM-based HTML generation was unavailable. 
          For a fully AI-generated custom visualization, try again when GPU resources are available.
        </div>
        
        <section>
          <h2>Conversation</h2>
          
          <div class="messages">
            ${messages.map((m, index) => `
              <div class="message ${m.role}">
                <div class="message-header">
                  <span class="role-label">${m.role}</span>
                  <span class="timestamp">Message #${index + 1}</span>
                </div>
                <div class="message-content">${formatMessageContent(m.content)}</div>
              </div>
            `).join('')}
          </div>
        </section>
        
        <footer>
          <p>Generated by ArxAIv Conversation Explorer</p>
        </footer>
      </div>
    </body>
    </html>
  `;
}

// Format message content for HTML display
function formatMessageContent(content) {
  // Escape HTML to prevent XSS
  const escapeHtml = (text) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };
  
  // First escape all HTML
  let safeContent = escapeHtml(content);
  
  // Then add formatting for code blocks
  const formatted = safeContent
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  
  return formatted;
}