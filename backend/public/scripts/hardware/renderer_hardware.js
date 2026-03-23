import { HARDWARE_PROFILES, resolveHardwareId } from './hardware_profiles.js';
import {
  HARDWARE_THEME,
  buildBoxFaces,
  buildFace,
  circle,
  line,
  measurePoints,
  polygon,
  portableAccent,
  project3D,
  projectDiscPoints,
  rect,
  svgShell,
  translatePoints,
} from './hardware_utils.js';
import { renderMediaInline } from './renderer_media.js';

const VIEWBOX = 256;

function bodyFaces(profile, originX, originY) {
  return buildBoxFaces(
    { x: 0, y: 0, z: 0, ...profile.body },
    profile.pixelSize,
    originX,
    originY,
  );
}

function slotTop(profile, originX, originY) {
  if (!profile.cartSlot || profile.cartSlot.kind !== 'top') {
    return '';
  }
  const slot = profile.cartSlot;
  const top = [
    project3D(slot.x, profile.body.h, slot.z, profile.pixelSize, originX, originY),
    project3D(slot.x + slot.w, profile.body.h, slot.z, profile.pixelSize, originX, originY),
    project3D(slot.x + slot.w, profile.body.h, slot.z + slot.d, profile.pixelSize, originX, originY),
    project3D(slot.x, profile.body.h, slot.z + slot.d, profile.pixelSize, originX, originY),
  ];
  return buildFace(top, HARDWARE_THEME.bg);
}

function slotFront(profile, originX, originY) {
  if (!profile.cartSlot || profile.cartSlot.kind !== 'front') {
    return '';
  }
  const slot = profile.cartSlot;
  const front = [
    project3D(slot.x, slot.y, 0, profile.pixelSize, originX, originY),
    project3D(slot.x + slot.w, slot.y, 0, profile.pixelSize, originX, originY),
    project3D(slot.x + slot.w, slot.y + slot.h, 0, profile.pixelSize, originX, originY),
    project3D(slot.x, slot.y + slot.h, 0, profile.pixelSize, originX, originY),
  ];
  return buildFace(front, HARDWARE_THEME.bg);
}

function renderInsertedCartridge(profile, originX, originY) {
  if (!profile.cartSlot || !profile.mediaType) {
    return '';
  }
  const slot = profile.cartSlot;
  const mediaSize = profile.portable ? 56 : 52;
  const media = renderMediaInline(profile.mediaType, profile.id, mediaSize, 'mid');
  let translateX;
  let translateY;

  if (slot.kind === 'top') {
    const anchor = project3D(
      slot.x + slot.w / 2,
      profile.body.h + slot.reveal,
      slot.z + slot.d / 2,
      profile.pixelSize,
      originX,
      originY,
    );
    translateX = Math.round(anchor.x - mediaSize / 2);
    translateY = Math.round(anchor.y - mediaSize + 6);
  } else {
    const anchor = project3D(
      slot.x + slot.w / 2,
      slot.y + slot.h + slot.reveal,
      0,
      profile.pixelSize,
      originX,
      originY,
    );
    translateX = Math.round(anchor.x - mediaSize / 2);
    translateY = Math.round(anchor.y - mediaSize + 12);
  }

  return `<g transform="translate(${translateX} ${translateY})">${media.markup}</g>`;
}

function renderDisc(profile, originX, originY) {
  if (!profile.discSlot) {
    return '';
  }
  const disc = profile.discSlot;
  const outer = projectDiscPoints(disc.x, profile.body.h + 1, disc.z, disc.r, profile.pixelSize, originX, originY, 20);
  const inner = projectDiscPoints(disc.x, profile.body.h + 1, disc.z, Math.max(2, Math.round(disc.r / 4)), profile.pixelSize, originX, originY, 16);
  return [
    polygon(outer, HARDWARE_THEME.recess, `stroke="${HARDWARE_THEME.border}" stroke-width="1"`),
    polygon(inner, HARDWARE_THEME.bg),
    polygon(projectDiscPoints(disc.x + 1, profile.body.h + 1, disc.z + 1, Math.max(3, Math.round(disc.r / 1.8)), profile.pixelSize, originX, originY, 18), 'none', `stroke="${HARDWARE_THEME.primary}" stroke-width="1" opacity="0.65"`),
  ].join('');
}

