// src/main/html-generator.js

const { validate } = require('html-validator');



class HTMLGenerator {

  constructor(llmService) {

    this.llmService = llmService;

  }

  

  async generateHTML(messages, summary = '') {

    try {

      // Use the LLM service to generate HTML

      const html = await this.llmService.generateHTML(messages, summary);

      

      // Validate the HTML before returning

      const isValid = await this.validateHTML(html);

      

      if (isValid) {

        return {

          success: true,

          html,

          isValid

        };

      } else {

        // If HTML is invalid, try the fallback generator

        const fallbackHtml = await this.llmService.generateFallbackHTML(messages);

        const isFallbackValid = await this.validateHTML(fallbackHtml);

        

        return {

          success: false,

          html: fallbackHtml,

          isValid: isFallbackValid,

          message: 'Primary HTML generation failed, using fallback'

        };

      }

    } catch (error) {

      console.error('Error generating HTML:', error);

      

      // Return a minimal valid HTML as last resort

      return {

        success: false,

        html: this.getMinimalHTML(messages),

        isValid: true,

        message: `Error: ${error.message}`

      };

    }

  }

  

  async validateHTML(html) {

    try {

      // Simple validation - check for proper structure

      const hasDoctype = html.includes('<!DOCTYPE html>') || html.includes('<!doctype html>');

      const hasHtmlTag = html.includes('<html') && html.includes('</html>');

      const hasBodyTag = html.includes('<body') && html.includes('</body>');

      

      const basicValid = hasDoctype && hasHtmlTag && hasBodyTag;

      

      if (!basicValid) {

        return false;

      }

      

      // Use more comprehensive validation if available

      try {

        const result = await validate({

          data: html,

          isFragment: false

        });

        

        // If there are only warnings but no errors, consider it valid

        return result.errors.length === 0;

      } catch (validationError) {

        console.warn('HTML validation error:', validationError);

        // Fall back to basic validation

        return basicValid;

      }

    } catch (error) {

      console.error('Error validating HTML:', error);

      return false;

    }

  }

  

  getMinimalHTML(messages) {

    return `

<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Conversation Summary</title>

  <style>

    body { font-family: sans-serif; margin: 0; padding: 20px; background: #0d1117; color: #c9d1d9; }

    .message { margin-bottom: 10px; padding: 10px; border-radius: 5px; }

    .user { background: #1f6feb; }

    .assistant { background: #238636; }

    h1 { color: #58a6ff; }

  </style>

</head>

<body>

  <h1>Conversation Summary</h1>

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

}



module.exports = HTMLGenerator;