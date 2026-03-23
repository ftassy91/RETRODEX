'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(process.cwd(), 'backend', 'public', 'assets', 'system');
const C = {
  bg: '#000000',
  panel: '#0d0d0d',
  muted: '#1a1a1a',
  mid: '#333333',
  accent: '#00ff41',
  accentSoft: '#00cc33',
  white: '#ffffff',
  amber: '#ffaa00',
  red: '#cc0000',
};

const OFFICIAL = {
  supports: ['cart_nes', 'cart_snes_us', 'cart_gb', 'cart_n64', 'cart_md', 'cart_neo_aes', 'disc_cd_standard', 'disc_gd_rom', 'disc_umd', 'cart_generic'],
  icons: ['grade_cib', 'grade_loose', 'grade_sealed', 'grade_cib_plus', 'region_ntsc_j', 'region_ntsc_u', 'region_pal', 'rarity_gem', 'price_stable', 'trend_up', 'trend_down', 'lot_bundle', 'manual_included', 'box_included'],
  patterns: ['scanlines_crt', 'phosphor_green', 'phosphor_amber', 'dither_16colors', 'noise_rf', 'grid_pixel'],
  signature: ['corner_tl', 'corner_tr', 'corner_bl', 'corner_br', 'frame_terminal'],
};

const ALIASES = ['cart_compact', 'floppy_disk'];

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const write = (family, name, content) => {
  const dir = path.join(OUT, family);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${name}.svg`), content, 'utf8');
};

function svg(viewBox, body, defs = '') {
  const defsBlock = defs ? `<defs>${defs}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${viewBox}" fill="none">${defsBlock}${body}</svg>`;
}

function support(viewBox, body, connector) {
  const [x, y, w, h] = viewBox.split(' ').map(Number);
  const conn = connector || `<rect x="${Math.round(w * 0.36)}" y="${Math.round(h * 0.82)}" width="${Math.round(w * 0.28)}" height="${Math.max(8, Math.round(h * 0.04))}" fill="${C.amber}"/>`;
  return svg(viewBox, `<g shape-rendering="crispEdges">${body}${conn}</g>`);
}

function icon(body) {
  return svg('0 0 256 256', `<g shape-rendering="crispEdges">${body}</g>`);
}

