const path = require('path');
const fs = require('fs-extra');
const Store = require('electron-store');

class ModelManager {
  constructor() {
    this.store = new Store();
    this.models = [];
    this.modelDirectory = this.store.get('modelDirectory') || this.getDefaultModelDirectory();
  }

  getDefaultModelDirectory() {
    const userHome = process.env.USERPROFILE || process.env.HOME;
    // Try to locate the lmstudio-community folder
    const lmstudioPath = path.join(userHome, '.lmstudio', 'models');
    const communityPath = path.join(lmstudioPath, 'lmstudio-community');
    
    // Check if the community path exists, otherwise default to the general models path
    if (fs.existsSync(communityPath)) {
      return communityPath;
    }
    return lmstudioPath;
  }

  async initialize() {
    await this.ensureModelDirectory();
    await this.loadModelList();
  }

  async ensureModelDirectory() {
    try {
      // First check if directory exists
      const exists = await fs.pathExists(this.modelDirectory);
      if (!exists) {
        // If not, try to create it or fall back to default
        try {
          await fs.ensureDir(this.modelDirectory);
        } catch (error) {
          console.error(`Could not create directory ${this.modelDirectory}:`, error);
          // Fall back to documents folder
          const docsDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'lm-terminal-models');
          await fs.ensureDir(docsDir);
          this.modelDirectory = docsDir;
          this.store.set('modelDirectory', docsDir);
        }
      }
    } catch (error) {
      console.error('Error ensuring model directory exists:', error);
    }
  }

  async setModelDirectory(dirPath) {
    this.modelDirectory = dirPath;
    this.store.set('modelDirectory', dirPath);
    await this.loadModelList();
    return this.models;
  }

  async loadModelList() {
    try {
      const exists = await fs.pathExists(this.modelDirectory);
      if (!exists) {
        this.models = [];
        return [];
      }

      const files = await fs.readdir(this.modelDirectory);
      
      // Get both files and directories
      const items = await Promise.all(files.map(async (file) => {
        const filePath = path.join(this.modelDirectory, file);
        const stats = await fs.stat(filePath);
        return { file, filePath, isDirectory: stats.isDirectory(), stats };
      }));
      
      // Process model files directly in this directory
      let modelFiles = items
        .filter(item => !item.isDirectory)
        .filter(item => {
          const ext = path.extname(item.file).toLowerCase();
          return ['.bin', '.gguf', '.ggml'].includes(ext);
        })
        .map(item => ({
          name: path.basename(item.file, path.extname(item.file)),
          path: item.filePath,
          size: this.formatFileSize(item.stats.size),
          arch: this.guessModelArchitecture(item.file),
          params: this.guessModelParameters(item.file),
          modified: item.stats.mtime,
        }));
      
      // Also look in subdirectories for model files
      for (const item of items.filter(item => item.isDirectory)) {
        try {
          const subFiles = await fs.readdir(item.filePath);
          const subModelFiles = subFiles
            .filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.bin', '.gguf', '.ggml'].includes(ext);
            })
            .map(file => {
              const filePath = path.join(item.filePath, file);
              const stats = fs.statSync(filePath);
              return {
                name: `${item.file}/${path.basename(file, path.extname(file))}`,
                path: filePath,
                size: this.formatFileSize(stats.size),
                arch: this.guessModelArchitecture(file),
                params: this.guessModelParameters(file),
                modified: stats.mtime,
              };
            });
          
          modelFiles = [...modelFiles, ...subModelFiles];
        } catch (error) {
          console.error(`Error reading subdirectory ${item.filePath}:`, error);
        }
      }
      
      this.models = modelFiles;
      return this.models;
    } catch (error) {
      console.error('Error loading model list:', error);
      this.models = [];
      return [];
    }
  }

  async getModels() {
    return this.models;
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  }

  guessModelArchitecture(filename) {
    // This is a simplified guesser based on filename patterns
    const lower = filename.toLowerCase();
    
    if (lower.includes('llama')) return 'Llama';
    if (lower.includes('mistral')) return 'Mistral';
    if (lower.includes('mpt')) return 'MPT';
    if (lower.includes('falcon')) return 'Falcon';
    if (lower.includes('pythia')) return 'Pythia';
    if (lower.includes('gpt-j')) return 'GPT-J';
    if (lower.includes('gpt-neox')) return 'GPT-NeoX';
    if (lower.includes('qwen')) return 'Qwen';
    if (lower.includes('gemma')) return 'Gemma';
    if (lower.includes('phi')) return 'Phi';
    
    return 'Unknown';
  }

  guessModelParameters(filename) {
    // Try to extract parameter size from filename
    const lower = filename.toLowerCase();
    const matches = lower.match(/(\d+)[bm]|(\d+\.?\d*)b/);
    
    if (matches) {
      const paramSize = matches[1] || matches[2];
      // Convert to B format
      if (paramSize < 10) {
        return `${paramSize}B`;
      } else {
        return `${paramSize}M`;
      }
    }
    
    return 'Unknown';
  }
}

module.exports = ModelManager;