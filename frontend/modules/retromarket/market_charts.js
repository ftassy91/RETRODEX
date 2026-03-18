const RETROMARKET_CHARTS = (() => {
  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.round(rect.width || 0));
    const height = Math.max(180, Math.round(rect.height || 0));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height };
  }

  function drawFrame(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#07140f';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(181,209,166,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    ctx.strokeStyle = 'rgba(181,209,166,0.08)';
    for (let i = 1; i < 5; i += 1) {
      const y = Math.round((height / 5) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }
  }

  function drawUnavailable(canvas, message) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = fitCanvas(canvas);
    drawFrame(ctx, width, height);
    ctx.fillStyle = '#8bac0f';
    ctx.font = '18px VT323';
    ctx.textAlign = 'center';
    ctx.fillText('10 YEAR TREND', width / 2, 38);
    ctx.fillStyle = 'rgba(230,242,216,0.7)';
    ctx.font = '16px VT323';
    wrapText(ctx, message || 'data unavailable', width / 2, height / 2 - 18, width - 40, 18);
    ctx.fillStyle = 'rgba(139,172,15,0.78)';
    ctx.font = '15px VT323';
    ctx.fillText('waiting for verified yearly history', width / 2, height - 18);
  }

  function wrapText(ctx, text, x, startY, maxWidth, lineHeight) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let y = startY;
    words.forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        line = word;
      } else {
        line = test;
      }
    });
    if (line) ctx.fillText(line, x, y);
  }

  function drawLineChart(canvas, history) {
    if (!canvas) return;
    if (!history || !history.points || !history.points.length) {
      drawUnavailable(canvas, history && history.message);
      return;
    }

    const ctx = canvas.getContext('2d');
    const { width, height } = fitCanvas(canvas);
    drawFrame(ctx, width, height);

    const padding = { top: 26, right: 18, bottom: 28, left: 34 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const values = history.points.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const coords = history.points.map((point, index) => ({
      x: padding.left + (chartWidth * index / Math.max(1, history.points.length - 1)),
      y: padding.top + chartHeight - (((point.value - min) / span) * chartHeight)
    }));

    ctx.beginPath();
    coords.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(coords[coords.length - 1].x, padding.top + chartHeight);
    ctx.lineTo(coords[0].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = 'rgba(139,172,15,0.14)';
    ctx.fill();

    ctx.strokeStyle = '#8bac0f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    coords.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    ctx.fillStyle = '#e6f2d8';
    coords.forEach((point, index) => {
      const radius = index === coords.length - 1 ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#e6f2d8';
    ctx.font = '16px VT323';
    ctx.textAlign = 'left';
    ctx.fillText(String(history.points[0].year), padding.left, height - 8);
    ctx.textAlign = 'right';
    ctx.fillText(String(history.points[history.points.length - 1].year), width - padding.right, height - 8);
    ctx.textAlign = 'left';
    ctx.fillText('$' + Math.round(max), 8, padding.top + 6);
    ctx.fillText('$' + Math.round(min), 8, padding.top + chartHeight);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8bac0f';
    ctx.fillText('LATEST ' + '$' + Math.round(history.points[history.points.length - 1].value), width - 10, 16);
  }

  return {
    drawPriceHistory(canvas, history) {
      drawLineChart(canvas, history);
    }
  };
})();
