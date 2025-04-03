// src/main/llm-service.js

const path = require('path');

const fs = require('fs-extra');

const { spawn } = require('child_process');

const os = require('os');



class LLMService {

  constructor(modelPath, processIsolator, safetyManager) {

    this.modelPath = modelPath;

    this.processIsolator = processIsolator;

    this.safetyManager = safetyManager;

    this.process = null;

    this.modelName = path.basename(modelPath, path.extname(modelPath));

    this.isLoading = false;

    this.binPath = this._getLlamaCppPath();

    this.isModelLoaded = false;

    

    // Create model-specific log directory

    this.logDir = path.join(

      process.env.USERPROFILE || process.env.HOME, 

      '.arxaiv', 

      'logs', 

      'llm'

    );

    fs.ensureDirSync(this.logDir);

    

    this.logPath = path.join(this.logDir, `${this.modelName}-${Date.now()}.log`);

    this.log(`LLMService constructor called with model path: ${modelPath}`);

    this.log(`Using binary path: ${this.binPath}`);

  }



  log(message) {

    const timestamp = new Date().toISOString();

    const logEntry = `[${timestamp}] ${message}\n`;

    

    // Console and file logging

    console.log(`[LLM] ${message}`);

    fs.appendFileSync(this.logPath, logEntry);

    

    // Also log to safety manager if available

    if (this.safetyManager) {

      this.safetyManager.logSafetyEvent(`[LLM] ${message}`);

    }

  }



  _getLlamaCppPath() {

    // Path to the llama.cpp executable - should be included with your app

    const platform = os.platform();

    const binDir = path.join(__dirname, '../../bin');

    

    let binName;

    if (platform === 'win32') {

      binName = 'llama-cli.exe'; // Windows executable name

    } else if (platform === 'darwin') {

      binName = 'llama-cli'; // macOS executable name

    } else {

      binName = 'llama-cli'; // Linux executable name

    }

    

    return path.join(binDir, binName);

  }



  async loadModel() {

    if (this.isLoading) {

      throw new Error('Model is already loading');

    }

  

    if (this.isModelLoaded) {

      this.log('Model already loaded');

      return true;

    }

  

    this.isLoading = true;

    

    this.log(`Starting to load model from: ${this.modelPath}`);

  

    try {

      // Check if the binary exists

      if (!fs.existsSync(this.binPath)) {

        this.log(`llama.cpp binary not found at: ${this.binPath}`);

        throw new Error(`llama.cpp binary not found at: ${this.binPath}`);

      }

      

      // Verify the model file exists

      if (!fs.existsSync(this.modelPath)) {

        this.log(`Model file not found at: ${this.modelPath}`);

        throw new Error(`Model file not found at: ${this.modelPath}`);

      }

      

      // Simple file validation approach

      try {

        // Check file size

        const fileStats = fs.statSync(this.modelPath);

        if (fileStats.size < 100000) { // Models should be at least 100KB

          throw new Error('Model file appears to be invalid or too small');

        }

        

        // Read first bytes to check GGUF magic (if it's a GGUF file)

        if (this.modelPath.toLowerCase().endsWith('.gguf')) {

          const fd = fs.openSync(this.modelPath, 'r');

          const buffer = Buffer.alloc(4);

          fs.readSync(fd, buffer, 0, 4, 0);

          fs.closeSync(fd);

          

          // Check for GGUF magic bytes

          const isGGUF = buffer.toString('ascii').startsWith('GGUF') || 

                        buffer.readUInt32LE(0) === 0x46554747; // "GGUF" in little-endian

          

          if (!isGGUF) {

            this.log('File has .gguf extension but no valid GGUF header');

            throw new Error('Invalid GGUF model file');

          }

        }

        

        // File validation successful

        this.log('Model file validation successful');

        this.isModelLoaded = true;

        this.isLoading = false;

        return true;

      } catch (validationError) {

        this.log(`Model validation error: ${validationError.message}`);

        throw validationError;

      }

    } catch (error) {

      this.isLoading = false;

      this.isModelLoaded = false;

      this.log(`Error in loadModel: ${error.message}\n${error.stack}`);

      console.error('Error loading model:', error);

      throw error;

    }

  }

            

