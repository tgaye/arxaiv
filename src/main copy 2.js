// const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// const path = require('path');
// const fs = require('fs-extra');
// const ModelManager = require('./main/model-manager');
// const LLMService = require('./main/llm-service');
// const GPUMonitor = require('./main/gpu-monitor');
// const HTMLValidator = require('./main/html-validator');
// const HTMLGenerator = require('./main/html-generator');
// const ConversationManager = require('./main/conversation-manager');
// // Initialize services
// let mainWindow;
// const modelManager = new ModelManager();
// let llmService = null;
// const gpuMonitor = new GPUMonitor();

// // Add these variables with your other service initializations
// let htmlValidator = null;
// let htmlGenerator = null;
// let conversationManager = null;

// // Add this function somewhere in your file
// function initializeServices(llmService) {
//   htmlValidator = new HTMLValidator();
//   htmlGenerator = new HTMLGenerator(llmService);
//   conversationManager = new ConversationManager(llmService);
// }

// // Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

// // Hot reload for development
// if (process.env.NODE_ENV === 'development') {
//   try {
//     require('electron-reloader')(module, {
//       debug: true,
//       watchRenderer: false // We'll use webpack for the renderer
//     });
//   } catch (_) { console.log('Error with electron-reloader'); }
// }

// const createWindow = () => {
//   // Create the browser window.
//   mainWindow = new BrowserWindow({
//     width: 1200,
//     height: 800,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       // Fix preload path - use the webpack variable in dev mode or a fixed path in production
//       preload: process.env.NODE_ENV === 'development' 
//         ? MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY 
//         : path.join(__dirname, 'preload.js'),
//       webSecurity: process.env.NODE_ENV !== 'development',
//     },
//     icon: path.join(__dirname, '../../assets/icon.png'),
//     backgroundColor: '#0d1117',
//   });

//   // In main.js
//   if (process.env.NODE_ENV === 'development') {
//     mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
//       callback({
//         responseHeaders: {
//           ...details.responseHeaders,
//           'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self' ws:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"]
//         }
//       });
//     });
//   }
//   // and load the index.html of the app.
//   mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

//   // Open the DevTools in development
//   if (process.env.NODE_ENV === 'development') {
//     mainWindow.webContents.openDevTools();
//   }
// };

// // Set up GPU update events
// const setupGpuMonitoring = async () => {
//   try {
//     // Initialize GPU monitoring
//     const gpuInfo = await gpuMonitor.initialize();
    
//     // Catch any errors from monitoring
//     try {
//       gpuMonitor.startMonitoring(1000); // Update every 1 second
      
//       // Set up GPU update events
//       gpuMonitor.onUpdate((gpuData) => {
//         if (mainWindow && !mainWindow.isDestroyed()) {
//           mainWindow.webContents.send('gpu-stats-update', gpuData);
//         }
//       });
//     } catch (monitorError) {
//       console.error('Error starting GPU monitoring:', monitorError);
//       // Continue even if monitoring fails
//     }
    
//     return gpuInfo;
//   } catch (error) {
//     console.error('Error setting up GPU monitoring:', error);
//     return {
//       gpuCount: 0,
//       gpuInfo: [],
//       vramWarningThreshold: gpuMonitor.getVramWarningThreshold()
//     };
//   }
// };

// // This method will be called when Electron has finished initialization
// app.whenReady().then(async () => {
//   createWindow();
//   await modelManager.initialize();
//   await setupGpuMonitoring();
// });

// // Quit when all windows are closed, except on macOS.
// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });

// app.on('activate', () => {
//   // On OS X it's common to re-create a window in the app when the
//   // dock icon is clicked and there are no other windows open.
//   if (BrowserWindow.getAllWindows().length === 0) {
//     createWindow();
//   }
// });

// // IPC handlers
// ipcMain.handle('get-models', async () => {
//   try {
//     return await modelManager.getModels();
//   } catch (error) {
//     console.error('Error getting models:', error);
//     return [];
//   }
// });

