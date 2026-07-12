/* ============================================================
   DASHBOARD — integrative overview: health ring, pillar
   breakdown, insights, quick actions, upcoming reminders,
   today's timeline, 7-day score trend.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Score } from '../core/score.js';
import { Scheduler } from '../core/scheduler.js';
import { Charts } from '../core/charts.js';
import { Notify } from '../core/notify.js';
import { Breaks } from '../breaks.js';

const PILLARS = [
  { key: 'eye', label: 'Eye health', token: '--m-eye', page: 'eye' },
  { key: 'movement', label: 'Movement', token: '--m-movement', page: 'movement' },
  { key: 'msk', label: 'Posture & body', token: '--m-msk', page: 'msk' },
  { key: 'mental', label: 'Mind', token: '--m-mental', page: 'mental' },
  { key: 'lifestyle', label: 'Lifestyle', token: '--m-lifestyle', page: 'lifestyle' },
  { key: 'focus', label: 'Deep work', token: '--m-focus', page: 'focus' },
];

const KIND_ICON = { eye: 'eye', blink: 'eye', move: 'walk', hydrate: 'drop', posture: 'spine', mood: 'brain', winddown: 'moon' };
const KIND_LABEL = { eye: 'Eye break', blink: 'Blink check', move: 'Movement block', hydrate: 'Hydration', posture: 'Posture reset', mood: 'Mood check-in', winddown: 'Wind-down' };
const INSIGHT_PAGE = { eye: 'eye', move: 'movement', msk: 'msk', mental: 'mental', hydrate: 'lifestyle', focus: 'focus', general: 'coach' };

let container = null;
let unsub = [];

function upcomingHtml() {
  const pausedUntil = Scheduler.pausedUntil();
  if (pausedUntil && pausedUntil > Date.now()) {
    return `<div class="empty">${Utils.icon('snooze', 30)}
      <div class="empty__title">Reminders paused</div>
      <div class="empty__sub">Quiet until ${Utils.esc(Utils.fmtTime(pausedUntil))} — resume any time from the sidebar.</div></div>`;
  }
  const items = Scheduler.next().slice(0, 5);
  if (!items.length) {
    return `<div class="empty">${Utils.icon('check', 30)}
      <div class="empty__title">Nothing scheduled right now</div>
      <div class="empty__sub">Reminders run during your work hours. Enjoy the quiet.</div></div>`;
  }
  return `<div class="list">${items.map(({ kind, at }) => `
    <div class="list__item">
      <div class="list__icon" style="color:var(--m-${kind === 'blink' ? 'eye' : kind}, var(--accent))">${Utils.icon(KIND_ICON[kind] || 'bell', 16)}</div>
      <div class="list__body"><div class="list__title">${Utils.esc(KIND_LABEL[kind] || kind)}</div></div>
      <div class="list__aside">${Utils.esc(Utils.fmtRelative(at - Date.now()))}</div>
    </div>`).join('')}</div>`;
}

function refreshUpcoming() {
  const host = container?.querySelector('#dashUpcoming');
  if (host) host.innerHTML = upcomingHtml();
}

function scoreWeekData() {
  const days = [...Utils.pastDateKeys(6), Utils.dateKey()];
  return days.map(date => {
    const v = Score.composite(date);
    return { label: Utils.weekdayShort(date), value: v ?? 0, hint: v === null ? 'no data' : `${v}/100` };
  });
}

function dayHasActivity(d) {
  if (!d) return false;
  return (d.eye.breaksTaken + d.eye.breaksSkipped + d.eye.exercisesDone) > 0 ||
    d.movement.standingMin > 0 || d.movement.blocksDone > 0 ||
    d.msk.checkins.length > 0 || d.mental.checkins.length > 0 ||
    d.lifestyle.water > 0 || d.focus.minutes > 0;
}

/** consecutive active days ending today */
function activityStreak() {
  if (!dayHasActivity(Store.today())) return 0;
  let streak = 1;
  for (const { data } of Store.pastDays(30).reverse()) {
    if (dayHasActivity(data)) streak++;
    else break;
  }
  return streak;
}

