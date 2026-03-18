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
  const GB_PALETTE = [
    { hex: _P.dark, rgb: [15, 56, 15] },
    { hex: _P.mid, rgb: [48, 98, 48] },
    { hex: _P.light, rgb: [139, 172, 15] },
    { hex: _P.bright, rgb: [155, 188, 15] }
  ];

  function createGbCanvas(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function drawSourceToGbCanvas(ctx, image, sourceType, width, height) {
    ctx.fillStyle = GB_PALETTE[3].hex;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = GB_PALETTE[2].hex;
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

  function quantizeCanvasToGameBoy(canvas) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var imageData = ctx.getImageData(0, 0, width, height);
    var data = imageData.data;

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
      var palette = GB_PALETTE[paletteIndex].rgb;

      data[index] = palette[0];
      data[index + 1] = palette[1];
      data[index + 2] = palette[2];
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function applyLCDFinish(canvas) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    if (!ctx || !width || !height) return;

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = GB_PALETTE[0].hex;
    for (var y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1);
    ctx.globalAlpha = 0.05;
    for (var x = 1; x < width; x += 4) ctx.fillRect(x, 0, 1, height);
    ctx.restore();
  }

  function generateGBSprite(options) {
    var width = options.width;
    var height = options.height;
    var canvas = createGbCanvas(width, height);
    var ctx = canvas.getContext('2d');

    if (options.image) {
      drawSourceToGbCanvas(ctx, options.image, options.sourceType, width, height);
    } else if (typeof options.drawFallback === 'function') {
      options.drawFallback(ctx, width, height, options.game);
    } else {
      return '';
    }

    quantizeCanvasToGameBoy(canvas);
    applyLCDFinish(canvas);
    return canvas.toDataURL('image/png');
  }

  return {
    GB_PALETTE: GB_PALETTE,
    applyLCDFinish: applyLCDFinish,
    generateGBSprite: generateGBSprite
  };
})();
