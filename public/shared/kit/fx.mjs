// Whole-scene style passes for 2D canvas games: the looks that code-drawn shapes can't reach on
// their own (paper, print, screen). Each draws onto a 2D context after the scene. Textures are
// made once and cached, so these are cheap enough to run every frame.
//
// For WebGL looks (CRT, glitch, bloom, real chromatic aberration), use PixiJS with pixi-filters
// from /shared/lib/ instead.
import { canvas, silhouette } from './sprites.mjs';

const cache = new Map();
function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

// Film or paper grain. amount 0..1. Uses a tiled noise texture, offset each frame if `animate`.
export function grain(ctx, w, h, { amount = 0.08, size = 128, animate = false, tint = null } = {}) {
  const tile = cached(`grain${size}${tint}`, () => {
    const c = canvas(size, size), x = c.getContext('2d'), img = x.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  });
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  const ox = animate ? (Math.random() * size) | 0 : 0, oy = animate ? (Math.random() * size) | 0 : 0;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.translate(-ox, -oy);
  ctx.fillRect(ox, oy, w + size, h + size);
  ctx.restore();
}

// Horizontal scanlines for screen looks. gap in device pixels.
export function scanlines(ctx, w, h, { alpha = 0.18, gap = 3, color = '#000' } = {}) {
  const tile = cached(`scan${gap}${color}`, () => {
    const c = canvas(1, gap), x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, 1, 1);
    return c;
  });
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// Darkens the edges.
export function vignette(ctx, w, h, { strength = 0.45, color = '0,0,0' } = {}) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${strength})`);
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
}

// Halftone: redraws `src` as dots on a grid, sized by darkness (riso, comics, newsprint).
// Returns a new canvas. Not per-frame: use it on sprites or a static background.
export function halftone(src, { cell = 6, color = '#000', angle = 0.26 } = {}) {
  const w = src.width, h = src.height;
  const s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = color;
  const cos = Math.cos(angle), sin = Math.sin(angle), R = Math.hypot(w, h);
  for (let gy = -R; gy < R; gy += cell) for (let gx = -R; gx < R; gx += cell) {
    const x = w / 2 + gx * cos - gy * sin, y = h / 2 + gx * sin + gy * cos;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = ((y | 0) * w + (x | 0)) * 4;
    const dark = (1 - (s[i] * 0.3 + s[i + 1] * 0.59 + s[i + 2] * 0.11) / 255) * (s[i + 3] / 255);
    if (dark < 0.04) continue;
    ctx.beginPath(); ctx.arc(x, y, Math.sqrt(dark) * cell * 0.62, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

// Misregistered print: draws `src` as offset one-color layers (riso, screen print, woodcut).
// layers: [{ color, dx, dy }]. Multiply blending, so overlaps darken like ink.
export function misregister(ctx, src, x, y, layers) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (const l of layers) ctx.drawImage(silhouette(src, l.color), x + (l.dx || 0), y + (l.dy || 0));
  ctx.restore();
}

// Cheap 2D chromatic split: draws the scene's canvas over itself in two tints, offset. Use on a
// finished frame (pass the same canvas the context draws to, or a copy).
export function chroma(ctx, src, { offset = 2, alpha = 0.35, a = '255,0,90', b = '0,220,255' } = {}) {
  const w = src.width, h = src.height;
  const tint = cached(`chroma${w}x${h}`, () => [canvas(w, h), canvas(w, h)]);
  [[a, -offset], [b, offset]].forEach(([col, dx], i) => {
    const t = tint[i], x = t.getContext('2d');
    x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${col})`; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(t, dx, 0); ctx.restore();
  });
}

// Watercolor-ish: soft bled edges with pigment pooled darker at the rim. Returns a new canvas.
export function wash(src, { bleed = 2, edge = 0.35 } = {}) {
  const pad = bleed * 3, w = src.width + pad * 2, h = src.height + pad * 2;
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.filter = `blur(${bleed}px)`; ctx.globalAlpha = 0.9;
  ctx.drawImage(src, pad, pad);
  // Rim: a dark copy of the shape with a blurred, shrunken core cut out of it.
  const rim = canvas(w, h), r = rim.getContext('2d');
  r.drawImage(silhouette(src, `rgba(0,0,0,${edge})`), pad, pad);
  r.globalCompositeOperation = 'destination-out'; r.filter = `blur(${bleed * 1.5}px)`;
  r.drawImage(src, pad + bleed, pad + bleed, src.width - bleed * 2, src.height - bleed * 2);
  ctx.filter = `blur(${bleed / 2}px)`; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-atop';
  ctx.drawImage(rim, 0, 0);
  return c;
}
