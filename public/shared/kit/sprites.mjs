// Sprites for Daily Incremental games. Everything returns a plain <canvas>, which draws straight
// into a 2D canvas (ctx.drawImage) or becomes a PixiJS texture (Texture.from(canvas)).
//
// The idea: open-licensed SVGs (npm run art) are source *shapes*. A game recolors them to its
// palette and restyles them (pixelate, outline, rough redraw, gradient) so no game looks like the
// icon set it borrowed from. Main characters are often better as hand-made pixel grids (pixel()).
//
// Register every sprite you make with register(name, canvas). Open the game with ?sprites to see
// them all on one sheet (npm run check screenshots it), and look at it before building around them.

// ---------- SVG sources ----------

export async function loadSvg(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

const hex = c => {
  const ctx = (hex.ctx ||= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d'));
  ctx.fillStyle = '#000'; ctx.fillStyle = c; return ctx.fillStyle; // normalizes names, rgb(), #abc
};
const rgb = c => { const h = hex(c); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = c => { const [r, g, b] = rgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// Recolors an SVG. `to` is one color (for single-color icons, which use currentColor), an object
// mapping old colors to new, or an array palette: the SVG's colors are matched to the palette by
// brightness rank, so darks stay dark and lights stay light.
export function recolor(svg, to) {
  if (typeof to === 'string') return svg.replace(/currentColor/g, to).replace(/<svg /, `<svg color="${to}" `);
  const found = [...new Set([...svg.matchAll(/(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{3,8}|[a-z]+)"/g)].map(m => m[1]).filter(c => c !== 'none' && c !== 'currentColor'))];
  let map = to;
  if (Array.isArray(to)) {
    const pal = [...to].sort((a, b) => lum(a) - lum(b));
    const src = [...found].sort((a, b) => lum(a) - lum(b));
    map = {};
    src.forEach((c, i) => { map[c] = pal[Math.round(src.length < 2 ? pal.length - 1 : i / (src.length - 1) * (pal.length - 1))]; });
  }
  return svg.replace(/(fill|stroke|stop-color)="([^"]+)"/g, (m, attr, c) => (map[c] ? `${attr}="${map[c]}"` : m));
}

// Fills every shape with a gradient (stops: array of colors, top to bottom by default).
export function gradient(svg, stops, { angle = 90 } = {}) {
  const a = (angle - 90) * Math.PI / 180;
  const x2 = 0.5 + Math.cos(a) * 0.5, y2 = 0.5 + Math.sin(a) * 0.5;
  const def = `<defs><linearGradient id="kitg" x1="${1 - x2}" y1="${1 - y2}" x2="${x2}" y2="${y2}">${
    stops.map((c, i) => `<stop offset="${i / Math.max(1, stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;
  return svg.replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="url(#kitg)"').replace(/(<svg[^>]*>)/, `$1${def}`);
}

// Rasterizes an SVG string to a canvas of the given size (keeps aspect, centered).
export function svgToCanvas(svg, w, h = w) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = canvas(w, h), ctx = c.getContext('2d');
      const k = Math.min(w / img.width, h / img.height);
      ctx.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k);
      resolve(c);
    };
    img.onerror = () => reject(new Error('svg failed to load'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// Redraws an SVG's paths with Rough.js: sketchy, hand-drawn, crayon or stitched looks.
// Pass the rough.js module from the game's own import (import rough from 'roughjs'), so the credits
// tool sees the game uses it. opts go to rough.js (roughness, bowing, fill, stroke, strokeWidth,
// fillStyle: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots').
export function roughen(rough, svg, size, opts = {}) {
  const vb = (svg.match(/viewBox="([^"]+)"/) || [, `0 0 ${size} ${size}`])[1].split(/[ ,]+/).map(Number);
  const c = canvas(size, size), ctx = c.getContext('2d');
  const k = size / Math.max(vb[2], vb[3]);
  ctx.setTransform(k, 0, 0, k, -vb[0] * k, -vb[1] * k);
  const rc = rough.canvas(c);
  for (const m of svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
    rc.path(m[1], { roughness: 1.2, fillStyle: 'hachure', fill: '#000', stroke: '#000', ...opts, strokeWidth: (opts.strokeWidth || 1.5) / k, hachureGap: (opts.hachureGap || 4) / k });
  }
  return c;
}

// ---------- Pixel art ----------

// A pixel sprite from text rows: one character per pixel, '.' or ' ' is transparent.
//   pixel(`..kk..
//          .kwwk.`, { k: '#222', w: '#fff' }, { scale: 4 })
export function pixel(rows, colors, { scale = 1 } = {}) {
  const lines = (Array.isArray(rows) ? rows : rows.split('\n')).map(l => l.trim()).filter(Boolean);
  const w = Math.max(...lines.map(l => l.length)), h = lines.length;
  const c = canvas(w, h), ctx = c.getContext('2d');
  lines.forEach((line, y) => [...line].forEach((ch, x) => {
    if (ch === '.' || ch === ' ' || !colors[ch]) return;
    ctx.fillStyle = colors[ch]; ctx.fillRect(x, y, 1, 1);
  }));
  return scale > 1 ? scaleUp(c, scale) : c;
}

// Shrinks any canvas to `width` pixels wide and snaps every pixel to the palette, with an optional
// ordered dither. Use it to turn SVG shapes into pixel art; scaleUp() the result to display it.
export function pixelate(src, width, palette, { dither = 0, alphaCut = 0.5 } = {}) {
  const w = width, h = Math.max(1, Math.round(src.height * width / src.width));
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const pal = palette.map(rgb);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 255 * alphaCut) { d[i + 3] = 0; continue; }
    const p = i / 4, x = p % w, y = (p / w) | 0;
    const off = dither ? (bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * dither * 64 : 0;
    let best = 0, bd = Infinity;
    for (let j = 0; j < pal.length; j++) {
      const dr = d[i] + off - pal[j][0], dg = d[i + 1] + off - pal[j][1], db = d[i + 2] + off - pal[j][2];
      const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dist < bd) { bd = dist; best = j; }
    }
    [d[i], d[i + 1], d[i + 2]] = pal[best]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Nearest-neighbor scale, for crisp pixels.
export function scaleUp(src, k) {
  const c = canvas(Math.round(src.width * k), Math.round(src.height * k)), ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// ---------- Finishing touches ----------

// Adds an outline `px` wide around the opaque parts (grows the canvas to fit).
export function outline(src, color, px = 1) {
  const c = canvas(src.width + px * 2, src.height + px * 2), ctx = c.getContext('2d');
  const sil = silhouette(src, color);
  for (let dx = -px; dx <= px; dx++) for (let dy = -px; dy <= px; dy++) {
    if (dx * dx + dy * dy <= px * px + px) ctx.drawImage(sil, px + dx, px + dy);
  }
  ctx.drawImage(src, px, px);
  return c;
}

// A one-color copy of the shape (shadows, flashes, cutout borders).
export function silhouette(src, color) {
  const c = canvas(src.width, src.height), ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// Drop shadow offset by (dx, dy); `blur` softens it (0 keeps it hard, for pixel and cutout looks).
export function shadow(src, color, dx = 2, dy = 2, blur = 0) {
  const pad = Math.ceil(blur * 2);
  const c = canvas(src.width + Math.abs(dx) + pad * 2, src.height + Math.abs(dy) + pad * 2), ctx = c.getContext('2d');
  const ox = pad + Math.max(0, -dx), oy = pad + Math.max(0, -dy);
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(silhouette(src, color), ox + dx, oy + dy);
  ctx.filter = 'none';
  ctx.drawImage(src, ox, oy);
  return c;
}

// Stacks canvases (all drawn at the same origin unless given [canvas, x, y]).
export function layer(...parts) {
  const items = parts.map(p => (Array.isArray(p) ? p : [p, 0, 0]));
  const w = Math.max(...items.map(([c, x]) => c.width + x)), h = Math.max(...items.map(([c, , y]) => c.height + y));
  const c = canvas(w, h), ctx = c.getContext('2d');
  for (const [p, x, y] of items) ctx.drawImage(p, x, y);
  return c;
}

export function canvas(w, h) {
  return Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) });
}

// ---------- Sprite sheet ----------

const registry = [];

// Records a sprite for the ?sprites sheet and returns it unchanged.
export function register(name, c) { registry.push({ name, c }); return c; }

export const sheetRequested = () => new URLSearchParams(location.search).has('sprites');

// Shows every registered sprite on one page, at 1x and enlarged, over light and dark checks so
// stray pixels and missing outlines show up. Call it after all sprites are made.
export function showSheet({ zoom = 3 } = {}) {
  const el = document.createElement('div');
  el.id = 'di-sprites';
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#777;padding:16px;display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start;font:12px/1.3 ui-monospace,monospace;color:#fff';
  for (const { name, c } of registry) {
    const card = document.createElement('figure');
    card.style.cssText = 'margin:0;padding:8px;background:repeating-conic-gradient(#999 0 25%,#bbb 0 50%) 0 0/16px 16px;border-radius:6px;display:flex;flex-direction:column;gap:6px;align-items:flex-start';
    const big = scaleUp(c, Math.max(1, Math.min(zoom, 360 / Math.max(c.width, c.height))));
    const dark = document.createElement('div');
    dark.style.cssText = 'background:#1a1a1a;padding:6px;border-radius:4px;display:flex;gap:8px;align-items:flex-end';
    const small = scaleUp(c, 1);
    dark.append(small);
    card.append(big, dark, Object.assign(document.createElement('figcaption'), { textContent: `${name} ${c.width}×${c.height}`, style: 'background:#0008;padding:2px 5px;border-radius:3px' }));
    el.append(card);
  }
  document.body.append(el);
  el.dataset.ready = '1';
}