const SUPPORTS = {
  cart_nes: support('0 0 540 400', `<rect x="44" y="28" width="452" height="296" fill="${C.panel}" stroke="${C.white}" stroke-width="12"/><rect x="150" y="28" width="240" height="44" fill="${C.bg}" stroke="${C.white}" stroke-width="10"/><rect x="88" y="118" width="364" height="128" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="118" y="268" width="304" height="36" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/><line x1="160" y1="130" x2="160" y2="234" stroke="${C.mid}" stroke-width="8"/><line x1="198" y1="130" x2="198" y2="234" stroke="${C.mid}" stroke-width="8"/><line x1="236" y1="130" x2="236" y2="234" stroke="${C.mid}" stroke-width="8"/><line x1="274" y1="130" x2="274" y2="234" stroke="${C.mid}" stroke-width="8"/><line x1="312" y1="130" x2="312" y2="234" stroke="${C.mid}" stroke-width="8"/><line x1="350" y1="130" x2="350" y2="234" stroke="${C.mid}" stroke-width="8"/>`),
  cart_snes_us: support('0 0 495 450', `<rect x="50" y="56" width="395" height="294" fill="${C.panel}" stroke="${C.white}" stroke-width="12"/><polygon points="120,56 375,56 350,114 145,114" fill="${C.bg}" stroke="${C.white}" stroke-width="10"/><rect x="122" y="136" width="251" height="120" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="108" y="282" width="279" height="30" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/><rect x="180" y="326" width="135" height="18" fill="${C.mid}"/>`),
  cart_gb: support('0 0 300 400', `<polygon points="60,28 240,28 264,72 264,304 36,304 36,72" fill="${C.panel}" stroke="${C.white}" stroke-width="10"/><rect x="82" y="82" width="136" height="112" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/><rect x="94" y="206" width="112" height="42" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/>`),
  cart_n64: support('0 0 420 400', `<polygon points="72,82 136,32 284,32 348,82 348,300 72,300" fill="${C.panel}" stroke="${C.white}" stroke-width="12"/><rect x="154" y="18" width="112" height="56" fill="${C.bg}" stroke="${C.white}" stroke-width="10"/><rect x="118" y="120" width="184" height="104" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="156" y="238" width="108" height="34" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/>`),
  cart_md: support('0 0 260 400', `<polygon points="56,24 204,24 232,70 232,312 28,312 28,70" fill="${C.panel}" stroke="${C.white}" stroke-width="10"/><rect x="82" y="88" width="96" height="126" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="66" y="232" width="128" height="34" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/>`),
  cart_neo_aes: support('0 0 380 400', `<rect x="42" y="28" width="296" height="298" fill="${C.panel}" stroke="${C.white}" stroke-width="12"/><rect x="102" y="12" width="176" height="46" fill="${C.bg}" stroke="${C.white}" stroke-width="10"/><rect x="86" y="98" width="208" height="136" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="116" y="252" width="148" height="34" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/>`),
  disc_cd_standard: support('0 0 400 400', `<circle cx="200" cy="168" r="116" fill="${C.panel}" stroke="${C.white}" stroke-width="10"/><circle cx="200" cy="168" r="76" stroke="${C.mid}" stroke-width="8"/><circle cx="200" cy="168" r="34" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/>`, `<rect x="164" y="328" width="72" height="16" fill="${C.amber}"/>`),
  disc_gd_rom: support('0 0 400 400', `<circle cx="200" cy="168" r="116" fill="${C.panel}" stroke="${C.white}" stroke-width="10"/><circle cx="200" cy="168" r="76" stroke="${C.mid}" stroke-width="8"/><circle cx="200" cy="168" r="34" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="188" y="54" width="24" height="34" fill="${C.accentSoft}"/>`, `<rect x="164" y="328" width="72" height="16" fill="${C.amber}"/>`),
  disc_umd: support('0 0 400 400', `<rect x="64" y="54" width="272" height="228" fill="${C.panel}" stroke="${C.white}" stroke-width="10"/><circle cx="200" cy="168" r="88" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><circle cx="200" cy="168" r="28" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/><rect x="88" y="78" width="224" height="22" fill="${C.bg}" stroke="${C.mid}" stroke-width="6"/>`, `<rect x="164" y="328" width="72" height="16" fill="${C.amber}"/>`),
  cart_generic: support('0 0 400 400', `<rect x="74" y="40" width="252" height="264" fill="${C.panel}" stroke="${C.white}" stroke-width="12"/><rect x="120" y="102" width="160" height="128" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="136" y="246" width="128" height="28" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/>`),
  cart_compact: support('0 0 360 280', `<rect x="48" y="48" width="264" height="148" fill="${C.panel}" stroke="${C.white}" stroke-width="10"/><rect x="120" y="22" width="120" height="44" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/><rect x="90" y="96" width="180" height="54" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/>`),
  floppy_disk: support('0 0 360 400', `<rect x="60" y="40" width="240" height="260" fill="${C.panel}" stroke="${C.white}" stroke-width="10"/><polygon points="236,40 300,40 300,104" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/><rect x="106" y="78" width="148" height="72" fill="${C.bg}" stroke="${C.mid}" stroke-width="8"/><rect x="126" y="180" width="108" height="60" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/>`),
};