  async generateResponse(message, onChunk) {

    this.log(`Generate response called with message: ${message.substring(0, 100)}...`);

    

    if (!this.isModelLoaded) {

      throw new Error('Model not loaded or load failed');

    }

    

    try {

      let fullResponse = '';

      const responseId = `response-${Date.now()}`;

      

      // Register with safety manager

      const completeTask = this.safetyManager ? 

        this.safetyManager.registerTask(responseId, 'llm-inference') : 

        () => {};

      

      // Use process isolator for safer execution

      return new Promise((resolve, reject) => {

        // Prepare command-line arguments for llama.cpp

        // Using a simpler set of args that work across different llama.cpp versions

        const args = [

          '-m', this.modelPath,

          '--prompt', `USER: ${message}\nASSISTANT:`,

          '-n', '1024',          // Number of tokens to predict

          '--temp', '0.7',       // Temperature

          '--repeat-penalty', '1.1',

          '-c', '2048',          // Context size

          '--no-mmap',           // Safer memory mapping

          '-ngl', '1'            // Number of GPU layers (1 is safer)

        ];

        

        this.log(`Spawning process with args: ${args.join(' ')}`);

        

        // Run in isolated process

        this.processIsolator.runIsolatedProcess(

          this.binPath,

          args,

          {

            timeout: 120000, // 2 minute timeout

            type: 'llm-inference',

            onData: (chunk, type) => {

              if (type === 'stdout') {

                fullResponse += chunk;

                onChunk(chunk);

              }

            }

          }

        )

        .then(() => {

          completeTask();

          resolve(fullResponse);

        })

        .catch((error) => {

          completeTask();

          this.log(`Process error: ${error.message}`);

          

          // Check if we got any response before the error

          if (fullResponse.length > 0) {

            this.log('Process failed but returning partial response');

            resolve(fullResponse);

          } else {

            // Fall back to simplified response

            this._generateSimulatedResponse(message, onChunk)

              .then(resolve)

              .catch(reject);

          }

        });

      });

    } catch (error) {

      this.log(`Error in generateResponse: ${error.message}\n${error.stack}`);

      console.error('Error generating response:', error);

      // Fall back to simulation on error

      return this._generateSimulatedResponse(message, onChunk);

    }

  }



  async _generateSimulatedResponse(message, onChunk) {

    this.log(`Generating simulated fallback response`);

    

    let fullResponse = '';

    

    // Basic fallback response based on user input

    const response = `I'm sorry, but I encountered an issue with GPU resources while processing your request. Here's a simplified response to your message: "${message}"\n\nThis is a fallback mode to protect your system from crashes. If you continue to see this message, please check your GPU resources or try selecting a smaller model.`;

    

    // Stream the response word by word with realistic typing delays

    const words = response.split(' ');

    

    for (let i = 0; i < words.length; i++) {

      // Vary the delay to simulate natural typing and thinking

      const delay = Math.floor(Math.random() * 70) + 30; // 30-100ms delay

      await new Promise(resolve => setTimeout(resolve, delay));

      

      const chunk = words[i] + (i < words.length - 1 ? ' ' : '');

      fullResponse += chunk;

      onChunk(chunk);

    }

    

    this.log('Simulated fallback response completed');

    return fullResponse;

  }



