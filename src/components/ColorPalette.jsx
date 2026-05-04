import React, { useMemo, useRef } from 'react';

export default function ColorPalette({
  palette,
  selectedColorIdx,
  onSelectColor,
  onAddColor,
  onDeleteColor,
  grid,
}) {
  const colorPickerRef = useRef(null);

  // Count stitch usage for each palette color
  const usageCounts = useMemo(() => {
    const counts = new Array(palette.length).fill(0);
    if (!grid || grid.length === 0) return counts;
    for (const row of grid) {
      for (const idx of row) {
        if (idx !== null && idx >= 0 && idx < counts.length) counts[idx]++;
      }
    }
    return counts;
  }, [grid, palette]);

  const totalStitches = usageCounts.reduce((a, b) => a + b, 0) || 1;

  const handlePickerChange = (e) => {
    const hex = e.target.value;
    // If color already exists, just select it
    const existing = palette.indexOf(hex);
    if (existing !== -1) {
      onSelectColor(existing);
    } else {
      onAddColor(hex);
    }
  };

  return (
    <aside className="color-palette">
      <div className="palette-header">
        <span className="palette-title">Colors</span>
        <span className="palette-count">{palette.length}</span>
      </div>

      {/* Active color + picker */}
      <div className="active-color-row">
        <div
          className="active-color-swatch"
          style={{ background: palette[selectedColorIdx] || '#fff' }}
          title="Active color"
        />
        <div className="active-color-info">
          <span className="active-color-hex">{palette[selectedColorIdx] || '—'}</span>
          <span className="active-color-usage">
            {usageCounts[selectedColorIdx] ?? 0} stitches
          </span>
        </div>
        <button
          className="add-color-btn"
          title="Pick a new color"
          onClick={() => colorPickerRef.current?.click()}
        >
          +
        </button>
        <input
          ref={colorPickerRef}
          type="color"
          className="hidden-picker"
          value={palette[selectedColorIdx] || '#000000'}
          onChange={handlePickerChange}
        />
      </div>

      {/* Palette swatches */}
      <div className="palette-swatches">
        {palette.map((color, idx) => (
          <div
            key={idx}
            className={`palette-swatch-item ${idx === selectedColorIdx ? 'selected' : ''}`}
            title={`${color} (${usageCounts[idx]} stitches)`}
          >
            <button
              className="swatch-btn"
              style={{ background: color }}
              onClick={() => onSelectColor(idx)}
            />
            <div className="swatch-meta">
              <span className="swatch-hex">{color}</span>
              <div className="swatch-bar">
                <div
                  className="swatch-bar-fill"
                  style={{
                    width: `${Math.round((usageCounts[idx] / totalStitches) * 100)}%`,
                    background: color,
                    border: '1px solid rgba(0,0,0,0.15)',
                  }}
                />
              </div>
              <span className="swatch-count">{usageCounts[idx]}</span>
            </div>
            <button
              className="swatch-delete"
              onClick={() => onDeleteColor(idx)}
              title="Remove color"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add custom color */}
      <button
        className="add-custom-btn"
        onClick={() => colorPickerRef.current?.click()}
      >
        + Add Color
      </button>

      <div className="palette-legend">
        <div className="legend-item"><span className="legend-dot" />Empty cell</div>
        <div className="legend-item"><span className="legend-dot active" />Selected</div>
      </div>
    </aside>
  );
}
