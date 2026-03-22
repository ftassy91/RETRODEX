const COS_30 = Math.sqrt(3) / 2;
const SIN_30 = 0.5;

export const HARDWARE_THEME = {
  bg: 'var(--bg, #000000)',
  surface: 'var(--bg-surface, #050805)',
  recess: 'var(--bg-card, #0a0f0a)',
  border: 'var(--border, #1a2a1a)',
  primary: 'var(--text-primary, #00ff66)',
  secondary: 'var(--text-secondary, #00994c)',
  muted: 'var(--text-muted, #1a5c2e)',
  alert: 'var(--text-alert, #ffcc00)',
  portable: 'var(--condition-cib, #4ecdc4)',
  contacts: 'var(--condition-mint, #ffd700)',
};

export function snap(n, pixelSize = 1) {
  return Math.round(n / pixelSize) * pixelSize;
}

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function normalizeDetail(detail) {
  if (detail === 'full' || detail === 'mid' || detail === 'minimal') {
    return detail;
  }
  return 'full';
}

export function getMediaDetail(size) {
  if (size >= 48) {
    return 'full';
  }
  if (size >= 24) {
    return 'mid';
  }
  return 'minimal';
}

export function project3D(x, y, z, pixelSize = 1, originX = 0, originY = 0) {
  const px = (x - z) * COS_30 * pixelSize + originX;
  const py = (x + z) * SIN_30 * pixelSize - y * pixelSize + originY;
  return {
    x: Math.round(px),
    y: Math.round(py),
  };
}

export function projectDiscPoints(cx, y, cz, radius, pixelSize = 1, originX = 0, originY = 0, segments = 16) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const theta = (Math.PI * 2 * index) / segments;
    const x = cx + Math.cos(theta) * radius;
    const z = cz + Math.sin(theta) * radius;
    points.push(project3D(x, y, z, pixelSize, originX, originY));
  }
  return points;
}

export function pointsAttr(points) {
  return points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(' ');
}

export function polygon(points, fill, extra = '') {
  return `<polygon points="${pointsAttr(points)}" fill="${fill}" ${extra}/>`;
}

export function pathFromPoints(points, fill, extra = '') {
  const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${Math.round(point.x)} ${Math.round(point.y)}`).join(' ');
  return `<path d="${d} Z" fill="${fill}" ${extra}/>`;
}

export function line(points, stroke, extra = '') {
  const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${Math.round(point.x)} ${Math.round(point.y)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${stroke}" ${extra}/>`;
}

export function rect(x, y, width, height, fill, extra = '') {
  return `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(width)}" height="${Math.round(height)}" fill="${fill}" ${extra}/>`;
}

export function circle(cx, cy, radius, fill, extra = '') {
  return `<circle cx="${Math.round(cx)}" cy="${Math.round(cy)}" r="${Math.round(radius)}" fill="${fill}" ${extra}/>`;
}

export function measurePoints(groups) {
  const points = groups.flat().filter(Boolean);
  if (!points.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function translatePoints(points, dx, dy) {
  return points.map((point) => ({
    x: Math.round(point.x + dx),
    y: Math.round(point.y + dy),
  }));
}

export function buildFace(facePoints, fill, stroke = HARDWARE_THEME.border, opacity = 1) {
  return polygon(facePoints, fill, `stroke="${stroke}" stroke-width="1" opacity="${opacity}" shape-rendering="crispEdges"`);
}

export function svgShell(viewBoxWidth, viewBoxHeight, content, title = '') {
  const titleMarkup = title ? `<title>${escapeXml(title)}</title>` : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}" shape-rendering="crispEdges">`,
    titleMarkup,
    content,
    '</svg>',
  ].join('');
}

export function buildBoxFaces(box, pixelSize, originX, originY) {
  const { x, y, z, w, h, d } = box;
  const front = [
    project3D(x, y, z, pixelSize, originX, originY),
    project3D(x + w, y, z, pixelSize, originX, originY),
    project3D(x + w, y + h, z, pixelSize, originX, originY),
    project3D(x, y + h, z, pixelSize, originX, originY),
  ];
  const left = [
    project3D(x, y, z, pixelSize, originX, originY),
    project3D(x, y, z + d, pixelSize, originX, originY),
    project3D(x, y + h, z + d, pixelSize, originX, originY),
    project3D(x, y + h, z, pixelSize, originX, originY),
  ];
  const top = [
    project3D(x, y + h, z, pixelSize, originX, originY),
    project3D(x + w, y + h, z, pixelSize, originX, originY),
    project3D(x + w, y + h, z + d, pixelSize, originX, originY),
    project3D(x, y + h, z + d, pixelSize, originX, originY),
  ];
  return { front, left, top };
}

export function portableAccent(consoleId) {
  return consoleId === 'game-boy' || consoleId === 'game-boy-advance'
    ? HARDWARE_THEME.portable
    : HARDWARE_THEME.primary;
}
