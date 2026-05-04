import React, { useState, useRef, useCallback } from 'react';
import { imageToGrid } from '../utils/imageToGrid';

export default function ImageConverter({ onConvert, onClose }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgEl, setImgEl] = useState(null);
  const [gridW, setGridW] = useState(60);
  const [gridH, setGridH] = useState(60);
  const [colorCount, setColorCount] = useState(20);
  const [keepAspect, setKeepAspect] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // { grid, palette }
  const [dragging, setDragging] = useState(false);
  const previewCanvasRef = useRef(null);
  const naturalSize = useRef({ w: 1, h: 1 });

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => {
      naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight };
      if (keepAspect) {
        const ratio = img.naturalHeight / img.naturalWidth;
        setGridH(Math.max(5, Math.round(gridW * ratio)));
      }
      setImgEl(img);
      setPreview(null);
    };
    img.src = url;
  }, [gridW, keepAspect]);

  const handleFileChange = (e) => loadImage(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    loadImage(e.dataTransfer.files[0]);
  };

  const handleWidthChange = (val) => {
    const w = Math.max(5, Math.min(200, val));
    setGridW(w);
    if (keepAspect && naturalSize.current.w > 0) {
      const ratio = naturalSize.current.h / naturalSize.current.w;
      setGridH(Math.max(5, Math.round(w * ratio)));
    }
  };

  const handleHeightChange = (val) => {
    const h = Math.max(5, Math.min(200, val));
    setGridH(h);
    if (keepAspect && naturalSize.current.h > 0) {
      const ratio = naturalSize.current.w / naturalSize.current.h;
      setGridW(Math.max(5, Math.round(h * ratio)));
    }
  };

  const handleConvertPreview = () => {
    if (!imgEl) return;
    setLoading(true);
    // Small delay so UI can update before synchronous heavy work
    setTimeout(() => {
      try {
        const result = imageToGrid(imgEl, gridW, gridH, colorCount);
        setPreview(result);
        drawPreview(result);
      } finally {
        setLoading(false);
      }
    }, 20);
  };

  const drawPreview = ({ grid, palette }) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rows = grid.length;
    const cols = grid[0]?.length || 0;
    // Scale preview to fit ~300px
    const maxDim = 300;
    const cellPx = Math.max(1, Math.floor(maxDim / Math.max(rows, cols)));
    canvas.width = cols * cellPx;
    canvas.height = rows * cellPx;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = grid[y][x];
        ctx.fillStyle = (idx !== null && idx >= 0) ? (palette[idx] || '#fff') : '#f5f0eb';
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }
  };

  const handleApply = () => {
    if (preview) onConvert({ ...preview, imgSrc });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Image to Pattern</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Drop zone */}
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''} ${imgSrc ? 'has-image' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {imgSrc ? (
              <img src={imgSrc} alt="uploaded" className="drop-preview-img" />
            ) : (
              <>
                <span className="drop-icon">+</span>
                <p>Drag & drop an image here</p>
                <p className="drop-sub">or click to browse</p>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="drop-file-input"
              onChange={handleFileChange}
            />
          </div>

          {/* Settings */}
          <div className="converter-settings">
            <div className="setting-row">
              <label>Grid Width</label>
              <input
                type="number"
                min={5} max={200}
                value={gridW}
                onChange={e => handleWidthChange(Number(e.target.value))}
                className="setting-input"
              />
              <span className="setting-unit">stitches</span>
            </div>

            <div className="setting-row">
              <label>Grid Height</label>
              <input
                type="number"
                min={5} max={200}
                value={gridH}
                onChange={e => handleHeightChange(Number(e.target.value))}
                className="setting-input"
              />
              <span className="setting-unit">stitches</span>
            </div>

            <div className="setting-row">
              <label>
                <input
                  type="checkbox"
                  checked={keepAspect}
                  onChange={e => setKeepAspect(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Lock aspect ratio
              </label>
            </div>

            <div className="setting-row">
              <label>Colors</label>
              <input
                type="range"
                min={2} max={48} step={1}
                value={colorCount}
                onChange={e => setColorCount(Number(e.target.value))}
                className="setting-slider"
              />
              <span className="setting-value">{colorCount}</span>
            </div>
          </div>

          {/* Convert button */}
          <button
            className={`convert-btn ${loading ? 'loading' : ''}`}
            onClick={handleConvertPreview}
            disabled={!imgEl || loading}
          >
            {loading ? 'Converting...' : 'Preview'}
          </button>

          {/* Preview canvas */}
          {preview && (
            <div className="preview-section">
              <p className="preview-label">
                {gridW} × {gridH} stitches &nbsp;·&nbsp; {preview.palette.length} colors
              </p>
              <canvas ref={previewCanvasRef} className="preview-canvas" />
              <div className="preview-palette">
                {preview.palette.map((c, i) => (
                  <span
                    key={i}
                    className="preview-swatch"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <button className="apply-btn" onClick={handleApply}>
                Apply to Canvas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