// ipcMain.handle('load-model', async (event, modelPath) => {
//   try {
//     console.log(`Loading model from path: ${modelPath}`);
//     fs.appendFileSync(
//       path.join(__dirname, '../../debug-main.txt'), 
//       `\n${new Date().toISOString()}: Loading model: ${modelPath}\n`
//     );
    
//     // Unload previous model if one is loaded
//     if (llmService) {
//       llmService.unloadModel();
//     }
    
//     // Create new LLM service with selected model
//     llmService = new LLMService(modelPath);
//     await llmService.loadModel();
    
//     // Initialize HTML services
//     initializeServices(llmService);
    
//     fs.appendFileSync(
//       path.join(__dirname, '../../debug-main.txt'), 
//       `\n${new Date().toISOString()}: Model loaded successfully\n`
//     );
    
//     return { 
//       success: true, 
//       message: `Model loaded: ${path.basename(modelPath)}` 
//     };
//   } catch (error) {
//     console.error('Error loading model:', error);
//     fs.appendFileSync(
//       path.join(__dirname, '../../debug-main.txt'), 
//       `\n${new Date().toISOString()}: Error loading model: ${error.message}\n${error.stack}\n`
//     );
    
//     return { 
//       success: false, 
//       error: error.message 
//     };
//   }
// });

// ipcMain.handle('get-vram-warning-threshold', () => {
//   console.log('get-vram-warning-threshold handler called');
//   console.log('gpuMonitor:', gpuMonitor);
//   console.log('gpuMonitor.getVramWarningThreshold:', gpuMonitor.getVramWarningThreshold);
//   return gpuMonitor.getVramWarningThreshold();
// });
// ipcMain.handle('set-vram-warning-threshold', (event, threshold) => {
//   console.log('get-vram-warning-threshold handler called');
//   console.log('gpuMonitor:', gpuMonitor);
//   return gpuMonitor.setVramWarningThreshold(threshold);
// });

// ipcMain.handle('get-gpu-info', async (event) => {
//   console.log('get-gpu-info handler called');
//   try {
//     const result = await gpuMonitor.initialize();
//     console.log('GPU Info result:', result);
//     return result;
//   } catch (error) {
//     console.error('Error in get-gpu-info handler:', error);
//     return {
//       gpuCount: 0,
//       gpuInfo: [],
//       vramWarningThreshold: gpuMonitor.getVramWarningThreshold()
//     };
//   }
// });

// ipcMain.handle('send-message', async (event, { message, conversationId }) => {
//   try {
//     if (!llmService) {
//       throw new Error('No model loaded');
//     }
//     // Start streaming response
//     const responsePromise = llmService.generateResponse(message, (chunk) => {
//       // Send each chunk to the renderer process
//       mainWindow.webContents.send('response-chunk', { chunk, conversationId });
//     });
//     // Wait for the full response
//     const fullResponse = await responsePromise;
//     return { success: true, response: fullResponse };
//   } catch (error) {
//     console.error('Error generating response:', error);
//     return { success: false, error: error.message };
//   }
// });

// ipcMain.handle('select-model-directory', async () => {
//   try {
//     // Set the default path to the LM Studio community models
//     const defaultPath = path.join(
//       process.env.USERPROFILE || process.env.HOME, 
//       '.lmstudio', 
//       'models', 
//       'lmstudio-community'
//     );
    
//     const result = await dialog.showOpenDialog(mainWindow, {
//       properties: ['openDirectory'],
//       title: 'Select Models Directory',
//       defaultPath: defaultPath
//     });
//     if (!result.canceled) {
//       const dirPath = result.filePaths[0];
//       await modelManager.setModelDirectory(dirPath);
//       return { success: true, path: dirPath };
//     }
//     return { success: false };
//   } catch (error) {
//     console.error('Error selecting directory:', error);
//     return { success: false, error: error.message };
//   }
// });


