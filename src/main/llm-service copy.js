// src/main/llm-service.js
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

// Debug function to save information to a file
function saveDebugInfo(info) {
  const debugPath = path.join(__dirname, '../../debug-llm.txt');
  const content = typeof info === 'string' ? info : JSON.stringify(info, null, 2);
  fs.appendFileSync(debugPath, `\n${new Date().toISOString()}:\n${content}\n`);
}

class LLMService {
  constructor(modelPath) {
    this.modelPath = modelPath;
    this.process = null;
    this.modelName = path.basename(modelPath, path.extname(modelPath));
    this.isLoading = false;
    this.binPath = this._getLlamaCppPath();
    
    saveDebugInfo(`LLMService constructor called with model path: ${modelPath}`);
    saveDebugInfo(`Using binary path: ${this.binPath}`);
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

    this.isLoading = true;
    
    saveDebugInfo(`Starting to load model from: ${this.modelPath}`);

    try {
      // Check if the binary exists
      if (!fs.existsSync(this.binPath)) {
        saveDebugInfo(`llama.cpp binary not found at: ${this.binPath}`);
        throw new Error(`llama.cpp binary not found at: ${this.binPath}`);
      }
      
      // We'll verify the model file exists
      if (!fs.existsSync(this.modelPath)) {
        saveDebugInfo(`Model file not found at: ${this.modelPath}`);
        throw new Error(`Model file not found at: ${this.modelPath}`);
      }
      
      // In the real implementation, we'd actually start the process here,
      // but for now we'll delay until the first inference call
      saveDebugInfo(`Model ${this.modelName} file verified`);
      this.isLoading = false;
      return true;
    } catch (error) {
      this.isLoading = false;
      saveDebugInfo(`Error in loadModel: ${error.message}\n${error.stack}`);
      console.error('Error loading model:', error);
      throw error;
    }
  }


