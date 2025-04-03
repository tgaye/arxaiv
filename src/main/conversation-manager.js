// src/main/conversation-manager.js
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

class ConversationManager {
  constructor(llmService) {
    this.llmService = llmService;
    this.conversations = new Map();
    this.storagePath = path.join(app.getPath('userData'), 'conversations');
    this.initialize();
  }
  
  async initialize() {
    // Ensure storage directory exists
    await fs.ensureDir(this.storagePath);
    
    // Try to load previously saved conversations
    try {
      const files = await fs.readdir(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const conversationId = path.basename(file, '.json');
          const data = await fs.readJson(path.join(this.storagePath, file));
          this.conversations.set(conversationId, data);
        }
      }
    } catch (error) {
      console.error('Error loading saved conversations:', error);
    }
  }
  
  async saveConversation(conversationId, data) {
    const conversation = {
      ...data,
      lastUpdated: new Date().toISOString()
    };
    
    this.conversations.set(conversationId, conversation);
    
    // Save to disk
    try {
      await fs.writeJson(
        path.join(this.storagePath, `${conversationId}.json`),
        conversation,
        { spaces: 2 }
      );
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }
  
  getConversation(conversationId) {
    return this.conversations.get(conversationId);
  }
  
  async updateSummary(conversationId, messages) {
    // Check if we already have this conversation
    const existing = this.conversations.get(conversationId);
    
    // Only generate a new summary if we have enough messages
    if (!existing || messages.length > (existing.messages?.length || 0)) {
      try {
        // Generate summary using LLM
        const summary = await this.llmService.generateConversationSummary(messages);
        
        // Save updated conversation with summary
        await this.saveConversation(conversationId, {
          messages,
          summary,
          id: conversationId
        });
        
        return summary;
      } catch (error) {
        console.error('Error updating summary:', error);
        // Return existing summary if available, or empty string
        return existing?.summary || '';
      }
    }
    
    // Return existing summary if no update needed
    return existing?.summary || '';
  }
}

module.exports = ConversationManager;