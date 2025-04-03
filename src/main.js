const { app, BrowserWindow, ipcMain, dialog } = require('electron');

const path = require('path');

const fs = require('fs-extra');

const ModelManager = require('./main/model-manager');

const LLMService = require('./main/llm-service');

const SafetyManager = require('./main/safety-manager');

const ProcessIsolator = require('./main/process-isolator');

const VRAMGuardian = require('./main/vram-guardian');

const ConversationManager = require('./main/conversation-manager');



// Global shutdown flag to prevent new operations during shutdown

let isShuttingDown = false;



// Initialize main services

let mainWindow;

let safetyManager;

let processIsolator;

let vramGuardian;

let modelManager;

let llmService = null;

let conversationManager = null;



// Configurables

const DEBUG_MODE = process.env.NODE_ENV === 'development';

const CRASH_PROTECTION = true; // Set to false only for debugging



// Error logging helper

function logError(message, error) {

  console.error(message, error);

  try {

    const logDir = path.join(app.getPath('userData'), 'logs');

    fs.ensureDirSync(logDir);

    

    fs.appendFileSync(

      path.join(logDir, 'error.log'), 

      `\n${new Date().toISOString()}: ${message}: ${error.message}\n${error.stack}\n`

    );

  } catch (err) {

    console.error('Failed to write to debug log:', err);

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



// Enable garbage collection access if available

if (DEBUG_MODE) {

  try {

    // This is only useful if the app is run with --expose-gc

    global.gc = global.gc || (() => console.log('GC not exposed. Start with --expose-gc'));

  } catch (e) {

    console.log('GC not available');

  }

}



// Create main window

const createWindow = async () => {

  try {

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



    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {

      callback({

        responseHeaders: {

          ...details.responseHeaders,

          'Content-Security-Policy': [
            "default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'self' ws: wss:; style-src * 'self' 'unsafe-inline'; frame-src * 'self' data: blob:; img-src * 'self' data: blob:; font-src * 'self' data: blob:; object-src 'self' data: blob:; media-src * 'self' data: blob:;"
          ]
        }

      });

    });



    

    // Load the app's HTML

    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);



    // Initialize core services that need the window

    safetyManager = new SafetyManager(mainWindow);

    processIsolator = new ProcessIsolator(safetyManager);

    vramGuardian = new VRAMGuardian(safetyManager);

    

    // Start VRAM safety monitoring

    vramGuardian.startMonitoring();



    // Open DevTools in development

    if (process.env.NODE_ENV === 'development') {

      mainWindow.webContents.openDevTools();

    }

    

    // Handle window closure gracefully

    mainWindow.on('close', async (e) => {

      if (!isShuttingDown && CRASH_PROTECTION) {

        // Prevent the default close

        e.preventDefault();

        

        // Set the shutdown flag

        isShuttingDown = true;

        

        try {

          // Notify renderer about shutdown

          mainWindow.webContents.send('app-shutting-down');

          

          // Give a moment for the renderer to show shutdown UI

          await new Promise(resolve => setTimeout(resolve, 200));

          

          // Clean up resources

          await performGracefulShutdown();

          

          // Now actually close

          mainWindow.destroy();

        } catch (error) {

          logError('Error during window close', error);

          mainWindow.destroy();

        }

      }

    });

  } catch (error) {

    logError('Error creating window', error);

    app.quit();

  }

};



// Initialize remaining services

const initializeServices = async () => {

  try {

    // Initialize model manager

    modelManager = new ModelManager();

    await modelManager.initialize();

    

    // Give time for the window to load

    await new Promise(resolve => setTimeout(resolve, 500));

    

    // Notify about successful initialization

    if (mainWindow && !mainWindow.isDestroyed()) {

      mainWindow.webContents.send('services-initialized');

    }

  } catch (error) {

    logError('Failed to initialize services', error);

    

    if (mainWindow && !mainWindow.isDestroyed()) {

      mainWindow.webContents.send('initialization-error', {

        error: error.message

      });

    }

  }

};





let isShuttingDownRenderer = false;

// Perform graceful shutdown

