// src/main/html-validator.js
const { JSDOM } = require('jsdom');

class HTMLValidator {
  constructor() {
    this.errorTypes = {
      MALFORMED: 'malformed_html',
      MISSING_DOCTYPE: 'missing_doctype',
      MISSING_HTML: 'missing_html_tag',
      MISSING_HEAD: 'missing_head_tag',
      MISSING_BODY: 'missing_body_tag',
      SCRIPT_ERROR: 'script_error'
    };
  }
  
  async validate(html) {
    const result = {
      isValid: false,
      errors: [],
      warnings: []
    };
    
    // Basic structure checks
    if (!html || typeof html !== 'string') {
      result.errors.push({
        type: this.errorTypes.MALFORMED,
        message: 'HTML is empty or not a string'
      });
      return result;
    }
    
    // Check for DOCTYPE
    if (!html.includes('<!DOCTYPE html>') && !html.includes('<!doctype html>')) {
      result.errors.push({
        type: this.errorTypes.MISSING_DOCTYPE,
        message: 'Missing DOCTYPE declaration'
      });
    }
    
    // Parse HTML with JSDOM
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Check for required elements
      if (!document.documentElement) {
        result.errors.push({
          type: this.errorTypes.MISSING_HTML,
          message: 'Missing <html> element'
        });
      }
      
      if (!document.head) {
        result.errors.push({
          type: this.errorTypes.MISSING_HEAD,
          message: 'Missing <head> element'
        });
      }
      
      if (!document.body) {
        result.errors.push({
          type: this.errorTypes.MISSING_BODY,
          message: 'Missing <body> element'
        });
      }
      
      // Check for JavaScript errors
      const scripts = document.querySelectorAll('script');
      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        if (!script.src) { // Only check inline scripts
          try {
            // Try to evaluate the script content
            new dom.window.Function(script.textContent);
          } catch (error) {
            result.warnings.push({
              type: this.errorTypes.SCRIPT_ERROR,
              message: `JavaScript error in script #${i+1}: ${error.message}`
            });
          }
        }
      }
      
      // If no errors, the HTML is valid
      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push({
        type: this.errorTypes.MALFORMED,
        message: `HTML parsing error: ${error.message}`
      });
    }
    
    return result;
  }
}

module.exports = HTMLValidator;