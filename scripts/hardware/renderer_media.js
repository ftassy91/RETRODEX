import { getMediaDetail } from './hardware_utils.js';
import { MEDIA_PROFILES, renderMediaMarkup, renderMediaSvg } from './media_profiles.js';

/**
 * @param {string} mediaType
 * @param {string} consoleId
 * @param {number} [size=48]
 * @returns {string}
 */
export function renderMedia(mediaType, consoleId, size = 48) {
  if (!MEDIA_PROFILES[mediaType]) {
    throw new Error(`Unknown media type: ${mediaType}`);
  }
  return renderMediaSvg(mediaType, consoleId, size, MEDIA_PROFILES[mediaType].label);
}

export function renderMediaInline(mediaType, consoleId, size = 48, detail = null) {
  if (!MEDIA_PROFILES[mediaType]) {
    throw new Error(`Unknown media type: ${mediaType}`);
  }
  return {
    size,
    detail: detail || getMediaDetail(size),
    markup: renderMediaMarkup(mediaType, consoleId, size, detail || getMediaDetail(size)),
  };
}