function weeklyTotals() {
  const days = [...Store.pastDays(6).map(x => x.data), Store.today()];
  const t = { breaks: 0, standMin: 0, water: 0, focusMin: 0 };
  for (const d of days) {
    if (!d) continue;
    t.breaks += d.eye.breaksTaken;
    t.standMin += d.movement.standingMin;
    t.water += d.lifestyle.water;
    t.focusMin += d.focus.minutes;
  }
  return t;
}

/** animate the big score ring from its last shown value (full sweep on first paint) */
let lastRingValue = 0;
function animateScoreRing(host, target) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = v => Charts.ring(host, {
    value: v, size: 168, thickness: 12,
    valueText: Math.round(v), label: 'out of 100',
  });
  const from = lastRingValue;
  lastRingValue = target;
  if (reduced || from === target) { draw(target); return; }
  const t0 = performance.now(), dur = from === 0 ? 700 : 350;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    draw(from + (target - from) * eased);
    if (p < 1 && host.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function render(el) {
  container = el;
  const s = Store.settings();
  const d = Store.today();
  const pillars = Score.pillars() || {};
  const composite = Score.composite();
  const insights = Score.insights();

  const streak = activityStreak();
  const week = weeklyTotals();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('home', 20)}</div>
          <div>
            <h1>${Utils.esc(Utils.greeting())}</h1>
            <div class="page-head__sub">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>
      <div class="page-head__actions">
        ${streak > 1 ? `<span class="chip chip--accent" title="Consecutive days with logged activity">${Utils.icon('flame', 13)} ${streak}-day streak</span>` : ''}
      </div>
    </div>

    <div class="card-grid cols-2 dash-hero">
      <div class="card card--pad dash-score">
        <div id="dashScoreRing"></div>
        <div class="dash-score__meta">
          <div class="card__title">Today's health score</div>
          <div class="small muted">${composite >= 75 ? 'Strong rhythm — keep it going.' : composite >= 50 ? 'Solid, with room to build.' : 'Small steps count. Pick one nudge below.'}</div>
        </div>
      </div>
      <div class="card card--pad">
        <div class="card__title">${Utils.icon('chart', 16)} Pillars</div>
        <div class="card__sub">How each area is doing today</div>
        <div class="dash-pillars">
          ${PILLARS.map(p => {
            const v = pillars[p.key];
            return `<button class="dash-pillar" data-page="${p.page}">
              <div class="dash-pillar__head">
                <span>${Utils.esc(p.label)}</span>
                <b>${v === null || v === undefined ? '—' : v}</b>
              </div>
              <div class="progress"><div class="progress__fill" style="width:${v ?? 0}%;background:var(${p.token})"></div></div>
            </button>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="section-title">Focus for now</div>
    <div class="card-grid cols-2" id="dashInsights">
      ${insights.slice(0, 4).map(ins => `
        <button class="card card--pad card--hover dash-insight" data-page="${INSIGHT_PAGE[ins.kind] || 'coach'}">
          <div class="list__icon" style="color:var(--m-${ins.kind === 'move' ? 'movement' : ins.kind === 'hydrate' ? 'lifestyle' : ins.kind === 'general' ? 'coach' : ins.kind}, var(--accent))">${Utils.icon(ins.icon, 16)}</div>
          <div class="grow" style="text-align:left">
            <div class="small">${Utils.esc(ins.text)}</div>
          </div>
          <span class="badge badge--${ins.tone === 'warn' ? 'warn' : ins.tone === 'ok' ? 'ok' : 'accent'}"><span class="dot"></span></span>
        </button>`).join('')}
    </div>

    <div class="section-title">Quick actions</div>
    <div class="row row--wrap dash-actions">
      <button class="chip chip--btn" data-act="water">${Utils.icon('drop', 13)} Log water</button>
      <button class="chip chip--btn" data-act="eye">${Utils.icon('eye', 13)} Eye break</button>
      <button class="chip chip--btn" data-act="posture">${Utils.icon('spine', 13)} Posture check</button>
      <button class="chip chip--btn" data-act="breathe">${Utils.icon('wind', 13)} Breathe</button>
      <button class="chip chip--btn" data-act="focus">${Utils.icon('timer', 13)} Start focus</button>
    </div>

    <div class="card-grid cols-2 mt-5">
      <div class="card card--pad">
        <div class="card__title">${Utils.icon('clock', 16)} Coming up</div>
        <div class="card__sub">Your next few nudges</div>
        <div id="dashUpcoming">${upcomingHtml()}</div>
      </div>
      <div class="card card--pad">
        <div class="card__title">${Utils.icon('walk', 16)} Today's timeline</div>
        <div class="card__sub">Standing vs sitting, with breaks</div>
        <canvas id="dashTimeline"></canvas>
        <div class="dash-legend">
          <span><i style="background:var(--m-movement)"></i>Standing</span>
          <span><i style="background:var(--m-eye)"></i>Eye break</span>
          <span><i class="dot" style="background:var(--text-1)"></i>Now</span>
        </div>
      </div>
    </div>

    <div class="section-title">This week</div>
    <div class="card-grid cols-4 dash-week">
      <div class="card card--pad"><div class="stat">
        <div class="stat__value">${week.breaks}</div><div class="stat__label">eye breaks</div>
      </div></div>
      <div class="card card--pad"><div class="stat">
        <div class="stat__value">${Utils.fmtDuration(week.standMin)}</div><div class="stat__label">standing</div>
      </div></div>
      <div class="card card--pad"><div class="stat">
        <div class="stat__value">${week.water}</div><div class="stat__label">glasses of water</div>
      </div></div>
      <div class="card card--pad"><div class="stat">
        <div class="stat__value">${Utils.fmtDuration(week.focusMin)}</div><div class="stat__label">deep work</div>
      </div></div>
    </div>

    <div class="card card--pad mt-4">
      <div class="card__title">${Utils.icon('chart', 16)} Composite health score</div>
      <div class="card__sub">Hover a bar for the day's score</div>
      <canvas id="dashScoreWeek"></canvas>
    </div>`;

  animateScoreRing(el.querySelector('#dashScoreRing'), composite);
  Charts.dayTimeline(el.querySelector('#dashTimeline'), d.movement.segments, d.breaks, {
    startMin: Utils.parseHM(s.workStart), endMin: Utils.parseHM(s.workEnd),
  });
  Charts.weekBars(el.querySelector('#dashScoreWeek'), scoreWeekData(), { height: 130, goal: null, unit: '/100' });

  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', e => {
      const page = e.target.closest('[data-page]');
      if (page) { Bus.emit('nav:go', { id: page.dataset.page }); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      switch (act) {
        case 'water':
          Store.update('lifestyle', l => { l.water++; });
          Notify.toast('Water logged', `Glass ${Store.today().lifestyle.water} of ${Store.settings().waterGoal}.`, 'success', 2400);
          break;
        case 'eye': Breaks.start('eye'); break;
        case 'posture': Breaks.start('posture'); break;
        case 'breathe': Breaks.start('breathing'); break;
        case 'focus': Bus.emit('nav:go', { id: 'focus' }); break;
      }
    });
  }
}

export default {
  id: 'dashboard',
  title: 'Overview',
  icon: 'home',

  render,

  onShow() {
    unsub.push(Bus.on('store:changed', () => render(container)));
    unsub.push(Bus.on('break:done', () => render(container)));
    refreshUpcoming();
  },

  onHide() { unsub.forEach(off => off()); unsub = []; },

  onTick() { refreshUpcoming(); },
};
