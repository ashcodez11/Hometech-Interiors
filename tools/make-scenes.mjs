/**
 * Hometech Interiors — interior artwork generator.
 *
 * Hometech's own project photographs are not available for this demo, so rather
 * than dressing up unrelated stock photos as completed work, the site ships a
 * consistent set of interior *elevation drawings*: flat, front-on presentation
 * views rendered as SVG from a small library of reusable primitives (cabinet
 * runs, slatted panels, cove ceilings, jaali screens, pendants, seating...).
 *
 * One palette, one line-weight hierarchy, one lighting language — so the gallery
 * reads as a single designer's presentation set, stays crisp at any size, and
 * weighs a few KB per image instead of a few MB.
 *
 *   npm run assets
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = path.join(ROOT, 'assets', 'img');

const W = 1600;
const H = 1000;
const CY = 150; // ceiling line
const FY = 762; // floor line

/* ------------------------------------------------------------------- themes */

const THEMES = {
  light: {
    wallTop: '#F4EDE0',
    wallBottom: '#E7DCC8',
    ceil: '#FBF8F2',
    floorTop: '#DCCEB5',
    floorBottom: '#CFBE9F',
    line: '#241F19',
    lineMid: 'rgba(36,31,25,0.5)',
    lineSoft: 'rgba(36,31,25,0.26)',
    panel: '#F8F3E9',
    panelAlt: '#EBE1CE',
    panelDeep: '#D6C6AA',
    glass: '#F4F0E8',
    white: '#FFFDF8',
    brass: '#A9865B',
    brassDeep: '#83643A',
    glow: '#F6DCA4',
    dark: '#241F19',
    shadow: 'rgba(36,31,25,0.22)',
    shadowSoft: 'rgba(36,31,25,0.12)'
  },
  dark: {
    wallTop: '#221C16',
    wallBottom: '#181310',
    ceil: '#141009',
    floorTop: '#1B1512',
    floorBottom: '#0F0C0A',
    line: '#E0C79C',
    lineMid: 'rgba(224,199,156,0.5)',
    lineSoft: 'rgba(224,199,156,0.26)',
    panel: '#28211A',
    panelAlt: '#302820',
    panelDeep: '#191410',
    glass: '#2C241C',
    white: '#E9DFCA',
    brass: '#C6A46B',
    brassDeep: '#9C7C49',
    glow: '#F1CE90',
    dark: '#0C0A08',
    shadow: 'rgba(0,0,0,0.5)',
    shadowSoft: 'rgba(0,0,0,0.3)'
  }
};

/* ------------------------------------------------------------------ helpers */

const n = (v) => Math.round(v * 10) / 10;
const P = (points) => points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');

let SCENE_ID = '';
const fid = (name) => `url(#${SCENE_ID}-${name})`;

const rect = (x, y, w, h, fill, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`;

const box = (x, y, w, h, fill, stroke, sw = 2.4, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;

const poly = (points, fill, extra = '') =>
  `<polygon points="${P(points)}" fill="${fill}"${extra}/>`;

const polyLine = (points, stroke, sw = 2, extra = '') =>
  `<polygon points="${P(points)}" fill="none" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;

const ln = (x1, y1, x2, y2, stroke, sw = 2, extra = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;

const dot = (cx, cy, r, fill, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra}/>`;

/** Blurred element — used for every light source and cast shadow. */
const blurred = (content, blur = '_blurSm', opacity = 1) =>
  `<g filter="${fid(blur)}" opacity="${opacity}">${content}</g>`;

/** Warm pool of light. */
const pool = (cx, cy, r, t, opacity = 0.6, blur = '_blurSm') =>
  blurred(dot(cx, cy, r, t.glow), blur, opacity);

/** Soft contact shadow on the floor. */
const contact = (cx, cy, rx, ry, t, opacity = 0.45) =>
  blurred(
    `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${t.shadow}"/>`,
    '_blurSm',
    opacity
  );

/* ------------------------------------------------------------------- stage */

/**
 * Wall / ceiling / floor stage with cove lighting, drawn front-on.
 * Everything after this is placed in elevation.
 */
function stage(t, opts = {}) {
  const fy = opts.fy === undefined ? FY : opts.fy;
  const cy = opts.cy === undefined ? CY : opts.cy;
  let s = rect(0, 0, W, H, fid('Gwall'));
  s += rect(0, 0, W, cy, fid('Gceil'));

  if (opts.cove !== false) {
    s += blurred(rect(120, cy - 16, W - 240, 34, t.glow), '_blurSm', 0.85);
    s += ln(120, cy, W - 120, cy, t.brass, 2.4);
    s += rect(120, cy - 26, W - 240, 10, t.panelDeep, ' opacity="0.75"');
  }

  if (opts.wash) {
    s += blurred(rect(240, cy + 40, W - 480, 320, t.white), '_blur', 0.18);
  }

  s += rect(0, fy, W, H - fy, fid('Gfloor'));
  s += ln(0, fy, W, fy, t.line, 2.6);

  if (opts.wainscot) {
    s += rect(0, fy - 118, W, 118, t.panelAlt, ' opacity="0.5"');
    s += ln(0, fy - 118, W, fy - 118, t.lineMid, 1.6);
  }
  return s;
}

/* ------------------------------------------------------------- primitives */

/** Run of cabinet doors with brass pulls. dir 'base' pulls up, 'upper' pulls down. */
function cabinetRun(x, y, w, h, t, opts = {}) {
  const units = opts.units || 4;
  const dir = opts.dir || 'base';
  const shutter = opts.shutter || 'plain';
  const fill = opts.fill || t.panel;
  const gap = w / units;
  let s = box(x, y, w, h, fill, t.line, 2.4);
  for (let i = 1; i < units; i += 1) {
    s += ln(x + i * gap, y, x + i * gap, y + h, t.lineMid, 1.6);
  }
  if (shutter === 'slat') {
    const count = Math.max(5, Math.round(gap / 11));
    for (let i = 0; i < units; i += 1) {
      for (let k = 1; k < count; k += 1) {
        const sx = x + i * gap + (k * gap) / count;
        s += ln(sx, y + 7, sx, y + h - 7, t.lineSoft, 1.4);
      }
    }
  }
  if (shutter === 'glass') {
    for (let i = 0; i < units; i += 1) {
      const gx = x + i * gap + 12;
      const gw = gap - 24;
      s += rect(gx, y + 14, gw, h - 28, t.glass);
      s += rect(gx, y + 14, gw, h - 28, 'none', ` stroke="${t.brass}" stroke-width="1.6"`);
      s += poly(
        [
          [gx + gw * 0.05, y + h - 16],
          [gx + gw * 0.4, y + 16],
          [gx + gw * 0.62, y + 16],
          [gx + gw * 0.27, y + h - 16]
        ],
        t.white,
        ' opacity="0.35"'
      );
      s += ln(gx, y + h / 2, gx + gw, y + h / 2, t.lineSoft, 1.4);
    }
  }
  if (opts.handles !== false) {
    for (let i = 0; i < units; i += 1) {
      const hx = x + i * gap + gap / 2 - 13;
      const hy = dir === 'base' ? y + 16 : y + h - 19;
      s += rect(hx, hy, 26, 3.4, t.brass, ' rx="1.7"');
    }
  }
  return s;
}

/** Light marble backsplash with soft veining. */
function splash(x, y, w, h, t, veins = 3) {
  let s = rect(x, y, w, h, t.white);
  for (let i = 0; i < veins; i += 1) {
    const sx = x + (w / (veins + 1)) * (i + 1) + (i % 2 ? 34 : -22);
    s += `<path d="M ${n(sx)} ${n(y + 8)} C ${n(sx + 40)} ${n(y + h * 0.3)}, ${n(sx - 34)} ${n(
      y + h * 0.64
    )}, ${n(sx + 22)} ${n(y + h - 8)}" fill="none" stroke="${t.lineSoft}" stroke-width="1.6"/>`;
  }
  s += ln(x, y, x + w, y, t.lineMid, 1.8);
  s += ln(x, y + h, x + w, y + h, t.lineMid, 1.8);
  return s;
}

/** Stone worktop with brass nosing. */
function worktop(x, y, w, t, thickness = 16) {
  return (
    rect(x, y, w, thickness, t.white) +
    ln(x, y, x + w, y, t.line, 2) +
    ln(x, y + thickness, x + w, y + thickness, t.line, 2) +
    rect(x, y + thickness - 4, w, 4, t.brass, ' opacity="0.9"')
  );
}

/** Warm wash under wall cabinets / floating units. */
function underGlow(x, y, w, t, opacity = 0.9) {
  return blurred(rect(x, y, w, 18, t.glow), '_blurSm', opacity);
}

/** Toe-kick / plinth shadow under a run. */
function toeKick(x, y, w, t, h = 18) {
  return rect(x, y, w, h, t.dark, ' opacity="0.5"');
}

/** Vertical fluted or slatted panel. */
function slats(x, y, w, h, t, spacing = 16, stroke) {
  let s = rect(x, y, w, h, t.panelAlt);
  for (let sx = x + spacing; sx < x + w - 1; sx += spacing) {
    s += ln(sx, y, sx, y + h, stroke || t.lineMid, 1.6);
  }
  s += box(x, y, w, h, 'none', t.line, 2.4);
  return s;
}

/** Cut-out jaali / lattice screen with warm backlighting. */
function jaali(x, y, w, h, t, cols = 8, rows = 5) {
  const cw = w / cols;
  const ch = h / rows;
  let s = blurred(rect(x + 14, y + 14, w - 28, h - 28, t.glow), '_blur', 0.55);
  s += rect(x, y, w, h, t.panelDeep);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x + c * cw + cw / 2;
      const cy = y + r * ch + ch / 2;
      const rx = cw * 0.32;
      const ry = ch * 0.33;
      const shape = [
        [cx, cy - ry],
        [cx + rx, cy],
        [cx, cy + ry],
        [cx - rx, cy]
      ];
      s += poly(shape, t.glow, ' opacity="0.7"');
      s += polyLine(shape, t.brassDeep, 1.8);
    }
  }
  s += box(x, y, w, h, 'none', t.brass, 2.6);
  return s;
}