  async generateConversationSummary(messages) {

    this.log(`Generating summary from ${messages.length} messages`);

    

    if (!this.isModelLoaded) {

      return this._generateSimulatedSummary(messages);

    }

    

    try {

      const prompt = `

Summarize the following conversation concisely, capturing the main topics, key points, and any conclusions.

Keep the summary under 200 words and focus on the most important information.



Conversation:

${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}



Provide ONLY the summary without any prefix or explanation.

`;

      

      // Use process isolator for safer execution

      const { output } = await this.processIsolator.runIsolatedProcess(

        this.binPath,

        [

          '-m', this.modelPath,

          '--prompt', prompt,

          '--n-predict', '512', // Summary should be short

          '--temp', '0.7',

          '--repeat-penalty', '1.1',

          '-c', '2048',

          '--no-display-prompt',

          '--gpu-layers', 'auto', // Use auto to avoid using too much VRAM

        ],

        {

          timeout: 30000, // 30 second timeout

          type: 'summary-generation'

        }

      );

      

      return output.trim();

    } catch (error) {

      this.log(`Error in generateConversationSummary: ${error.message}\n${error.stack}`);

      return this._generateSimulatedSummary(messages);

    }

  }



  _generateSimulatedSummary(messages) {

    // Extract some basic metrics

    const messageCount = messages.length;

    const userMessageCount = messages.filter(m => m.role === 'user').length;

    const aiMessageCount = messages.filter(m => m.role === 'assistant').length;

    

    // Create a basic summary

    return `This conversation consists of ${messageCount} messages (${userMessageCount} from the user and ${aiMessageCount} from the AI). The discussion covers various topics including user queries and assistant responses. This summary was generated in fallback mode to conserve GPU resources.`;

  }



  // NEW METHODS FOR HTML GENERATION

