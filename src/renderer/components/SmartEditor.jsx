// src/renderer/components/SmartEditor.jsx
import React, { useEffect, useRef, useState } from 'react';
import MonacoWrapper from './MonacoWrapper';

const isImage = (filename = '') => /\.(png|jpe?g|gif|bmp|webp)$/i.test(filename);
const isText = (filename = '') => {
  if (!filename) return false;
  const base = filename.split('/').pop();
  const hiddenAsText = ['.gitignore', '.env', '.eslintrc', '.prettierrc', '.npmrc'];
  return /\.(txt|md|json|xml|html|css|js|jsx|ts|tsx|py|java|c|cpp|cs)$/i.test(filename) || hiddenAsText.includes(base);
};

const SmartEditor = ({ file, onContentChange }) => {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    console.log('[SmartEditor] Received file:', file);
    setShowError(false);
  }, [file]);

  useEffect(() => {
    if (!file || !isImage(file.name)) return;

    const img = imageRef.current;
    const container = containerRef.current;

    const autoScale = () => {
      if (!img || !container) return;
      const containerWidth = container.offsetWidth;
      const targetWidth = containerWidth * 0.8;
      const scale = targetWidth / img.naturalWidth;
      setZoom(scale);
      setOffset({ x: 0, y: 0 });
    };

    if (img.complete) autoScale();
    else img.onload = autoScale;
  }, [file]);

  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((z) => Math.max(0.1, Math.min(5, z + delta)));
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!dragging || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDragging(false);
    setStart(null);
    containerRef.current.style.cursor = 'grab';
  };

  if (!file) {
    return <div className="empty-state">No file selected</div>;
  }

  if (isImage(file.name)) {
    return (
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#1e1e1e',
          position: 'relative',
          cursor: 'grab',
          userSelect: 'none'
        }}
      >
        <img
          ref={imageRef}
          src={`file://${file.path}`}
          alt={file.name}
          style={{
            position: 'absolute',
            left: `calc(50% + ${offset.x}px - ${(imageRef.current?.naturalWidth || 0) * zoom / 2}px)` || '0',
            top: `calc(50% + ${offset.y}px - ${(imageRef.current?.naturalHeight || 0) * zoom / 2}px)` || '0',
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            maxWidth: 'none',
            maxHeight: 'none',
            imageRendering: 'pixelated',
            pointerEvents: 'none'
          }}
          onLoad={() => console.log('[SmartEditor] Image loaded:', file.path)}
          onError={() => console.warn('[SmartEditor] Failed to load image:', file.path)}
        />
      </div>
    );
  }

  if (isText(file.name)) {
    return <MonacoWrapper file={file} onContentChange={onContentChange} />;
  }

  return (
    <div
      style={{
        backgroundColor: '#10141e',
        color: '#ef4444',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '13px',
        padding: '16px',
        border: '1px solid rgba(54, 249, 246, 0.2)',
        borderRadius: '6px',
        margin: '20px',
        maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(54, 249, 246, 0.1) inset',
        animation: 'pulse 1.5s ease-in-out infinite'
      }}
    >
      <strong>Unsupported File</strong>
      <p>Cannot preview this file type: <code>{file.name}</code></p>
    </div>
  );
};

export default SmartEditor;
