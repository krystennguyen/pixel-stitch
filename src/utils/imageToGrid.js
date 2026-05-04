/**
 * Converts an HTML image element into a 2D grid of palette indices.
 * Uses k-means++ color quantization to reduce image colors.
 */

export function imageToGrid(imageElement, gridWidth, gridHeight, maxColors = 24) {
  const canvas = document.createElement('canvas');
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imageElement, 0, 0, gridWidth, gridHeight);

  const imageData = ctx.getImageData(0, 0, gridWidth, gridHeight);
  const pixels = imageData.data;

  // Extract RGB triples
  const rawColors = [];
  for (let i = 0; i < pixels.length; i += 4) {
    rawColors.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }

  // Run k-means to get palette
  const k = Math.min(maxColors, rawColors.length);
  const palette = kMeans(rawColors, k, 12);

  // Map every pixel to nearest palette entry
  const grid = [];
  for (let y = 0; y < gridHeight; y++) {
    const row = [];
    for (let x = 0; x < gridWidth; x++) {
      const idx = y * gridWidth + x;
      row.push(nearestIdx(rawColors[idx], palette));
    }
    grid.push(row);
  }

  const hexPalette = palette.map(([r, g, b]) => rgbToHex(r, g, b));

  // Remove unused palette entries and remap
  const usedSet = new Set(grid.flat());
  const usedList = [...usedSet].sort((a, b) => a - b);
  const remap = new Map(usedList.map((old, i) => [old, i]));

  const remappedGrid = grid.map(row => row.map(v => remap.get(v)));
  const trimmedPalette = usedList.map(i => hexPalette[i]);

  return { grid: remappedGrid, palette: trimmedPalette };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function colorDist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function nearestIdx(color, palette) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = colorDist2(color, palette[i]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// Subsample colors for faster k-means
function subsample(colors, n) {
  if (colors.length <= n) return colors;
  const step = Math.ceil(colors.length / n);
  const out = [];
  for (let i = 0; i < colors.length && out.length < n; i += step) {
    out.push(colors[i]);
  }
  return out;
}

// k-means++ initialization
function initCentroids(colors, k) {
  const centroids = [colors[Math.floor(Math.random() * colors.length)]];
  while (centroids.length < k) {
    const dists = colors.map(c => Math.min(...centroids.map(ct => colorDist2(c, ct))));
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) {
      centroids.push(colors[Math.floor(Math.random() * colors.length)]);
      continue;
    }
    let r = Math.random() * total;
    let chosen = colors[colors.length - 1];
    for (let i = 0; i < colors.length; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = colors[i]; break; }
    }
    centroids.push(chosen);
  }
  return centroids;
}

function kMeans(allColors, k, iterations = 12) {
  if (allColors.length === 0 || k === 0) return [];
  const colors = subsample(allColors, 2000);
  let centroids = initCentroids(colors, k);

  for (let iter = 0; iter < iterations; iter++) {
    const clusters = Array.from({ length: k }, () => ({ sum: [0, 0, 0], count: 0 }));
    for (const c of colors) {
      const idx = nearestIdx(c, centroids);
      clusters[idx].sum[0] += c[0];
      clusters[idx].sum[1] += c[1];
      clusters[idx].sum[2] += c[2];
      clusters[idx].count++;
    }
    let changed = false;
    centroids = centroids.map((old, i) => {
      if (clusters[i].count === 0) return old;
      const newC = clusters[i].sum.map(v => v / clusters[i].count);
      if (colorDist2(old, newC) > 1) changed = true;
      return newC;
    });
    if (!changed) break;
  }
  return centroids;
}