/** Arched niche. */
function arch(x, y, w, h, t, fill) {
  const r = w / 2;
  const d = `M ${n(x)} ${n(y + h)} L ${n(x)} ${n(y + r)} A ${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(
    y + r
  )} L ${n(x + w)} ${n(y + h)} Z`;
  return (
    `<path d="${d}" fill="${fill || t.panelAlt}"/>` +
    `<path d="${d}" fill="none" stroke="${t.brass}" stroke-width="2.6"/>`
  );
}

/** Pendant light: cord, shade, warm pool. */
function pendant(x, yTop, yBottom, t, shade = 30) {
  const r = shade * 0.5;
  return (
    blurred(dot(x, yBottom + r + 26, shade * 3, t.glow), '_blur', 0.5) +
    ln(x, yTop, x, yBottom, t.lineMid, 2) +
    `<path d="M ${n(x - r)} ${n(yBottom + shade)} L ${n(x - r * 0.4)} ${n(yBottom)} L ${n(
      x + r * 0.4
    )} ${n(yBottom)} L ${n(x + r)} ${n(yBottom + shade)} Z" fill="${t.brassDeep}"/>` +
    `<path d="M ${n(x - r)} ${n(yBottom + shade)} L ${n(x - r * 0.4)} ${n(yBottom)} L ${n(
      x + r * 0.4
    )} ${n(yBottom)} L ${n(x + r)} ${n(yBottom + shade)} Z" fill="none" stroke="${t.brass}" stroke-width="2"/>` +
    dot(x, yBottom + shade + 7, shade * 0.36, t.glow, ' opacity="0.95"')
  );
}

/** Recessed spotlights along a line. */
function spots(xs, y, t, r = 9) {
  return xs
    .map(
      (x) =>
        blurred(dot(x, y, r * 3.6, t.glow), '_blurSm', 0.55) +
        dot(x, y, r * 1.9, 'none', ` stroke="${t.brass}" stroke-width="1.8"`) +
        dot(x, y, r, t.glow, ' opacity="0.95"')
    )
    .join('');
}

/** Rug drawn front-on with a woven border. */
function rug(x, y, w, t, opts = {}) {
  const h = opts.h || 26;
  let s = rect(x, y, w, h, t.panelAlt, ' opacity="0.85"');
  s += ln(x, y, x + w, y, t.brass, 2, ' opacity="0.6"');
  s += ln(x, y + h, x + w, y + h, t.brass, 2, ' opacity="0.6"');
  s += ln(x, y, x, y + h, t.brass, 2, ' opacity="0.6"');
  s += ln(x + w, y, x + w, y + h, t.brass, 2, ' opacity="0.6"');
  s += ln(x + 16, y + 6, x + w - 16, y + 6, t.lineSoft, 1.4);
  return s;
}