const performGracefulShutdown = async () => {

  console.log('Performing graceful shutdown...');

  isShuttingDownRenderer = true;

  // Stop monitoring

  if (vramGuardian) {

    vramGuardian.stopMonitoring();

  }

  

  // Kill any running processes

  if (processIsolator) {

    const killedCount = processIsolator.killAllProcesses();

    console.log(`Killed ${killedCount} running processes`);

  }

  

  // Unload model

  if (llmService) {

    try {

      await llmService.unloadModel();

      llmService = null;

    } catch (error) {

      logError('Error unloading model during shutdown', error);

    }

  }

  

  // Force GC

  if (global.gc) {

    try {

      global.gc();

    } catch (e) {

      // Ignore GC errors

    }

  }

  

  console.log('Graceful shutdown complete');

};



// Init app when ready

app.whenReady().then(async () => {

  try {

    // Create window first

    await createWindow();

    

    // Then initialize services

    await initializeServices();

    

    // Enable crash reporting in production

    if (!DEBUG_MODE && CRASH_PROTECTION) {

      process.on('uncaughtException', (error) => {

        logError('Uncaught exception in main process', error);

        

        if (safetyManager) {

          safetyManager.triggerEmergencyShutdown(`Uncaught exception: ${error.message}`);

        } else {

          app.exit(1);

        }

      });

    }

  } catch (error) {

    logError('Error during app initialization', error);

    app.quit();

  }

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



// Perform cleanup before quitting

app.on('will-quit', async (e) => {

  if (!isShuttingDown && CRASH_PROTECTION) {

    // Prevent immediate quit

    e.preventDefault();

    

    // Set the shutdown flag

    isShuttingDown = true;

    

    try {

      // Clean up resources

      await performGracefulShutdown();

      

      // Now actually quit

      app.quit();

    } catch (error) {

      logError('Error during app quit', error);

      app.quit();

    }

  }

});



// Initialize HTML-related services

function initializeHtmlServices(llmServiceInstance) {

  try {

    // Only create once

    if (!conversationManager && llmServiceInstance) {

      conversationManager = new ConversationManager(llmServiceInstance);

    }

  } catch (error) {

    logError('Failed to initialize HTML services', error);

  }

}



// ========== IPC HANDLERS ==========

ipcMain.handle('read-html-file', async (event, filePath) => {
  try {
    // Make sure the path is within the app's directory for security
    const appPath = app.getAppPath();
    const fullPath = path.join(appPath, filePath);
    
    // Security check - make sure the file is within the app directory
    if (!fullPath.startsWith(appPath)) {
      throw new Error('Access denied: Attempting to access a file outside the app directory');
    }
    
    // Read the file
    const fileContent = await fs.readFile(fullPath, 'utf8');
    return { success: true, content: fileContent };
  } catch (error) {
    console.error('Error reading HTML file:', error);
    return { success: false, error: error.message };
  }
});



// Model listing

ipcMain.handle('get-models', async () => {

  try {

    if (isShuttingDown) return { success: false, error: 'Application is shutting down' };

    return await modelManager.getModels();

  } catch (error) {

    logError('Error getting models', error);

    return [];

  }

});



// Model loading

ipcMain.handle('load-model', async (event, modelPath) => {

  try {

    if (isShuttingDown) return { success: false, error: 'Application is shutting down' };

    

    console.log(`Loading model from path: ${modelPath}`);

    

    // Check GPU status before loading

    const vramStatus = await vramGuardian.checkVramSafety();

    if (!vramStatus.safe) {

      const criticalGpu = vramStatus.criticalGpu;

      return { 

        success: false, 

        error: `GPU resources critical: ${criticalGpu.name} at ${criticalGpu.vramUsagePercent.toFixed(1)}% VRAM usage`,

        vramIssue: true

      };

    }

    

    // Unload previous model if one is loaded to free GPU memory

    if (llmService) {

      await llmService.unloadModel();

      llmService = null;

      

      // Force garbage collection

      if (global.gc) {

        global.gc();

        // Wait for GC to complete

        await new Promise(resolve => setTimeout(resolve, 300));

      }

    }

    

    // Create new LLM service with selected model

    llmService = new LLMService(modelPath, processIsolator, safetyManager);

    

    // Register model loading as a critical task with the safety manager

    const modelLoadingTaskId = `model-loading-${Date.now()}`;

    const completeTask = safetyManager.registerTask(modelLoadingTaskId, 'model-loading');

    

    try {

      await llmService.loadModel();

      completeTask();

      

      // Initialize HTML services

      initializeHtmlServices(llmService);

      

      return { 

        success: true, 

        message: `Model loaded: ${path.basename(modelPath)}` 

      };

    } catch (error) {

      completeTask();

      throw error;

    }

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

  if (isShuttingDown) return 80; // Default value if shutting down

  return vramGuardian.highVramThreshold;

});



ipcMain.handle('set-vram-warning-threshold', (event, threshold) => {

  if (isShuttingDown) return false;

  

  vramGuardian.setThresholds({

    highVram: threshold

  });

  

  safetyManager.setWarningThresholds({

    vramUsagePercent: threshold

  });

  

  return threshold;

});



// GPU info

ipcMain.handle('get-gpu-info', async () => {

  try {

    if (isShuttingDown) return {

      gpuCount: 0,

      gpuInfo: [],

      vramWarningThreshold: 80

    };

    

    const metrics = await vramGuardian.checkGpuMetrics();

    

    if (!metrics || metrics.length === 0) {

      return {

        gpuCount: 0,

        gpuInfo: [],

        vramWarningThreshold: vramGuardian.highVramThreshold

      };

    }

    

    return {

      gpuCount: metrics.length,

      gpuInfo: metrics.map(gpu => ({

        name: gpu.name,

        utilizationGpu: gpu.utilization || 0,

        memoryTotal: gpu.memoryTotalMB * 1024 * 1024, // Convert to bytes

        memoryUsed: gpu.memoryUsedMB * 1024 * 1024, // Convert to bytes

        vramUsagePercent: gpu.vramUsagePercent,

        temperature: gpu.temperature || 0,

        isVramWarning: gpu.vramUsagePercent > vramGuardian.highVramThreshold

      })),

      vramWarningThreshold: vramGuardian.highVramThreshold

    };

  } catch (error) {

    logError('Error getting GPU info', error);

    return {

      gpuCount: 0,

      gpuInfo: [],

      vramWarningThreshold: vramGuardian.highVramThreshold

    };

  }

});



// Chat message handling

ipcMain.handle('send-message', async (event, { message, conversationId }) => {

  try {

    if (isShuttingDown) return { success: false, error: 'Application is shutting down' };

    

    if (!llmService) {

      throw new Error('No model loaded');

    }

    

    // Check GPU status before inference

    const vramStatus = await vramGuardian.checkVramSafety();

    if (!vramStatus.safe) {

      const criticalGpu = vramStatus.criticalGpu;

      return { 

        success: false, 

        error: `GPU resources critical: ${criticalGpu.name} at ${criticalGpu.vramUsagePercent.toFixed(1)}% VRAM usage. Please try again after closing some applications.`,

        vramIssue: true

      };

    }

    

    // Register the inference task with the safety manager

    const inferenceTaskId = `inference-${conversationId}-${Date.now()}`;

    const completeTask = safetyManager.registerTask(inferenceTaskId, 'inference');

    

    try {

      // Stream response

      const responsePromise = llmService.generateResponse(message, (chunk) => {

        // Send chunks to renderer

        if (mainWindow && !mainWindow.isDestroyed()) {

          // THIS LINE WAS CRASHING THE APP:

          // ** Your LLM process is generating output

          // The code is trying to send that output to the renderer process (the UI window)

          // But the renderer process has already crashed or is being disposed of **



          safelySendToRenderer('response-chunk', { chunk, conversationId });

        }

      });

      

      // Wait for full response

      const fullResponse = await responsePromise;

      completeTask();

      return { success: true, response: fullResponse };

    } catch (error) {

      completeTask();

      throw error;

    }

  } catch (error) {

    logError('Error generating response', error);

    return { success: false, error: error.message };

  }

});



// Model directory selection

ipcMain.handle('select-model-directory', async () => {

  try {

    if (isShuttingDown) return { success: false, error: 'Application is shutting down' };

    

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

// In main.js - Modify the generate-html handler

ipcMain.handle('generate-html', async (event, { conversationId, messages, summary }) => {

  // Debugging checklist

  const debugChecklist = {

    safetyChecks: {

      shuttingDown: false,

      validMessages: false,

      gpuSafe: false,

      modelLoaded: false

    },

    htmlGeneration: {

      processStarted: false,

      outputReceived: false,

      extractionAttempted: false,

      htmlExtracted: false,

      htmlValidated: false

    },

    finalOutcome: {

      success: false,

      method: 'unknown'

    }

  };



  // Logging function with emojis

  const logChecklistStatus = () => {

    console.log('🔍 HTML Generation Checklist:');

    console.log('Safety Checks:');

    console.log(`  Shutting Down: ${debugChecklist.safetyChecks.shuttingDown ? '❌' : '✅'}`);

    console.log(`  Valid Messages: ${debugChecklist.safetyChecks.validMessages ? '✅' : '❌'}`);

    console.log(`  GPU Safe: ${debugChecklist.safetyChecks.gpuSafe ? '✅' : '❌'}`);

    console.log(`  Model Loaded: ${debugChecklist.safetyChecks.modelLoaded ? '✅' : '❌'}`);

    

    console.log('\nHTML Generation:');

    console.log(`  Process Started: ${debugChecklist.htmlGeneration.processStarted ? '✅' : '❌'}`);

    console.log(`  Output Received: ${debugChecklist.htmlGeneration.outputReceived ? '✅' : '❌'}`);

    console.log(`  Extraction Attempted: ${debugChecklist.htmlGeneration.extractionAttempted ? '✅' : '❌'}`);

    console.log(`  HTML Extracted: ${debugChecklist.htmlGeneration.htmlExtracted ? '✅' : '❌'}`);

    console.log(`  HTML Validated: ${debugChecklist.htmlGeneration.htmlValidated ? '✅' : '❌'}`);

    

    console.log('\nFinal Outcome:');

    console.log(`  Success: ${debugChecklist.finalOutcome.success ? '✅' : '❌'}`);

    console.log(`  Method: ${debugChecklist.finalOutcome.method}`);

  };



  try {

    // Shutting Down Check

    if (isShuttingDown) {

      debugChecklist.safetyChecks.shuttingDown = true;

      logChecklistStatus();

      return { 

        success: false, 

        error: 'Application is shutting down',

        html: getStaticFallbackHTML(messages, 'Application is shutting down'),

        method: 'shutdown-fallback'

      };

    }

    

    // Messages Validation

    if (!Array.isArray(messages) || messages.length === 0) {

      console.log('❌ Aborting HTML generation: No valid messages provided');

      debugChecklist.safetyChecks.validMessages = false;

      logChecklistStatus();

      return {

        success: false,

        error: 'No valid messages to generate HTML from',

        html: getStaticFallbackHTML([], summary || ''),

        method: 'fallback'

      };

    }

    debugChecklist.safetyChecks.validMessages = true;

    

    // GPU Safety Check

    const vramStatus = await vramGuardian.checkVramSafety();

    if (!vramStatus.safe) {

      console.log('❌ Critical GPU status detected');

      debugChecklist.safetyChecks.gpuSafe = false;

      logChecklistStatus();

      return {

        success: true,

        html: getStaticFallbackHTML(messages, summary || 'GPU resources are critical. Using static HTML generation.'),

        isValid: true,

        method: 'critical-gpu-fallback',

        vramIssue: true

      };

    }

    debugChecklist.safetyChecks.gpuSafe = true;

    

    // Model Loading Check

    if (!llmService) {

      console.log('❌ No model loaded');

      debugChecklist.safetyChecks.modelLoaded = false;

      logChecklistStatus();

      return {

        success: false,

        error: 'No model loaded',

        html: getStaticFallbackHTML(messages, summary || 'No model loaded'),

        method: 'no-model-fallback'

      };

    }

    debugChecklist.safetyChecks.modelLoaded = true;

    

    // Prepare HTML Generation

    const htmlGenTimeout = 180000; // 3 minute timeout

    const prompt = `

Generate a complete, valid HTML5 document for the following conversation:



Conversation Context:

${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}



HTML Generation Requirements:

- Must start with <!DOCTYPE html>

- Include full HTML structure

- Responsive dark-themed design

- Embedded CSS and optional minimal JavaScript

- No external dependencies

- Focus on readability and conversation visualization



IMPORTANT: Respond ONLY with the complete HTML document, starting from <!DOCTYPE html> 

and ending with </html>. Do not include any additional text or markdown markers.

`;

    

    console.log("🚀 Running HTML generation");

    

    // Run HTML Generation Process

    debugChecklist.htmlGeneration.processStarted = true;

    const htmlResult = await processIsolator.runIsolatedProcess(

      llmService.binPath,

      [

        '-m', llmService.modelPath,

        '--prompt', prompt,

        '--temp', '0.7',

        '-c', '2048',

        '--no-display-prompt',

        '--gpu-layers', '1', 

        '--n-predict', '4096'

      ],

      {

        timeout: htmlGenTimeout,

        type: 'html-generation',

        collectFullOutput: true,

        onData: (chunk, type) => {

          debugChecklist.htmlGeneration.outputReceived = true;

          if (type === 'stdout' && mainWindow && !mainWindow.isDestroyed()) {

            mainWindow.webContents.send('html-generation-status', {

              status: 'processing',

              message: 'Processing HTML content...',

              progress: chunk.substring(0, 20) + "..."

            });

          }

        }

      }

    );

    

    // Extract HTML

    debugChecklist.htmlGeneration.extractionAttempted = true;

    const extractHTML = (output) => {

      const htmlTokens = output

        .split('HTML OUTPUT:')

        .filter(token => token.trim() !== '')

        .map(token => token.trim());

      

      const reconstructedHtml = htmlTokens

        .join('')

        .replace(/\s+/g, ' ')

        .trim();

      

      const htmlMatch = reconstructedHtml.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);

      return htmlMatch ? htmlMatch[0] : null;

    };

    

    // Extraction Strategies

    const extractionStrategies = [

      () => extractHTML(htmlResult.output),

      () => {

        const markdownMatch = htmlResult.output.match(/```html\s*(<!DOCTYPE html>[\s\S]*?<\/html>)\s*```/i);

        return markdownMatch ? markdownMatch[1] : null;

      },

      () => {

        const directMatch = htmlResult.output.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);

        return directMatch ? directMatch[0] : null;

      }

    ];

    

    // Try extraction strategies

    let html = null;

    for (const strategy of extractionStrategies) {

      html = strategy();

      if (html) break;

    }

    

    // Log extraction results

    if (html) {

      debugChecklist.htmlGeneration.htmlExtracted = true;

      console.log(`✅ HTML Extracted Successfully (Length: ${html.length} bytes)`);

      console.log('🔍 HTML Preview:');

      console.log(html.substring(0, 500) + '...');

    } else {

      console.log('❌ Failed to extract HTML');

      console.log('🔍 Raw Output Preview:');

      console.log(htmlResult.output.substring(0, 500) + '...');

    }

    

    // HTML Validation

    if (html) {

      const { JSDOM } = require('jsdom');

      try {

        new JSDOM(html);

        debugChecklist.htmlGeneration.htmlValidated = true;

        console.log('✅ HTML Structure Validated Successfully');

      } catch (validationError) {

        console.log('❌ HTML Validation Failed');

        console.log(`Validation Error: ${validationError.message}`);

        html = null;

      }

    }

    

    // Final Outcome

    if (html) {

      debugChecklist.finalOutcome.success = true;

      debugChecklist.finalOutcome.method = 'isolated-process';

      logChecklistStatus();

      

      // Immediate rendering

      if (mainWindow && !mainWindow.isDestroyed()) {

        mainWindow.webContents.send('html-content-ready', {

          conversationId,

          html,

          method: 'isolated-process'

        });

      }

      

      return {

        success: true,

        html,

        isValid: true,

        method: 'isolated-process'

      };

    } else {

      throw new Error('No valid HTML could be extracted or validated');

    }

  } catch (error) {

    console.error('❌ HTML Generation Fatal Error:', error);

    

    debugChecklist.finalOutcome.success = false;

    debugChecklist.finalOutcome.method = 'error-fallback';

    logChecklistStatus();

    

    // Notify renderer about failed generation

    if (mainWindow && !mainWindow.isDestroyed()) {

      mainWindow.webContents.send('html-generation-status', {

        status: 'error',

        message: `Error: ${error.message}`

      });

    }

    

    // Return fallback HTML

    return {

      success: false,

      error: error.message,

      html: getStaticFallbackHTML(messages, summary || `Error generating HTML: ${error.message}`),

      method: 'error-fallback'

    };

  }

});



// Fallback HTML generation (simplified version that doesn't use LLM)

ipcMain.handle('generate-fallback-html', async (event, { conversationId, messages }) => {

  try {

    if (isShuttingDown) return { 

      success: false, 

      error: 'Application is shutting down',

      html: getStaticFallbackHTML(messages, 'Application is shutting down')

    };

    

    return {

      success: true,

      html: getStaticFallbackHTML(messages, 'Fallback HTML generation')

    };

  } catch (error) {

    logError('Error generating fallback HTML', error);

    return {

      success: false,

      error: error.message,

      html: getStaticFallbackHTML(messages, `Error: ${error.message}`)

    };

  }

});



// Conversation summary generation

ipcMain.handle('generate-conversation-summary', async (event, { conversationId, messages }) => {

  try {

    if (isShuttingDown) return { success: false, error: 'Application is shutting down' };

    

    if (!llmService) {

      throw new Error('No model loaded');

    }

    

    if (!conversationManager) {

      initializeHtmlServices(llmService);

    }

    

    // Skip summary generation if VRAM is high

    const vramStatus = await vramGuardian.checkVramSafety();

    const primaryGpu = vramStatus.metrics && vramStatus.metrics[0];

    

    if (primaryGpu && primaryGpu.vramUsagePercent > vramGuardian.highVramThreshold) {

      const simpleSummary = `Conversation with ${messages.length} messages (summary generation skipped to conserve GPU memory)`;

      

      // Notify renderer

      if (mainWindow && !mainWindow.isDestroyed()) {

        mainWindow.webContents.send('conversation-summary', {

          conversationId,

          summary: simpleSummary

        });

      }

      

      return { 

        success: true, 

        summary: simpleSummary,

        skipped: true

      };

    }

    

    // Register summary generation task with the safety manager

    const summaryTaskId = `summary-${conversationId}-${Date.now()}`;

    const completeTask = safetyManager.registerTask(summaryTaskId, 'summary-generation');

    

    try {

      // Generate summary

      const summary = await conversationManager.updateSummary(conversationId, messages);

      completeTask();

      

      // Notify renderer

      if (mainWindow && !mainWindow.isDestroyed()) {

        mainWindow.webContents.send('conversation-summary', {

          conversationId,

          summary

        });

      }

      

      return { success: true, summary };

    } catch (error) {

      completeTask();

      throw error;

    }

  } catch (error) {

    logError('Error generating conversation summary', error);

    return { success: false, error: error.message };

  }

});



// Safety-related handlers

ipcMain.handle('get-system-resources', async () => {

  try {

    if (isShuttingDown) return { success: false, error: 'Application is shutting down' };

    

    const vramStatus = await vramGuardian.checkVramSafety();

    

    return {

      success: true,

      gpuMetrics: vramStatus.metrics || [],

      systemInfo: safetyManager.getSystemInfo()

    };

  } catch (error) {

    logError('Error getting system resources', error);

    return { success: false, error: error.message };

  }

});



ipcMain.handle('force-gpu-reset', async () => {

  try {

    if (isShuttingDown) return { success: false, error: 'Application is shutting down' };

    

    // Stop any active LLM processes

    if (llmService) {

      await llmService.unloadModel();

    }

    

    // Force cleanup

    if (processIsolator) {

      processIsolator.killAllProcesses();

    }

    

    // Force GC

    if (global.gc) {

      global.gc();

      await new Promise(resolve => setTimeout(resolve, 500));

    }

    

    // Try GPU reset

    await vramGuardian.forceGpuReset();

    

    return { success: true };

  } catch (error) {

    logError('Error forcing GPU reset', error);

    return { success: false, error: error.message };

  }

});



// ========== IPC LISTENERS ==========



// Listen for safety-critical errors from renderer

ipcMain.on('report-critical-error', (event, { message, stack }) => {

  logError('Critical error reported from renderer', { message, stack });

  

  if (safetyManager) {

    safetyManager.logSafetyEvent(`Critical error from renderer: ${message}`);

  }

});



// ========== HELPER FUNCTIONS ==========



// Static fallback HTML generation

function getStaticFallbackHTML(messages, summary = '') {

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

          font-family: 'JetBrains Mono', monospace, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;

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

          font-family: 'JetBrains Mono', monospace;

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

          <div class="subtitle">Safe Mode HTML Visualization</div>

          

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

              <div class="metadata-label">Mode:</div>

              <div class="metadata-value">Static Safe Mode</div>

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

          This is a safe-mode visualization created to protect your GPU resources and prevent system crashes.

          This static template uses minimal GPU memory while still displaying your conversation content.

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

          <p>Generated in Safe Mode by ArxAIv Conversation Explorer</p>

        </footer>

      </div>

    </body>

    </html>

  `;

}



function safelySendToRenderer(channel, data) {

    if (isShuttingDownRenderer) {

    return false;

  }

  

  try {

    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {

      mainWindow.webContents.send(channel, data);

      return true;

    }

    return false;

  } catch (error) {

    console.log(`Failed to send message to renderer (${channel}):`, error.message);

    return false;

  }

}



// Format message content for HTML display

function formatMessageContent(content) {

  // Escape HTML to prevent XSS

  const escapeHtml = (text) => {

    if (typeof text !== 'string') return '';

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