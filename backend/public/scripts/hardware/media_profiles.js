import {
  HARDWARE_THEME,
  circle,
  escapeXml,
  getMediaDetail,
  pathFromPoints,
  rect,
} from './hardware_utils.js';

const BASE_SIZE = 48;

function mediaPalette(consoleId) {
  const portable = consoleId === 'game-boy' || consoleId === 'game-boy-advance' || consoleId === 'gb' || consoleId === 'gba';
  return {
    shell: HARDWARE_THEME.surface,
    inset: HARDWARE_THEME.recess,
    outline: HARDWARE_THEME.border,
    accent: portable ? HARDWARE_THEME.portable : HARDWARE_THEME.primary,
    dim: HARDWARE_THEME.muted,
    gold: HARDWARE_THEME.contacts,
  };
}

function polygonPoints(points) {
  return points.map((point) => `${point[0]},${point[1]}`).join(' ');
}

function mediaPolygon(points, fill, extra = '') {
  return `<polygon points="${polygonPoints(points)}" fill="${fill}" ${extra}/>`;
}

function mediaPath(points, fill, extra = '') {
  return pathFromPoints(points.map(([x, y]) => ({ x, y })), fill, extra);
}

function renderContacts(x, y, count, width, height, gap, color) {
  const pieces = [];
  for (let index = 0; index < count; index += 1) {
    pieces.push(rect(x + index * (width + gap), y, width, height, color));
  }
  return pieces.join('');
}

function renderCartNes(size, detail, palette) {
  const left = Math.round(size * 0.23);
  const top = Math.round(size * 0.08);
  const right = size - left;
  const bottom = size - Math.round(size * 0.1);
  const shoulder = Math.round(size * 0.14);
  const tabWidth = Math.round(size * 0.18);
  const tabDepth = Math.round(size * 0.08);
  const path = [
    [left + shoulder, top],
    [right - shoulder, top],
    [right, top + shoulder],
    [right, bottom - tabDepth],
    [size / 2 + tabWidth / 2, bottom - tabDepth],
    [size / 2 + tabWidth / 2, bottom],
    [size / 2 - tabWidth / 2, bottom],
    [size / 2 - tabWidth / 2, bottom - tabDepth],
    [left, bottom - tabDepth],
    [left, top + shoulder],
  ];
  const markup = [mediaPath(path, palette.shell, `stroke="${palette.outline}" stroke-width="1"`)];
  if (detail !== 'minimal') {
    markup.push(rect(left + 5, top + 6, right - left - 10, 7, palette.inset));
  }
  if (detail === 'full') {
    markup.push(renderContacts(size / 2 - 7, bottom - tabDepth + 1, 5, 2, 2, 1, palette.gold));
  }
  return markup.join('');
}

function renderCartSnes(size, detail, palette) {
  const left = Math.round(size * 0.12);
  const top = Math.round(size * 0.16);
  const right = size - left;
  const bottom = size - Math.round(size * 0.14);
  const notch = Math.round(size * 0.12);
  const points = [
    [left, top + notch],
    [left + notch, top],
    [right - notch, top],
    [right, top + notch],
    [right, bottom],
    [left, bottom],
  ];
  const markup = [mediaPolygon(points, palette.shell, `stroke="${palette.outline}" stroke-width="1"`)];
  if (detail !== 'minimal') {
    markup.push(rect(left + 5, top + 7, right - left - 10, 7, palette.inset));
    markup.push(rect(left + 9, top + 4, right - left - 18, 2, palette.accent));
  }
  if (detail === 'full') {
    markup.push(renderContacts(Math.round(size * 0.36), bottom - 3, 5, 1, 2, 1, palette.gold));
  }
  return markup.join('');
}

function renderCartN64(size, detail, palette) {
  const left = Math.round(size * 0.14);
  const top = Math.round(size * 0.16);
  const right = size - left;
  const bottom = size - Math.round(size * 0.12);
  const gripWidth = Math.round(size * 0.18);
  const gripHeight = Math.round(size * 0.1);
  const points = [
    [left, top + gripHeight],
    [size / 2 - gripWidth / 2, top + gripHeight],
    [size / 2 - gripWidth / 2, top],
    [size / 2 + gripWidth / 2, top],
    [size / 2 + gripWidth / 2, top + gripHeight],
    [right, top + gripHeight],
    [right, bottom],
    [left, bottom],
  ];
  const markup = [mediaPolygon(points, palette.shell, `stroke="${palette.outline}" stroke-width="1"`)];
  if (detail !== 'minimal') {
    markup.push(rect(left + 5, top + 8, right - left - 10, 8, palette.inset));
  }
  if (detail === 'full') {
    markup.push(rect(left + 10, top + 5, right - left - 20, 2, palette.accent));
  }
  return markup.join('');
}