/** Potted plant. */
function plant(x, yBase, t, s = 1) {
  let out = poly(
    [
      [x - 30 * s, yBase],
      [x + 30 * s, yBase],
      [x + 24 * s, yBase - 46 * s],
      [x - 24 * s, yBase - 46 * s]
    ],
    t.panelDeep
  );
  out += polyLine(
    [
      [x - 30 * s, yBase],
      [x + 30 * s, yBase],
      [x + 24 * s, yBase - 46 * s],
      [x - 24 * s, yBase - 46 * s]
    ],
    t.line,
    2
  );
  out += ln(x - 24 * s, yBase - 40 * s, x + 24 * s, yBase - 40 * s, t.lineMid, 1.4);
  const leaves = [
    [-18, -66, -38, 15, 34],
    [18, -64, 36, 15, 34],
    [0, -110, -4, 16, 40],
    [-13, -88, -26, 13, 30],
    [13, -92, 24, 13, 30]
  ];
  for (const [lx, ly, tilt, rx, ry] of leaves) {
    out += `<ellipse cx="${n(x + lx * s)}" cy="${n(yBase + ly * s)}" rx="${n(rx * s)}" ry="${n(
      ry * s
    )}" fill="${t.panelAlt}" stroke="${t.lineMid}" stroke-width="1.8" transform="rotate(${tilt} ${n(
      x + lx * s
    )} ${n(yBase + ly * s)})"/>`;
  }
  return out;
}

/** Table / console / counter, drawn front-on with legs. */
function surface(x, y, w, t, opts = {}) {
  const th = opts.th || 22;
  let s = rect(x, y, w, th, opts.top || t.white);
  s += ln(x, y, x + w, y, t.line, 2.4);
  s += ln(x, y + th, x + w, y + th, t.line, 2.4);
  if (opts.brass !== false) s += rect(x + 12, y + th - 4, w - 24, 4, t.brass, ' opacity="0.85"');
  if (opts.legs !== false) {
    s += rect(x + 26, y + th, 9, opts.legH || 130, t.line, ' opacity="0.85"');
    s += rect(x + w - 35, y + th, 9, opts.legH || 130, t.line, ' opacity="0.85"');
    if (opts.stretcher) s += ln(x + 30, y + th + 34, x + w - 30, y + th + 34, t.lineSoft, 1.6);
  }
  return s;
}

/** Chair, front-on. facing: 'toward' shows the seat, 'away' shows the back. */
function chair(x, y, t, opts = {}) {
  const w = opts.w || 88;
  const h = opts.h || 112;
  const back = opts.facing !== 'toward';
  let s = '';
  s += box(x - w / 2, y - h, w, h * 0.9, back ? t.panel : t.panelAlt, t.line, 2.2, ' rx="5"');
  if (back) {
    s += rect(x - w / 2 + 10, y - h + 18, w - 20, h * 0.46, t.panelAlt, ' rx="4"');
    s += ln(x - w / 2 + 10, y - h + 18 + h * 0.23, x + w / 2 - 10, y - h + 18 + h * 0.23, t.lineSoft, 1.4);
  } else {
    s += rect(x - w / 2 + 10, y - h * 0.62, w - 20, h * 0.4, t.panel, ' rx="4"');
  }
  s += rect(x - w / 2 - 4, y - 16, w + 8, 16, t.panelDeep, ' rx="3"');
  s += ln(x - w / 2 + 8, y, x - w / 2 + 8, y + 30, t.lineMid, 2.2);
  s += ln(x + w / 2 - 8, y, x + w / 2 - 8, y + 30, t.lineMid, 2.2);
  return s;
}

/** Sofa, front-on. */
function sofa(x, y, w, t, opts = {}) {
  const h = opts.h || 150;
  const seat = opts.seat || 66;
  let s = box(x, y - h, w, h, t.panel, t.line, 2.4, ' rx="7"');
  s += rect(x + 18, y - h + 20, w - 36, h - seat - 22, t.panelAlt, ' rx="5"');
  s += ln(x + w / 2, y - h + 20, x + w / 2, y - seat - 2, t.lineMid, 1.6);
  s += rect(x - 16, y - h + 28, 24, h - 6, t.panelDeep, ' rx="6"');
  s += rect(x + w - 8, y - h + 28, 24, h - 6, t.panelDeep, ' rx="6"');
  s += rect(x + 8, y - seat, w - 16, seat * 0.52, t.panelAlt, ' rx="4"');
  s += ln(x, y - seat + seat * 0.52, x + w, y - seat + seat * 0.52, t.lineMid, 1.6);
  s += ln(x + 30, y, x + 30, y + 20, t.lineMid, 2.2);
  s += ln(x + w - 30, y, x + w - 30, y + 20, t.lineMid, 2.2);
  return s;
}

/** Open shelving with books and objects. */
function shelves(x, y, w, t, rows = 4, gap = 92, opts = {}) {
  let s = '';
  for (let i = 0; i < rows; i += 1) {
    const sy = y + i * gap;
    s += rect(x, sy, w, 10, t.panelAlt);
    s += ln(x, sy, x + w, sy, t.line, 2.2);
    if (opts.books !== false) {
      const count = 5 + ((i * 3) % 4);
      let bx = x + 14;
      for (let b = 0; b < count; b += 1) {
        const bw = 11 + ((b * 7) % 9);
        const bh = 40 + ((b * 13) % 22);
        s += rect(bx, sy - bh, bw, bh, b % 3 === 0 ? t.panelDeep : t.panel, ' rx="2"');
        s += rect(bx, sy - bh, bw, 5, t.brass, ' rx="2" opacity="0.5"');
        bx += bw + 6;
      }
    }
    if ((i + 1) % 2 === 0) {
      const ox = x + w - 46;
      s += dot(ox, sy - 26, 22, t.panelDeep);
      s += dot(ox, sy - 26, 22, 'none', ` stroke="${t.brass}" stroke-width="1.8"`);
    } else {
      s += rect(x + w - 74, sy - 52, 26, 42, t.panelDeep, ' rx="3"');
      s += rect(x + w - 42, sy - 40, 22, 30, t.panelAlt, ' rx="3"');
    }
  }
  s += rect(x, y + (rows - 1) * gap + 10, w, 4, t.brass, ' opacity="0.6"');
  return s;
}

/** Framed artwork. */
function frame(x, y, w, h, t, opts = {}) {
  return (
    rect(x, y, w, h, opts.fill || t.panel, ` stroke="${t.brass}" stroke-width="2"`) +
    rect(x + 9, y + 9, w - 18, h - 18, opts.innerFill || t.panelAlt, ' opacity="0.8"')
  );
}

/* ------------------------------------------------------------------- scenes */

