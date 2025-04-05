import React, { useEffect, useRef, useState } from 'react';

const isImage = (filename = '') => /\.(png|jpe?g|gif|bmp|webp)$/i.test(filename);
const isText = (filename = '') => /\.(txt|md|json|xml|html|css|js|jsx|ts|tsx|py|java|c|cpp|cs)$/i.test(filename);

const SmartEditor = ({ file }) => {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);

  useEffect(() => {
    console.log('[SmartEditor] Received file:', file);
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
    console.log('[SmartEditor] Attempting to render image:', file.name);
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
    console.log('[SmartEditor] Rendering text editor for:', file.name);
    return (
      <div className="text-editor-fallback">
        <pre style={{
          color: '#f8f8f2',
          backgroundColor: '#272822',
          padding: '10px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto'
        }}>{file.content}</pre>
      </div>
    );
  }

  console.warn('[SmartEditor] Unsupported file type:', file.name);
  return (
    <div className="unsupported-preview">
      <p>Cannot preview this file type: {file.name}</p>
    </div>
  );
};

export default SmartEditor;
