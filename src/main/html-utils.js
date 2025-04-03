// src/main/html-utils.js
const { JSDOM } = require('jsdom');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

class HTMLUtils {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs', 'html');
    fs.ensureDirSync(this.logDir);
  }

  /**
   * Save raw HTML to log file for debugging
   */
  logRawHTML(html, prefix = 'html-raw') {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logPath = path.join(this.logDir, `${prefix}-${timestamp}.html`);
    fs.writeFileSync(logPath, html);
    console.log(`HTML logged to: ${logPath}`);
    return logPath;
  }

  /**
   * Extract HTML from raw output using multiple strategies
   */
  extractHTML(output) {
    console.log("Attempting to extract HTML from output of length:", output.length);
    
    // Try different extraction strategies
    const strategies = [
      // Strategy 1: Find HTML enclosed in doctype and /html tags
      () => {
        const htmlMatch = output.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
        if (htmlMatch) {
          console.log("Strategy 1: Found HTML with DOCTYPE");
          return htmlMatch[0];
        }
        return null;
      },
      
      // Strategy 2: Find HTML in markdown code blocks
      () => {
        const markdownMatch = output.match(/```html\s*(<!DOCTYPE html>[\s\S]*?<\/html>)\s*```/i);
        if (markdownMatch) {
          console.log("Strategy 2: Found HTML in markdown block");
          return markdownMatch[1];
        }
        return null;
      },
      
      // Strategy 3: Reconstruct from tokens (for token-by-token generation)
      () => {
        // Clean HTML token output
        const cleaned = output
          .replace(/HTML OUTPUT:\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        const docTypeMatch = cleaned.match(/<!(DOCTYPE|doctype) html>[\s\S]*/i);
        if (docTypeMatch) {
          console.log("Strategy 3: Found DOCTYPE in cleaned output");
          
          // Try to find complete HTML structure
          const htmlMatch = docTypeMatch[0].match(/<!(DOCTYPE|doctype) html>[\s\S]*?<\/html>/i);
          if (htmlMatch) {
            console.log("Strategy 3: Found complete HTML in cleaned output");
            return htmlMatch[0];
          }
        }
        return null;
      },
      
      // Strategy 4: Join HTML OUTPUT tokens
      () => {
        // Extract only the lines with HTML OUTPUT:
        const htmlLines = output.split('\n')
          .filter(line => line.includes('HTML OUTPUT:'))
          .map(line => {
            // Extract content after HTML OUTPUT:
            const content = line.replace(/.*HTML OUTPUT:\s*/, '').trim();
            return content;
          })
          .join('');
        
        if (htmlLines.includes('<!DOCTYPE') && htmlLines.includes('</html>')) {
          console.log("Strategy 4: Reconstructed HTML from HTML OUTPUT lines");
          return htmlLines;
        }
        return null;
      }
    ];
    
    // Try each strategy until one works
    for (const strategy of strategies) {
      const html = strategy();
      if (html) return html;
    }
    
    return null;
  }

  /**
   * Validate HTML structure and fix common issues
   */
  validateAndFix(html) {
    if (!html) return null;
    
    try {
      // Basic validation with JSDOM
      const dom = new JSDOM(html);
      
      // Check if we have basic structure
      if (!dom.window.document.documentElement) {
        throw new Error('Missing document element');
      }
      
      // If we reach here, the HTML is at least structurally valid
      return html;
    } catch (error) {
      console.error('HTML validation error:', error.message);
      
      // Try to fix common issues
      let fixedHtml = html;
      
      // Ensure we have DOCTYPE
      if (!fixedHtml.includes('<!DOCTYPE html>') && !fixedHtml.includes('<!doctype html>')) {
        fixedHtml = '<!DOCTYPE html>\n' + fixedHtml;
      }
      
      // Ensure we have html tags
      if (!fixedHtml.includes('<html')) {
        fixedHtml = fixedHtml.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<html>');
        fixedHtml += '\n</html>';
      }
      
      // Ensure we have head and body tags
      if (!fixedHtml.includes('<head')) {
        fixedHtml = fixedHtml.replace('<html>', '<html>\n<head><title>Conversation</title></head>');
      }
      
      if (!fixedHtml.includes('<body')) {
        fixedHtml = fixedHtml.replace('</head>', '</head>\n<body>');
        fixedHtml = fixedHtml.replace('</html>', '</body>\n</html>');
      }
      
      // Re-validate the fixed HTML
      try {
        new JSDOM(fixedHtml);
        return fixedHtml;
      } catch (e) {
        console.error('Failed to fix HTML:', e.message);
        return null; // Cannot fix the HTML
      }
    }
  }

  /**
   * Generate a fallback HTML when all else fails
   */
  generateFallbackHTML(messages, summary = '') {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ArxAIv Conversation Explorer (Fallback)</title>
        <style>
          :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --accent-primary: #58a6ff;
            --accent-secondary: #238636;
            --user-bg: rgba(31, 111, 235, 0.2);
            --user-border: #1f6feb;
            --assistant-bg: rgba(35, 134, 54, 0.2);
            --assistant-border: #238636;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 20px;
            margin: 0;
          }
          
          .container {
            max-width: 900px;
            margin: 0 auto;
          }
          
          header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(88, 166, 255, 0.2);
          }
          
          h1 {
            color: var(--accent-primary);
            margin: 0 0 8px 0;
          }
          
          .note {
            background-color: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 6px;
            margin: 16px 0;
            font-style: italic;
            color: var(--text-secondary);
          }
          
          .message {
            padding: 16px;
            border-radius: 6px;
            margin-bottom: 16px;
          }
          
          .user {
            background-color: var(--user-bg);
            border-left: 4px solid var(--user-border);
          }
          
          .assistant {
            background-color: var(--assistant-bg);
            border-left: 4px solid var(--assistant-border);
          }
          
          .role {
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--accent-primary);
          }
          
          pre {
            background-color: rgba(0, 0, 0, 0.2);
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
          }
          
          code {
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>ArxAIv Conversation Explorer</h1>
            <p>Safe Mode Fallback View</p>
          </header>
          
          ${summary ? `
            <div class="note">
              <strong>Summary:</strong> ${summary}
            </div>
          ` : ''}
          
          <div class="messages">
            ${messages.map(m => `
              <div class="message ${m.role}">
                <div class="role">${m.role.toUpperCase()}</div>
                <div class="content">${this._formatContent(m.content)}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="note">
            This is a fallback view created when the standard HTML generation failed.
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  /**
   * Format message content safely (escaping HTML and preserving code blocks)
   */
  _formatContent(content) {
    if (typeof content !== 'string') return '';
    
    // Escape HTML
    let safeContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    
    // Format code blocks
    safeContent = safeContent
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert newlines to <br>
    safeContent = safeContent.replace(/\n/g, '<br>');
    
    return safeContent;
  }
}

module.exports = new HTMLUtils();