/* ============================================================
   CHARTS — Pure Canvas Chart Library
   ============================================================ */

const Charts = (() => {
  const COLORS = {
    cyan:   'hsl(175, 80%, 48%)',
    teal:   'hsl(168, 65%, 42%)',
    violet: 'hsl(265, 70%, 65%)',
    amber:  'hsl(38, 92%, 58%)',
    rose:   'hsl(350, 75%, 60%)',
    green:  'hsl(145, 65%, 48%)',
    blue:   'hsl(215, 85%, 60%)',
    gray:   'hsl(215, 15%, 30%)',
  };

  const ALPHA_COLORS = {
    cyan:   'hsla(175, 80%, 48%, 0.15)',
    violet: 'hsla(265, 70%, 65%, 0.15)',
    amber:  'hsla(38, 92%, 58%, 0.15)',
    green:  'hsla(145, 65%, 48%, 0.15)',
    rose:   'hsla(350, 75%, 60%, 0.15)',
    blue:   'hsla(215, 85%, 60%, 0.15)',
  };

  function createCanvas(container, width, height) {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    container.innerHTML = '';
    container.appendChild(canvas);
    return { canvas, ctx, width, height };
  }

  /**
   * Draw a sparkline (mini line chart)
   * @param {HTMLElement} container
   * @param {number[]} data
   * @param {string} color - key from COLORS
   * @param {Object} opts
   */
  function sparkline(container, data, color = 'cyan', opts = {}) {
    const w = opts.width || container.clientWidth || 120;
    const h = opts.height || 40;
    const { ctx, width, height } = createCanvas(container, w, h);
    if (!data || data.length < 2) return;

    const padding = 4;
    const maxVal = Math.max(...data, 1);
    const minVal = Math.min(...data, 0);
    const range = maxVal - minVal || 1;
    const stepX = (width - padding * 2) / (data.length - 1);

    const points = data.map((v, i) => ({
      x: padding + i * stepX,
      y: padding + (1 - (v - minVal) / range) * (height - padding * 2)
    }));

    // Area fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = ALPHA_COLORS[color] || ALPHA_COLORS.cyan;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = COLORS[color] || COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // End dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[color] || COLORS.cyan;
    ctx.fill();
  }

  /**
   * Draw a bar chart
   */
  function barChart(container, labels, datasets, opts = {}) {
    const w = opts.width || container.clientWidth || 400;
    const h = opts.height || 200;
    const { ctx, width, height } = createCanvas(container, w, h);

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find max value across all datasets
    let maxVal = 0;
    datasets.forEach(ds => {
      ds.data.forEach(v => { if (v > maxVal) maxVal = v; });
    });
    maxVal = maxVal || 1;

    const barGroupWidth = chartW / labels.length;
    const barWidth = Math.min(barGroupWidth * 0.6 / datasets.length, 24);
    const groupGap = barGroupWidth - barWidth * datasets.length;

    // Y-axis grid lines
    ctx.strokeStyle = 'hsla(215, 15%, 30%, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y labels
      const val = Math.round(maxVal * (1 - i / 4));
      ctx.fillStyle = 'hsl(215, 15%, 42%)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val, padding.left - 8, y + 4);
    }
    ctx.setLineDash([]);

    // Bars
    datasets.forEach((ds, dsIdx) => {
      const barColor = COLORS[ds.color] || COLORS.cyan;
      ds.data.forEach((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = padding.left + i * barGroupWidth + groupGap / 2 + dsIdx * barWidth;
        const y = padding.top + chartH - barH;

        // Rounded rect
        const r = Math.min(4, barWidth / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barWidth - r, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
        ctx.lineTo(x + barWidth, padding.top + chartH);
        ctx.lineTo(x, padding.top + chartH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = barColor;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    });

    // X-axis labels
    ctx.fillStyle = 'hsl(215, 15%, 42%)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      const x = padding.left + i * barGroupWidth + barGroupWidth / 2;
      ctx.fillText(label, x, height - padding.bottom + 20);
    });
  }

  /**
   * Draw a donut chart
   */
  function donut(container, segments, opts = {}) {
    const size = opts.size || 160;
    const { ctx, width, height } = createCanvas(container, size, size);

    const cx = width / 2;
    const cy = height / 2;
    const radius = size / 2 - 10;
    const lineWidth = opts.thickness || 16;
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

    let startAngle = -Math.PI / 2;

    segments.forEach(seg => {
      const sweep = (seg.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
      ctx.strokeStyle = COLORS[seg.color] || seg.color || COLORS.cyan;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
      startAngle += sweep + 0.04; // small gap
    });

    // Center text
    if (opts.centerText) {
      ctx.fillStyle = 'hsl(210, 20%, 92%)';
      ctx.font = `bold ${size / 5}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.centerText, cx, cy - 4);
    }
    if (opts.centerSubtext) {
      ctx.fillStyle = 'hsl(215, 12%, 42%)';
      ctx.font = `${size / 10}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(opts.centerSubtext, cx, cy + size / 6);
    }
  }

  /**
   * Draw a radial gauge (for health score)
   */
  function gauge(container, value, max = 100, opts = {}) {
    const size = opts.size || 180;
    const { ctx, width, height } = createCanvas(container, size, size);

    const cx = width / 2;
    const cy = height / 2;
    const radius = size / 2 - 16;
    const lineWidth = opts.thickness || 12;
    const pct = Utils.clamp(value / max, 0, 1);

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsl(225, 22%, 14%)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Progress arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + pct * Math.PI * 2;

    // Gradient for the progress
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const color = opts.color || 'cyan';
    if (color === 'cyan') {
      gradient.addColorStop(0, COLORS.cyan);
      gradient.addColorStop(1, COLORS.teal);
    } else if (color === 'violet') {
      gradient.addColorStop(0, COLORS.violet);
      gradient.addColorStop(1, COLORS.blue);
    } else {
      gradient.addColorStop(0, COLORS[color] || COLORS.cyan);
      gradient.addColorStop(1, COLORS[color] || COLORS.cyan);
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center text
    ctx.fillStyle = 'hsl(210, 20%, 92%)';
    ctx.font = `bold ${size / 4}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(value), cx, cy - 6);

    // Label
    ctx.fillStyle = 'hsl(215, 12%, 42%)';
    ctx.font = `500 ${size / 14}px Inter, sans-serif`;
    ctx.fillText(opts.label || 'SCORE', cx, cy + size / 5);
  }

  /**
   * Draw a line chart with multiple datasets
   */
  function lineChart(container, labels, datasets, opts = {}) {
    const w = opts.width || container.clientWidth || 400;
    const h = opts.height || 200;
    const { ctx, width, height } = createCanvas(container, w, h);

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    let maxVal = 0;
    datasets.forEach(ds => {
      ds.data.forEach(v => { if (v > maxVal) maxVal = v; });
    });
    maxVal = maxVal || 1;

    // Grid
    ctx.strokeStyle = 'hsla(215, 15%, 30%, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw each dataset
    datasets.forEach(ds => {
      const color = COLORS[ds.color] || COLORS.cyan;
      const alphaColor = ALPHA_COLORS[ds.color] || ALPHA_COLORS.cyan;
      const stepX = chartW / Math.max(ds.data.length - 1, 1);

      const points = ds.data.map((v, i) => ({
        x: padding.left + i * stepX,
        y: padding.top + (1 - v / maxVal) * chartH
      }));

      // Area
      if (opts.fill !== false) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartH);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
        ctx.closePath();
        ctx.fillStyle = alphaColor;
        ctx.fill();
      }

      // Line
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Dots
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    });

    // X labels
    ctx.fillStyle = 'hsl(215, 15%, 42%)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const stepX = chartW / Math.max(labels.length - 1, 1);
    labels.forEach((label, i) => {
      ctx.fillText(label, padding.left + i * stepX, height - padding.bottom + 20);
    });
  }

  return { sparkline, barChart, donut, gauge, lineChart, COLORS, ALPHA_COLORS, createCanvas };
})();