function renderHandheldFeatures(profile, faces) {
  const frontBounds = measurePoints([faces.front]);
  const accent = portableAccent(profile.id);
  const x = Math.round(frontBounds.minX + 16);
  const y = Math.round(frontBounds.minY + 14);
  const width = Math.round(frontBounds.width - 32);
  const screenHeight = profile.id === 'game-boy' ? 46 : 32;
  const buttonY = profile.id === 'game-boy' ? y + screenHeight + 18 : y + screenHeight + 12;
  const rightClusterX = x + width - 30;
  const speakerY = buttonY + 18;

  const parts = [
    rect(x, y, width, screenHeight, HARDWARE_THEME.recess, `stroke="${HARDWARE_THEME.border}" stroke-width="1"`),
    rect(x + 6, y + 6, width - 12, screenHeight - 12, HARDWARE_THEME.bg),
    rect(x + 9, y + 9, width - 18, screenHeight - 18, accent, `opacity="0.22"`),
    rect(x + 8, buttonY + 6, 14, 4, accent),
    rect(x + 13, buttonY + 1, 4, 14, accent),
    circle(rightClusterX, buttonY + 9, 5, accent),
    circle(rightClusterX + 12, buttonY + 3, 5, accent),
    circle(x + 8, frontBounds.maxY - 10, 2, HARDWARE_THEME.alert),
  ];

  if (profile.id === 'game-boy') {
    for (let index = 0; index < 4; index += 1) {
      parts.push(rect(rightClusterX - 8 + index * 4, speakerY, 2, 10, HARDWARE_THEME.muted));
    }
  } else {
    parts.push(rect(x + width / 2 - 14, frontBounds.maxY - 9, 28, 3, HARDWARE_THEME.muted));
  }

  return parts.join('');
}

function renderSnesFeatures(faces) {
  const topBounds = measurePoints([faces.top]);
  const frontBounds = measurePoints([faces.front]);
  return [
    rect(topBounds.minX + 20, topBounds.minY + 18, 18, 5, HARDWARE_THEME.recess),
    rect(topBounds.maxX - 46, topBounds.minY + 16, 14, 5, HARDWARE_THEME.recess),
    circle(frontBounds.minX + 18, frontBounds.minY + 22, 2, HARDWARE_THEME.alert),
    rect(frontBounds.minX + 32, frontBounds.minY + 19, 20, 4, HARDWARE_THEME.muted),
    rect(frontBounds.maxX - 44, frontBounds.minY + 19, 20, 4, HARDWARE_THEME.muted),
  ].join('');
}

function renderMegadriveFeatures(faces) {
  const topBounds = measurePoints([faces.top]);
  const frontBounds = measurePoints([faces.front]);
  return [
    circle(topBounds.minX + topBounds.width / 2, topBounds.minY + 22, 24, 'none', `stroke="${HARDWARE_THEME.primary}" stroke-width="3" opacity="0.5"`),
    circle(topBounds.minX + topBounds.width / 2, topBounds.minY + 22, 13, HARDWARE_THEME.recess),
    rect(frontBounds.minX + 18, frontBounds.minY + 17, 26, 4, HARDWARE_THEME.muted),
    circle(frontBounds.maxX - 18, frontBounds.minY + 19, 3, HARDWARE_THEME.alert),
  ].join('');
}

function renderDiscConsoleFeatures(profile, faces) {
  const topBounds = measurePoints([faces.top]);
  const frontBounds = measurePoints([faces.front]);
  return [
    circle(topBounds.minX + topBounds.width / 2, topBounds.minY + 22, profile.id === 'saturn' ? 28 : 24, 'none', `stroke="${HARDWARE_THEME.border}" stroke-width="3"`),
    rect(frontBounds.minX + 20, frontBounds.minY + 18, 36, 4, HARDWARE_THEME.muted),
    circle(frontBounds.maxX - 16, frontBounds.minY + 20, 3, HARDWARE_THEME.alert),
  ].join('');
}

