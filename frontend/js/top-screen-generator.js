const TOP_SCREEN_GENERATOR = (() => {
  const _P = (typeof globalThis !== 'undefined' && globalThis.RDX_PALETTE)
    ? globalThis.RDX_PALETTE
    : { dark: '#0F380F', mid: '#306230', light: '#8BAC0F', bright: '#9BBC0F' };
  const GB_DITHER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  const DEFAULT_PALETTE_HEX = [_P.dark, _P.mid, _P.light, _P.bright];

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h);
  }

  function seededRand(seed, n) {
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) | 0;
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) | 0;
    return ((seed ^ (seed >>> 16)) >>> 0) % n;
  }

  function hexToRgb(hex) {
    var normalized = String(hex || '').replace('#', '');
    return [
      parseInt(normalized.slice(0, 2), 16) || 0,
      parseInt(normalized.slice(2, 4), 16) || 0,
      parseInt(normalized.slice(4, 6), 16) || 0
    ];
  }

  function buildPaletteData(colors) {
    return (colors || DEFAULT_PALETTE_HEX).map(function(color) {
      return {
        hex: color,
        rgb: hexToRgb(color)
      };
    });
  }

  const GB_PALETTE = buildPaletteData(DEFAULT_PALETTE_HEX);

  function getConsolePalette(consoleName) {
    var name = String(consoleName || '').toLowerCase();

    if (name.indexOf('famicom') >= 0 || name === 'nes' || name.indexOf('nintendo entertainment system') >= 0) {
      return ['#1a1a2e', '#16213e', '#0f3460', '#e94560'];
    }
    if (name.indexOf('snes') >= 0 || name.indexOf('super nintendo') >= 0) {
      return ['#0d0d0d', '#1a3a1a', '#2d6a2d', '#7abf7a'];
    }
    if (name.indexOf('game boy advance') >= 0 || name.indexOf('gba') >= 0) {
      return ['#05051a', '#0f1a3d', '#1a3d8b', '#44aadd'];
    }
    if (name.indexOf('game boy color') >= 0 || name.indexOf('gb color') >= 0 || name === 'game boy' || name.indexOf('game boy') >= 0) {
      return ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
    }
    if (name.indexOf('sega genesis') >= 0 || name.indexOf('mega drive') >= 0) {
      return ['#1a0a2e', '#2d1654', '#6a3fa0', '#c48be8'];
    }
    if (name.indexOf('sega saturn') >= 0 || name.indexOf('saturn') >= 0) {
      return ['#1a0505', '#3d0f0f', '#8b1a1a', '#e85555'];
    }
    if (name.indexOf('playstation') >= 0 || name === 'ps1' || name.indexOf('ps one') >= 0) {
      return ['#050520', '#0f0f45', '#1a1a8b', '#4444dd'];
    }
    if (name.indexOf('nintendo 64') >= 0 || name.indexOf('n64') >= 0) {
      return ['#1a1a05', '#3d3d0f', '#8b7a00', '#ddc420'];
    }
    if (name.indexOf('nintendo ds') >= 0 || name === 'nds' || name.indexOf('ds') >= 0) {
      return ['#05051a', '#0f1a3d', '#2a5a9b', '#7ab4e8'];
    }
    if (name.indexOf('dreamcast') >= 0) {
      return ['#05101a', '#0f2535', '#1a558b', '#55aae8'];
    }

    return DEFAULT_PALETTE_HEX.slice();
  }

  function createGbCanvas(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function getPaletteData(palette) {
    if (Array.isArray(palette) && palette.length && palette[0] && Array.isArray(palette[0].rgb)) {
      return palette;
    }
    return buildPaletteData(palette || DEFAULT_PALETTE_HEX);
  }

  function getSeedValue(seed, salt, max) {
    return seededRand((seed + Math.imul(salt + 1, 1103515245)) | 0, max);
  }

  function getRangeValue(seed, salt, min, max) {
    return min + getSeedValue(seed, salt, (max - min) + 1);
  }

  function drawSourceToGbCanvas(ctx, image, sourceType, width, height, paletteData) {
    paletteData = getPaletteData(paletteData);
    ctx.fillStyle = paletteData[3].hex;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = paletteData[2].hex;
    ctx.fillRect(6, 6, width - 12, height - 12);

    var imgW = image && (image.naturalWidth || image.width) ? (image.naturalWidth || image.width) : width;
    var imgH = image && (image.naturalHeight || image.height) ? (image.naturalHeight || image.height) : height;
    var cropX = 0;
    var cropY = 0;
    var cropW = imgW;
    var cropH = imgH;
    var isWideGeneratedCard = sourceType === 'generated-local' && (imgW / Math.max(1, imgH)) > 1.55;

    if (isWideGeneratedCard) {
      cropX = Math.round(imgW * 0.055);
      cropY = Math.round(imgH * 0.10);
      cropW = Math.round(imgW * 0.89);
      cropH = Math.round(imgH * 0.60);
    }

    var scale = Math.max((width - 18) / cropW, (height - 18) / cropH);
    var fitContain = sourceType === 'boxart' || sourceType === 'artwork' || sourceType === 'asset-library';
    if (sourceType === 'generated-local' && !isWideGeneratedCard) {
      fitContain = true;
    }
    if (fitContain) {
      scale = Math.min((width - 20) / cropW, (height - 20) / cropH);
    }
    scale = Math.max(scale, 0.1);

    var drawW = Math.max(1, Math.round(cropW * scale));
    var drawH = Math.max(1, Math.round(cropH * scale));
    var drawX = Math.round((width - drawW) / 2);
    var drawY = Math.round((height - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, cropX, cropY, cropW, cropH, drawX, drawY, drawW, drawH);
  }

  function drawTitleCard(ctx, width, height, colors, seed) {
    var frameW = Math.round(width * 0.6);
    var frameH = Math.round(height * 0.4);
    var frameX = Math.round((width - frameW) / 2);
    var frameY = Math.round((height - frameH) / 2) - 10;

    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colors[1];
    ctx.fillRect(frameX, frameY, frameW, frameH);
    ctx.fillStyle = colors[3];
    [
      [8, 8],
      [width - 12, 8],
      [8, height - 28],
      [width - 12, height - 28]
    ].forEach(function(point) {
      ctx.fillRect(point[0], point[1], 4, 4);
      ctx.fillRect(point[0] - 6, point[1], 4, 4);
      ctx.fillRect(point[0], point[1] + 6, 4, 4);
    });

    ctx.fillStyle = colors[2];
    for (var row = 0; row < 3; row += 1) {
      var blocks = getRangeValue(seed, row, 6, 11);
      var startX = frameX + 16 + getSeedValue(seed, row + 20, 18);
      var startY = frameY + 16 + (row * 16);
      for (var col = 0; col < blocks; col += 1) {
        if (getSeedValue(seed, row * 20 + col + 80, 5) === 0) continue;
        ctx.fillRect(startX + (col * 10), startY, 7, 5);
      }
    }
  }

  function drawScanlineGrid(ctx, width, height, colors) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = colors[1];
    for (var y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.restore();

    var radius = Math.round(height * 0.3);
    var centerX = Math.round(width / 2);
    var centerY = Math.round(height * 0.45);
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(6, radius - 12), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPixelTerrain(ctx, width, height, colors, seed, detailSeed) {
    var horizon = Math.round(height * 0.4);
    ctx.fillStyle = colors[1];
    ctx.fillRect(0, 0, width, horizon);
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, horizon, width, height - horizon);

    var bumpCount = getRangeValue(detailSeed, 4, 5, 8);
    ctx.fillStyle = colors[2];
    for (var i = 0; i < bumpCount; i += 1) {
      var bumpWidth = getRangeValue(seed, 40 + i, 26, 60);
      var bumpHeight = getRangeValue(detailSeed, 60 + i, 14, 42);
      var bumpX = getSeedValue(seed, 90 + i, Math.max(1, width - bumpWidth));
      ctx.fillRect(bumpX, height - bumpHeight - 20, bumpWidth, bumpHeight);
    }

    ctx.fillStyle = colors[3];
    ctx.fillRect(width - 28, 14, 8, 8);
    ctx.fillRect(width - 24, 10, 8, 8);
    ctx.fillRect(width - 20, 14, 8, 8);
    ctx.fillRect(width - 24, 18, 8, 8);
  }

  function drawSpriteFrame(ctx, width, height, colors, seed, detailSeed) {
    var block = 16;
    var originX = Math.round((width - (block * 5)) / 2);
    var originY = Math.round((height - (block * 5)) / 2) - 8;
    var isDiamond = getSeedValue(detailSeed, 7, 2) === 0;
    var coordinates = isDiamond
      ? [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [2, 4]]
      : [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [2, 4], [1, 1], [3, 1], [1, 3], [3, 3]];

    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);

    coordinates.forEach(function(point, index) {
      ctx.fillStyle = (index + getSeedValue(seed, index + 120, 2)) % 2 === 0 ? colors[2] : colors[3];
      ctx.fillRect(originX + (point[0] * block), originY + (point[1] * block), block - 2, block - 2);
    });

    ctx.fillStyle = colors[1];
    ctx.fillRect(34, height - 34, width - 68, 12);
    ctx.fillStyle = colors[3];
    ctx.fillRect(38, height - 31, Math.round((width - 76) * (0.35 + (getSeedValue(detailSeed, 160, 50) / 100))), 6);
  }

  function drawMapView(ctx, width, height, colors, seed, detailSeed) {
    var cellW = Math.floor((width - 32) / 8);
    var cellH = Math.floor((height - 48) / 6);
    var originX = 16;
    var originY = 16;
    var paletteIndexes = [0, 1, 2];

    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);

    for (var row = 0; row < 6; row += 1) {
      for (var col = 0; col < 8; col += 1) {
        var tone = paletteIndexes[getSeedValue(seed, (row * 8) + col + 200, paletteIndexes.length)];
        ctx.fillStyle = colors[tone];
        ctx.fillRect(originX + (col * cellW), originY + (row * cellH), cellW - 2, cellH - 2);
      }
    }

    var cursorCol = getSeedValue(detailSeed, 260, 8);
    var cursorRow = getSeedValue(detailSeed, 261, 6);
    ctx.strokeStyle = colors[3];
    ctx.lineWidth = 2;
    ctx.strokeRect(originX + (cursorCol * cellW), originY + (cursorRow * cellH), cellW - 2, cellH - 2);
  }

  function drawBossFrame(ctx, width, height, colors, seed, detailSeed) {
    var frameW = Math.round(width * 0.7);
    var frameH = Math.round(height * 0.7);
    var frameX = Math.round((width - frameW) / 2);
    var frameY = Math.round((height - frameH) / 2) - 8;

    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = colors[3];
    ctx.fillRect(frameX, frameY, frameW, 2);
    ctx.fillRect(frameX, frameY + frameH - 2, frameW, 2);
    ctx.fillRect(frameX, frameY, 2, frameH);
    ctx.fillRect(frameX + frameW - 2, frameY, 2, frameH);

    ctx.fillStyle = colors[1];
    ctx.fillRect(frameX + 18, frameY + 18, frameW - 36, frameH - 36);

    var eyeOffset = getRangeValue(seed, 320, 14, 26);
    var eyeY = frameY + Math.round(frameH * 0.28);
    var mouthWidth = Math.round(frameW * (0.18 + (getSeedValue(detailSeed, 321, 9) / 100)));
    ctx.fillStyle = colors[3];
    ctx.fillRect(frameX + Math.round(frameW * 0.28), eyeY, eyeOffset, eyeOffset);
    ctx.fillRect(frameX + Math.round(frameW * 0.62) - eyeOffset, eyeY, eyeOffset, eyeOffset);
    ctx.fillRect(Math.round((width - mouthWidth) / 2), frameY + Math.round(frameH * 0.62), mouthWidth, 8);

    ctx.fillStyle = colors[1];
    ctx.fillRect(40, height - 30, width - 80, 10);
    ctx.fillStyle = colors[2];
    ctx.fillRect(44, height - 27, Math.round((width - 88) * (0.45 + (getSeedValue(seed, 322, 45) / 100))), 4);
  }

  function drawTitleOverlay(ctx, width, height, colors, game) {
    if (!game || !game.title) return;

    var title = String(game.title).slice(0, 12);
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, height - 16, width, 16);
    ctx.restore();

    ctx.fillStyle = colors[3];
    ctx.font = '10px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 8, height - 8);
  }

  function drawGeneratedComposition(ctx, width, height, game, paletteHex, seed, detailSeed) {
    var styleIndex = seededRand(seed, 6);
    switch (styleIndex) {
      case 0:
        drawTitleCard(ctx, width, height, paletteHex, seed);
        break;
      case 1:
        drawScanlineGrid(ctx, width, height, paletteHex);
        break;
      case 2:
        drawPixelTerrain(ctx, width, height, paletteHex, seed, detailSeed);
        break;
      case 3:
        drawSpriteFrame(ctx, width, height, paletteHex, seed, detailSeed);
        break;
      case 4:
        drawMapView(ctx, width, height, paletteHex, seed, detailSeed);
        break;
      default:
        drawBossFrame(ctx, width, height, paletteHex, seed, detailSeed);
        break;
    }

    drawTitleOverlay(ctx, width, height, paletteHex, game);
  }

  function quantizeCanvasToGameBoy(canvas, palette) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var imageData = ctx.getImageData(0, 0, width, height);
    var data = imageData.data;
    var paletteData = getPaletteData(palette);

    for (var index = 0; index < data.length; index += 4) {
      var alpha = data[index + 3];
      if (alpha < 16) continue;

      var pixelIndex = index / 4;
      var x = pixelIndex % width;
      var y = Math.floor(pixelIndex / width);
      var gray = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
      var threshold = (GB_DITHER[y % 4][x % 4] - 7.5) * 4;
      var adjusted = Math.max(0, Math.min(255, gray + threshold));
      var paletteIndex = Math.max(0, Math.min(3, Math.round((adjusted / 255) * 3)));
      var paletteColor = paletteData[paletteIndex].rgb;

      data[index] = paletteColor[0];
      data[index + 1] = paletteColor[1];
      data[index + 2] = paletteColor[2];
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function applyLCDFinish(canvas, palette) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var paletteData = getPaletteData(palette);
    if (!ctx || !width || !height) return;

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = paletteData[0].hex;
    for (var y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.globalAlpha = 0.05;
    for (var x = 1; x < width; x += 4) {
      ctx.fillRect(x, 0, 1, height);
    }
    ctx.restore();
  }

  function generateGBSprite(options) {
    var width = options.width;
    var height = options.height;
    var canvas = createGbCanvas(width, height);
    var ctx = canvas.getContext('2d');
    var game = options.game || {};
    var paletteHex = getConsolePalette(game.console);
    var paletteData = buildPaletteData(paletteHex);
    var seed = hashStr(game.id || game.title || '');
    var detailSeed = hashStr([
      game.genre || '',
      game.rarity || '',
      game.year || '',
      game.developer || ''
    ].join('|'));

    if (options.image) {
      drawSourceToGbCanvas(ctx, options.image, options.sourceType, width, height, paletteData);
    } else if (game && (game.id || game.title)) {
      drawGeneratedComposition(ctx, width, height, game, paletteHex, seed, detailSeed);
    } else if (typeof options.drawFallback === 'function') {
      options.drawFallback(ctx, width, height, game);
    } else {
      return '';
    }

    quantizeCanvasToGameBoy(canvas, paletteData);
    applyLCDFinish(canvas, paletteData);
    return canvas.toDataURL('image/png');
  }

  return {
    GB_PALETTE: GB_PALETTE,
    applyLCDFinish: applyLCDFinish,
    generateGBSprite: generateGBSprite,
    getConsolePalette: getConsolePalette,
    hashStr: hashStr,
    quantizeCanvasToGameBoy: quantizeCanvasToGameBoy,
    seededRand: seededRand
  };
})();