const SCENES = {
  /* 1 — hero: full modular kitchen, moody */
  'hero-modular-kitchen': {
    theme: 'dark',
    build(t) {
      let s = stage(t);
      s += spots([380, 620, 860, 1100, 1340], CY - 52, t, 9);

      // Double-stacked wall units
      s += cabinetRun(300, 232, 1000, 186, t, { units: 4, dir: 'upper', shutter: 'slat' });
      s += slats(300, 232, 1000, 186, t, 26, t.lineSoft);
      s += underGlow(306, 418, 988, t);

      // Marble splash
      s += splash(300, 436, 1000, 182, t, 4);
      s += worktop(300, 618, 1000, t);
      s += cabinetRun(300, 634, 1000, 148, t, { units: 4, dir: 'base' });
      s += toeKick(300, 782, 1000, t, 20);

      // Tall fluted pantry column
      s += slats(1330, 232, 150, 570, t, 24);
      s += rect(1400, 380, 30, 4, t.brass);

      // Open niche with glassware
      s += box(760, 436, 260, 182, t.panelDeep, t.line, 2.2);
      s += rect(778, 566, 224, 42, t.panelAlt);
      s += ln(778, 566, 1002, 566, t.line, 1.8);
      s += rect(806, 520, 30, 46, t.panel, ' rx="3"');
      s += rect(848, 508, 26, 58, t.brassDeep, ' rx="3"');
      s += dot(910, 542, 24, t.panel, ' opacity="0.9"');
      s += rect(954, 528, 30, 38, t.panelAlt, ' rx="3"');
      s += blurred(rect(770, 430, 240, 40, t.glow), '_blurSm', 0.55);

      // Island in the foreground
      s += contact(800, 900, 520, 34, t, 0.42);
      s += rect(300, 862, 1000, 26, t.white);
      s += ln(300, 862, 1300, 862, t.line, 2.6);
      s += ln(300, 888, 1300, 888, t.line, 2.6);
      s += rect(312, 884, 976, 4, t.brass, ' opacity="0.85"');
      s += rect(330, 888, 940, 118, t.panel, ' stroke="none"');
      s += box(330, 888, 940, 118, 'none', t.line, 2.4);
      s += ln(800, 888, 800, 1006, t.lineMid, 1.8);
      s += rect(560, 912, 34, 4, t.brass, ' rx="2"');
      s += rect(1006, 912, 34, 4, t.brass, ' rx="2"');
      s += plant(430, 862, t, 0.85);
      s += `<ellipse cx="1010" cy="876" rx="96" ry="18" fill="${t.panelAlt}" stroke="${t.line}" stroke-width="2"/>`;
      s += dot(986, 862, 16, t.panelDeep);
      s += dot(1030, 860, 14, t.panelDeep);
      s += dot(1010, 846, 12, t.brassDeep);

      s += pendant(520, CY - 6, 620, t, 34);
      s += pendant(1080, CY - 6, 620, t, 34);
      return s;
    }
  },

  /* 2 — light modular kitchen with breakfast counter */
  'interior-modular-kitchen': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([420, 700, 980, 1260], CY - 52, t, 8);

      // Window with daylight
      s += blurred(rect(200, 250, 300, 330, t.glow), '_blurSm', 0.7);
      s += box(200, 250, 300, 330, 'none', t.line, 2.6);
      s += ln(350, 250, 350, 580, t.line, 2.2);
      s += ln(200, 415, 500, 415, t.line, 2.2);
      s += poly(
        [
          [206, 574],
          [494, 256],
          [516, 256],
          [228, 574]
        ],
        t.white,
        ' opacity="0.3"'
      );

      // Wall units with glass shutters
      s += cabinetRun(560, 232, 740, 190, t, { units: 3, dir: 'upper', shutter: 'glass' });
      s += underGlow(566, 422, 728, t);
      s += splash(560, 440, 740, 178, t, 3);
      s += worktop(560, 618, 740, t);
      s += cabinetRun(560, 634, 740, 148, t, { units: 3, dir: 'base' });
      s += toeKick(560, 782, 740, t, 20);

      // Tall column
      s += box(1330, 232, 150, 570, t.panelDeep, t.line, 2.4);
      s += ln(1330, 400, 1480, 400, t.line, 2);
      s += ln(1330, 560, 1480, 560, t.line, 2);
      s += rect(1386, 252, 30, 4, t.brass);

      // Breakfast counter
      s += contact(760, 900, 480, 32, t, 0.28);
      s += rect(360, 858, 800, 26, t.white);
      s += ln(360, 858, 1160, 858, t.line, 2.6);
      s += ln(360, 884, 1160, 884, t.line, 2.6);
      s += rect(372, 880, 776, 4, t.brass, ' opacity="0.85"');
      s += box(390, 884, 740, 116, t.panel, t.line, 2.4);
      s += ln(760, 884, 760, 1000, t.lineMid, 1.8);
      s += rug(180, 940, 500, t, { h: 22 });
      s += chair(470, 1000, t, { facing: 'away', w: 96, h: 124 });
      s += chair(1050, 1000, t, { facing: 'away', w: 96, h: 124 });

      s += pendant(640, CY - 6, 636, t, 32);
      s += pendant(940, CY - 6, 636, t, 32);
      s += plant(1400, 900, t, 1);
      return s;
    }
  },

  /* 3 — wardrobe wall */
  'interior-wardrobe': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([380, 660, 940, 1280], CY - 52, t, 8);
      s += blurred(rect(560, CY + 10, 480, 60, t.glow), '_blurSm', 0.5);

      // Full-height wardrobe: slatted | open niche | plain shutters
      s += box(220, 200, 1160, 600, t.panel, t.line, 2.6);
      s += ln(220, 268, 1380, 268, t.line, 2.2);
      s += rect(240, 226, 44, 4, t.brass);
      s += rect(1336, 226, 44, 4, t.brass);

      // Slatted shutters
      s += slats(240, 288, 380, 496, t, 15);
      s += ln(430, 288, 430, 784, t.line, 2.2);
      s += rect(300, 316, 30, 4, t.brass);
      s += rect(560, 316, 30, 4, t.brass);

      // Open niche: shelves, rail, folded stacks
      s += rect(640, 288, 320, 496, t.panelDeep);
      s += box(640, 288, 320, 496, 'none', t.line, 2.4);
      s += blurred(rect(660, 300, 280, 40, t.glow), '_blurSm', 0.55);
      s += ln(664, 372, 936, 372, t.line, 2);
      s += ln(664, 466, 936, 466, t.line, 2);
      s += ln(664, 560, 936, 560, t.line, 2);
      s += rect(700, 400, 244, 62, t.panel, ' rx="4"');
      s += rect(700, 400, 244, 6, t.brass, ' opacity="0.6"');
      s += rect(720, 494, 200, 62, t.panelAlt, ' rx="4"');
      s += rect(760, 588, 140, 62, t.panel, ' rx="4"');
      s += dot(880, 336, 22, t.panelAlt);
      s += dot(880, 336, 22, 'none', ` stroke="${t.brass}" stroke-width="1.8"`);

      // Plain shutters with brass pulls
      s += box(980, 288, 380, 496, t.panel, t.line, 2.4);
      s += ln(1170, 288, 1170, 784, t.line, 2.2);
      s += rect(1074, 316, 34, 4, t.brass);
      s += rect(1244, 316, 34, 4, t.brass);

      s += contact(800, 828, 560, 26, t, 0.3);
      s += rug(300, 852, 1000, t, { h: 30 });
      s += surface(560, 812, 460, t, { legH: 84, stretcher: true, top: t.panelAlt });
      s += rect(618, 776, 34, 36, t.panelDeep, ' rx="3"');
      s += dot(700, 786, 18, t.panel);
      s += plant(1400, 910, t, 1.15);
      s += box(150, 800, 130, 106, t.panelAlt, t.line, 2.2, ' rx="5"');
      s += ln(150, 850, 280, 850, t.lineMid, 1.6);
      return s;
    }
  },

  /* 4 — false ceiling, looking up */
  'interior-false-ceiling': {
    theme: 'dark',
    build(t) {
      // Ceiling-first composition: the whole frame is the ceiling plane
      let s = rect(0, 0, W, H, fid('Gceil'));
      s += rect(0, 700, W, 300, fid('Gwall'));
      s += ln(0, 700, W, 700, t.brass, 2.6);

      // Nested tray / cove
      s += box(200, 120, 1200, 470, 'none', t.brass, 2.6);
      s += blurred(rect(214, 134, 1172, 456, t.glow), '_blur', 0.4);
      s += box(300, 190, 1000, 330, t.panelDeep, t.brass, 2.2);
      s += blurred(rect(300, 190, 1000, 26, t.glow), '_blurSm', 0.95);
      s += blurred(rect(300, 494, 1000, 26, t.glow), '_blurSm', 0.95);
      s += blurred(rect(300, 190, 26, 330, t.glow), '_blurSm', 0.95);
      s += blurred(rect(1274, 190, 26, 330, t.glow), '_blurSm', 0.95);

      // Linear profile lights radiating toward the viewer
      for (const lx of [620, 940]) {
        s += poly(
          [
            [lx, 700],
            [lx + 22, 700],
            [lx + 30, 120],
            [lx + 12, 120]
          ],
          t.glow,
          ' opacity="0.55"'
        );
        s += polyLine(
          [
            [lx, 700],
            [lx + 22, 700],
            [lx + 30, 120],
            [lx + 12, 120]
          ],
          t.brass,
          2
        );
        s += blurred(rect(lx - 30, 380, 130, 90, t.glow), '_blur', 0.35);
      }

      s += spots([420, 800, 1180], 340, t, 11);
      s += `<g filter="${fid('_blur')}" opacity="0.5">${rect(360, 620, 880, 150, t.glow)}</g>`;

      // Room below gives scale
      s += slats(120, 700, 1360, 190, t, 34);
      s += blurred(rect(240, 700, 1120, 40, t.glow), '_blurSm', 0.6);
      s += pendant(560, 700, 800, t, 30);
      s += pendant(1040, 700, 800, t, 30);
      s += contact(800, 960, 620, 30, t, 0.5);
      s += sofa(420, 1000, 340, t, { h: 130, seat: 58 });
      s += sofa(840, 1000, 340, t, { h: 130, seat: 58 });
      s += surface(700, 940, 200, t, { legH: 54, th: 18 });
      s += plant(1430, 1000, t, 1);
      return s;
    }
  },

  /* 5 — living room / media wall */
  'interior-living': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([420, 700, 980, 1260], CY - 52, t, 8);

      // Arched display niche
      s += arch(200, 268, 320, 440, t, t.panelAlt);
      s += blurred(rect(216, 268, 288, 60, t.glow), '_blurSm', 0.7);
      s += ln(220, 552, 500, 552, t.line, 2.2);
      s += rect(238, 500, 74, 52, t.panel, ' rx="4"');
      s += dot(400, 512, 40, t.panel);
      s += dot(400, 512, 40, 'none', ` stroke="${t.brass}" stroke-width="2"`);
      s += rect(300, 464, 42, 88, t.panelDeep, ' rx="4"');

      // Fluted media wall
      s += slats(560, 232, 900, 530, t, 18);
      s += `<g filter="${fid('_blurSm')}" opacity="0.5">${rect(586, 246, 60, 500, t.glow)}</g>`;
      s += blurred(rect(700, 300, 560, 320, t.glow), '_blurSm', 0.28);

      // TV
      s += box(720, 300, 520, 280, t.dark, t.brass, 2.2, ' rx="4"');
      s += rect(748, 328, 464, 224, t.white, ' opacity="0.07"');
      s += ln(980, 584, 980, 606, t.lineMid, 2);
      // Suspended console
      s += rect(640, 606, 680, 54, t.panelDeep);
      s += box(640, 606, 680, 54, 'none', t.line, 2.4);
      s += ln(980, 606, 980, 660, t.line, 2);
      s += rect(700, 622, 40, 4, t.brass);
      s += rect(1220, 622, 40, 4, t.brass);
      s += blurred(rect(660, 660, 640, 30, t.glow), '_blurSm', 0.75);
      s += blurred(dot(980, 700, 260, t.glow), '_blur', 0.22);

      s += contact(560, 958, 420, 30, t, 0.3);
      s += rug(140, 892, 960, t, { h: 34 });
      s += sofa(120, 990, 560, t, { h: 176, seat: 76 });
      s += surface(1060, 936, 300, t, { legH: 76, stretcher: true, top: t.panelAlt });
      s += rect(1120, 900, 32, 36, t.panelDeep, ' rx="3"');
      s += dot(1210, 902, 18, t.panel);
      s += plant(1430, 1000, t, 1.1);

      // Floor lamp
      s += ln(1360, 700, 1360, 990, t.line, 2.6);
      s += poly(
        [
          [1320, 700],
          [1400, 700],
          [1416, 762],
          [1304, 762]
        ],
        t.brassDeep
      );
      s += blurred(dot(1360, 768, 74, t.glow), '_blurSm', 0.7);
      return s;
    }
  },

  /* 6 — bedroom */
  'interior-bedroom': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([480, 800, 1120], CY - 52, t, 8);
      s += blurred(rect(300, CY + 6, 1000, 60, t.glow), '_blurSm', 0.45);

      // Panelled headboard wall
      s += slats(300, 250, 1000, 400, t, 22);
      s += ln(290, 240, 1310, 240, t.brass, 2.4);
      s += ln(290, 660, 1310, 660, t.brass, 2.4);
      s += frame(720, 320, 160, 150, t, { fill: t.panelDeep, innerFill: t.panel });

      // Bedside tables + pendants
      s += box(150, 596, 150, 196, t.panel, t.line, 2.4);
      s += ln(150, 660, 300, 660, t.lineMid, 1.8);
      s += rect(212, 616, 28, 4, t.brass);
      s += box(1300, 596, 150, 196, t.panel, t.line, 2.4);
      s += ln(1300, 660, 1450, 660, t.lineMid, 1.8);
      s += rect(1362, 616, 28, 4, t.brass);
      s += pendant(225, CY - 6, 470, t, 28);
      s += pendant(1375, CY - 6, 470, t, 28);

      // Bed
      s += contact(800, 992, 560, 34, t, 0.3);
      s += box(300, 620, 1000, 120, t.panelAlt, t.line, 2.2, ' rx="5"');
      s += rect(180, 690, 1240, 130, t.white);
      s += box(180, 690, 1240, 130, 'none', t.line, 2.6);
      s += ln(180, 820, 1420, 820, t.line, 2.6);
      s += rect(180, 820, 1240, 180, t.panel, ' opacity="0.95"');
      s += box(180, 820, 1240, 180, 'none', t.line, 2.6);
      s += ln(800, 1000, 800, 820, t.lineMid, 1.8);
      // Pillows
      for (const px of [380, 660]) {
        s += rect(px, 706, 220, 92, t.panelAlt, ' rx="10"');
        s += rect(px, 706, 220, 92, 'none', ` stroke="${t.line}" stroke-width="1.8" rx="10"`);
      }
      // Throw
      s += rect(180, 820, 1240, 18, t.brass, ' opacity="0.35"');
      s += ln(180, 862, 1420, 862, t.lineSoft, 1.6);
      s += plant(1430, 990, t, 1);
      return s;
    }
  },

  /* 7 — dining */
  'interior-dining': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([380, 1260], CY - 52, t, 8);

      // Slatted feature wall
      s += slats(120, 200, 1360, 562, t, 28);
      s += blurred(rect(140, 200, 200, 540, t.glow), '_blurSm', 0.4);
      s += blurred(rect(1260, 200, 200, 540, t.glow), '_blurSm', 0.4);
      s += frame(240, 268, 250, 300, t, { fill: t.panelDeep, innerFill: t.panel });
      s += frame(540, 268, 210, 300, t, { fill: t.panel, innerFill: t.panelDeep });
      s += blurred(rect(120, 190, 1360, 40, t.glow), '_blurSm', 0.6);

      // Linear pendant over the table
      s += blurred(rect(620, 372, 360, 70, t.glow), '_blurSm', 0.6);
      s += rect(620, 386, 360, 12, t.brassDeep);
      s += polyLine(
        [
          [620, 386],
          [980, 386],
          [980, 398],
          [620, 398]
        ],
        t.brass,
        2
      );
      s += ln(680, CY - 6, 680, 386, t.lineMid, 1.8);
      s += ln(920, CY - 6, 920, 386, t.lineMid, 1.8);
      for (const gx of [680, 800, 920]) {
        s += dot(gx, 412, 17, t.glow, ' opacity="0.9"');
        s += dot(gx, 412, 27, 'none', ` stroke="${t.brass}" stroke-width="1.6" opacity="0.6"`);
      }

      // Table + chairs
      s += contact(800, 992, 460, 30, t, 0.3);
      s += rug(170, 908, 1260, t, { h: 30 });
      s += chair(600, 1000, t, { facing: 'toward', w: 104, h: 140 });
      s += chair(1000, 1000, t, { facing: 'toward', w: 104, h: 140 });
      s += chair(700, 838, t, { facing: 'away', w: 96, h: 126 });
      s += chair(900, 838, t, { facing: 'away', w: 96, h: 126 });
      s += surface(440, 842, 720, t, { th: 24, legH: 120, stretcher: true, top: t.white });
      s += dot(800, 812, 40, t.panelAlt);
      s += dot(800, 812, 40, 'none', ` stroke="${t.brass}" stroke-width="2"`);
      s += plant(1440, 900, t, 1.05);
      return s;
    }
  },

  /* 8 — pooja unit */
  'interior-pooja-unit': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([520, 800, 1080], CY - 52, t, 8);
      s += slats(120, 190, 1360, 572, t, 34);

      // Flanking columns
      s += box(360, 216, 88, 546, t.panelDeep, t.line, 2.4);
      s += box(1152, 216, 88, 546, t.panelDeep, t.line, 2.4);
      s += rect(360, 216, 880, 22, t.white);
      s += ln(360, 216, 1240, 216, t.line, 2.4);
      s += ln(360, 238, 1240, 238, t.line, 2.4);
      s += rect(366, 232, 868, 5, t.brass, ' opacity="0.85"');

      // Jaali screen
      s += jaali(448, 262, 704, 340, t, 7, 4);

      // Plinth
      s += rect(360, 602, 880, 20, t.white);
      s += ln(360, 602, 1240, 602, t.line, 2.4);
      s += ln(360, 622, 1240, 622, t.line, 2.4);
      s += rect(360, 622, 880, 16, t.panelAlt);
      s += ln(360, 638, 1240, 638, t.line, 2.2);
      s += cabinetRun(376, 638, 848, 104, t, { units: 3, dir: 'base', shutter: 'slat' });

      // Lamps on the plinth
      for (const lx of [560, 800, 1040]) {
        s += blurred(dot(lx, 570, 62, t.glow), '_blurSm', 0.85);
        s += poly(
          [
            [lx - 32, 602],
            [lx + 32, 602],
            [lx + 14, 570],
            [lx - 14, 570]
          ],
          t.brassDeep
        );
        s += dot(lx, 546, 14, t.glow);
      }
      // Central offering tray
      s += rect(744, 520, 112, 82, t.panelDeep, ' rx="5"');
      s += ln(744, 552, 856, 552, t.brass, 2);
      s += dot(800, 500, 20, t.panelAlt);
      s += dot(800, 500, 20, 'none', ` stroke="${t.brass}" stroke-width="1.8"`);

      s += contact(800, 934, 460, 28, t, 0.28);
      s += rug(240, 862, 1120, t, { h: 32 });
      s += chair(800, 1000, t, { facing: 'away', w: 92, h: 116 });
      s += plant(1430, 960, t, 1);
      s += plant(150, 940, t, 0.85);
      return s;
    }
  },

  /* 9 — crockery unit */
  'interior-crockery-unit': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([400, 800, 1200], CY - 52, t, 8);
      s += slats(120, 190, 1360, 572, t, 40);

      // Tall carcass
      s += box(240, 210, 1120, 552, t.panel, t.line, 2.6);
      s += ln(240, 276, 1360, 276, t.line, 2.2);
      s += rect(262, 234, 40, 4, t.brass);
      s += rect(1338, 234, 40, 4, t.brass);

      // Glass display, left
      s += cabinetRun(262, 300, 360, 262, t, { units: 2, dir: 'upper', shutter: 'glass', handles: false });
      s += blurred(dot(442, 370, 150, t.glow), '_blur', 0.28);

      // Open shelves, centre
      s += rect(646, 300, 268, 262, t.panelDeep);
      s += box(646, 300, 268, 262, 'none', t.line, 2.2);
      for (let i = 1; i <= 2; i += 1) {
        const sy = 300 + (262 / 3) * i;
        s += rect(656, sy, 248, 8, t.panelAlt);
        s += ln(656, sy, 904, sy, t.line, 2);
      }
      s += rect(678, 344, 30, 44, t.panel, ' rx="3"');
      s += rect(716, 330, 26, 58, t.panelAlt, ' rx="3"');
      s += dot(800, 348, 22, t.panel);
      s += dot(860, 350, 18, t.panelAlt);

      // Open shelves, right
      s += rect(938, 300, 400, 262, t.panelDeep);
      s += box(938, 300, 400, 262, 'none', t.line, 2.2);
      for (let i = 1; i <= 2; i += 1) {
        const sy = 300 + (262 / 3) * i;
        s += rect(948, sy, 380, 8, t.panelAlt);
        s += ln(948, sy, 1328, sy, t.line, 2);
      }
      s += dot(1040, 342, 24, t.panel);
      s += dot(1040, 342, 24, 'none', ` stroke="${t.brass}" stroke-width="1.8"`);
      s += rect(1100, 322, 26, 66, t.panelAlt, ' rx="3"');
      s += rect(1140, 336, 24, 52, t.panel, ' rx="3"');
      s += rect(1200, 328, 70, 60, t.panelDeep, ' rx="4"');

      // Counter + drawers
      s += rect(240, 562, 1120, 22, t.white);
      s += ln(240, 562, 1360, 562, t.line, 2.4);
      s += ln(240, 584, 1360, 584, t.line, 2.4);
      s += rect(246, 578, 1108, 5, t.brass, ' opacity="0.85"');
      s += cabinetRun(256, 584, 1088, 160, t, { units: 5, dir: 'base' });
      s += blurred(rect(1160, 592, 180, 150, t.glow), '_blurSm', 0.45);
      s += toeKick(256, 744, 1088, t, 18);

      s += contact(780, 950, 460, 28, t, 0.26);
      s += rug(200, 876, 1180, t, { h: 30 });
      s += surface(300, 900, 320, t, { legH: 62, th: 20, top: t.panelAlt });
      s += rect(370, 862, 26, 38, t.panelDeep, ' rx="2"');
      s += dot(440, 864, 18, t.panel);
      s += rect(500, 858, 24, 42, t.brassDeep, ' rx="2"');
      s += plant(1420, 960, t, 1);
      return s;
    }
  },

  /* 10 — foyer */
  'interior-foyer': {
    theme: 'dark',
    build(t) {
      let s = stage(t);
      s += spots([480, 800, 1120], CY - 52, t, 9);
      s += slats(120, 190, 1360, 572, t, 30);

      // Arched niche with console
      s += arch(420, 224, 760, 520, t, t.panelDeep);
      s += blurred(rect(470, 260, 660, 130, t.glow), '_blurSm', 0.55);
      s += surface(460, 512, 680, t, { th: 20, legs: false, top: t.white });
      s += rect(460, 532, 680, 128, t.panel);
      s += box(460, 532, 680, 128, 'none', t.line, 2.4);
      s += ln(800, 532, 800, 660, t.lineMid, 1.8);
      s += ln(460, 660, 1140, 660, t.brass, 2);
      s += rect(500, 552, 34, 4, t.brass);
      s += rect(1066, 552, 34, 4, t.brass);

      // Objects on the console
      s += rect(560, 452, 34, 60, t.panelAlt, ' rx="4"');
      s += rect(604, 470, 26, 42, t.panelDeep, ' rx="4"');
      s += dot(900, 456, 26, t.panelAlt);
      s += dot(900, 456, 26, 'none', ` stroke="${t.brass}" stroke-width="1.8"`);
      s += rect(990, 440, 40, 72, t.panelDeep, ' rx="4"');

      // Wall spots with visible cones
      for (const sx of [230, 1370]) {
        s += blurred(
          poly(
            [
              [sx - 10, 300],
              [sx + 10, 300],
              [sx + 76, 620],
              [sx - 76, 620]
            ],
            t.glow
          ),
          '_blurSm',
          0.5
        );
        s += dot(sx, 292, 11, t.glow, ' opacity="0.95"');
        s += dot(sx, 292, 24, 'none', ` stroke="${t.brass}" stroke-width="1.8"`);
      }

      s += contact(800, 950, 520, 30, t, 0.5);
      s += rug(140, 872, 940, t, { h: 32 });
      s += sofa(110, 1010, 380, t, { h: 128, seat: 56 });
      s += box(1080, 700, 420, 140, t.panel, t.line, 2.4);
      s += ln(1080, 770, 1500, 770, t.brass, 2);
      s += ln(1290, 700, 1290, 840, t.lineMid, 1.6);
      s += rect(1130, 716, 30, 4, t.brass);
      s += plant(1430, 1000, t, 1.05);
      return s;
    }
  },

  /* 11 — study nook */
  'interior-study': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([520, 800, 1100], CY - 52, t, 8);
      s += slats(120, 190, 440, 572, t, 24);

      // Open shelving wall
      s += shelves(600, 262, 500, t, 4, 118, { books: true });
      s += rect(600, 200, 500, 12, t.panelAlt);
      s += ln(600, 200, 1100, 200, t.line, 2.2);
      s += rect(1120, 200, 360, 384, t.panel, ' stroke="none"');
      s += box(1120, 200, 360, 384, 'none', t.line, 2.4);
      s += ln(1120, 296, 1480, 296, t.line, 2.2);
      s += ln(1120, 392, 1480, 392, t.line, 2.2);
      s += dot(1210, 268, 22, t.panelAlt);
      s += rect(1280, 226, 28, 44, t.panelDeep, ' rx="3"');
      s += rect(1352, 240, 26, 30, t.panelAlt, ' rx="3"');
      s += frame(1160, 428, 280, 120, t, { fill: t.panelDeep, innerFill: t.panel });
      s += frame(180, 250, 320, 300, t, { fill: t.panelDeep, innerFill: t.panel });
      s += blurred(dot(800, 300, 220, t.glow), '_blur', 0.2);

      // Desk
      s += contact(800, 950, 480, 28, t, 0.28);
      s += surface(520, 742, 700, t, { th: 24, legH: 128, stretcher: true, top: t.white });
      s += box(640, 664, 230, 78, t.dark, t.line, 2.2, ' rx="4"');
      s += rect(664, 682, 182, 46, t.white, ' opacity="0.08"');
      s += ln(755, 742, 755, 790, t.lineMid, 2);
      s += rect(600, 706, 34, 36, t.panelDeep, ' rx="3"');
      s += dot(960, 706, 18, t.panelAlt);
      // Task lamp
      s += ln(1150, 742, 1150, 650, t.line, 2.4);
      s += poly(
        [
          [1112, 650],
          [1188, 650],
          [1204, 706],
          [1096, 706]
        ],
        t.brassDeep
      );
      s += blurred(dot(1150, 712, 66, t.glow), '_blurSm', 0.7);
      s += chair(400, 1006, t, { facing: 'toward', w: 108, h: 148 });
      s += rug(120, 916, 1280, t, { h: 28 });
      s += plant(1430, 990, t, 0.95);
      return s;
    }
  },

  /* 12 — slatted partition */
  'interior-partition': {
    theme: 'light',
    build(t) {
      let s = stage(t);
      s += spots([400, 760, 1180], CY - 52, t, 8);

      // Slatted screen with light spilling through the gaps
      s += blurred(rect(180, 200, 700, 562, t.glow), '_blur', 0.5);
      s += rect(180, 200, 700, 562, t.panelDeep, ' opacity="0.9"');
      for (let sx = 200; sx < 880; sx += 22) {
        s += rect(sx, 200, 11, 562, t.panelAlt);
        s += ln(sx, 200, sx, 762, t.lineMid, 1.4);
      }
      s += box(180, 200, 700, 562, 'none', t.brass, 2.6);
      s += rect(180, 470, 700, 7, t.brass, ' opacity="0.9"');

      // Console + arch mirror beside it
      s += arch(1000, 250, 300, 330, t, t.panelDeep);
      s += poly(
        [
          [1016, 566],
          [1284, 566],
          [1250, 268],
          [1050, 268]
        ],
        t.white,
        ' opacity="0.3"'
      );
      s += frame(920, 250, 460, 330, t, { fill: t.panelAlt, innerFill: t.panelDeep });
      s += arch(1000, 250, 300, 330, t, 'none');
      s += surface(940, 626, 420, t, { th: 20, legH: 96, legs: true, stretcher: true });
      s += rect(1000, 580, 36, 46, t.panelAlt, ' rx="4"');
      s += dot(1200, 584, 24, t.panel);
      s += dot(1200, 584, 24, 'none', ` stroke="${t.brass}" stroke-width="1.8"`);
      s += rect(1250, 566, 30, 60, t.panelDeep, ' rx="4"');

      s += contact(480, 950, 460, 28, t, 0.3);
      s += rug(150, 878, 900, t, { h: 30 });
      s += chair(700, 1000, t, { facing: 'toward', w: 104, h: 132 });
      s += chair(420, 1000, t, { facing: 'toward', w: 104, h: 132 });
      s += plant(1430, 990, t, 1.15);
      s += plant(960, 940, t, 0.8);
      return s;
    }
  }
};