const ICONS = {
  grade_cib: icon(`<rect x="44" y="68" width="104" height="124" fill="${C.panel}" stroke="${C.white}" stroke-width="8"/><rect x="92" y="52" width="120" height="140" fill="${C.bg}" stroke="${C.accent}" stroke-width="8"/>`),
  grade_loose: icon(`<rect x="74" y="60" width="108" height="140" fill="${C.panel}" stroke="${C.white}" stroke-width="8"/>`),
  grade_sealed: icon(`<rect x="74" y="60" width="108" height="140" fill="${C.panel}" stroke="${C.white}" stroke-width="8"/><rect x="60" y="46" width="136" height="168" fill="none" stroke="${C.amber}" stroke-width="8"/>`),
  grade_cib_plus: icon(`<rect x="44" y="68" width="104" height="124" fill="${C.panel}" stroke="${C.white}" stroke-width="8"/><rect x="92" y="52" width="120" height="140" fill="${C.bg}" stroke="${C.accent}" stroke-width="8"/><line x1="182" y1="24" x2="182" y2="76" stroke="${C.amber}" stroke-width="8"/><line x1="156" y1="50" x2="208" y2="50" stroke="${C.amber}" stroke-width="8"/>`),
  region_ntsc_j: icon(`<rect x="48" y="52" width="160" height="152" fill="none" stroke="${C.white}" stroke-width="8"/><line x1="96" y1="84" x2="96" y2="172" stroke="${C.red}" stroke-width="8"/><line x1="136" y1="84" x2="136" y2="172" stroke="${C.white}" stroke-width="8"/><line x1="176" y1="84" x2="176" y2="172" stroke="${C.accent}" stroke-width="8"/>`),
  region_ntsc_u: icon(`<rect x="48" y="52" width="160" height="152" fill="none" stroke="${C.white}" stroke-width="8"/><line x1="72" y1="84" x2="184" y2="84" stroke="${C.red}" stroke-width="8"/><line x1="72" y1="128" x2="184" y2="128" stroke="${C.white}" stroke-width="8"/><line x1="72" y1="172" x2="184" y2="172" stroke="${C.accent}" stroke-width="8"/>`),
  region_pal: icon(`<rect x="48" y="52" width="160" height="152" fill="none" stroke="${C.white}" stroke-width="8"/><rect x="76" y="88" width="42" height="80" fill="${C.accent}"/><rect x="126" y="88" width="42" height="80" fill="${C.white}"/><rect x="176" y="88" width="4" height="80" fill="${C.accentSoft}"/>`),
  rarity_gem: icon(`<polygon points="128,28 188,92 160,196 96,196 68,92" fill="${C.bg}" stroke="${C.amber}" stroke-width="8"/><line x1="128" y1="28" x2="128" y2="196" stroke="${C.amber}" stroke-width="8"/>`),
  price_stable: icon(`<line x1="48" y1="164" x2="96" y2="164" stroke="${C.white}" stroke-width="8"/><line x1="96" y1="164" x2="96" y2="132" stroke="${C.white}" stroke-width="8"/><line x1="96" y1="132" x2="152" y2="132" stroke="${C.white}" stroke-width="8"/><line x1="152" y1="132" x2="152" y2="148" stroke="${C.white}" stroke-width="8"/><line x1="152" y1="148" x2="208" y2="148" stroke="${C.white}" stroke-width="8"/>`),
  trend_up: icon(`<line x1="56" y1="184" x2="184" y2="56" stroke="${C.accent}" stroke-width="10"/><line x1="184" y1="56" x2="184" y2="108" stroke="${C.accent}" stroke-width="10"/><line x1="184" y1="56" x2="132" y2="56" stroke="${C.accent}" stroke-width="10"/>`),
  trend_down: icon(`<line x1="56" y1="56" x2="184" y2="184" stroke="${C.red}" stroke-width="10"/><line x1="184" y1="184" x2="184" y2="132" stroke="${C.red}" stroke-width="10"/><line x1="184" y1="184" x2="132" y2="184" stroke="${C.red}" stroke-width="10"/>`),
  lot_bundle: icon(`<rect x="46" y="88" width="82" height="92" fill="${C.panel}" stroke="${C.white}" stroke-width="8"/><rect x="90" y="64" width="82" height="92" fill="${C.bg}" stroke="${C.accent}" stroke-width="8"/><rect x="134" y="40" width="82" height="92" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/>`),
  manual_included: icon(`<rect x="74" y="40" width="108" height="164" fill="${C.panel}" stroke="${C.white}" stroke-width="8"/><line x1="98" y1="86" x2="158" y2="86" stroke="${C.accent}" stroke-width="8"/><line x1="98" y1="118" x2="158" y2="118" stroke="${C.accent}" stroke-width="8"/><line x1="98" y1="150" x2="144" y2="150" stroke="${C.accent}" stroke-width="8"/>`),
  box_included: icon(`<rect x="64" y="82" width="128" height="108" fill="${C.panel}" stroke="${C.white}" stroke-width="8"/><polygon points="64,82 104,42 232,42 192,82" fill="${C.bg}" stroke="${C.white}" stroke-width="8"/><line x1="128" y1="82" x2="128" y2="190" stroke="${C.accent}" stroke-width="8"/>`),
};

