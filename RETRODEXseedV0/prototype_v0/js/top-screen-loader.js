const TOP_SCREEN_LOADER = (() => {
  const TOP_IMAGE_CACHE = {};
  const LOCAL_IMAGE_ROOTS = [
    { type: 'boxart', path: 'assets/boxart/' },
    { type: 'titleScreen', path: 'assets/titlescreens/' },
    { type: 'artwork', path: 'assets/artwork/' },
    { type: 'gameplay', path: 'assets/screenshots/' },
    { type: 'generated', path: 'assets/generated_gb/' }
  ];
  const PLACEHOLDER_TOP_IMAGE = 'assets/placeholders/default.png';
  const GENERATED_STORAGE_PREFIX = 'retrodex.top.generated.v3.';
  const GB_RENDER_SIZE = { width: 320, height: 180 };

  function slugify(str) {
    return String(str || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function isLocalAssetPath(value) {
    return typeof value === 'string'
      && value !== ''
      && !/^https?:\/\//i.test(value)
      && !/^data:/i.test(value);
  }

  function normalizeAssetPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
  }

  function getGeneratedStorageKey(slug) {
    return GENERATED_STORAGE_PREFIX + slug;
  }

  function readGeneratedFromStorage(slug) {
    try {
      if (typeof localStorage === 'undefined') return '';
      return localStorage.getItem(getGeneratedStorageKey(slug)) || '';
    } catch (_error) {
      return '';
    }
  }

  function writeGeneratedToStorage(slug, dataUrl) {
    try {
      if (typeof localStorage === 'undefined' || !dataUrl) return;
      localStorage.setItem(getGeneratedStorageKey(slug), dataUrl);
    } catch (_error) {
      /* localStorage may be unavailable or full - ignore safely */
    }
  }

  function buildTopImagePaths(slug) {
    return LOCAL_IMAGE_ROOTS.map(function(entry) {
      return {
        type: entry.type,
        path: entry.path + slug + '.png'
      };
    });
  }

  function getTopImageFit(type) {
    if (String(type || '').indexOf('generated') >= 0) return 'cover';
    if (String(type || '').indexOf('fallback') >= 0) return 'cover';
    if (type === 'boxart' || type === 'artwork') return 'contain';
    if (type === 'titleScreen' || type === 'gameplay') return 'cover';
    if (type === 'generated') return 'cover';
    return 'contain';
  }

  function loadCachedImage(url, loadImageTag) {
    var cacheKey = normalizeAssetPath(url);
    if (TOP_IMAGE_CACHE[cacheKey]) {
      return TOP_IMAGE_CACHE[cacheKey];
    }
    TOP_IMAGE_CACHE[cacheKey] = loadImageTag(url).catch(function(error) {
      delete TOP_IMAGE_CACHE[cacheKey];
      throw error;
    });
    return TOP_IMAGE_CACHE[cacheKey];
  }

  function tryLoadImageSequence(candidates, index, loadImageTag) {
    if (!candidates || index >= candidates.length) {
      return Promise.reject();
    }

    var candidate = candidates[index];
    return loadCachedImage(candidate.path, loadImageTag)
      .then(function(loaded) {
        loaded.topImageType = candidate.type;
        loaded.topImagePath = candidate.path;
        return loaded;
      })
      .catch(function() {
        return tryLoadImageSequence(candidates, index + 1, loadImageTag);
      });
  }

  function findLocalGenerationSources(game, context, slug, resolvers) {
    var entry = context && context.entry ? context.entry : {};
    var topVisual = entry.top_visual || {};
    var manualArtwork = (resolvers.getManualArtworkEntry && resolvers.getManualArtworkEntry(game.id)) || {};
    var assetLibraryEntry = resolvers.getAssetLibraryEntry && resolvers.getAssetLibraryEntry(game.id);
    var seen = {};
    var sources = [];

    function pushSource(path, type) {
      var normalized = normalizeAssetPath(path);
      if (!isLocalAssetPath(normalized) || seen[normalized]) return;
      seen[normalized] = true;
      sources.push({ path: normalized, type: type || 'source' });
    }

    buildTopImagePaths(slug).slice(0, 4).forEach(function(item) {
      pushSource(item.path, item.type);
    });

    pushSource('assets/generated_gb/' + slug + '.png', 'generated-local');

    [
      manualArtwork.gameSpecificSprite,
      manualArtwork.mainSprite,
      manualArtwork.bossSprite,
      manualArtwork.pixelArt,
      manualArtwork.iconicObject,
      manualArtwork.artwork,
      manualArtwork.src,
      topVisual['3'],
      topVisual.artwork,
      topVisual.top,
      topVisual.keyArt,
      topVisual.key_art,
      entry.titleScreen,
      entry.title_screen,
      entry.boxart,
      entry.box_art,
      entry.screenshot,
      entry.screenshots,
      game.boxart,
      game.box_art,
      game.titleScreen,
      game.title_screen,
      game.screenshot,
      game.screenshots,
      game.artwork
    ].forEach(function(value) {
      if (Array.isArray(value)) {
        value.forEach(function(item) { pushSource(item, 'project'); });
        return;
      }
      pushSource(value, 'project');
    });

    if (assetLibraryEntry && assetLibraryEntry.status === 'ready' && assetLibraryEntry.sprite_path) {
      pushSource(assetLibraryEntry.sprite_path, 'asset-library');
    }

    return sources;
  }

  function normalizeTopImageLoaded(loaded) {
    var type = loaded.topImageType || 'artwork';
    var fit = getTopImageFit(type);
    return {
      src: loaded.src,
      fit: fit,
      position: 'center center',
      ratio: '16:9',
      isSprite: false,
      type: type,
      assetRecord: null,
      width: loaded.width || 0,
      height: loaded.height || 0
    };
  }

  function ensureGeneratedTopImage(game, context, slug, helpers) {
    var stored = readGeneratedFromStorage(slug);
    if (stored) {
      return helpers.loadImageTag(stored).then(function(loaded) {
        loaded.topImageType = 'generated-runtime-cache';
        loaded.topImagePath = stored;
        return loaded;
      });
    }

    var generationSources = findLocalGenerationSources(game, context, slug, helpers);

    function tryGenerate(index) {
      if (index >= generationSources.length) {
        var fallbackDataUrl = helpers.renderFallbackGameBoyIllustration(
          game,
          GB_RENDER_SIZE.width,
          GB_RENDER_SIZE.height
        );
        writeGeneratedToStorage(slug, fallbackDataUrl);
        return helpers.loadImageTag(fallbackDataUrl).then(function(loaded) {
          loaded.topImageType = 'generated-fallback';
          loaded.topImagePath = fallbackDataUrl;
          return loaded;
        });
      }

      var source = generationSources[index];
      return loadCachedImage(source.path, helpers.loadImageTag)
        .then(function(loaded) {
          var dataUrl = helpers.renderLoadedGameBoyIllustration(loaded, source.type);
          writeGeneratedToStorage(slug, dataUrl);
          return helpers.loadImageTag(dataUrl).then(function(generated) {
            generated.topImageType = 'generated-' + source.type;
            generated.topImagePath = dataUrl;
            return generated;
          });
        })
        .catch(function() {
          return tryGenerate(index + 1);
        });
    }

    return tryGenerate(0);
  }

  function resolveTopImage(game, context, helpers) {
    var slug = slugify(game && game.title);
    var localCandidates = buildTopImagePaths(slug);
    context.topImageSlug = slug;
    context.topImagePaths = localCandidates.map(function(item) { return item.path; });

    return tryLoadImageSequence(localCandidates.slice(0, 4), 0, helpers.loadImageTag)
      .catch(function() {
        return ensureGeneratedTopImage(game, context, slug, helpers);
      })
      .catch(function() {
        return loadCachedImage(PLACEHOLDER_TOP_IMAGE, helpers.loadImageTag).then(function(loaded) {
          loaded.topImageType = 'placeholder';
          loaded.topImagePath = PLACEHOLDER_TOP_IMAGE;
          return loaded;
        });
      })
      .then(function(loaded) {
        return normalizeTopImageLoaded(loaded);
      });
  }

  return {
    LOCAL_IMAGE_ROOTS: LOCAL_IMAGE_ROOTS,
    PLACEHOLDER_TOP_IMAGE: PLACEHOLDER_TOP_IMAGE,
    GENERATED_STORAGE_PREFIX: GENERATED_STORAGE_PREFIX,
    GB_RENDER_SIZE: GB_RENDER_SIZE,
    slugify: slugify,
    buildTopImagePaths: buildTopImagePaths,
    readGeneratedFromStorage: readGeneratedFromStorage,
    writeGeneratedToStorage: writeGeneratedToStorage,
    resolveTopImage: resolveTopImage
  };
})();
