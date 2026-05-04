import React, { useState, useCallback, useEffect, useRef } from 'react';
import PatternGrid from './PatternGrid';
import ColorPalette from './ColorPalette';
import Toolbar from './Toolbar';
import ImageConverter from './ImageConverter';

const DEFAULT_W = 40;
const DEFAULT_H = 40;
const DEFAULT_PALETTE = [
  '#FFFFFF', '#000000', '#CD65B4', '#9DABB9', '#D4866E',
  '#41742F', '#2A0B75', '#542154', '#F0D1E8', '#F4EBCD',
];
const MAX_UNDO = 50;

function makeBlankGrid(w, h) {
  return Array.from({ length: h }, () => new Array(w).fill(null));
}

function floodFill(grid, x, y, newColor) {
  const rows = grid.length;
  const cols = grid[0].length;
  const target = grid[y][x];
  if (target === newColor) return grid;
  const newGrid = grid.map(r => [...r]);
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue;
    if (newGrid[cy][cx] !== target) continue;
    newGrid[cy][cx] = newColor;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return newGrid;
}

export default function PixelStitchApp() {
  const mode = 'cross-stitch';
  const [tool, setTool] = useState('pencil');
  const [cellSize, setCellSize] = useState(18);
  const [palette, setPalette] = useState([...DEFAULT_PALETTE]);
  const [selectedColorIdx, setSelectedColorIdx] = useState(1);
  const [grid, setGrid] = useState(() => makeBlankGrid(DEFAULT_W, DEFAULT_H));
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [showConverter, setShowConverter] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [overlayImage, setOverlayImage] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.35);
  const [overlayOn, setOverlayOn] = useState(false);
  const [showStitch, setShowStitch] = useState(true);
  const gridRef = useRef(null);

  // ── History helpers ───────────────────────────────────────────────────────

  const pushUndo = useCallback((before) => {
    setUndoStack(s => [...s.slice(-(MAX_UNDO - 1)), before]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack(s => {
      if (s.length === 0) return s;
      const prev = s[s.length - 1];
      setRedoStack(r => [...r, grid]);
      setGrid(prev);
      return s.slice(0, -1);
    });
  }, [grid]);

  const redo = useCallback(() => {
    setRedoStack(s => {
      if (s.length === 0) return s;
      const next = s[s.length - 1];
      setUndoStack(r => [...r, grid]);
      setGrid(next);
      return s.slice(0, -1);
    });
  }, [grid]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      switch (e.key.toLowerCase()) {
        case 'p': setTool('pencil'); break;
        case 'f': setTool('fill'); break;
        case 'e': setTool('eraser'); break;
        case '+': case '=': setCellSize(s => Math.min(48, s + 2)); break;
        case '-': setCellSize(s => Math.max(4, s - 2)); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ── Grid operations ───────────────────────────────────────────────────────

  const handleNewGrid = useCallback((w, h) => {
    pushUndo(grid);
    setGrid(makeBlankGrid(w, h));
    setStatusMsg(`New ${w}×${h} grid created`);
  }, [grid, pushUndo]);

  const handleStrokeEnd = useCallback((newGrid, before) => {
    pushUndo(before);
    setGrid(newGrid);
  }, [pushUndo]);

  const handleFill = useCallback((x, y, colorIdx) => {
    const colorToFill = tool === 'eraser' ? null : colorIdx;
    const before = grid.map(r => [...r]);
    const next = floodFill(grid, x, y, colorToFill);
    pushUndo(before);
    setGrid(next);
  }, [grid, tool, pushUndo]);

  // ── Palette operations ────────────────────────────────────────────────────

  const handleAddColor = useCallback((hex) => {
    setPalette(p => {
      const next = [...p, hex];
      setSelectedColorIdx(next.length - 1);
      return next;
    });
  }, []);

  const handleDeleteColor = useCallback((idx) => {
    setPalette(p => {
      if (p.length <= 1) return p;
      const next = p.filter((_, i) => i !== idx);
      // Remap grid: remove uses of deleted color, shift indices
      setGrid(g => g.map(row => row.map(v => {
        if (v === idx) return null;
        if (v > idx) return v - 1;
        return v;
      })));
      setSelectedColorIdx(si => {
        if (si === idx) return Math.max(0, idx - 1);
        if (si > idx) return si - 1;
        return si;
      });
      return next;
    });
  }, []);

  // ── Image converter ───────────────────────────────────────────────────────

  const handleConvert = useCallback(({ grid: newGrid, palette: newPalette, imgSrc }) => {
    pushUndo(grid);
    setGrid(newGrid);
    setPalette(newPalette);
    setSelectedColorIdx(0);
    if (imgSrc) { setOverlayImage(imgSrc); setOverlayOn(true); }
    setShowConverter(false);
    setStatusMsg(`Imported ${newGrid[0].length}×${newGrid.length} pattern with ${newPalette.length} colors`);
  }, [grid, pushUndo]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportPNG = useCallback(() => {
    const canvas = gridRef.current?.getCanvas();
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `stitch-pattern-${Date.now()}.png`;
    a.click();
    setStatusMsg('PNG exported');
  }, []);

  // ── Status bar info ───────────────────────────────────────────────────────

  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const filledCount = grid.flat().filter(v => v !== null).length;

  return (
    <div className="app-shell">
      {/* Main layout */}
      <div className="main-layout">
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          cellSize={cellSize}
          onCellSizeChange={setCellSize}
          gridWidth={cols}
          gridHeight={rows}
          onNewGrid={handleNewGrid}
          onShowImageConverter={() => setShowConverter(true)}
          overlayImage={overlayImage}
          overlayOn={overlayOn}
          onToggleOverlay={() => setOverlayOn(v => !v)}
          overlayOpacity={overlayOpacity}
          onOverlayOpacityChange={setOverlayOpacity}
          showStitch={showStitch}
          onToggleStitch={() => setShowStitch(v => !v)}
          onExportPNG={handleExportPNG}
          onUndo={undo}
          onRedo={redo}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
        />

        {/* Canvas area */}
        <main className="canvas-area">
          <div className="canvas-scroll">
            <PatternGrid
              ref={gridRef}
              grid={grid}
              palette={palette}
              selectedColorIdx={selectedColorIdx}
              tool={tool}
              mode={mode}
              cellSize={cellSize}
              hoveredCell={hoveredCell}
              onStrokeEnd={handleStrokeEnd}
              onFill={handleFill}
              onHover={setHoveredCell}
              overlayImage={overlayOn ? overlayImage : null}
              overlayOpacity={overlayOpacity}
              showStitch={showStitch}
            />
          </div>

          {/* Status bar */}
          <div className="status-bar">
            <span>{cols} × {rows} &nbsp;·&nbsp; {filledCount} stitches filled</span>
            {hoveredCell && (
              <span>Cell ({hoveredCell.x + 1}, {hoveredCell.y + 1})</span>
            )}
            <span className="status-msg">{statusMsg}</span>
          </div>
        </main>

        <ColorPalette
          palette={palette}
          selectedColorIdx={selectedColorIdx}
          onSelectColor={setSelectedColorIdx}
          onAddColor={handleAddColor}
          onDeleteColor={handleDeleteColor}
          grid={grid}
        />
      </div>

      {/* Modal */}
      {showConverter && (
        <ImageConverter
          onConvert={handleConvert}
          onClose={() => setShowConverter(false)}
        />
      )}
    </div>
  );
}
