// src/main/process-isolator.js

const { spawn } = require('child_process');

const path = require('path');

const fs = require('fs-extra');

const { app } = require('electron');



class ProcessIsolator {

  constructor(safetyManager) {

    this.safetyManager = safetyManager;

    this.processes = new Map();

    this.maxExecutionTime = 300000; // 5 minutes default

    this.logPath = path.join(app.getPath('userData'), 'logs', 'processes');

    

    // Ensure log directory exists

    fs.ensureDirSync(this.logPath);

  }

  

  generateProcessId(type) {

    return `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  }

  

  killProcessesByType(type) {

    let killCount = 0;

    

    this.processes.forEach((processInfo, processId) => {

      if (processInfo.type === type) {

        if (this.killProcess(processId)) {

          killCount++;

        }

      }

    });

    

    return killCount;

  }



  async runIsolatedProcess(command, args, options = {}) {

    const processId = this.generateProcessId(options.type || 'generic');

    const logFile = path.join(this.logPath, `${processId}.log`);

    

    // Create log file stream

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    logStream.write(`[${new Date().toISOString()}] Starting process: ${command} ${args.join(' ')}\n`);

    

    // Enhanced logging for HTML generation

    if (options.type === 'html-generation') {

      console.log(`======= HTML GENERATION PROCESS STARTING =======`);

      console.log(`Command: ${command}`);

      console.log(`Args: ${args.join(' ')}`);

      console.log(`Timeout: ${options.timeout || this.maxExecutionTime}ms`);

    }

    

    // Set defaults with more robust options

    const timeout = options.timeout || this.maxExecutionTime;

    const onData = options.onData || (() => {});

    const type = options.type || 'generic';

    const collectFullOutput = options.collectFullOutput || false;

    

    // HTML-specific token collection

    let outputBuffer = '';

    let completeHtmlBuffer = '';

    let isCollectingHtml = false;

    let htmlTokenCollectionStarted = false;

    

    return new Promise((resolve, reject) => {

      // Spawn the process with additional safety

      const process = spawn(command, args, {

        shell: false,

        windowsHide: true,

        stdio: ['pipe', 'pipe', 'pipe']

      });

      

      // Register with safety manager

      const completeTask = this.safetyManager.registerTask(processId, type, process);

      

      // Timeout handler

      const timeoutId = setTimeout(() => {

        logStream.write(`[${new Date().toISOString()}] Process timed out after ${timeout}ms\n`);

        

        if (type === 'html-generation') {

          console.log(`======= HTML GENERATION PROCESS TIMED OUT AFTER ${timeout}ms =======`);

        }

        

        this.killProcess(processId);

        reject(new Error(`Process timed out after ${timeout}ms`));

      }, timeout);

      

      // Track process

      this.processes.set(processId, { process, timeoutId, type, logStream });

      

      // Enhanced output collection

      let fullOutput = '';

      let errorOutput = '';

      let lastOutputTime = Date.now();

      

      // Stdout handler with improved logging and collection

      process.stdout.on('data', (data) => {

        try {

          const chunk = data.toString();

          

          // Collect full output if specified

          if (collectFullOutput) {

            fullOutput += chunk;

          }

          

          lastOutputTime = Date.now();

          logStream.write(`[STDOUT] ${chunk}`);

          

          // Verbose logging for HTML generation

          if (type === 'html-generation') {

            console.log(`HTML OUTPUT: ${chunk.substring(0, Math.min(chunk.length, 200))}${chunk.length > 200 ? '...' : ''}`);

            

            // HTML Token Collection Logic

            if (chunk.includes('HTML OUTPUT:')) {

              const tokens = chunk.split('HTML OUTPUT:')

                .filter(token => token.trim() !== '')

                .map(token => token.trim());

              

              tokens.forEach(token => {

                // Detect start of HTML

                if (token.startsWith('<!') || token.startsWith('<html')) {

                  isCollectingHtml = true;

                  htmlTokenCollectionStarted = true;

                  outputBuffer = '';

                }

                

                // Collect HTML tokens

                if (isCollectingHtml) {

                  outputBuffer += token;

                }

                

                // Detect end of HTML

                if (token.includes('</html>')) {

                  completeHtmlBuffer = outputBuffer;

                  isCollectingHtml = false;

                }

              });

            }

          }

          

          // Call custom data handler

          try {

            onData(chunk, 'stdout');

          } catch (callbackError) {

            console.error(`onData callback error: ${callbackError.message}`);

            logStream.write(`[ERROR] onData callback error: ${callbackError.message}\n`);

          }

        } catch (error) {

          console.error(`Error processing stdout: ${error.message}`);

          logStream.write(`[ERROR] Processing stdout data: ${error.message}\n`);

        }

      });

      

      // Stderr handler

      process.stderr.on('data', (data) => {

        const chunk = data.toString();

        errorOutput += chunk;

        logStream.write(`[STDERR] ${chunk}`);

        

        if (type === 'html-generation') {

          console.log(`HTML ERROR OUTPUT: ${chunk}`);

        }

        

        onData(chunk, 'stderr');

      });

      

      // Activity monitoring

      const activityCheck = setInterval(() => {

        const now = Date.now();

        const idleTime = now - lastOutputTime;

        

        if (idleTime > 5000 && type === 'html-generation') {

          console.log(`HTML GENERATION: Process idle for ${Math.floor(idleTime/1000)}s`);

          logStream.write(`[${new Date().toISOString()}] Process idle for ${Math.floor(idleTime/1000)}s\n`);

        }

      }, 5000);

      

      // Process completion handler

      process.on('close', (code) => {

        clearTimeout(timeoutId);

        clearInterval(activityCheck);

        completeTask();

        

        logStream.write(`[${new Date().toISOString()}] Process exited with code: ${code}\n`);

        

        if (type === 'html-generation') {

          console.log(`======= HTML GENERATION PROCESS COMPLETED WITH CODE ${code} =======`);

          if (code !== 0) {

            console.log(`HTML GENERATION ERROR OUTPUT: ${errorOutput}`);

          }

          

          // Log HTML collection results

          console.log(`HTML Token Collection Status:`);

          console.log(`- Collection Started: ${htmlTokenCollectionStarted}`);

          console.log(`- Complete HTML Buffer Length: ${completeHtmlBuffer.length}`);

        }

        

        logStream.end();

        this.processes.delete(processId);

        

        // Return HTML buffer if available, otherwise fallback

        if (code === 0) {

          const outputToReturn = completeHtmlBuffer || fullOutput;

          resolve(collectFullOutput 

            ? { output: outputToReturn, processId } 

            : { processId }

          );

        } else {

          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));

        }

      });

      

      // Error handler

      process.on('error', (error) => {

        clearTimeout(timeoutId);

        clearInterval(activityCheck);

        completeTask();

        

        logStream.write(`[${new Date().toISOString()}] Process error: ${error.message}\n`);

        

        if (type === 'html-generation') {

          console.log(`======= HTML GENERATION PROCESS ERROR: ${error.message} =======`);

        }

        

        logStream.end();

        this.processes.delete(processId);

        reject(error);

      });

    });

}

  

  killProcess(processId) {

    if (this.processes.has(processId)) {

      const { process, timeoutId, logStream } = this.processes.get(processId);

      

      clearTimeout(timeoutId);

      

      try {

        logStream.write(`[${new Date().toISOString()}] Force killing process\n`);

        

        // Try graceful termination first

        if (process.kill('SIGTERM')) {

          // Give it a moment, then force kill if still running

          setTimeout(() => {

            try {

              // Check if process is still running

              const isRunning = process.exitCode === null;

              if (isRunning) {

                process.kill('SIGKILL');

                logStream.write(`[${new Date().toISOString()}] Forced SIGKILL after SIGTERM\n`);

              }

            } catch (e) {

              // Process likely already terminated

            }

          }, 500);

        }

      } catch (error) {

        logStream.write(`[${new Date().toISOString()}] Error killing process: ${error.message}\n`);

      } finally {

        logStream.end();

        this.processes.delete(processId);

      }

      

      return true;

    }

    

    return false;

  }

  

  killAllProcesses() {

    let killCount = 0;

    

    this.processes.forEach((_, processId) => {

      if (this.killProcess(processId)) {

        killCount++;

      }

    });

    

    return killCount;

  }

  

  setMaxExecutionTime(timeMs) {

    this.maxExecutionTime = timeMs;

  }

}



module.exports = ProcessIsolator;