  async generateHTML(messages, summary = '') {
    saveDebugInfo(`Generating HTML from ${messages.length} messages`);
    
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
  
      let fullResponse = '';
      
      // Use the actual LLM to generate HTML if available
      if (fs.existsSync(this.binPath)) {
        // Prepare command-line arguments for llama.cpp
        const args = [
          '-m', this.modelPath,
          '--prompt', prompt,
          '--n-predict', '4096', // Larger context for HTML generation
          '--temp', '0.7',
          '--repeat-penalty', '1.1',
          '-c', '4096',
          '--no-display-prompt'
        ];
        
        saveDebugInfo(`Spawning process for HTML generation: ${this.binPath}`);
        
        // Start the llama.cpp process
        this.htmlProcess = spawn(this.binPath, args);
        
        return new Promise((resolve, reject) => {
          // Handle process output
          this.htmlProcess.stdout.on('data', (data) => {
            const text = data.toString();
            fullResponse += text;
          });
          
          // Handle process errors
          this.htmlProcess.stderr.on('data', (data) => {
            saveDebugInfo(`HTML Generation stderr: ${data.toString()}`);
          });
          
          // Handle process completion
          this.htmlProcess.on('close', (code) => {
            saveDebugInfo(`HTML Generation process exited with code ${code}`);
            this.htmlProcess = null;
            
            if (code === 0) {
              // Extract HTML from response if needed
              const htmlMatch = fullResponse.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
              const htmlContent = htmlMatch ? htmlMatch[0] : fullResponse;
              resolve(htmlContent);
            } else {
              reject(new Error(`HTML generation failed with code ${code}`));
            }
          });
          
          // Handle process errors
          this.htmlProcess.on('error', (error) => {
            saveDebugInfo(`HTML Generation process error: ${error.message}`);
            this.htmlProcess = null;
            reject(error);
          });
        });
      } else {
        // Fallback to a simulated response
        return this._generateSimulatedHTML(messages, summary);
      }
    } catch (error) {
      saveDebugInfo(`Error in generateHTML: ${error.message}\n${error.stack}`);
      throw error;
    }
  }
  
  // Fallback HTML generator with simplified requirements
  async generateFallbackHTML(messages) {
    saveDebugInfo(`Generating fallback HTML from ${messages.length} messages`);
    
    try {
      const prompt = `
  Create a simple HTML document that summarizes the following conversation.
  Only use basic HTML and CSS, nothing fancy. Focus on content over style.
  Make sure the HTML is valid and well-formed.
  
  Here is the conversation:
  ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}
  
  Respond ONLY with valid HTML code. Include a simple stylesheet in a <style> tag.
  `;
  
      // If we can use the real LLM
      if (fs.existsSync(this.binPath)) {
        // Implementation similar to generateHTML but with simpler prompt
        const args = [
          '-m', this.modelPath,
          '--prompt', prompt,
          '--n-predict', '2048', 
          '--temp', '0.7',
          '--repeat-penalty', '1.1',
          '-c', '2048',
          '--no-display-prompt'
        ];
        
        saveDebugInfo(`Spawning process for fallback HTML generation: ${this.binPath}`);
        
        // Start the llama.cpp process
        this.fallbackHtmlProcess = spawn(this.binPath, args);
        
        let fullResponse = '';
        
        return new Promise((resolve, reject) => {
          // Process output handling, similar to generateHTML
          this.fallbackHtmlProcess.stdout.on('data', (data) => {
            fullResponse += data.toString();
          });
          
          this.fallbackHtmlProcess.stderr.on('data', (data) => {
            saveDebugInfo(`Fallback HTML stderr: ${data.toString()}`);
          });
          
          this.fallbackHtmlProcess.on('close', (code) => {
            this.fallbackHtmlProcess = null;
            
            if (code === 0) {
              // Extract HTML from response
              const htmlMatch = fullResponse.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
              const htmlContent = htmlMatch ? htmlMatch[0] : fullResponse;
              resolve(htmlContent);
            } else {
              // If real generation fails, fall back to simulated
              resolve(this._generateSimulatedHTML(messages, '', true));
            }
          });
          
          this.fallbackHtmlProcess.on('error', (error) => {
            this.fallbackHtmlProcess = null;
            // Fall back to simulated on error
            resolve(this._generateSimulatedHTML(messages, '', true));
          });
        });
      } else {
        // Use the simulated version
        return this._generateSimulatedHTML(messages, '', true);
      }
    } catch (error) {
      saveDebugInfo(`Error in generateFallbackHTML: ${error.message}\n${error.stack}`);
      return this._generateSimulatedHTML(messages, '', true);
    }
  }
  
  // Generate conversation summary
  async generateConversationSummary(messages) {
    saveDebugInfo(`Generating summary from ${messages.length} messages`);
    
    try {
      const prompt = `
  Summarize the following conversation concisely, capturing the main topics, key points, and any conclusions.
  Keep the summary under 200 words and focus on the most important information.
  
  Conversation:
  ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}
  
  Provide ONLY the summary without any prefix or explanation.
  `;
  
      // If we can use the real LLM
      if (fs.existsSync(this.binPath)) {
        const args = [
          '-m', this.modelPath,
          '--prompt', prompt,
          '--n-predict', '512', // Summary should be short
          '--temp', '0.7',
          '--repeat-penalty', '1.1',
          '-c', '2048',
          '--no-display-prompt'
        ];
        
        saveDebugInfo(`Spawning process for summary generation: ${this.binPath}`);
        
        // Start the process
        this.summaryProcess = spawn(this.binPath, args);
        
        let fullResponse = '';
        
        return new Promise((resolve, reject) => {
          this.summaryProcess.stdout.on('data', (data) => {
            fullResponse += data.toString();
          });
          
          this.summaryProcess.stderr.on('data', (data) => {
            saveDebugInfo(`Summary stderr: ${data.toString()}`);
          });
          
          this.summaryProcess.on('close', (code) => {
            this.summaryProcess = null;
            
            if (code === 0) {
              resolve(fullResponse.trim());
            } else {
              // Fall back to simulated summary
              resolve(this._generateSimulatedSummary(messages));
            }
          });
          
          this.summaryProcess.on('error', (error) => {
            this.summaryProcess = null;
            // Fall back to simulated on error
            resolve(this._generateSimulatedSummary(messages));
          });
        });
      } else {
        // Use the simulated version
        return this._generateSimulatedSummary(messages);
      }
    } catch (error) {
      saveDebugInfo(`Error in generateConversationSummary: ${error.message}\n${error.stack}`);
      return this._generateSimulatedSummary(messages);
    }
  }



  async generateResponse(message, onChunk) {
    saveDebugInfo(`Generate response called with message: ${message.substring(0, 100)}...`);
    
    try {
      // If we don't have the llama.cpp binary yet, use the simulation
      if (!fs.existsSync(this.binPath)) {
        return this._generateSimulatedResponse(message, onChunk);
      }
      
      let fullResponse = '';
      
      // Prepare command-line arguments for llama.cpp
      const args = [
        '-m', this.modelPath,
        '--prompt', `USER: ${message}\nASSISTANT:`,
        '--n-predict', '1024',
        '--temp', '0.7',
        '--repeat-penalty', '1.1',
        '-c', '2048',
        '--no-display-prompt'  // Don't echo the prompt in output
      ];
      
      saveDebugInfo(`Spawning process: ${this.binPath} ${args.join(' ')}`);
      
      // Start the llama.cpp process
      this.process = spawn(this.binPath, args);
      
      return new Promise((resolve, reject) => {
        // Handle process output
        this.process.stdout.on('data', (data) => {
          const text = data.toString();
          fullResponse += text;
          onChunk(text);
          saveDebugInfo(`Received chunk: ${text.substring(0, 20)}...`);
        });
        
        // Handle process errors
        this.process.stderr.on('data', (data) => {
          const error = data.toString();
          saveDebugInfo(`Process stderr: ${error}`);
          // Don't reject on stderr - llama.cpp outputs progress info to stderr
        });
        
        // Handle process completion
        this.process.on('close', (code) => {
          saveDebugInfo(`Process exited with code ${code}`);
          if (code === 0) {
            resolve(fullResponse);
          } else {
            // Fall back to simulation if the process fails
            saveDebugInfo(`Process failed, falling back to simulation`);
            this._generateSimulatedResponse(message, onChunk).then(resolve).catch(reject);
          }
          this.process = null;
        });
        
        // Handle process errors
        this.process.on('error', (error) => {
          saveDebugInfo(`Process error: ${error.message}`);
          // Fall back to simulation if the process fails
          this._generateSimulatedResponse(message, onChunk).then(resolve).catch(reject);
          this.process = null;
        });
      });
    } catch (error) {
      saveDebugInfo(`Error in generateResponse: ${error.message}\n${error.stack}`);
      console.error('Error generating response:', error);
      // Fall back to simulation on error
      return this._generateSimulatedResponse(message, onChunk);
    }
  }

  async _generateSimulatedResponse(message, onChunk) {
    saveDebugInfo(`Generating simulated response`);
    
    let fullResponse = '';
    
    // More realistic simulation based on user input
    const responses = this._getContextualResponse(message);
    
    // Stream the response word by word with realistic typing delays
    const words = responses.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      // Vary the delay to simulate natural typing and thinking
      const delay = Math.floor(Math.random() * 70) + 30; // 30-100ms delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
      fullResponse += chunk;
      onChunk(chunk);
      
      saveDebugInfo(`Sent simulated chunk: ${chunk.trim()}`);
    }
    
    saveDebugInfo('Simulated response generation completed');
    return fullResponse;
  }




  //=====================================================================

  
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

  _generateSimulatedSummary(messages) {
    // Extract some basic metrics
    const messageCount = messages.length;
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const aiMessageCount = messages.filter(m => m.role === 'assistant').length;
    
    // Create a basic summary
    return `This conversation consists of ${messageCount} messages (${userMessageCount} from the user and ${aiMessageCount} from the AI). The discussion covers topics related to language models, AI technology, and information processing. Key points include questions about model capabilities, discussions about implementing features, and explanations of various concepts.`;
  }


  _getContextualResponse(message) {
    // A more sophisticated response generator that tries to be contextual
    const lowerMsg = message.toLowerCase();
    const modelInfo = `\n\n(This response was generated using a simulated version of the ${this.modelName} model)`;
    
    // Check for different types of queries and provide relevant responses
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi ') || lowerMsg === 'hi') {
      return `Hello! I'm a local AI assistant running on your device through the LM Terminal. How can I help you today?${modelInfo}`;
    }
    
    // Add other response patterns (same as in previous example)
    // ...
    
    // Default response if no specific patterns match
    return `I'm a locally hosted AI assistant running directly on your device. I process information using the ${this.modelName} model loaded in the LM Terminal application. I've received your message: "${message}" and am responding without requiring internet access.${modelInfo}`;
  }

  unloadModel() {
    saveDebugInfo('Unloading model...');
    
    if (this.process) {
      try {
        saveDebugInfo('Terminating running process');
        this.process.kill();
        this.process = null;
      } catch (error) {
        saveDebugInfo(`Error terminating process: ${error.message}`);
        console.error('Error terminating process:', error);
      }
    }
    
    saveDebugInfo('Model unloaded successfully');
  }
}

module.exports = LLMService;