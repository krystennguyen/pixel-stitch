import React, { useState } from 'react';
import pencilIcon from '../assets/pencil.png';
import bucketIcon from '../assets/bucket.png';
import eraserIcon from '../assets/eraser.png';

const TOOLS = [
  { id: 'pencil', label: 'Pencil', title: 'Pencil (P)', icon: pencilIcon },
  { id: 'fill',   label: 'Fill',   title: 'Fill bucket (F)', icon: bucketIcon },
  { id: 'eraser', label: 'Eraser', title: 'Eraser (E)', icon: eraserIcon },
];

export default function Toolbar({
  tool,
  onToolChange,
  cellSize,
  onCellSizeChange,
  gridWidth,
  gridHeight,
  onNewGrid,
  onShowImageConverter,
  overlayImage,
  overlayOn,
  onToggleOverlay,
  overlayOpacity,
  onOverlayOpacityChange,
  showStitch,
  onToggleStitch,
  onExportPNG,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  const [newW, setNewW] = useState(String(gridWidth));
  const [newH, setNewH] = useState(String(gridHeight));

  const handleApplySize = () => {
    const w = Math.max(5, Math.min(200, parseInt(newW) || gridWidth));
    const h = Math.max(5, Math.min(200, parseInt(newH) || gridHeight));
    onNewGrid(w, h);
    setNewW(String(w));
    setNewH(String(h));
  };

  return (
    <aside className="toolbar">
      {/* Image / New */}
      <div className="tool-section">
        <button className="toolbar-btn primary-btn" onClick={onShowImageConverter}>
          Image to Pattern
        </button>
        <button
          className="toolbar-btn"
          onClick={() => {
            const w = parseInt(newW) || gridWidth;
            const h = parseInt(newH) || gridHeight;
            onNewGrid(w, h);
          }}
        >
          New Grid
        </button>
        <button className="toolbar-btn" onClick={onExportPNG}>Export PNG</button>
        <button className="toolbar-btn" onClick={onUndo} disabled={!canUndo}>Undo</button>
        <button className="toolbar-btn" onClick={onRedo} disabled={!canRedo}>Redo</button>
      </div>

      <div className="tool-divider" />

      {/* Drawing tools */}
      <div className="tool-section">
        <span className="tool-section-label">TOOLS</span>
        <div className="tool-btn-group">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`tool-icon-btn ${tool === t.id ? 'active' : ''}`}
              title={t.title}
              onClick={() => onToolChange(t.id)}
            >
              <img src={t.icon} alt={t.label} className="tool-icon-img" />
            </button>
          ))}
        </div>
        <label className="overlay-toggle-label">
          <input
            type="checkbox"
            checked={showStitch}
            onChange={onToggleStitch}
            className="overlay-checkbox"
          />
          Show stitches
        </label>
      </div>

      <div className="tool-divider" />

      {/* Zoom */}
      <div className="tool-section">
        <span className="tool-section-label">ZOOM</span>
        <div className="zoom-controls">
          <button
            className="zoom-btn"
            onClick={() => onCellSizeChange(Math.max(4, cellSize - 2))}
            disabled={cellSize <= 4}
          >
            −
          </button>
          <span className="zoom-value">{cellSize}px</span>
          <button
            className="zoom-btn"
            onClick={() => onCellSizeChange(Math.min(48, cellSize + 2))}
            disabled={cellSize >= 48}
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={4}
          max={48}
          step={2}
          value={cellSize}
          onChange={e => onCellSizeChange(Number(e.target.value))}
          className="zoom-slider"
        />
      </div>

      <div className="tool-divider" />

      {/* Grid size */}
      <div className="tool-section">
        <span className="tool-section-label">GRID SIZE</span>
        <div className="size-inputs">
          <label className="size-label">
            W
            <input
              type="number"
              className="size-input"
              value={newW}
              min={5}
              max={200}
              onChange={e => setNewW(e.target.value)}
            />
          </label>
          <label className="size-label">
            H
            <input
              type="number"
              className="size-input"
              value={newH}
              min={5}
              max={200}
              onChange={e => setNewH(e.target.value)}
            />
          </label>
        </div>
        <button className="toolbar-btn small-btn" onClick={handleApplySize}>
          Apply
        </button>
      </div>

      <div className="tool-divider" />

      {/* Shortcuts hint */}
      <div className="shortcuts-hint">
        <p><kbd>P</kbd> Pencil</p>
        <p><kbd>F</kbd> Fill</p>
        <p><kbd>E</kbd> Eraser</p>
        <p><kbd>+</kbd><kbd>−</kbd> Zoom</p>
        <p><kbd>Ctrl Z</kbd> Undo</p>
      </div>

      {/* Overlay */}
      {overlayImage && (
        <>
          <div className="tool-divider" />
          <div className="tool-section">
            <span className="tool-section-label">OVERLAY</span>
            <label className="overlay-toggle-label">
              <input
                type="checkbox"
                checked={overlayOn}
                onChange={onToggleOverlay}
                className="overlay-checkbox"
              />
              Show photo overlay
            </label>
            {overlayOn && (
              <div className="overlay-opacity-row">
                <span className="size-label">Opacity</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={e => onOverlayOpacityChange(Number(e.target.value))}
                  className="zoom-slider"
                />
                <span className="zoom-value">{Math.round(overlayOpacity * 100)}%</span>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