function renderN64Features(faces) {
  const frontBounds = measurePoints([faces.front]);
  const topBounds = measurePoints([faces.top]);
  return [
    circle(frontBounds.minX + 16, frontBounds.minY + 22, 3, HARDWARE_THEME.recess),
    circle(frontBounds.minX + 34, frontBounds.minY + 22, 3, HARDWARE_THEME.recess),
    circle(frontBounds.maxX - 34, frontBounds.minY + 22, 3, HARDWARE_THEME.recess),
    circle(frontBounds.maxX - 16, frontBounds.minY + 22, 3, HARDWARE_THEME.recess),
    rect(topBounds.minX + 26, topBounds.minY + 16, 18, 4, HARDWARE_THEME.recess),
    circle(frontBounds.maxX - 14, frontBounds.minY + 12, 3, HARDWARE_THEME.alert),
  ].join('');
}

function renderNesFeatures(faces) {
  const frontBounds = measurePoints([faces.front]);
  const topBounds = measurePoints([faces.top]);
  return [
    line([
      { x: topBounds.minX + 24, y: topBounds.maxY - 2 },
      { x: topBounds.maxX - 16, y: topBounds.minY + 18 },
    ], HARDWARE_THEME.border, 'stroke-width="2"'),
    rect(frontBounds.minX + 20, frontBounds.minY + 18, 34, 4, HARDWARE_THEME.muted),
    rect(frontBounds.maxX - 20, frontBounds.minY + 18, 8, 4, HARDWARE_THEME.alert),
  ].join('');
}

function renderFeatureLayer(profile, faces) {
  switch (profile.family) {
    case 'handheld':
    case 'handheld-wide':
      return renderHandheldFeatures(profile, faces);
    case 'top-loader':
      return renderSnesFeatures(faces);
    case 'megadrive':
      return renderMegadriveFeatures(faces);
    case 'disc-top':
      return renderDiscConsoleFeatures(profile, faces);
    case 'n64':
      return renderN64Features(faces);
    case 'front-loader':
      return renderNesFeatures(faces);
    default:
      return '';
  }
}

function renderConsoleMarkup(profile, opts = {}) {
  const originX = 128;
  const originY = profile.family.startsWith('handheld') ? 224 : 192;
  const faces = bodyFaces(profile, originX, originY);
  const bounds = measurePoints([faces.front, faces.left, faces.top]);
  const dx = Math.round(128 - (bounds.minX + bounds.width / 2));
  const dy = Math.round((profile.family.startsWith('handheld') ? 214 : 188) - bounds.maxY);

  const shiftedFaces = {
    front: translatePoints(faces.front, dx, dy),
    left: translatePoints(faces.left, dx, dy),
    top: translatePoints(faces.top, dx, dy),
  };

  const slotMarkup = (slotTop(profile, originX, originY) + slotFront(profile, originX, originY)).replace(
    /(\d+),(\d+)/g,
    (match, x, y) => `${Number(x) + dx},${Number(y) + dy}`,
  );

  const markup = [
    buildFace(shiftedFaces.left, HARDWARE_THEME.recess),
    buildFace(shiftedFaces.front, HARDWARE_THEME.surface),
    buildFace(shiftedFaces.top, HARDWARE_THEME.surface, HARDWARE_THEME.border, 0.86),
    slotMarkup,
    renderFeatureLayer(profile, shiftedFaces),
    profile.discSlot ? renderDisc(profile, originX + dx, originY + dy) : '',
    opts.withMedia === false || profile.discSlot ? '' : renderInsertedCartridge(profile, originX + dx, originY + dy),
  ].join('');

  if (!opts.showLabel) {
    return markup;
  }

  return [
    markup,
    `<text x="128" y="238" text-anchor="middle" fill="${portableAccent(profile.id)}" font-size="14" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" letter-spacing="1">${profile.label}</text>`,
  ].join('');
}

/**
 * @param {string} consoleId
 * @param {object} [opts]
 * @param {boolean} [opts.withMedia=true]
 * @param {boolean} [opts.showLabel=false]
 * @returns {string}
 */
export function renderConsole(consoleId, opts = {}) {
  const resolvedId = resolveHardwareId(consoleId);
  const profile = HARDWARE_PROFILES[resolvedId];
  if (!profile) {
    throw new Error(`Unknown console hardware profile: ${consoleId}`);
  }
  return svgShell(
    VIEWBOX,
    VIEWBOX,
    renderConsoleMarkup(profile, { withMedia: opts.withMedia !== false, showLabel: opts.showLabel === true }),
    profile.label,
  );
}
