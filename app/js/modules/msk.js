/* ============================================================
   POSTURE & BODY (MSK) — discomfort check-ins, targeted relief,
   posture resets, ergonomic guidance, discomfort trend.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Charts } from '../core/charts.js';
import { Notify } from '../core/notify.js';
import { Breaks } from '../breaks.js';

const AREAS = [
  { key: 'neck', label: 'Neck' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'upperBack', label: 'Upper back' },
  { key: 'lowerBack', label: 'Lower back' },
  { key: 'wrists', label: 'Wrists' },
];

const RELIEF = {
  neck: 'Slow neck rotations and gentle chin tucks — hold each for a few breaths.',
  shoulders: 'Backward shoulder rolls and a doorway chest stretch to open things up.',
  upperBack: 'Thoracic extension over the back of your chair, eyes to the ceiling.',
  lowerBack: 'Seated spinal twists and a few slow stand-ups using a hip hinge.',
  wrists: 'Wrist flexor/extensor stretches and fist-to-fan finger spreads.',
};

const SERIES_TOKENS = ['--m-eye', '--m-movement', '--m-msk', '--m-mental', '--m-focus'];

let container = null;
let unsub = [];

function cssVal(token) { return getComputedStyle(document.documentElement).getPropertyValue(token).trim(); }

function latestToday() {
  const c = Store.today().msk.checkins;
  return c.length ? c[c.length - 1] : null;
}

function weekAverages() {
  // returns { area: avgOfLastCheckinsAcrossDays } over past 6 + today
  const days = [...Utils.pastDateKeys(6), Utils.dateKey()];
  const sums = {}, counts = {};
  for (const date of days) {
    const data = Store.day(date);
    const c = data?.msk.checkins;
    if (!c || !c.length) continue;
    const last = c[c.length - 1];
    for (const a of AREAS) {
      sums[a.key] = (sums[a.key] || 0) + last.areas[a.key];
      counts[a.key] = (counts[a.key] || 0) + 1;
    }
  }
  const out = {};
  for (const a of AREAS) out[a.key] = counts[a.key] ? sums[a.key] / counts[a.key] : null;
  return out;
}

function render(el) {
  container = el;
  const d = Store.today();
  const last = latestToday();
  const seed = last ? last.areas : { neck: 0, shoulders: 0, upperBack: 0, lowerBack: 0, wrists: 0 };
  const averages = weekAverages();

  const worst = last
    ? Object.entries(last.areas).filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2)
    : [];

  // ergonomic guidance selection
  let ergo;
  if ((averages.wrists ?? 0) >= 4) {
    ergo = { title: 'Consider your wrist setup', body: 'Recurring wrist discomfort responds well to ergonomic peripherals — a split/tented keyboard and a vertical mouse keep the wrists more neutral. Studies of computer operators show ergonomic adjustments meaningfully reduce symptoms.' };
  } else if ((averages.neck ?? 0) >= 4) {
    ergo = { title: 'Raise your screen', body: 'Ongoing neck strain usually means the screen is too low. A monitor riser or laptop stand that puts the top of the screen at eye level takes the load off your neck. Ergonomic adjustments are proven to cut musculoskeletal symptoms.' };
  } else {
    ergo = { title: 'Ergonomics basics', list: [
      'Elbows near your body, forearms roughly parallel to the floor',
      'Screen an arm\'s length away, top at eye level',
      'Feet flat, thighs parallel to the floor',
      'Change posture often — the best position is your next one',
    ] };
  }

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('spine', 20)}</div>
          <div>
            <h1>Posture &amp; Body</h1>
            <div class="page-head__sub">Track discomfort · get targeted relief</div>
          </div>
        </div>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--secondary" data-break="posture">${Utils.icon('spine', 15)} Posture reset</button>
      </div>
    </div>

    <div class="card card--pad">
      <div class="card__title">${Utils.icon('edit', 16)} Discomfort check-in</div>
      <div class="card__sub">Rate each area 0 (fine) to 10 (very sore) ${last ? `· last saved ${Utils.fmtTime(last.ts)}` : ''}</div>
      <div class="msk-sliders">
        ${AREAS.map(a => `
          <div class="msk-slider">
            <div class="msk-slider__head"><span>${Utils.esc(a.label)}</span><b data-val="${a.key}">${seed[a.key]}</b></div>
            <input type="range" class="slider" min="0" max="10" step="1" value="${seed[a.key]}" data-area="${a.key}">
          </div>`).join('')}
      </div>
      <div class="row row--between mt-4">
        <div class="stat"><div class="stat__value">${d.msk.postureChecks}</div><div class="stat__label">posture resets today</div></div>
        <button class="btn btn--primary" data-save>${Utils.icon('check', 15)} Save check-in</button>
      </div>
    </div>

    <div class="section-title">Targeted relief</div>
    <div class="card card--pad">
      ${worst.length ? `
        <div class="card__sub" style="margin-bottom:var(--sp-3)">Based on your latest check-in</div>
        <div class="list">
          ${worst.map(([key, v]) => `
            <div class="list__item">
              <div class="list__icon">${Utils.icon('spine', 15)}</div>
              <div class="list__body">
                <div class="list__title">${Utils.esc(AREAS.find(a => a.key === key).label)} · ${v}/10</div>
                <div class="list__sub">${Utils.esc(RELIEF[key])}</div>
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn--secondary btn--block mt-4" data-break="stretch">${Utils.icon('play', 15)} Start stretch sequence</button>`
      : `<div class="empty">${Utils.icon('spine', 30)}
          <div class="empty__title">No discomfort logged yet</div>
          <div class="empty__sub">Save a check-in above and I'll suggest targeted micro-stretches for whatever's sore.</div>
        </div>`}
    </div>

    <div class="section-title">Ergonomics</div>
    <div class="card card--pad">
      <div class="card__title">${Utils.icon('monitor', 16)} ${Utils.esc(ergo.title)}</div>
      ${ergo.body ? `<div class="small muted mt-2">${Utils.esc(ergo.body)}</div>`
        : `<div class="list mt-2">${ergo.list.map(i => `
            <div class="list__item"><div class="list__icon">${Utils.icon('check', 15)}</div>
            <div class="list__body"><div class="list__title" style="font-weight:500">${Utils.esc(i)}</div></div></div>`).join('')}</div>`}
    </div>

    <div class="section-title">Discomfort trend</div>
    <div class="card card--pad">
      <div class="card__title">${Utils.icon('chart', 16)} Last 7 days</div>
      <div class="card__sub">Latest daily rating per area (lower is better)</div>
      <canvas id="mskTrend"></canvas>
      <div class="dash-legend" id="mskLegend"></div>
    </div>

    <div class="disclaimer mt-4">
      ${Utils.icon('alert', 14)}
      <span>These are general self-care suggestions. If pain is sharp, persistent, radiating, or accompanied by numbness, please see a healthcare professional.</span>
    </div>`;

  // trend chart
  const days = [...Utils.pastDateKeys(6), Utils.dateKey()];
  const labels = days.map(Utils.weekdayShort);
  const series = AREAS.map((a, i) => ({
    name: a.label,
    color: cssVal(SERIES_TOKENS[i]) || '#888',
    values: days.map(date => {
      const c = Store.day(date)?.msk.checkins;
      return c && c.length ? c[c.length - 1].areas[a.key] : null;
    }),
  }));
  Charts.lines(el.querySelector('#mskTrend'), series, labels, { height: 150, max: 10 });
  el.querySelector('#mskLegend').innerHTML = series.map(s =>
    `<span><i style="background:${s.color}"></i>${Utils.esc(s.name)}</span>`).join('');

  // live slider labels (no re-render while dragging)
  el.querySelectorAll('input[data-area]').forEach(input => {
    input.addEventListener('input', () => {
      el.querySelector(`[data-val="${input.dataset.area}"]`).textContent = input.value;
    });
  });

  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', e => {
      const brk = e.target.closest('[data-break]');
      if (brk) { Breaks.start(brk.dataset.break); return; }
      if (e.target.closest('[data-save]')) {
        const areas = {};
        container.querySelectorAll('input[data-area]').forEach(i => { areas[i.dataset.area] = Number(i.value); });
        Store.update('msk', m => { m.checkins.push({ ts: Date.now(), areas }); });
        Notify.toast('Check-in saved', 'Your relief suggestions are updated below.', 'success', 2600);
      }
    });
  }
}

export default {
  id: 'msk',
  title: 'Posture & Body',
  icon: 'spine',

  render,

  onShow() {
    unsub.push(Bus.on('store:changed', ({ scope }) => {
      if (['msk', 'settings'].includes(scope)) render(container);
    }));
    unsub.push(Bus.on('break:done', ({ kind }) => { if (['posture', 'stretch'].includes(kind)) render(container); }));
  },

  onHide() { unsub.forEach(off => off()); unsub = []; },
};