/* ------------------------------------------------------------------ render */

function defs(id, t) {
  return `<defs>
<linearGradient id="${id}-Gwall" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${t.wallTop}"/><stop offset="1" stop-color="${t.wallBottom}"/>
</linearGradient>
<linearGradient id="${id}-Gfloor" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${t.floorTop}"/><stop offset="1" stop-color="${t.floorBottom}"/>
</linearGradient>
<linearGradient id="${id}-Gceil" x1="0" y1="1" x2="0" y2="0">
<stop offset="0" stop-color="${t.wallBottom}"/><stop offset="1" stop-color="${t.ceil}"/>
</linearGradient>
<filter id="${id}-_blur" x="-40%" y="-60%" width="180%" height="220%">
<feGaussianBlur stdDeviation="34"/>
</filter>
<filter id="${id}-_blurSm" x="-50%" y="-70%" width="200%" height="240%">
<feGaussianBlur stdDeviation="13"/>
</filter>
</defs>`;
}

function renderScene(id, scene) {
  const t = THEMES[scene.theme];
  SCENE_ID = id;
  const body = scene.build(t);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${id}-title">` +
    `<title id="${id}-title">${scene.title}</title>` +
    defs(id, t) +
    rect(0, 0, W, H, t.wallBottom) +
    body +
    '</svg>'
  );
}

