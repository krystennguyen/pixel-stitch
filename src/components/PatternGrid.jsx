import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

// ── Pure canvas drawing helpers ───────────────────────────────────────────────

function luminance(hex) {
  if (!hex || hex.length < 7) return 128;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function stitchStroke(hex) {
  return luminance(hex) < 128 ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.30)';
}

function drawXStitch(ctx, px, py, cw, ch, color) {
  const pad = Math.max(1.5, cw * 0.15);
  ctx.strokeStyle = stitchStroke(color);
  ctx.lineWidth = Math.max(0.8, cw / 10);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px + pad, py + pad);
  ctx.lineTo(px + cw - pad, py + ch - pad);
  ctx.moveTo(px + cw - pad, py + pad);
  ctx.lineTo(px + pad, py + ch - pad);
  ctx.stroke();
}

function drawCrochetStitch(ctx, px, py, cw, ch, color) {
  ctx.strokeStyle = stitchStroke(color);
  ctx.lineWidth = Math.max(0.8, cw / 11);
  ctx.lineCap = 'round';
  const cx = px + cw / 2;
  // Top arc (chain)
  ctx.beginPath();
  ctx.arc(cx, py + ch * 0.33, cw * 0.28, Math.PI, 0);
  ctx.stroke();
  // V legs (single crochet body)
  ctx.beginPath();
  ctx.moveTo(px + cw * 0.22, py + ch * 0.33);
  ctx.lineTo(cx, py + ch * 0.72);
  ctx.lineTo(px + cw * 0.78, py + ch * 0.33);
  ctx.stroke();
}

function renderCell(ctx, g, x, y, palette, mode, cw, ch, cellSize, showStitch) {
  const px = x * cw;
  const py = y * ch;
  const colorIdx = g[y][x];
  const color = (colorIdx !== null && colorIdx >= 0) ? (palette[colorIdx] || null) : null;

  ctx.fillStyle = color || '#f5f0eb';
  ctx.fillRect(px, py, cw, ch);

  if (showStitch && color && cellSize >= 8) {
    if (mode === 'cross-stitch') {
      drawXStitch(ctx, px, py, cw, ch, color);
    } else {
      drawCrochetStitch(ctx, px, py, cw, ch, color);
    }
  }

  if (cellSize >= 4) {
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px + 0.25, py + 0.25, cw - 0.5, ch - 0.5);
  }
}

