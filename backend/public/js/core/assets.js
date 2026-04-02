'use strict';

(() => {
  const ASSET_BASE = '/assets/system';
  const SUPPORT_MAP = {
    NES: 'cart_nes',
    'Nintendo Entertainment System': 'cart_nes',
    Famicom: 'cart_nes',
    SNES: 'cart_snes_us',
    'Super Nintendo': 'cart_snes_us',
    'Super Famicom': 'cart_snes_us',
    'Super NES': 'cart_snes_us',
    'Game Boy': 'cart_gb',
    'Game Boy Color': 'cart_gb',
    'Game Boy Advance': 'cart_gb',
    GBA: 'cart_gb',
    'Nintendo DS': 'cart_gb',
    'Nintendo 3DS': 'cart_gb',
    DS: 'cart_gb',
    'Nintendo 64': 'cart_n64',
    N64: 'cart_n64',
    'Sega Genesis': 'cart_md',
    'Mega Drive': 'cart_md',
    Genesis: 'cart_md',
    'Atari 2600': 'cart_generic',
    'Atari 7800': 'cart_generic',
    'Atari 5200': 'cart_generic',
    'Atari Lynx': 'cart_compact',
    'Neo Geo': 'cart_neo_aes',
    'Neo Geo AES': 'cart_neo_aes',
    'Neo Geo MVS': 'cart_neo_aes',
    'Neo Geo CD': 'disc_cd_standard',
    WonderSwan: 'cart_gb',
    'WonderSwan Color': 'cart_gb',
    'Game Gear': 'cart_gb',
    'Sega Master System': 'cart_md',
    'Master System': 'cart_md',
    PlayStation: 'disc_cd_standard',
    PS1: 'disc_cd_standard',
    PSOne: 'disc_cd_standard',
    'PlayStation 2': 'disc_cd_standard',
    PS2: 'disc_cd_standard',
    'Sega Saturn': 'disc_cd_standard',
    Saturn: 'disc_cd_standard',
    'Sega CD': 'disc_cd_standard',
    'Mega CD': 'disc_cd_standard',
    'TurboGrafx-16': 'disc_cd_standard',
    'TurboGrafx-CD': 'disc_cd_standard',
    'PC Engine CD': 'disc_cd_standard',
    'PC Engine': 'cart_compact',
    Dreamcast: 'disc_gd_rom',
    'Sega Dreamcast': 'disc_gd_rom',
    PSP: 'disc_umd',
    'PlayStation Portable': 'disc_umd',
    GameCube: 'disc_gd_rom',
    'Nintendo GameCube': 'disc_gd_rom',
    'PC-88': 'floppy_disk',
    'PC-98': 'floppy_disk',
    MSX: 'floppy_disk',
    Amiga: 'floppy_disk',
    'Commodore 64': 'floppy_disk',
    'Atari ST': 'floppy_disk',
  };
  const RARITY_ICONS = { LEGENDARY: 'rarity_gem', EPIC: 'rarity_gem', RARE: 'rarity_gem' };
  const GRADE_ICONS = { cib: 'grade_cib', loose: 'grade_loose', mint: 'grade_sealed', sealed: 'grade_sealed', other: 'grade_loose' };

  function image(src, className, size, alt, label) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.width = size;
    img.height = size;
    img.className = className;
    img.setAttribute('aria-hidden', alt ? 'false' : 'true');
    if (label) img.setAttribute('aria-label', label);
    return img;
  }
  function getSupportPath(consoleName) {
    return `${ASSET_BASE}/supports/${SUPPORT_MAP[consoleName] || 'cart_generic'}.svg`;
  }
  function createSupportImg(consoleName, size = 16) {
    const img = image(getSupportPath(consoleName), 'asset-support', size, '', '');
    img.onerror = () => { img.src = `${ASSET_BASE}/supports/cart_generic.svg`; };
    return img;
  }
  function getRarityIconPath(rarity) {
    const icon = RARITY_ICONS[String(rarity || '').toUpperCase()];
    return icon ? `${ASSET_BASE}/icons/${icon}.svg` : null;
  }
  function createRarityImg(rarity, size = 14) {
    const src = getRarityIconPath(rarity);
    return src ? image(src, 'asset-rarity', size, rarity, rarity) : null;
  }
  function getGradeIconPath(condition) {
    return `${ASSET_BASE}/icons/${GRADE_ICONS[String(condition || '').toLowerCase()] || 'grade_loose'}.svg`;
  }
  function createGradeImg(condition, size = 14) {
    return image(getGradeIconPath(condition), 'asset-grade', size, String(condition || '').toUpperCase(), String(condition || '').toLowerCase());
  }
  function normalizeConditionBadgeValue(value) {
    const condition = String(value || '').trim().toLowerCase();
    if (!condition || condition === '-' || condition === '—') return null;
    if (condition.includes('sealed')) return 'sealed';
    if (condition.includes('mint')) return 'mint';
    if (condition.includes('cib')) return 'cib';
    if (condition.includes('loose')) return 'loose';
    if (condition === 'other') return 'other';
    return null;
  }
  function decorateConditionBadges(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('.badge--condition, .condition-badge, [data-condition]').forEach((badge) => {
      if (badge.querySelector('.asset-grade')) return;
      const condition = normalizeConditionBadgeValue(
        badge.dataset.condition
        || badge.textContent
        || ''
      );
      if (!condition) return;
      const img = createGradeImg(condition, 14);
      badge.insertBefore(img, badge.firstChild);
    });
  }
  function getTrendIconPath(trend) {
    if (trend == null) return null;
    if (trend > 0) return `${ASSET_BASE}/icons/trend_up.svg`;
    if (trend < 0) return `${ASSET_BASE}/icons/trend_down.svg`;
    return `${ASSET_BASE}/icons/price_stable.svg`;
  }
  function injectStyles() {
    if (!document.head || document.getElementById('r?trodex-assets-css')) return;
    const style = document.createElement('style');
    style.id = 'r?trodex-assets-css';
    style.textContent = '.asset-support,.asset-rarity,.asset-grade,.asset-trend{display:inline-block;vertical-align:middle;flex-shrink:0;image-rendering:pixelated;image-rendering:crisp-edges}.asset-support{margin-right:6px}.asset-rarity{margin-left:4px;opacity:.9}.asset-grade{margin-right:4px}';
    document.head.appendChild(style);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
  else injectStyles();

  window.RetroDexAssets = {
    getSupportPath,
    createSupportImg,
    getRarityIconPath,
    createRarityImg,
    getGradeIconPath,
    createGradeImg,
    decorateConditionBadges,
    getTrendIconPath,
    SUPPORT_MAP,
    RARITY_ICONS,
    GRADE_ICONS,
  };
})();