  async generateHTML(messages, summary = '') {

    this.log(`Generating HTML from ${messages.length} messages`);

    

    try {

      const prompt = `

You are a web developer tasked with creating a single HTML file that summarizes and visualizes the following conversation.

The HTML should be modern, responsive, and visually appealing. Include CSS and JavaScript directly in the HTML file.

The page should represent the key points, themes, and information from the conversation in an organized way.



Here's a summary of the conversation so far:

${summary || 'No summary available yet.'}



And here is the full conversation:

${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}



Respond ONLY with valid HTML code for a single complete webpage. The HTML should:

1. Have a proper DOCTYPE and valid HTML structure

2. Include all CSS in a <style> tag

3. Include all JavaScript in a <script> tag

4. Be responsive and mobile-friendly

5. Use a dark theme with good readability

6. Organize the information in a logical way

7. Visualize any data mentioned in the conversation if appropriate

8. Include navigation between different sections if necessary



Do not include anything else in your response except the complete HTML code.

`;



      // Add real-time logging of HTML generation

      console.log("HTML GENERATION: Starting...");

      

      try {

        const { output } = await this.processIsolator.runIsolatedProcess(

          this.binPath,

          [

            '-m', this.modelPath,

            '--prompt', prompt,

            '--n-predict', '4096',

            '--temp', '0.7',

            '--repeat-penalty', '1.1',

            '-c', '4096',

            '--no-display-prompt',

            '--gpu-layers', 'auto' // Use auto to avoid using too much VRAM

          ],

          {

            timeout: 60000, // 60 second timeout

            type: 'html-generation',

            onData: (chunk, type) => {

              if (type === 'stdout') {

                console.log(`HTML GENERATION: ${chunk}`);

              }

            }

          }

        );

        

        // Extract HTML from response if needed



        // const htmlMatch = output.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);

        // const htmlContent = htmlMatch ? htmlMatch[0] : output;



        const htmlMatch = output.match(/```html\s*(<!DOCTYPE html>[\s\S]*?<\/html>)\s*```/i) || 

        output.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);

        const htmlContent = htmlMatch ? (htmlMatch[1] || htmlMatch[0]) : output;

        

        console.log(`HTML GENERATION: Completed (${htmlContent.length} bytes)`);

        return htmlContent;

      } catch (error) {

        this.log(`HTML Generation process error: ${error.message}`);

        console.log(`HTML GENERATION: Error - ${error.message}`);

        

        // Fall back to simulated HTML

        return this._generateSimulatedHTML(messages, summary);

      }

    } catch (error) {

      this.log(`Error in generateHTML: ${error.message}\n${error.stack}`);

      console.log(`HTML GENERATION: Fatal error - ${error.message}`);

      return this._generateSimulatedHTML(messages, summary);

    }

  }



  // Fallback HTML generator with simplified requirements

  async generateFallbackHTML(messages) {

    this.log(`Generating fallback HTML from ${messages.length} messages`);

    

    try {

      const prompt = `

Create a simple HTML document that summarizes the following conversation.

Only use basic HTML and CSS, nothing fancy. Focus on content over style.

Make sure the HTML is valid and well-formed.



Here is the conversation:

${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}



Respond ONLY with valid HTML code. Include a simple stylesheet in a <style> tag.

`;



      console.log("HTML GENERATION: Using fallback generator");

      

      try {

        const { output } = await this.processIsolator.runIsolatedProcess(

          this.binPath,

          [

            '-m', this.modelPath,

            '--prompt', prompt,

            '--n-predict', '2048', 

            '--temp', '0.7',

            '--repeat-penalty', '1.1',

            '-c', '2048',

            '--no-display-prompt',

            '--gpu-layers', '1' // Reduce to 1 layer for fallback to save VRAM

          ],

          {

            timeout: 30000, // 30 second timeout

            type: 'fallback-html-generation',

            onData: (chunk, type) => {

              if (type === 'stdout') {

                console.log(`HTML FALLBACK: ${chunk}`);

              }

            }

          }

        );

        

        // Extract HTML from the output

        const htmlMatch = output.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);

        const htmlContent = htmlMatch ? htmlMatch[0] : output;

        return htmlContent;

      } catch (error) {

        // If real generation fails, fall back to simulated

        return this._generateSimulatedHTML(messages, '', true);

      }

    } catch (error) {

      this.log(`Error in generateFallbackHTML: ${error.message}\n${error.stack}`);

      return this._generateSimulatedHTML(messages, '', true);

    }

  }



  _generateSimulatedHTML(messages, summary = '', isSimple = false) {

    const title = "Conversation Explorer";

    const topics = ["AI", "Technology", "Conversation"];

    

    // Simple version for fallback

    if (isSimple) {

      return `

<!DOCTYPE html>

<html>

<head>

  <title>${title}</title>

  <style>

    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #0d1117; color: #c9d1d9; }

    .message { margin-bottom: 10px; padding: 10px; border-radius: 5px; }

    .user { background: #1f6feb; }

    .assistant { background: #238636; }

    h1 { color: #58a6ff; }

  </style>

</head>

<body>

  <h1>${title}</h1>

  <p>This page shows a summary of your conversation.</p>

  

  <div class="messages">

    ${messages.map(m => 

      `<div class="message ${m.role}">

        <strong>${m.role.toUpperCase()}:</strong>

        <p>${m.content}</p>

      </div>`

    ).join('')}

  </div>

</body>

</html>

    `;

    }

    

    // More sophisticated version for primary generation

    return `

<!DOCTYPE html>

<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${title}</title>

  <style>

    :root {

      --bg-primary: #0d1117;

      --bg-secondary: #161b22;

      --text-primary: #c9d1d9;

      --text-secondary: #8b949e;

      --accent: #58a6ff;

      --user-msg: #1f6feb;

      --ai-msg: #238636;

    }

    

    * {

      box-sizing: border-box;

      margin: 0;

      padding: 0;

    }

    

    body {

      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;

      background-color: var(--bg-primary);

      color: var(--text-primary);

      line-height: 1.6;

    }

    

    .container {

      max-width: 1200px;

      margin: 0 auto;

      padding: 20px;

    }

    

    header {

      padding: 20px 0;

      border-bottom: 1px solid var(--bg-secondary);

      margin-bottom: 30px;

    }

    

    h1, h2, h3 {

      color: var(--accent);

    }

    

    .topic-tags {

      display: flex;

      flex-wrap: wrap;

      gap: 10px;

      margin: 20px 0;

    }

    

    .tag {

      background-color: var(--bg-secondary);

      color: var(--accent);

      padding: 5px 10px;

      border-radius: 15px;

      font-size: 0.8rem;

    }

    

    .summary-section {

      background-color: var(--bg-secondary);

      padding: 20px;

      border-radius: 8px;

      margin-bottom: 30px;

    }

    

    .conversation {

      display: flex;

      flex-direction: column;

      gap: 15px;

    }

    

    .message {

      padding: 15px;

      border-radius: 8px;

      max-width: 85%;

    }

    

    .user {

      background-color: var(--user-msg);

      align-self: flex-end;

    }

    

    .assistant {

      background-color: var(--ai-msg);

      align-self: flex-start;

    }

    

    .role {

      font-weight: bold;

      margin-bottom: 5px;

      font-size: 0.9rem;

      opacity: 0.8;

    }

    

    mark {

      background-color: rgba(88, 166, 255, 0.2);

      color: #58a6ff;

      padding: 0 2px;

      border-radius: 2px;

    }

    

    @media (max-width: 768px) {

      .message {

        max-width: 100%;

      }

    }

  </style>

</head>

<body>

  <div class="container">

    <header>

      <h1>${title}</h1>

      <div class="topic-tags">

        ${topics.map(topic => `<span class="tag">${topic}</span>`).join('')}

      </div>

    </header>

    

    <section class="summary-section">

      <h2>Conversation Summary</h2>

      <p>${summary || 'This conversation covers various topics including ' + topics.join(', ') + '.'}</p>

    </section>

    

    <section>

      <h2>Full Conversation</h2>

      <div class="conversation">

        ${messages.map(m => `

          <div class="message ${m.role}">

            <div class="role">${m.role.toUpperCase()}</div>

            <div class="content">${m.content}</div>

          </div>

        `).join('')}

      </div>

    </section>

  </div>

  

  <script>

    // Simple script to enhance the UI

    document.addEventListener('DOMContentLoaded', function() {

      // Create spans around keywords instead of direct innerHTML replacement

      const keywords = ${JSON.stringify(topics)};

      const contentElements = document.querySelectorAll('.content');

      

      // Safer approach to highlight text

      function highlightKeywords(element, keywordsList) {

        // Get all text nodes within the element

        const walker = document.createTreeWalker(

          element, 

          NodeFilter.SHOW_TEXT,

          null,

          false

        );

        

        const textNodes = [];

        let node;

        while (node = walker.nextNode()) {

          textNodes.push(node);

        }

        

        // Process each text node

        for (const textNode of textNodes) {

          let text = textNode.nodeValue;

          let replaced = false;

          

          keywordsList.forEach(keyword => {

            const pattern = new RegExp(keyword, 'gi');

            if (pattern.test(text)) {

              replaced = true;

              const fragments = text.split(pattern);

              const container = document.createElement('span');

              

              for (let i = 0; i < fragments.length; i++) {

                container.appendChild(document.createTextNode(fragments[i]));

                

                // Add the highlighted keyword between fragments (except after the last one)

                if (i < fragments.length - 1) {

                  const match = text.match(pattern)[i];

                  const mark = document.createElement('mark');

                  mark.textContent = match;

                  container.appendChild(mark);

                }

              }

              

              textNode.parentNode.insertBefore(container, textNode);

              textNode.parentNode.removeChild(textNode);

            }

          });

        }

      }

      

      // Apply highlighting to each content element

      contentElements.forEach(element => {

        highlightKeywords(element, keywords);

      });

    });

  </script>

</body>

</html>

  `;

  }



  unloadModel() {

    this.log('Unloading model...');

    

    // Kill any active processes

    if (this.processIsolator) {

      const killedCount = this.processIsolator.killAllProcesses();

      this.log(`Killed ${killedCount} active processes`);

    }

    

    // Force garbage collection if available

    if (global.gc) {

      try {

        this.log('Running garbage collection');

        global.gc();

      } catch (error) {

        this.log(`Error running garbage collection: ${error.message}`);

      }

    }

    

    this.isModelLoaded = false;

    this.log('Model unloaded successfully');

    return true;

  }

}



module.exports = LLMService;