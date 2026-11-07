/**
 * Generates raster brand assets with zero dependencies:
 *   assets/img/og-hometech-interiors.png   (1200x630 Open Graph card)
 *   assets/img/apple-touch-icon.png        (180x180)
 *   assets/img/favicon-64.png              (64x64)
 *
 * Uses Node's built-in zlib to write real PNG files and a tiny built-in 5x7
 * bitmap font for the wordmark, so no image/font libraries are required.
 *
 *   npm run assets
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = path.join(ROOT, 'assets', 'img');

/* ------------------------------------------------------------------- palette */

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  255
];

const INK = hex('#0B1622');
const INK_SOFT = hex('#111E2B');
const PAPER = hex('#FAF9F6');
const BRASS = hex('#C6A15B');
const BRASS_DIM = hex('#6B5A33');
const MUTED = hex('#8E9AA6');

/* ---------------------------------------------------------------- PNG writer */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ------------------------------------------------------------------- canvas */

function createCanvas(width, height, background) {
  const px = Buffer.alloc(width * height * 4);
  const canvas = {
    width,
    height,
    px,
    blend(x, y, [r, g, b, a]) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      if (a >= 255) {
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        return;
      }
      const t = a / 255;
      px[i] = Math.round(px[i] * (1 - t) + r * t);
      px[i + 1] = Math.round(px[i + 1] * (1 - t) + g * t);
      px[i + 2] = Math.round(px[i + 2] * (1 - t) + b * t);
      px[i + 3] = 255;
    },
    fill(x, y, w, h, color) {
      for (let yy = Math.round(y); yy < Math.round(y + h); yy += 1)
        for (let xx = Math.round(x); xx < Math.round(x + w); xx += 1) canvas.blend(xx, yy, color);
    },
    stroke(x, y, w, h, color, t = 1) {
      canvas.fill(x, y, w, t, color);
      canvas.fill(x, y + h - t, w, t, color);
      canvas.fill(x, y, t, h, color);
      canvas.fill(x + w - t, y, t, h, color);
    },
    line(x0, y0, x1, y1, color, t = 1) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let i = 0; i <= steps; i += 1) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const y = y0 + ((y1 - y0) * i) / steps;
        for (let ox = 0; ox < t; ox += 1) for (let oy = 0; oy < t; oy += 1) canvas.blend(Math.round(x) + ox, Math.round(y) + oy, color);
      }
    },
    toPNG: () => encodePNG(width, height, px)
  };
  if (background) canvas.fill(0, 0, width, height, background);
  return canvas;
}

/* -------------------------------------------------------------- 5x7 bitmap font */

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10011', '10101', '10101', '10101', '11001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '&': ['01000', '10100', '10100', '01000', '10101', '10010', '01101'],
  '·': ['00000', '00000', '00000', '00100', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000']
};

function textWidth(text, scale, tracking = 1) {
  const chars = [...text];
  if (!chars.length) return 0;
  return chars.length * 5 * scale + (chars.length - 1) * tracking * scale;
}

function drawText(canvas, text, x, y, { scale = 2, color = PAPER, tracking = 1.4, align = 'left' } = {}) {
  const chars = [...String(text).toUpperCase()];
  const width = textWidth(text, scale, tracking) + Math.max(0, chars.length - 1) * 0;
  let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  for (const ch of chars) {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < 7; row += 1) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col += 1) {
        if (bits[col] !== '1') continue;
        canvas.fill(cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 5 * scale + tracking * scale;
  }
  return width;
}

/* ---------------------------------------------------------------- compositions */

/** Thin architectural elevation motif: a modular-kitchen run with cove lighting. */
function kitchenElevation(canvas, x, y, w, h, color, dim) {
  const unit = w / 4;
  // upper cabinets
  for (let i = 0; i < 4; i += 1) {
    canvas.stroke(x + i * unit, y, unit, h * 0.3, color, 1);
    canvas.fill(x + i * unit + unit * 0.5 - 1, y + h * 0.14, 2, h * 0.05, dim);
  }
  // cove light line
  canvas.fill(x, y + h * 0.34, w, 1, color);
  // base cabinets
  for (let i = 0; i < 4; i += 1) {
    canvas.stroke(x + i * unit, y + h * 0.5, unit, h * 0.42, color, 1);
  }
  // worktop
  canvas.fill(x, y + h * 0.47, w, 2, color);
  // tall appliance column
  canvas.stroke(x + w * 0.78, y + h * 0.02, w * 0.2, h * 0.9, dim, 1);
}

