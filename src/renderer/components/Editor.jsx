// // src/renderer/components/Editor.jsx
// import React, { useState, useEffect, useRef } from 'react';
// import { monokaiTheme } from './MonokaiTheme';

// // Helper function for file extension detection
// const getFileExtension = (filename) => {
//   if (!filename) return '';
//   const parts = filename.split('.');
//   return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
// };

// const Editor = ({ file, onContentChange }) => {
//   const [content, setContent] = useState('');
//   const textareaRef = useRef(null);
//   const [lineNumbers, setLineNumbers] = useState([]);
//   const [language, setLanguage] = useState('plaintext');
  
//   useEffect(() => {
//     if (file) {
//       setContent(file.content || '');
//       generateLineNumbers(file.content || '');
//       detectLanguage(file.name);
//     } else {
//       setContent('');
//       setLineNumbers([]);
//       setLanguage('plaintext');
//     }
//   }, [file]);
  
//   const detectLanguage = (filename) => {
//     const extension = getFileExtension(filename);
    
//     // Map file extensions to language modes
//     const extensionMap = {
//       '.js': 'javascript',
//       '.jsx': 'jsx',
//       '.ts': 'typescript',
//       '.tsx': 'tsx',
//       '.html': 'html',
//       '.css': 'css',
//       '.py': 'python',
//       '.cpp': 'cpp',
//       '.c': 'c',
//       '.h': 'cpp',
//       '.hpp': 'cpp',
//       '.json': 'json',
//       '.md': 'markdown',
//       '.txt': 'plaintext',
//       '.xml': 'xml',
//       '.java': 'java',
//       '.rb': 'ruby',
//       '.php': 'php',
//       '.go': 'go',
//       '.rs': 'rust',
//     };
    
//     setLanguage(extensionMap[extension] || 'plaintext');
//   };
  
//   const generateLineNumbers = (text) => {
//     const lines = text.split('\n').length;
//     setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
//   };
  
//   const handleContentChange = (e) => {
//     const newContent = e.target.value;
//     setContent(newContent);
//     generateLineNumbers(newContent);
//     onContentChange(newContent);
//   };
  
//   const handleKeyDown = (e) => {
//     // Handle tab key for indentation
//     if (e.key === 'Tab') {
//       e.preventDefault();
      
//       // Insert 2 spaces where the cursor is
//       const cursorPosition = e.target.selectionStart;
//       const cursorEnd = e.target.selectionEnd;
      
//       if (cursorPosition === cursorEnd) {
//         // No selection, just insert spaces at cursor
//         const newContent = 
//           content.substring(0, cursorPosition) + 
//           '  ' + 
//           content.substring(cursorPosition);
        
//         setContent(newContent);
//         onContentChange(newContent);
        
//         // Move cursor after the inserted spaces
//         setTimeout(() => {
//           e.target.selectionStart = cursorPosition + 2;
//           e.target.selectionEnd = cursorPosition + 2;
//         }, 0);
//       } else {
//         // Handle selection indentation
//         const selectedText = content.substring(cursorPosition, cursorEnd);
//         const lines = selectedText.split('\n');
//         const indentedLines = lines.map(line => '  ' + line);
        
//         // Add to the beginning of each line in the selection
//         const newContent = 
//           content.substring(0, cursorPosition) + 
//           indentedLines.join('\n') + 
//           content.substring(cursorEnd);
        
//         setContent(newContent);
//         onContentChange(newContent);
        
//         // Keep the same selection, just shifted right
//         setTimeout(() => {
//           e.target.selectionStart = cursorPosition;
//           e.target.selectionEnd = cursorEnd + (lines.length * 2);
//         }, 0);
//       }
//     }
//   };

//   // Get color styles for different syntax elements
//   const getTokenColor = (token, type) => {
//     if (type === 'comment') return monokaiTheme.comment;
//     if (type === 'string') return monokaiTheme.string;
//     if (type === 'number') return monokaiTheme.number;
//     if (type === 'keyword') return monokaiTheme.keyword;
//     if (type === 'function') return monokaiTheme.function;
//     if (type === 'operator') return monokaiTheme.operator;
//     if (type === 'class') return monokaiTheme.class;
//     if (type === 'property') return monokaiTheme.property;
//     return monokaiTheme.foreground;
//   };

