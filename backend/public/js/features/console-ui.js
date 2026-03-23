(function attachRetroDexConsoleUi(globalScope) {
  let hardwareModulesPromise = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeJSON(value, fallback) {
    if (!value) return fallback;
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return value;

    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function initials(label) {
    return String(label || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'RD';
  }

  function manufacturerFor(item) {
    if (item?.manufacturer) return item.manufacturer;

    const text = String(item?.title || item?.platform || item?.name || '').toLowerCase();
    if (text.includes('nintendo') || text.includes('game boy')) return 'Nintendo';
    if (text.includes('sega') || text.includes('dreamcast') || text.includes('saturn') || text.includes('genesis')) return 'Sega';
    if (text.includes('playstation')) return 'Sony';
    if (text.includes('neo geo')) return 'SNK';
    if (text.includes('atari')) return 'Atari';
    return 'Archive';
  }

  function resolveConsoleCandidates(consoleInfo) {
    return [
      consoleInfo?.title,
      consoleInfo?.platform,
      consoleInfo?.id,
      consoleInfo?.name,
    ].filter(Boolean);
  }

  function loadHardwareModules() {
    if (!hardwareModulesPromise) {
      hardwareModulesPromise = Promise.all([
        import('/scripts/hardware/renderer_hardware.js'),
        import('/scripts/hardware/renderer_media.js'),
        import('/scripts/hardware/hardware_profiles.js'),
        import('/scripts/hardware/media_profiles.js'),
      ])
        .then(([hardwareModule, mediaModule, profilesModule, mediaProfilesModule]) => ({
          renderConsole: hardwareModule.renderConsole,
          renderMedia: mediaModule.renderMedia,
          resolveHardwareId: profilesModule.resolveHardwareId,
          HARDWARE_PROFILES: profilesModule.HARDWARE_PROFILES,
          MEDIA_PROFILES: mediaProfilesModule.MEDIA_PROFILES,
        }))
        .catch(() => null);
    }

    return hardwareModulesPromise;
  }

  async function getHardwareContext(consoleInfo) {
    const modules = await loadHardwareModules();
    if (!modules) return null;

    const candidates = resolveConsoleCandidates(consoleInfo);
    for (const candidate of candidates) {
      const resolvedId = modules.resolveHardwareId(candidate);
      const profile = modules.HARDWARE_PROFILES?.[resolvedId];

      if (profile) {
        return {
          ...modules,
          resolvedId,
          profile,
        };
      }
    }

    return {
      ...modules,
      resolvedId: null,
      profile: null,
    };
  }

  async function renderConsoleIllustration(consoleInfo, opts = {}) {
    const context = await getHardwareContext(consoleInfo);
    if (!context?.renderConsole) return null;

    const consoleId = resolveConsoleCandidates(consoleInfo)[0];
    if (!consoleId) return null;

    try {
      return context.renderConsole(consoleId, {
        withMedia: false,
        showLabel: false,
        ...opts,
      });
    } catch (_) {
      return null;
    }
  }

  async function renderMediaAsset(consoleInfo, size = 48) {
    const context = await getHardwareContext(consoleInfo);
    if (!context?.profile?.mediaType || typeof context.renderMedia !== 'function') {
      return null;
    }

    try {
      return {
        markup: context.renderMedia(context.profile.mediaType, context.resolvedId, size),
        label: context.MEDIA_PROFILES?.[context.profile.mediaType]?.label || 'Physical media',
      };
    } catch (_) {
      return null;
    }
  }

  globalScope.RetroDexConsoleUi = {
    escapeHtml,
    safeJSON,
    initials,
    manufacturerFor,
    loadHardwareModules,
    getHardwareContext,
    renderConsoleIllustration,
    renderMediaAsset,
  };
})(typeof window !== 'undefined' ? window : globalThis);
