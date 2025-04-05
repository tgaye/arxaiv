import React, { useMemo, useRef, useState, useEffect } from 'react';
import MonacoWrapper from './MonacoWrapper';

const isImageFile = (filename) => /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(filename);
const isPdfFile = (filename) => /\.pdf$/i.test(filename);

const SmartEditor = ({ file, onContentChange }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const [zoom, setZoom] = useState(1.0);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [lastMouse, setLastMouse] = useState(null);
  const [pdfPageSize, setPdfPageSize] = useState({ width: 0, height: 0 });

  const isImage = useMemo(() => file?.name && isImageFile(file.name), [file]);
  const isPdf = useMemo(() => file?.name && isPdfFile(file.name), [file]);

  const blobUrl = useMemo(() => {
    if (!file) return null;
    try {
      if (file.path && !file.content) return `file://${file.path}`;
      if (typeof file.content === 'string') {
        return file.content.startsWith('data:')
          ? file.content
          : `data:application/pdf;base64,${file.content}`;
      }
      return URL.createObjectURL(new Blob([file.content]));
    } catch (err) {
      console.error('Failed to create blob URL:', err);
      return null;
    }
  }, [file]);

  // 🖼️ Auto-zoom image
  useEffect(() => {
    if (!isImage || !imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    const autoZoom = () => {
      const naturalWidth = img.naturalWidth;
      const scale = (container.offsetWidth * 0.8) / naturalWidth;
      setZoom(scale);
      setOffset({ x: 0, y: 0 });
    };

    if (img.complete) autoZoom();
    else img.onload = autoZoom;
  }, [blobUrl, isImage]);


  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((z) => Math.min(5, Math.max(0.1, z + delta)));
    }
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
    containerRef.current.style.cursor = 'grabbing';
  };

  const onMouseMove = (e) => {
    if (!dragging || !lastMouse) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const onMouseUp = () => {
    setDragging(false);
    containerRef.current.style.cursor = 'default';
    setLastMouse(null);
  };

  if (!file) return null;

  // 🖼️ Image View
  if (isImage && blobUrl) {
    return (
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#1e1e1e',
          position: 'relative',
          userSelect: 'none',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <img
          ref={imageRef}
          src={blobUrl}
          alt={file.name}
          style={{
            position: 'absolute',
            left: `calc(50% + ${offset.x}px - ${imageRef.current?.naturalWidth * zoom / 2}px)`,
            top: `calc(50% + ${offset.y}px - ${imageRef.current?.naturalHeight * zoom / 2}px)`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            imageRendering: 'pixelated',
            maxWidth: 'none',
            maxHeight: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  // 📄 PDF View
  if (isPdf && blobUrl) {
    return (
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#1e1e1e',
          position: 'relative',
          userSelect: 'none',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            left: `calc(50% + ${offset.x}px - ${pdfPageSize.width / 2}px)`,
            top: `calc(50% + ${offset.y}px - ${pdfPageSize.height / 2}px)`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    );
  }

  // 📝 Code View
  return <MonacoWrapper file={file} onContentChange={onContentChange} />;
};

export default SmartEditor;