function renderCartGb(size, detail, palette) {
  const left = Math.round(size * 0.22);
  const top = Math.round(size * 0.08);
  const right = size - left;
  const bottom = size - Math.round(size * 0.1);
  const chamfer = Math.round(size * 0.12);
  const notchWidth = Math.round(size * 0.16);
  const points = [
    [left + chamfer, top],
    [size / 2 - notchWidth / 2, top],
    [size / 2 - notchWidth / 2, top + 3],
    [size / 2 + notchWidth / 2, top + 3],
    [size / 2 + notchWidth / 2, top],
    [right - chamfer, top],
    [right, top + chamfer],
    [right, bottom],
    [left, bottom],
    [left, top + chamfer],
  ];
  const markup = [mediaPolygon(points, palette.shell, `stroke="${palette.outline}" stroke-width="1"`)];
  if (detail !== 'minimal') {
    markup.push(rect(left + 5, top + 8, right - left - 10, 10, palette.inset));
    markup.push(rect(left + 9, top + 5, right - left - 18, 2, palette.accent));
  }
  if (detail === 'full') {
    markup.push(rect(size / 2 - 4, bottom - 4, 8, 2, palette.gold));
  }
  return markup.join('');
}

function renderCartGba(size, detail, palette) {
  const left = Math.round(size * 0.14);
  const top = Math.round(size * 0.22);
  const right = size - left;
  const bottom = size - Math.round(size * 0.14);
  const cut = Math.round(size * 0.08);
  const centerNotch = Math.round(size * 0.12);
  const points = [
    [left + cut, top],
    [size / 2 - centerNotch / 2, top],
    [size / 2 - centerNotch / 2, top + 3],
    [size / 2 + centerNotch / 2, top + 3],
    [size / 2 + centerNotch / 2, top],
    [right - cut, top],
    [right, top + cut],
    [right, bottom],
    [left, bottom],
    [left, top + cut],
  ];
  const markup = [mediaPolygon(points, palette.shell, `stroke="${palette.outline}" stroke-width="1"`)];
  if (detail !== 'minimal') {
    markup.push(rect(left + 5, top + 6, right - left - 10, 6, palette.inset));
  }
  if (detail === 'full') {
    markup.push(rect(size / 2 - 6, bottom - 3, 12, 2, palette.accent));
  }
  return markup.join('');
}

function renderCartMd(size, detail, palette) {
  const left = Math.round(size * 0.22);
  const top = Math.round(size * 0.08);
  const right = size - left;
  const bottom = size - Math.round(size * 0.08);
  const cap = Math.round(size * 0.12);
  const points = [
    [left + cap, top],
    [right - cap, top],
    [right, top + cap],
    [right, bottom],
    [left, bottom],
    [left, top + cap],
  ];
  const markup = [mediaPolygon(points, palette.shell, `stroke="${palette.outline}" stroke-width="1"`)];
  if (detail !== 'minimal') {
    markup.push(rect(left + 6, top + 7, right - left - 12, 13, palette.inset));
    markup.push(rect(left + 8, top + 3, right - left - 16, 2, palette.accent));
  }
  if (detail === 'full') {
    markup.push(rect(left + 10, bottom - 5, right - left - 20, 2, palette.dim));
  }
  return markup.join('');
}

function renderDiscCd(size, detail, palette) {
  const center = size / 2;
  const outer = Math.round(size * 0.38);
  const inner = Math.round(size * 0.08);
  const markup = [
    circle(center, center, outer, palette.shell, `stroke="${palette.outline}" stroke-width="1"`),
    circle(center, center, inner, 'var(--bg, #000000)'),
  ];
  if (detail !== 'minimal') {
    markup.push(circle(center, center, Math.round(size * 0.24), 'none', `stroke="${palette.accent}" stroke-width="2" opacity="0.8"`));
  }
  if (detail === 'full') {
    markup.push(mediaPolygon([
      [center + outer - 6, center - 2],
      [center + outer - 2, center + 2],
      [center + outer - 10, center + 6],
    ], palette.dim));
  }
  return markup.join('');
}

function renderDiscGdrom(size, detail, palette) {
  const center = size / 2;
  const outer = Math.round(size * 0.38);
  const inner = Math.round(size * 0.08);
  const markup = [
    circle(center, center, outer, palette.shell, `stroke="${palette.outline}" stroke-width="1"`),
    circle(center, center, inner, 'var(--bg, #000000)'),
  ];
  if (detail !== 'minimal') {
    markup.push(circle(center, center, Math.round(size * 0.24), 'none', `stroke="${palette.accent}" stroke-width="2" stroke-dasharray="4 3"`));
  }
  if (detail === 'full') {
    markup.push(mediaPolygon([
      [center + 8, center - 12],
      [center + 13, center - 8],
      [center + 4, center - 4],
    ], palette.dim));
  }
  return markup.join('');
}

function renderDiscUmd(size, detail, palette) {
  const frame = Math.round(size * 0.14);
  const markup = [
    rect(frame, frame + 4, size - frame * 2, size - frame * 2 - 8, palette.shell, `stroke="${palette.outline}" stroke-width="1" rx="2" ry="2"`),
    circle(size / 2, size / 2 + 2, Math.round(size * 0.18), palette.inset),
  ];
  if (detail !== 'minimal') {
    markup.push(circle(size / 2, size / 2 + 2, Math.round(size * 0.08), 'var(--bg, #000000)'));
  }
  return markup.join('');
}