/* ------------------------------------------------------------------- write */

await mkdir(OUT, { recursive: true });

const TITLES = {
  'hero-modular-kitchen': 'Modular kitchen interior design — counter, wall units and island',
  'interior-modular-kitchen': 'Modular kitchen with glass wall units and breakfast counter',
  'interior-wardrobe': 'Wardrobe interior with slatted shutters and open storage',
  'interior-false-ceiling': 'False ceiling design with cove lighting and linear profile lights',
  'interior-living': 'Living room interior with fluted media wall and display niche',
  'interior-bedroom': 'Bedroom interior with panelled headboard and pendant lights',
  'interior-dining': 'Dining area interior with slatted feature wall and linear pendant',
  'interior-pooja-unit': 'Pooja unit with jaali screen and warm backlighting',
  'interior-crockery-unit': 'Crockery unit with glass display cabinets and open shelves',
  'interior-foyer': 'Foyer interior with arched niche and console',
  'interior-study': 'Study nook with open shelving, desk and task lighting',
  'interior-partition': 'Slatted partition separating living and dining areas'
};

let total = 0;
for (const [id, scene] of Object.entries(SCENES)) {
  scene.title = TITLES[id] || id;
  const svg = renderScene(id, scene);
  await writeFile(path.join(OUT, `${id}.svg`), svg, 'utf8');
  const kb = Buffer.byteLength(svg) / 1024;
  total += kb;
  console.log(`  ✓ assets/img/${id}.svg  ${kb.toFixed(1)} KB`);
}
console.log(`  ${Object.keys(SCENES).length} scenes, ${total.toFixed(1)} KB total`);