//   // Simple syntax highlighting patterns (can be expanded)
//   const getHighlightStyles = () => {
//     // Basic highlighting patterns for different languages
//     const patterns = {
//       javascript: {
//         keywords: /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|async|await|try|catch|throw|new|this|super|static|typeof|instanceof|delete|void|switch|case|default|break|continue|do|in|of|yield)\b/g,
//         functions: /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
//         numbers: /\b(0x[0-9A-Fa-f]+|\d+(\.\d+)?([eE][-+]?\d+)?)\b/g,
//         strings: /(["'`])(.*?)\1/g,
//         comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
//         operators: /([+\-*/%=<>!&|^~?:]+)/g,
//         properties: /\.([$A-Za-z_][$A-Za-z0-9_]*)/g,
//       },
//       jsx: {
//         // Extends JavaScript patterns with JSX specific ones
//         keywords: /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|async|await|try|catch|throw|new|this|super|static|typeof|instanceof|delete|void|switch|case|default|break|continue|do|in|of|yield)\b/g,
//         functions: /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
//         numbers: /\b(0x[0-9A-Fa-f]+|\d+(\.\d+)?([eE][-+]?\d+)?)\b/g,
//         strings: /(["'`])(.*?)\1/g,
//         comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
//         operators: /([+\-*/%=<>!&|^~?:]+)/g,
//         properties: /\.([$A-Za-z_][$A-Za-z0-9_]*)/g,
//         components: /<([A-Z][A-Za-z0-9_]*)/g,
//         jsxAttributes: /([A-Za-z_][A-Za-z0-9_]*)=/g
//       },
//       html: {
//         tags: /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
//         attributes: /([a-z0-9_-]+)=["'].*?["']/gi,
//         comments: /<!--[\s\S]*?-->/g,
//         entities: /&[a-z0-9#]+;/gi
//       },
//       css: {
//         selectors: /([.#]?[a-z0-9_-]+)(?=\s*\{)/gi,
//         properties: /([\w-]+)(?=\s*:)/gi,
//         values: /:\s*([^;]+);/gi,
//         comments: /\/\*[\s\S]*?\*\//g
//       },
//       python: {
//         keywords: /\b(def|class|import|from|as|return|if|elif|else|for|while|try|except|finally|with|in|is|not|and|or|True|False|None|lambda|raise|assert)\b/g,
//         functions: /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g,
//         numbers: /\b(0x[0-9A-Fa-f]+|\d+(\.\d+)?([eE][-+]?\d+)?)\b/g,
//         strings: /(['"])(.*?)\1|'''[\s\S]*?'''|"""[\s\S]*?"""/g,
//         comments: /#.*$|'''[\s\S]*?'''|"""[\s\S]*?"""/gm
//       },
//       cpp: {
//         keywords: /\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|class|namespace|template|this|virtual|public|protected|private|inline|explicit)\b/g,
//         macros: /#\w+/g,
//         numbers: /\b(0x[0-9A-Fa-f]+|\d+(\.\d+)?([eE][-+]?\d+)?)\b/g,
//         strings: /(["'])(.*?)\1/g,
//         comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
//         operators: /([+\-*/%=<>!&|^~?:]+)/g,
//         typenames: /\b(bool|char16_t|char32_t|wchar_t|string|vector|map|set|list|deque|queue|stack|array|bitset|forward_list|unordered_map|unordered_set)\b/g
//       },
//       // Add more language patterns as needed
//     };
    
//     // Return CSS for the selected language (fallback to plaintext)
//     const languagePatterns = patterns[language] || {};
    
//     return `
//       /* Monokai theme */
//       .code-textarea {
//         color: ${monokaiTheme.foreground};
//         background-color: ${monokaiTheme.background};
//         font-family: 'JetBrains Mono', monospace;
//         tab-size: 2;
//       }
      
//       /* Language: ${language} */
//       /* This is a basic approximation - for real syntax highlighting you'd need a proper syntax parser */
//       /* CSS-only syntax highlighting has limitations, consider a dedicated library for production use */
      
//       /* Additional language-specific styles would be added here using preprocessed code or a proper syntax highlighter library */
//     `;
//   };

//   return (
//     <div className="editor">
//       {!file ? (
//         <div className="no-file-open">
//           <div className="no-file-message">No file open</div>
//           <div className="no-file-instructions">Open a file from the explorer to start editing</div>
//         </div>
//       ) : (
//         <div className="editor-with-line-numbers">
//           <div className="line-numbers">
//             {lineNumbers.map(num => (
//               <div key={num} className="line-number">{num}</div>
//             ))}
//           </div>
//           <textarea
//             ref={textareaRef}
//             className={`code-textarea language-${language}`}
//             value={content}
//             onChange={handleContentChange}
//             onKeyDown={handleKeyDown}
//             spellCheck={false}
//           />
//           <style>
//             {getHighlightStyles()}
//           </style>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Editor;