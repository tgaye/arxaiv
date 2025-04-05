// src/renderer/components/MonacoWrapper.jsx
import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

const MonacoWrapper = ({ file, onContentChange }) => {
  const editorRef = useRef(null);
  const monacoInstanceRef = useRef(null);

  const getLanguageFromFilename = (filename = '') => {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      html: 'html',
      css: 'css',
      json: 'json',
      py: 'python',
      cpp: 'cpp',
      cc: 'cpp',
      c: 'c',
      h: 'cpp',
      hpp: 'cpp',
      java: 'java',
      php: 'php',
      go: 'go',
      rs: 'rust',
      md: 'markdown',
      xml: 'xml',
      txt: 'plaintext',
    };
    return map[ext] || 'plaintext';
  };

  useEffect(() => {
    if (!editorRef.current || !file) return;

    const monokaiQuantumTheme = {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'f8f8f2', background: '2d2a2e' },
        { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'f92672' },
        { token: 'number', foreground: 'ae81ff' },
        { token: 'string', foreground: 'e6db74' },
        { token: 'operator', foreground: 'f92672' },
        { token: 'type', foreground: '66d9ef' },
        { token: 'function', foreground: 'a6e22e' },
        { token: 'variable', foreground: 'f8f8f2' },
      ],
      colors: {
        'editor.foreground': '#f8f8f2',
        'editor.background': '#2d2a2e',
        'editorCursor.foreground': '#f8f8f0',
        'editor.lineHighlightBackground': '#3e3d40',
        'editorLineNumber.foreground': '#a1a1a1cc',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'editor.selectionBackground': '#49483e88',
        'editor.inactiveSelectionBackground': '#3e3d4099',
        'editorIndentGuide.background': '#3b3a3d',
        'editorWhitespace.foreground': '#3e3d4099',
      },
    };

    monaco.editor.defineTheme('monokai-quantum', monokaiQuantumTheme);

    const instance = monaco.editor.create(editorRef.current, {
      value: file.content || '',
      language: getLanguageFromFilename(file.name),
      theme: 'monokai-quantum',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      wordWrap: 'on',
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 8,
      minimap: { enabled: false },
      stickyScroll: {
        enabled: false // 🔧 turn off to restore line number visibility at top
      },
      unusualLineTerminators: 'off',
      automaticLayout: true,
    });

    monacoInstanceRef.current = instance;

    instance.onDidChangeModelContent(() => {
      const newValue = instance.getValue();
      onContentChange(newValue);
    });

    return () => {
      instance.dispose();
    };
  }, [file]);

  useEffect(() => {
    if (monacoInstanceRef.current && file?.content !== monacoInstanceRef.current.getValue()) {
      monacoInstanceRef.current.setValue(file.content || '');
    }
  }, [file?.content]);

  return <div ref={editorRef} style={{ width: '100%', height: 'calc(100vh - 85px)' }} />;
};

export default MonacoWrapper;