// // Now add these handlers at the end of your file, right before the app.on('will-quit') line:

// // HTML generation handlers
// ipcMain.handle('generate-html', async (event, { conversationId, messages, summary }) => {
//   console.log(`generate-html called for conversation ${conversationId} with ${messages?.length || 0} messages`);
//   try {
//     if (!llmService) {
//       throw new Error('No model loaded');
//     }
    
//     console.log('Checking HTML services...');
//     if (!htmlGenerator) {
//       console.log('Initializing HTML services...');
//       initializeServices(llmService);
//     }
    
//     console.log('Calling htmlGenerator.generateHTML...');
    
//     // Add a timeout to prevent hanging if the GPU crashes
//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('HTML generation timed out')), 30000);
//     });
    
//     // Race the HTML generation against the timeout
//     const result = await Promise.race([
//       htmlGenerator.generateHTML(messages, summary),
//       timeoutPromise
//     ]);
    
//     console.log('HTML generation successful:', result?.isValid);
//     return {
//       success: true,
//       html: result.html,
//       isValid: result.isValid
//     };
//   } catch (error) {
//     console.error('Error in generate-html handler:', error);
//     // Provide a fallback HTML that doesn't depend on the GPU
//     return {
//       success: false,
//       error: error.message,
//       html: `
//         <!DOCTYPE html>
//         <html>
//           <head>
//             <title>Conversation Summary</title>
//             <style>
//               body { font-family: sans-serif; margin: 0; padding: 20px; background: #0d1117; color: #c9d1d9; }
//               .message { margin-bottom: 10px; padding: 10px; border-radius: 5px; }
//               .user { background: #1f6feb; }
//               .assistant { background: #238636; }
//               h1 { color: #58a6ff; }
//             </style>
//           </head>
//           <body>
//             <h1>Conversation Summary</h1>
//             <div class="messages">
//               ${messages.map(m => 
//                 `<div class="message ${m.role}">
//                   <strong>${m.role.toUpperCase()}:</strong>
//                   <p>${m.content}</p>
//                 </div>`
//               ).join('')}
//             </div>
//           </body>
//         </html>
//       `
//     };
//   }
// });

// ipcMain.handle('generate-fallback-html', async (event, { conversationId, messages }) => {
//   try {
//     if (!llmService) {
//       throw new Error('No model loaded');
//     }
    
//     if (!htmlGenerator) {
//       initializeServices(llmService);
//     }
    
//     // Generate fallback HTML
//     const fallbackHtml = await llmService.generateFallbackHTML(messages);
    
//     return {
//       success: true,
//       html: fallbackHtml
//     };
//   } catch (error) {
//     console.error('Error generating fallback HTML:', error);
//     return {
//       success: false,
//       error: error.message,
//       html: htmlGenerator ? htmlGenerator.getMinimalHTML(messages) : `
//         <html>
//           <head><title>Fallback Error</title></head>
//           <body style="font-family: sans-serif; padding: 20px;">
//             <h1>Error Generating Page</h1>
//             <p>${error.message}</p>
//           </body>
//         </html>
//       `
//     };
//   }
// });

// ipcMain.handle('generate-conversation-summary', async (event, { conversationId, messages }) => {
//   try {
//     if (!llmService) {
//       throw new Error('No model loaded');
//     }
    
//     if (!conversationManager) {
//       initializeServices(llmService);
//     }
    
//     // Generate a summary in the background
//     const summary = await conversationManager.updateSummary(conversationId, messages);
    
//     // Notify the renderer about the new summary
//     mainWindow.webContents.send('conversation-summary', {
//       conversationId,
//       summary
//     });
    
//     return { success: true, summary };
//   } catch (error) {
//     console.error('Error generating conversation summary:', error);
//     return { success: false, error: error.message };
//   }
// });

// // Add cleanup on app quit
// app.on('will-quit', () => {
//   gpuMonitor.stopMonitoring();
// });