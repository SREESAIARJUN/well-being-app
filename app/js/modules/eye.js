/* ============================================================
   EYE HEALTH — 20-20-20 breaks, blink reminders, guided
   exercises, ergonomics checklist, weekly adherence trend.
   (Reference module: shows the render/onShow/onHide/onTick
   pattern every module follows.)
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Scheduler } from '../core/scheduler.js';
import { Charts } from '../core/charts.js';
import { Breaks } from '../breaks.js';

const EXERCISES = [
  { kind: 'eye', icon: 'eye', name: '20-20-20 break', desc: '20 seconds of distance focus', mins: '20 s' },
  { kind: 'palming', icon: 'hand', name: 'Palming', desc: 'Warm darkness for tired eyes', mins: '30 s' },
  { kind: 'figure8', icon: 'refresh', name: 'Figure eight', desc: 'Smooth-pursuit eye tracking', mins: '40 s' },
];

const ERGO_ITEMS = [
  'Screen an arm\'s length away (50–75 cm)',
  'Top of screen at or just below eye level',
  'No window glare on the screen',
  'Text size comfortable without leaning in',
  'Room lighting similar to screen brightness',
];

let container = null;
let unsub = [];

function nextEyeBreakMs() {
  const next = Scheduler.next().find(r => r.kind === 'eye');
  return next ? next.at - Date.now() : null;
}

function renderCountdown() {
  const host = container?.querySelector('#eyeNextRing');
  if (!host) return;
  const s = Store.settings();
  const remain = nextEyeBreakMs();
  const total = s.eyeBreakEvery * 60_000;
  if (remain === null) {
    Charts.ring(host, { value: 0, size: 150, thickness: 10, valueText: '—', label: 'paused' });
    return;
  }
  // beyond ~2 intervals means we're outside work hours (weekend/evening):
  // show a humane duration instead of a nonsense "574:13" countdown
  const farAway = remain > total * 2;
  Charts.ring(host, {
    value: farAway ? 0 : (1 - Utils.clamp(remain / total, 0, 1)) * 100,
    size: 150, thickness: 10,
    valueText: farAway ? Utils.fmtDuration(remain / 60_000) : Utils.fmtClock(remain),
    label: farAway ? 'next work block' : 'until next break',
  });
}

function weekData() {
  const days = [...Store.pastDays(6), { date: Utils.dateKey(), data: Store.today() }];
  return days.map(({ date, data }) => ({
    label: Utils.weekdayShort(date),
    value: data ? data.eye.breaksTaken : 0,
    hint: data ? `${data.eye.breaksTaken} taken · ${data.eye.breaksSkipped} skipped` : 'no data',
  }));
}

function render(el) {
  container = el;
  const s = Store.settings();
  const d = Store.today();
  const total = d.eye.breaksTaken + d.eye.breaksSkipped;
  const adherence = total ? Math.round((d.eye.breaksTaken / total) * 100) : null;

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('eye', 20)}</div>
          <div>
            <h1>Eye Health</h1>
            <div class="page-head__sub">20-20-20 rhythm · every ${s.eyeBreakEvery} min during work hours</div>
          </div>
        </div>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--primary" data-break="eye">${Utils.icon('play', 15)} Break now</button>
      </div>
    </div>

    <div class="card-grid cols-3">
      <div class="card card--pad eye-hero" style="grid-row: span 2; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--sp-3)">
        <div id="eyeNextRing"></div>
        <div class="small muted">Next scheduled eye break</div>
        <button class="btn btn--secondary btn--sm" data-snooze>${Utils.icon('snooze', 13)} Snooze 5 min</button>
      </div>
      <div class="card card--pad"><div class="stat">
        <div class="stat__value">${d.eye.breaksTaken}</div>
        <div class="stat__label">breaks taken today</div>
      </div></div>
      <div class="card card--pad"><div class="stat">
        <div class="stat__value">${adherence === null ? '—' : adherence + '<span class="unit">%</span>'}</div>
        <div class="stat__label">adherence today</div>
      </div></div>
      <div class="card card--pad"><div class="stat">
        <div class="stat__value">${d.eye.exercisesDone}</div>
        <div class="stat__label">exercises done</div>
      </div></div>
      <div class="card card--pad">
        <div class="row row--between">
          <div>
            <div class="card__title">Blink reminders</div>
            <div class="small muted">Gentle nudge every ${s.blinkEvery || '–'} min</div>
          </div>
          <span class="toggle"><input type="checkbox" id="eyeBlinkToggle" ${s.blinkEvery > 0 ? 'checked' : ''}><i></i></span>
        </div>
      </div>
    </div>

    <div class="section-title">Guided exercises</div>
    <div class="card-grid cols-3">
      ${EXERCISES.map(x => `
        <button class="card card--pad card--hover exercise-card" data-break="${x.kind}">
          <div class="list__icon">${Utils.icon(x.icon, 16)}</div>
          <div class="grow" style="text-align:left">
            <div class="list__title">${Utils.esc(x.name)}</div>
            <div class="list__sub">${Utils.esc(x.desc)}</div>
          </div>
          <span class="badge">${x.mins}</span>
        </button>`).join('')}
    </div>

    <div class="section-title">This week</div>
    <div class="card card--pad">
      <div class="card__title">${Utils.icon('chart', 16)} Eye breaks per day</div>
      <div class="card__sub">Hover a bar for taken vs skipped</div>
      <canvas id="eyeWeekChart"></canvas>
    </div>

    <div class="section-title">Screen ergonomics</div>
    <div class="card card--pad">
      <div class="card__sub" style="margin-bottom:var(--sp-3)">A 60-second self-check — most digital eye strain starts here.</div>
      <div class="list">
        ${ERGO_ITEMS.map(item => `
          <div class="list__item">
            <div class="list__icon">${Utils.icon('check', 15)}</div>
            <div class="list__body"><div class="list__title" style="font-weight:500">${Utils.esc(item)}</div></div>
          </div>`).join('')}
      </div>
    </div>`;

  // delegated listener attached ONCE per page element (el survives re-renders;
  // guard prevents duplicate handlers stacking up)
  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', e => {
      const breakBtn = e.target.closest('[data-break]');
      if (breakBtn) { Breaks.start(breakBtn.dataset.break); return; }
      if (e.target.closest('[data-snooze]')) {
        Scheduler.snooze('eye', 5);
        renderCountdown();
      }
    });
  }
  el.querySelector('#eyeBlinkToggle').addEventListener('change', e => {
    Store.updateSettings({ blinkEvery: e.target.checked ? 10 : 0 });
  });

  renderCountdown();
  Charts.weekBars(el.querySelector('#eyeWeekChart'), weekData(), { height: 130, unit: 'breaks' });
}

export default {
  id: 'eye',
  title: 'Eye Health',
  icon: 'eye',

  render,

  onShow() {
    unsub.push(Bus.on('store:changed', ({ scope }) => {
      if (['eye', 'breaks', 'settings'].includes(scope)) render(container);
    }));
    unsub.push(Bus.on('break:done', ({ kind }) => {
      if (['eye', 'palming', 'figure8'].includes(kind)) render(container);
    }));
  },

  onHide() {
    unsub.forEach(off => off());
    unsub = [];
  },

  onTick() { renderCountdown(); },
};
