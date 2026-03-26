'use strict';

const fs = require('fs');
const path = require('path');

const ASSET_DIR = path.join(process.cwd(), 'backend', 'public', 'assets', 'system');
const REPORT = path.join(process.cwd(), 'scripts', 'visual', 'qa_report.json');
const APPROVED_COLORS = new Set(['#000000', '#0d0d0d', '#00ff41', '#00cc33', '#1a1a1a', '#333333', '#ffffff', '#ffaa00', '#cc0000', 'none', 'transparent']);
const HARDWARE_RATIOS = {
  cart_nes: { ratio: 1.35, ref: 'NES US cartridge' },
  cart_snes_us: { ratio: 1.10, ref: 'SNES US cartridge' },
  cart_gb: { ratio: 0.75, ref: 'Game Boy cartridge' },
  cart_n64: { ratio: 1.05, ref: 'Nintendo 64 cartridge' },
  cart_md: { ratio: 0.65, ref: 'Mega Drive cartridge' },
  cart_neo_aes: { ratio: 0.95, ref: 'Neo Geo AES cartridge' },
  disc_cd_standard: { ratio: 1.0, ref: 'Standard CD 74mm' },
  disc_gd_rom: { ratio: 1.0, ref: 'Dreamcast GD-ROM' },
  disc_umd: { ratio: 1.0, ref: 'PSP UMD' },
};
const FORBIDDEN_ELEMENTS = ['text', 'image', 'foreignobject', 'script', 'use'];
const FORBIDDEN_ATTRS = ['href', 'xlink:href'];
const FAMILIES = {
  supports: ['cart_nes', 'cart_snes_us', 'cart_gb', 'cart_n64', 'cart_md', 'cart_neo_aes', 'disc_cd_standard', 'disc_gd_rom', 'disc_umd', 'cart_generic'],
  icons: ['grade_cib', 'grade_loose', 'grade_sealed', 'grade_cib_plus', 'region_ntsc_j', 'region_ntsc_u', 'region_pal', 'rarity_gem', 'price_stable', 'trend_up', 'trend_down', 'lot_bundle', 'manual_included', 'box_included'],
  patterns: ['scanlines_crt', 'phosphor_green', 'phosphor_amber', 'dither_16colors', 'noise_rf', 'grid_pixel'],
  signature: ['corner_tl', 'corner_tr', 'corner_bl', 'corner_br', 'frame_terminal'],
};