const PATTERNS = {
  scanlines_crt: svg('0 0 128 128', '<rect width="128" height="128" fill="url(#scan)"/>', `<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${C.bg}"/><rect y="0" width="4" height="1" fill="${C.accent}" opacity="0.12"/></pattern>`),
  phosphor_green: svg('0 0 128 128', '<rect width="128" height="128" fill="url(#g)"/>', `<radialGradient id="g" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="${C.accent}" stop-opacity="0.18"/><stop offset="100%" stop-color="${C.bg}" stop-opacity="0"/></radialGradient>`),
  phosphor_amber: svg('0 0 128 128', '<rect width="128" height="128" fill="url(#a)"/>', `<radialGradient id="a" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="${C.amber}" stop-opacity="0.18"/><stop offset="100%" stop-color="${C.bg}" stop-opacity="0"/></radialGradient>`),
  dither_16colors: svg('0 0 128 128', '<rect width="128" height="128" fill="url(#d)"/>', `<pattern id="d" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${C.bg}"/><rect x="0" y="0" width="4" height="4" fill="${C.mid}" opacity="0.16"/><rect x="4" y="4" width="4" height="4" fill="${C.mid}" opacity="0.16"/></pattern>`),
  noise_rf: svg('0 0 128 128', '<rect width="128" height="128" fill="transparent" filter="url(#n)"/>', '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.2 0 0 0 0 0.2 0 0 0 0.08 0"/></filter>'),
  grid_pixel: svg('0 0 128 128', '<rect width="128" height="128" fill="url(#grid)"/>', `<pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${C.bg}"/><line x1="0" y1="0" x2="16" y2="0" stroke="${C.accentSoft}" stroke-opacity="0.10" stroke-width="1"/><line x1="0" y1="0" x2="0" y2="16" stroke="${C.accentSoft}" stroke-opacity="0.10" stroke-width="1"/></pattern>`),
};

const SIGNATURE = {
  corner_tl: svg('0 0 128 128', `<rect x="0" y="0" width="52" height="8" fill="${C.accent}"/><rect x="0" y="0" width="8" height="52" fill="${C.accent}"/>`),
  corner_tr: svg('0 0 128 128', `<rect x="76" y="0" width="52" height="8" fill="${C.accent}"/><rect x="120" y="0" width="8" height="52" fill="${C.accent}"/>`),
  corner_bl: svg('0 0 128 128', `<rect x="0" y="120" width="52" height="8" fill="${C.accent}"/><rect x="0" y="76" width="8" height="52" fill="${C.accent}"/>`),
  corner_br: svg('0 0 128 128', `<rect x="76" y="120" width="52" height="8" fill="${C.accent}"/><rect x="120" y="76" width="8" height="52" fill="${C.accent}"/>`),
  frame_terminal: svg('0 0 256 256', `<rect x="10" y="10" width="236" height="236" fill="none" stroke="${C.white}" stroke-width="8"/><rect x="26" y="26" width="204" height="204" fill="none" stroke="${C.accentSoft}" stroke-width="4"/>`),
};

function preview() {
  const sections = Object.entries(OFFICIAL).map(([family, names]) => {
    const cards = names.map((name) => `<figure class="card"><img src="/assets/system/${family}/${name}.svg" alt="${name}" width="96" height="96"><figcaption>${name}</figcaption></figure>`).join('');
    return `<section class="family"><h2>${family}</h2><div class="grid">${cards}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RetroDex System Assets Preview</title><style>:root{color-scheme:dark}body{margin:0;padding:32px;background:#000;color:#00ff41;font:14px/1.4 monospace}h1,h2{margin:0 0 16px}.meta{margin:0 0 32px;color:#00cc33}.family{margin-bottom:40px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}.card{margin:0;padding:16px;border:1px solid #1a1a1a;background:#0d0d0d;display:grid;gap:12px;justify-items:center}.card img{width:96px;height:96px;image-rendering:pixelated}figcaption{color:#fff;text-align:center;word-break:break-word}</style></head><body><h1>RetroDex System Assets</h1><p class="meta">35 assets officiels. Les aliases de compatibilité ne sont pas affichés ici.</p>${sections}</body></html>`;
}

function main() {
  ensureDir(OUT);
  ['supports', 'icons', 'patterns', 'signature'].forEach((family) => ensureDir(path.join(OUT, family)));
  Object.entries(SUPPORTS).forEach(([name, content]) => write('supports', name, content));
  Object.entries(ICONS).forEach(([name, content]) => write('icons', name, content));
  Object.entries(PATTERNS).forEach(([name, content]) => write('patterns', name, content));
  Object.entries(SIGNATURE).forEach(([name, content]) => write('signature', name, content));
  fs.writeFileSync(path.join(OUT, 'preview.html'), preview(), 'utf8');
  console.log('✅ 35 assets générés');
}

main();