function ogCard() {
  const W = 1200;
  const H = 630;
  const c = createCanvas(W, H, INK);

  // soft vignette panel
  c.fill(0, 0, W, 4, INK_SOFT);
  c.fill(0, H - 4, W, 4, INK_SOFT);

  // brass hairline frame
  c.stroke(56, 56, W - 112, H - 112, BRASS_DIM, 1);

  // elevation motif on the right
  kitchenElevation(c, 690, 176, 430, 280, BRASS_DIM, BRASS_DIM);

  // eyebrow rule + label
  c.fill(88, 150, 48, 2, BRASS);
  drawText(c, 'CHENNAI', 88, 126, { scale: 2, color: BRASS, tracking: 1.8 });
  drawText(c, 'INTERIOR DECORATORS', 200, 126, { scale: 2, color: MUTED, tracking: 1.8 });

  // wordmark
  drawText(c, 'HOMETECH', 88, 210, { scale: 11, color: PAPER, tracking: 1.6 });
  drawText(c, 'INTERIORS', 88, 300, { scale: 6, color: BRASS, tracking: 4 });

  // hairline
  c.fill(88, 380, 300, 1, BRASS_DIM);

  // tagline
  drawText(c, 'YOUR THOUGHT. OUR DESIGN.', 88, 404, { scale: 3.2, color: PAPER, tracking: 1.4 });
  drawText(c, 'SAIDAPET, CHENNAI  ·  22+ YEARS OF EXPERIENCE', 88, 456, { scale: 2.2, color: MUTED, tracking: 1.4 });

  // contact baseline
  c.fill(88, 520, 1024, 1, BRASS_DIM);
  drawText(c, '8122220083', 88, 540, { scale: 3, color: PAPER, tracking: 1.6 });
  drawText(c, 'MODULAR KITCHENS · WARDROBES · FALSE CEILINGS', W - 88, 540, {
    scale: 2.2,
    color: MUTED,
    tracking: 1.2,
    align: 'right'
  });

  return c;
}

function appIcon(size) {
  const c = createCanvas(size, size, INK);
  const pad = Math.max(2, Math.round(size * 0.09));
  c.stroke(pad, pad, size - pad * 2, size - pad * 2, BRASS, Math.max(1, Math.round(size / 64)));
  const scale = Math.max(2, Math.round(size / 12));
  const h = 7 * scale;
  drawText(c, 'H', size / 2, (size - h) / 2, { scale, color: BRASS, tracking: 0, align: 'center' });
  return c;
}

/* -------------------------------------------------------------------- write */

await mkdir(OUT, { recursive: true });

const jobs = [
  ['og-hometech-interiors.png', ogCard()],
  ['apple-touch-icon.png', appIcon(180)],
  ['favicon-64.png', appIcon(64)]
];

for (const [name, canvas] of jobs) {
  const png = canvas.toPNG();
  await writeFile(path.join(OUT, name), png);
  console.log(`  ✓ assets/img/${name}  ${canvas.width}x${canvas.height}  ${(png.length / 1024).toFixed(1)} KB`);
}

// Vector favicon: a navy tile with a thin gold rule and the Hometech monogram.
// The full logo is a raster JPEG, which browsers cannot use as a crisp favicon,
// so the tab icon reuses the brand monogram rather than the whole lockup.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Hometech Interiors">
  <rect width="64" height="64" rx="8" fill="#0B1622"/>
  <rect x="7.5" y="7.5" width="49" height="49" rx="4" fill="none" stroke="#C6A15B" stroke-width="1.5"/>
  <path d="M22 20v24M42 20v24M22 32h20" fill="none" stroke="#E2CD9E" stroke-width="4" stroke-linecap="square"/>
</svg>
`;

await writeFile(path.join(OUT, 'favicon.svg'), favicon);
console.log('  ✓ assets/img/favicon.svg  vector');