function extractViewBox(svg) {
  const match = svg.match(/viewBox="([^"]+)"/i);
  if (!match) return null;
  const parts = match[1].trim().split(/\s+/).map(Number);
  return parts.length === 4 ? { x: parts[0], y: parts[1], w: parts[2], h: parts[3] } : null;
}
function extractColors(svg) {
  const colors = new Set();
  [/fill="([^"]+)"/g, /stroke="([^"]+)"/g, /stop-color="([^"]+)"/g].forEach((re) => {
    let match;
    while ((match = re.exec(svg)) !== null) colors.add(match[1].toLowerCase().trim());
  });
  return colors;
}
function countNodes(svg) {
  const tags = svg.match(/<[a-z][^/\s>]*/gi) || [];
  return tags.filter((tag) => !['<svg', '<defs', '<g', '<pattern', '<filter', '<radialgradient', '<fecolormatrix', '<feturbulence'].includes(tag.toLowerCase())).length;
}
function hasForbiddenContent(svg) {
  const lower = svg.toLowerCase();
  return FORBIDDEN_ELEMENTS.some((tag) => lower.includes(`<${tag}`)) || FORBIDDEN_ATTRS.some((attr) => lower.includes(attr));
}
function hasConnector(svg, viewBox) {
  const bottom25 = viewBox.y + (viewBox.h * 0.75);
  return [...svg.matchAll(/y="([\d.]+)"/g)].some((match) => parseFloat(match[1]) >= bottom25);
}
function scoreAsset(family, name, svgContent, fileSize) {
  const issues = [];
  let score = 0;
  const info = {};
  if (/<svg[^>]+>/i.test(svgContent) && /viewBox="/i.test(svgContent)) score += 20;
  else issues.push('Missing svg or viewBox');
  const unapproved = [...extractColors(svgContent)].filter((c) => !APPROVED_COLORS.has(c) && c !== '');
  if (!unapproved.length) score += 20;
  else {
    issues.push(`Unapproved colors: ${unapproved.join(', ')}`);
    score += Math.max(0, 20 - (unapproved.length * 5));
  }
  const maxNodes = family === 'patterns' || family === 'signature' ? 40 : 20;
  const nodes = countNodes(svgContent);
  info.node_count = nodes;
  score += nodes <= maxNodes ? 15 : Math.max(0, 15 - (Math.floor((nodes - maxNodes) / 5) * 3));
  if (nodes > maxNodes) issues.push(`Too many nodes: ${nodes} (max ${maxNodes})`);
  info.file_size_bytes = fileSize;
  if (fileSize <= 2048) score += 15;
  else if (fileSize <= 4096) {
    score += 10;
    issues.push(`File size ${fileSize}B above 2KB ideal`);
  } else {
    issues.push(`File size ${fileSize}B above 4KB limit`);
  }
  if (/^[a-z][a-z0-9_]*$/.test(name)) score += 10;
  else issues.push('Name not in snake_case');
  if (!hasForbiddenContent(svgContent)) score += 10;
  else issues.push('Contains forbidden elements');
  if (family === 'patterns' || family === 'signature') score += 10;
  else if (/shape-rendering.*crispedges/i.test(svgContent)) score += 10;
  else {
    issues.push('Missing shape-rendering="crispEdges"');
    score += 5;
  }
  const viewBox = extractViewBox(svgContent);
  if (family === 'supports' && viewBox && HARDWARE_RATIOS[name]) {
    const expected = HARDWARE_RATIOS[name].ratio;
    const actual = parseFloat((viewBox.w / viewBox.h).toFixed(2));
    const tolerance = expected * 0.1;
    const ok = Math.abs(actual - expected) <= tolerance;
    info.hardware_ref = HARDWARE_RATIOS[name].ref;
    info.proportions_check = ok ? 'PASS' : `FAIL (expected ${expected}:1 ±10%)`;
    if (!ok) issues.push(`Wrong proportions: ${actual}:1 (expected ${expected}:1 ±10%)`);
    const hasConn = hasConnector(svgContent, viewBox);
    info.connector_check = hasConn ? 'PASS' : 'WARN';
    if (!hasConn) issues.push('No connector area detected in bottom 25% of viewBox');
  }
  const status = score >= 85 ? 'PASS' : score >= 70 ? 'REVIEW' : 'FAIL';
  return { asset: `${name}.svg`, family, status, score, issues, ...info };
}

function main() {
  console.log('\nRetroDex — SVG Asset QA');
  console.log('═══════════════════════════════════════');
  const results = [];
  let pass = 0; let review = 0; let fail = 0; let hasFail = false;
  Object.entries(FAMILIES).forEach(([family, names]) => {
    console.log(`\n  [${family.toUpperCase()}]`);
    names.forEach((name) => {
      const file = path.join(ASSET_DIR, family, `${name}.svg`);
      if (!fs.existsSync(file)) {
        results.push({ asset: `${name}.svg`, family, status: 'FAIL', score: 0, issues: ['File not found'] });
        console.log(`    ✗ ${name.padEnd(22)} FAIL   0  File not found`);
        fail += 1; hasFail = true; return;
      }
      const content = fs.readFileSync(file, 'utf8');
      const result = scoreAsset(family, name, content, Buffer.byteLength(content, 'utf8'));
      results.push(result);
      const icon = result.status === 'PASS' ? '✓' : result.status === 'REVIEW' ? '~' : '✗';
      const issue = result.issues.length ? `  [${result.issues[0]}]` : '';
      console.log(`    ${icon} ${name.padEnd(22)} ${result.status.padEnd(7)} ${String(result.score).padStart(3)}${issue}`);
      if (result.status === 'PASS') pass += 1;
      if (result.status === 'REVIEW') review += 1;
      if (result.status === 'FAIL') { fail += 1; hasFail = true; }
    });
  });
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify({ generated: new Date().toISOString(), summary: { pass, review, fail, total: results.length }, assets: results }, null, 2));
  console.log('\n═══════════════════════════════════════');
  console.log(`PASS: ${pass}  REVIEW: ${review}  FAIL: ${fail}  TOTAL: ${results.length}`);
  console.log(`Report: ${REPORT}`);
  if (hasFail) {
    console.log('\n⚠ Some assets FAIL — fix before integrating into UI.');
    process.exit(1);
  }
  console.log('\n✅ All assets PASS or REVIEW.');
}

main();
