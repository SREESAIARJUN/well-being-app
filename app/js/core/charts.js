/* ============================================================
   CHARTS — tiny canvas chart kit (DPR-aware, token-driven).

   Design rules applied (dataviz method): thin marks with rounded
   data-ends, 2px surface gaps between adjacent fills, recessive
   grid, text always in text tokens (labels live in HTML/canvas
   text color, never series color), single hue for magnitude,
   status colors reserved. Module accents validated for CVD
   separation (worst adjacent ΔE 35, protan) + contrast ≥3:1 on
   both surfaces; every multi-hue chart also direct-labels each
   mark, so identity never depends on color alone.
   ============================================================ */

import { Utils } from './utils.js';

function cssVar(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

function prepCanvas(canvas, height) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
  const h = height || canvas.clientHeight || 120;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* shared hover tooltip */
let tip = null;
function showTip(x, y, html) {
  if (!tip) { tip = Utils.el('div', { class: 'chart-tip' }); document.body.appendChild(tip); }
  tip.innerHTML = html;
  tip.style.display = 'block';
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(x + 12, window.innerWidth - r.width - 8) + 'px';
  tip.style.top = Math.max(4, y - r.height - 10) + 'px';
}
function hideTip() { if (tip) tip.style.display = 'none'; }

export const Charts = {
  /**
   * Progress ring inside `host` (.ring). value 0..100.
   * opts: {size=120, thickness=9, label, sub, color, valueText}
   */
  ring(host, { value = 0, size = 120, thickness = 9, label = '', sub = '', color = '', valueText = null } = {}) {
    host.classList.add('ring');
    host.innerHTML = `<canvas></canvas>
      <div class="ring__center">
        <div>
          <div class="ring__value" style="font-size:${Math.round(size * 0.24)}px">${valueText ?? Math.round(value)}</div>
          ${label ? `<div class="ring__label">${Utils.esc(label)}</div>` : ''}
          ${sub ? `<div class="ring__label" style="opacity:.7">${Utils.esc(sub)}</div>` : ''}
        </div>
      </div>`;
    const canvas = host.querySelector('canvas');
    canvas.style.width = size + 'px';
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const accent = color || cssVar('--accent', host) || '#2dd4bf';
    const track = cssVar('--track') || 'rgba(255,255,255,0.08)';
    const cx = size / 2, cy = size / 2, r = (size - thickness) / 2 - 1;
    const start = -Math.PI / 2;
    const frac = Utils.clamp(value, 0, 100) / 100;

    ctx.lineCap = 'round';
    ctx.lineWidth = thickness;
    ctx.strokeStyle = track;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (frac > 0.005) {
      ctx.strokeStyle = accent;
      ctx.shadowColor = accent; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(cx, cy, r, start, start + frac * Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
  },

  /** sparkline: single hue line + soft fill, no axes */
  spark(canvas, values, { color = '', height = 44, fill = true } = {}) {
    const { ctx, w, h } = prepCanvas(canvas, height);
    if (!values.length) return;
    const accent = color || cssVar('--accent', canvas) || '#2dd4bf';
    const max = Math.max(...values, 1), min = Math.min(...values, 0);
    const span = max - min || 1;
    const pad = 3;
    const pts = values.map((v, i) => [
      pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2),
      h - pad - ((v - min) / span) * (h - pad * 2),
    ]);
    if (fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], h);
      pts.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(pts[pts.length - 1][0], h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, accent + '33'); grad.addColorStop(1, accent + '00');
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    const last = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(last[0], last[1], 2.6, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();
  },

  /**
   * Weekly bars: data [{label, value, hint?}], goal line optional.
   * Rounded tops anchored to baseline, 2px gaps, hover tooltip.
   */
  weekBars(canvas, data, { color = '', height = 120, goal = null, unit = '' } = {}) {
    const { ctx, w, h } = prepCanvas(canvas, height);
    if (!data.length) return;
    const accent = color || cssVar('--accent', canvas) || '#2dd4bf';
    const track = cssVar('--track') || 'rgba(255,255,255,0.08)';
    const textDim = cssVar('--text-3') || '#66738c';
    const grid = cssVar('--chart-grid') || 'rgba(255,255,255,0.07)';
    const labelH = 16, topPad = 6;
    const plotH = h - labelH - topPad;
    const max = Math.max(...data.map(d => d.value), goal || 0, 1);
    const slot = w / data.length;
    const barW = Math.min(26, Math.max(8, slot - 8));
    const bars = [];

    // recessive baseline
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, topPad + plotH + 0.5); ctx.lineTo(w, topPad + plotH + 0.5); ctx.stroke();

    data.forEach((d, i) => {
      const x = slot * i + (slot - barW) / 2;
      const bh = Math.max(2, (d.value / max) * plotH);
      const y = topPad + plotH - bh;
      const rad = Math.min(4, barW / 2, bh);
      // track ghost so empty days still read
      ctx.fillStyle = track;
      ctx.beginPath(); ctx.roundRect(x, topPad, barW, plotH, 4); ctx.fill();
      if (d.value > 0) {
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.roundRect(x, y, barW, bh, [rad, rad, 0, 0]); ctx.fill();
      }
      ctx.fillStyle = textDim;
      ctx.font = `600 9.5px ${cssVar('--font-sans') || 'sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, h - 3);
      bars.push({ x, y: topPad, w: barW, h: plotH, d });
    });

    if (goal !== null && goal > 0) {
      const gy = topPad + plotH - (Math.min(goal, max) / max) * plotH;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = textDim; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      ctx.setLineDash([]);
    }

    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const hit = bars.find(b => mx >= b.x - 4 && mx <= b.x + b.w + 4);
      if (hit) showTip(e.clientX, e.clientY,
        `<b>${Utils.esc(String(hit.d.hint ?? hit.d.value))}${unit ? ' ' + unit : ''}</b><span>${Utils.esc(hit.d.label)}</span>`);
      else hideTip();
    };
    canvas.onmouseleave = hideTip;
  },

  /**
   * Day timeline strip: segments [{t:epochMs, mode:'sit'|'stand'}] plus
   * break markers [{ts, kind}], rendered across the work window.
   */
  dayTimeline(canvas, segments, breaks, { height = 34, startMin, endMin } = {}) {
    const { ctx, w, h } = prepCanvas(canvas, height);
    const standC = cssVar('--m-movement') || '#34d399';
    const track = cssVar('--track') || 'rgba(255,255,255,0.08)';
    const eyeC = cssVar('--m-eye') || '#38bdf8';
    const dayStart = new Date(); dayStart.setHours(0, startMin, 0, 0);
    const t0 = dayStart.getTime();
    const spanMs = Math.max(1, (endMin - startMin)) * 60_000;
    const X = ts => Utils.clamp(((ts - t0) / spanMs) * w, 0, w);
    const barY = 8, barH = h - 16;

    ctx.fillStyle = track;
    ctx.beginPath(); ctx.roundRect(0, barY, w, barH, 5); ctx.fill();

    // stand segments (sit stays as track — calm, single-hue magnitude)
    const now = Date.now();
    const segs = [...segments].sort((a, b) => a.t - b.t);
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].mode !== 'stand') continue;
      const from = X(segs[i].t);
      const until = X(i + 1 < segs.length ? segs[i + 1].t : Math.min(now, t0 + spanMs));
      if (until - from < 1) continue;
      ctx.fillStyle = standC;
      ctx.beginPath(); ctx.roundRect(from, barY, Math.max(2, until - from), barH, 3); ctx.fill();
    }

    // break ticks
    for (const b of breaks || []) {
      if (b.action !== 'done') continue;
      const x = X(b.ts);
      ctx.fillStyle = b.kind === 'eye' ? eyeC : cssVar('--text-2') || '#a9b4c8';
      ctx.beginPath(); ctx.roundRect(x - 1.25, barY - 4, 2.5, barH + 8, 2); ctx.fill();
    }

    // "now" cursor
    if (now >= t0 && now <= t0 + spanMs) {
      const x = X(now);
      ctx.fillStyle = cssVar('--text-1') || '#fff';
      ctx.beginPath(); ctx.arc(x, barY + barH / 2, 3, 0, Math.PI * 2); ctx.fill();
    }
  },

  /**
   * Multi-line trend: series [{name, color, values:[...]}] over shared
   * x labels. Crosshair hover with per-series values. Caller renders the
   * HTML legend (identity never color-alone).
   */
  lines(canvas, series, labels, { height = 150, max: forcedMax = null } = {}) {
    const { ctx, w, h } = prepCanvas(canvas, height);
    if (!series.length || !labels.length) return;
    const textDim = cssVar('--text-3') || '#66738c';
    const grid = cssVar('--chart-grid') || 'rgba(255,255,255,0.07)';
    const labelH = 16, topPad = 8, pad = 4;
    const plotH = h - labelH - topPad;
    const all = series.flatMap(s => s.values).filter(v => v !== null && v !== undefined);
    const max = forcedMax ?? Math.max(...all, 1);
    const X = i => pad + (i / Math.max(1, labels.length - 1)) * (w - pad * 2);
    const Y = v => topPad + plotH - (Utils.clamp(v, 0, max) / max) * plotH;

    for (const frac of [0, 0.5, 1]) {
      const y = topPad + plotH * frac + 0.5;
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.fillStyle = textDim;
    ctx.font = `600 9.5px ${cssVar('--font-sans') || 'sans-serif'}`;
    ctx.textAlign = 'center';
    const step = Math.ceil(labels.length / 8);
    labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l, X(i), h - 3); });

    for (const s of series) {
      ctx.beginPath();
      let started = false;
      s.values.forEach((v, i) => {
        if (v === null || v === undefined) { started = false; return; }
        if (!started) { ctx.moveTo(X(i), Y(v)); started = true; }
        else ctx.lineTo(X(i), Y(v));
      });
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.stroke();
      // point markers — without these an isolated value (e.g. a user's very
      // first check-in) draws nothing at all
      ctx.fillStyle = s.color;
      s.values.forEach((v, i) => {
        if (v === null || v === undefined) return;
        ctx.beginPath(); ctx.arc(X(i), Y(v), 2.6, 0, Math.PI * 2); ctx.fill();
      });
    }

    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let idx = Math.round(((mx - pad) / (w - pad * 2)) * (labels.length - 1));
      idx = Utils.clamp(idx, 0, labels.length - 1);
      const rows = series
        .filter(s => s.values[idx] !== null && s.values[idx] !== undefined)
        .map(s => `<span><i style="background:${s.color}"></i>${Utils.esc(s.name)}: <b>${Math.round(s.values[idx])}</b></span>`)
        .join('');
      if (rows) showTip(e.clientX, e.clientY, `<b>${Utils.esc(labels[idx])}</b>${rows}`);
      else hideTip();
    };
    canvas.onmouseleave = hideTip;
  },
};