function renderFloppy35(size, detail, palette) {
  const frame = Math.round(size * 0.16);
  const markup = [
    rect(frame, frame, size - frame * 2, size - frame * 2, palette.shell, `stroke="${palette.outline}" stroke-width="1"`),
    rect(size / 2 - 8, frame + 2, 16, 6, palette.inset),
  ];
  if (detail !== 'minimal') {
    markup.push(rect(frame + 5, size / 2 - 1, size - frame * 2 - 10, 10, palette.inset));
  }
  if (detail === 'full') {
    markup.push(rect(size / 2 + 3, size / 2 + 2, 5, 3, palette.accent));
  }
  return markup.join('');
}

function renderFloppy525(size, detail, palette) {
  const frame = Math.round(size * 0.12);
  const markup = [
    rect(frame, frame, size - frame * 2, size - frame * 2, palette.shell, `stroke="${palette.outline}" stroke-width="1"`),
    circle(size / 2, size / 2, Math.round(size * 0.1), palette.inset),
  ];
  if (detail !== 'minimal') {
    markup.push(rect(size / 2 - 8, frame + 5, 16, 5, palette.inset));
  }
  if (detail === 'full') {
    markup.push(rect(size / 2 - 2, size - frame - 8, 4, 4, palette.accent));
  }
  return markup.join('');
}

function renderUnsupported(size, palette) {
  return [
    rect(Math.round(size * 0.2), Math.round(size * 0.2), Math.round(size * 0.6), Math.round(size * 0.6), palette.shell, `stroke="${palette.outline}" stroke-width="1"`),
    rect(Math.round(size * 0.35), Math.round(size * 0.35), Math.round(size * 0.3), Math.round(size * 0.3), palette.inset),
  ].join('');
}

const RENDERERS = {
  'cart-nes': renderCartNes,
  'cart-snes': renderCartSnes,
  'cart-n64': renderCartN64,
  'cart-gb': renderCartGb,
  'cart-gba': renderCartGba,
  'cart-md': renderCartMd,
  'disc-cd': renderDiscCd,
  'disc-dvd': renderDiscCd,
  'disc-gdrom': renderDiscGdrom,
  'disc-umd': renderDiscUmd,
  'floppy-35': renderFloppy35,
  'floppy-525': renderFloppy525,
};

export const MEDIA_PROFILES = {
  'cart-nes': { id: 'cart-nes', label: 'NES Cartridge', shape: { w: 14, h: 18 }, render: renderCartNes },
  'cart-snes': { id: 'cart-snes', label: 'SNES Cartridge', shape: { w: 18, h: 14 }, render: renderCartSnes },
  'cart-n64': { id: 'cart-n64', label: 'N64 Cartridge', shape: { w: 18, h: 14 }, render: renderCartN64 },
  'cart-gb': { id: 'cart-gb', label: 'Game Boy Cartridge', shape: { w: 14, h: 18 }, render: renderCartGb },
  'cart-gba': { id: 'cart-gba', label: 'Game Boy Advance Cartridge', shape: { w: 18, h: 12 }, render: renderCartGba },
  'cart-md': { id: 'cart-md', label: 'Mega Drive Cartridge', shape: { w: 16, h: 20 }, render: renderCartMd },
  'disc-cd': { id: 'disc-cd', label: 'Compact Disc', shape: { w: 18, h: 18 }, render: renderDiscCd },
  'disc-dvd': { id: 'disc-dvd', label: 'DVD', shape: { w: 18, h: 18 }, render: renderDiscCd },
  'disc-gdrom': { id: 'disc-gdrom', label: 'GD-ROM', shape: { w: 18, h: 18 }, render: renderDiscGdrom },
  'disc-umd': { id: 'disc-umd', label: 'UMD', shape: { w: 18, h: 18 }, render: renderDiscUmd },
  'floppy-35': { id: 'floppy-35', label: '3.5 Floppy', shape: { w: 18, h: 18 }, render: renderFloppy35 },
  'floppy-525': { id: 'floppy-525', label: '5.25 Floppy', shape: { w: 18, h: 18 }, render: renderFloppy525 },
};

export function renderMediaMarkup(mediaType, consoleId, size = BASE_SIZE, detail = null) {
  const normalizedDetail = detail || getMediaDetail(size);
  const renderer = RENDERERS[mediaType] || renderUnsupported;
  const palette = mediaPalette(consoleId);
  return renderer(size, normalizedDetail, palette);
}

export function renderMediaSvg(mediaType, consoleId, size = BASE_SIZE, title = '') {
  const detail = getMediaDetail(size);
  const markup = renderMediaMarkup(mediaType, consoleId, size, detail);
  const safeTitle = title ? `<title>${escapeXml(title)}</title>` : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">`,
    safeTitle,
    markup,
    '</svg>',
  ].join('');
}