function renderFullGrid(canvas, g, palette, mode, cw, ch, cellSize, hovered, showStitch) {
  if (!canvas || !g || g.length === 0) return;
  const rows = g.length;
  const cols = g[0].length;
  const W = cols * cw;
  const H = rows * ch;

  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f0eb';
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      renderCell(ctx, g, x, y, palette, mode, cw, ch, cellSize, showStitch);
    }
  }

  // Bold guide lines every 10 cells
  if (cellSize >= 5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= rows; y += 10) {
      ctx.beginPath(); ctx.moveTo(0, y * ch); ctx.lineTo(W, y * ch); ctx.stroke();
    }
    for (let x = 0; x <= cols; x += 10) {
      ctx.beginPath(); ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, H); ctx.stroke();
    }
  }

  // Hover highlight
  if (hovered) {
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 2;
    ctx.strokeRect(hovered.x * cw + 1, hovered.y * ch + 1, cw - 2, ch - 2);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const PatternGrid = forwardRef(function PatternGrid(
  { grid, palette, selectedColorIdx, tool, mode, cellSize, hoveredCell, onStrokeEnd, onFill, onHover, overlayImage, overlayOpacity, showStitch },
  ref
) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null); // cached Image element for overlay
  const localGrid = useRef(null);       // mutable copy used during strokes
  const isDrawing = useRef(false);
  const lastCell = useRef(null);
  const preStroke = useRef(null);       // snapshot before stroke, for undo

  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const cw = mode === 'crochet' ? Math.round(cellSize * 0.85) : cellSize;
  const ch = cellSize;

  // Expose canvas + current grid to parent via ref
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getGrid: () => localGrid.current,
  }), []);

  // Helper: draw overlay on top of already-rendered grid
  const drawOverlay = useCallback(() => {    const canvas = canvasRef.current;
    if (!canvas || !overlayImage) return;
    const ctx = canvas.getContext('2d');
    const doRender = (img) => {
      ctx.save();
      ctx.globalAlpha = overlayOpacity ?? 0.35;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
    if (overlayRef.current && overlayRef.current.src === overlayImage) {
      doRender(overlayRef.current);
    } else {
      const img = new Image();
      img.onload = () => { overlayRef.current = img; doRender(img); };
      img.src = overlayImage;
    }
  }, [overlayImage, overlayOpacity]);

  // Sync local grid from prop whenever it changes externally
  useEffect(() => {
    localGrid.current = grid.map(row => [...row]);
    renderFullGrid(canvasRef.current, localGrid.current, palette, mode, cw, ch, cellSize, hoveredCell, showStitch);
    drawOverlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, palette, mode, cw, ch, cellSize, showStitch]);

  // Re-render when hover changes (cheap — just redraws hover highlight)
  useEffect(() => {
    renderFullGrid(canvasRef.current, localGrid.current, palette, mode, cw, ch, cellSize, hoveredCell, showStitch);
    drawOverlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredCell]);

  // Re-render when overlay changes
  useEffect(() => {
    renderFullGrid(canvasRef.current, localGrid.current, palette, mode, cw, ch, cellSize, hoveredCell, showStitch);
    drawOverlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayImage, overlayOpacity]);

  // ── Mouse helpers ─────────────────────────────────────────────────────────

  const cellFromEvent = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / cw);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / ch);
    if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
    return { x, y };
  }, [cw, ch, cols, rows]);

  const paintCell = useCallback((x, y) => {
    const g = localGrid.current;
    if (!g) return;
    const colorToApply = tool === 'eraser' ? null : selectedColorIdx;
    if (g[y][x] === colorToApply) return;
    g[y][x] = colorToApply;
    // Partial redraw: just repaint changed cell + borders
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    renderCell(ctx, g, x, y, palette, mode, cw, ch, cellSize, showStitch);
  }, [tool, selectedColorIdx, palette, mode, cw, ch, cellSize, showStitch]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const cell = cellFromEvent(e);
    if (!cell) return;

    if (tool === 'fill') {
      onFill(cell.x, cell.y, selectedColorIdx);
      return;
    }

    isDrawing.current = true;
    preStroke.current = localGrid.current.map(row => [...row]);
    paintCell(cell.x, cell.y);
    lastCell.current = cell;
  }, [tool, selectedColorIdx, cellFromEvent, paintCell, onFill]);

  const handleMouseMove = useCallback((e) => {
    const cell = cellFromEvent(e);
    onHover(cell);
    if (!isDrawing.current || !cell || tool === 'fill') return;
    if (lastCell.current?.x === cell.x && lastCell.current?.y === cell.y) return;
    paintCell(cell.x, cell.y);
    lastCell.current = cell;
  }, [tool, cellFromEvent, paintCell, onHover]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing.current && localGrid.current) {
      onStrokeEnd(localGrid.current.map(row => [...row]), preStroke.current);
      drawOverlay();
    }
    isDrawing.current = false;
    lastCell.current = null;
    preStroke.current = null;
  }, [onStrokeEnd, drawOverlay]);

  const handleMouseLeave = useCallback(() => {
    onHover(null);
    handleMouseUp();
  }, [onHover, handleMouseUp]);

  // Touch support
  const toMouseEvent = (e) => {
    const t = e.touches[0];
    return { clientX: t.clientX, clientY: t.clientY, button: 0 };
  };

  const cursor = tool === 'eraser' ? 'cell' : tool === 'fill' ? 'copy' : 'crosshair';

  return (
    <div className="pattern-grid-container">
      <canvas
        ref={canvasRef}
        className="pattern-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={e => { e.preventDefault(); handleMouseDown(toMouseEvent(e)); }}
        onTouchMove={e => { e.preventDefault(); handleMouseMove(toMouseEvent(e)); }}
        onTouchEnd={() => handleMouseUp()}
        style={{ cursor, touchAction: 'none', display: 'block' }}
      />
    </div>
  );
});

export default PatternGrid;
