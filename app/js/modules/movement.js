/* ============================================================
   MOVEMENT — sit/stand tracking toward a 2–4 h/day standing
   goal, movement blocks, sit-less timeline, weekly trend.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Scheduler } from '../core/scheduler.js';
import { Charts } from '../core/charts.js';
import { Notify } from '../core/notify.js';
import { Breaks } from '../breaks.js';

let container = null;
let unsub = [];

function nextMoveMs() {
  const next = Scheduler.next().find(r => r.kind === 'move');
  return next ? next.at - Date.now() : null;
}

function refreshCountdown() {
  const el = container?.querySelector('#moveNext');
  if (!el) return;
  const ms = nextMoveMs();
  el.textContent = ms === null ? 'paused' : Utils.fmtRelative(ms);
}

function weekData() {
  const days = [...Utils.pastDateKeys(6), Utils.dateKey()];
  return days.map(date => {
    const data = Store.day(date);
    const v = data ? data.movement.standingMin : 0;
    return { label: Utils.weekdayShort(date), value: v, hint: Utils.fmtDuration(v) };
  });
}

function render(el) {
  container = el;
  const s = Store.settings();
  const d = Store.today();
  const standing = d.movement.standingMin;
  const pct = Math.round(Utils.clamp(standing / Math.max(30, s.standGoalMin), 0, 1) * 100);
  const isStanding = d.movement.posture === 'stand';

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('walk', 20)}</div>
          <div>
            <h1>Movement</h1>
            <div class="page-head__sub">Break up sitting · move every ${s.moveEvery} min</div>
          </div>
        </div>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--secondary" data-break="stretch">${Utils.icon('spine', 15)} Stretch</button>
        <button class="btn btn--primary" data-break="move">${Utils.icon('play', 15)} Move now</button>
      </div>
    </div>

    <div class="card-grid cols-2 move-hero">
      <div class="card card--pad">
        <div class="card__title">${Utils.icon('walk', 16)} Right now you are…</div>
        <div class="card__sub">Standing time counts toward your daily goal</div>
        <div class="seg seg--block move-posture" style="margin-top:var(--sp-2)">
          <button class="seg__btn ${!isStanding ? 'is-active' : ''}" data-posture="sit">${Utils.icon('monitor', 14)} Sitting</button>
          <button class="seg__btn ${isStanding ? 'is-active' : ''}" data-posture="stand">${Utils.icon('walk', 14)} Standing</button>
        </div>
        <div class="move-status ${isStanding ? 'is-standing' : ''}">
          ${isStanding ? `${Utils.icon('check', 13)} Standing — keep it up` : 'Switch to standing for your next call or reading task.'}
        </div>
      </div>
      <div class="card card--pad move-goal">
        <div class="meter">
          <div class="meter__head"><span>Standing today</span><b>${Utils.fmtDuration(standing)} / ${Utils.fmtDuration(s.standGoalMin)}</b></div>
          <div class="progress"><div class="progress__fill" style="width:${pct}%"></div></div>
        </div>
        <div class="row row--wrap mt-4">
          <div class="stat grow"><div class="stat__value">${d.movement.blocksDone}</div><div class="stat__label">move blocks done</div></div>
          <div class="stat grow"><div class="stat__value">${pct}<span class="unit">%</span></div><div class="stat__label">of goal</div></div>
          <div class="stat grow"><div class="stat__value" id="moveNext" style="font-size:var(--text-lg)">–</div><div class="stat__label">next block</div></div>
        </div>
      </div>
    </div>

    <div class="section-title">Sit-less timeline</div>
    <div class="card card--pad">
      <div class="card__sub" style="margin-bottom:var(--sp-2)">Your posture across the workday</div>
      <canvas id="moveTimeline"></canvas>
      <div class="dash-legend">
        <span><i style="background:var(--m-movement)"></i>Standing</span>
        <span><i style="background:var(--track)"></i>Sitting</span>
        <span><i class="dot" style="background:var(--text-1)"></i>Now</span>
      </div>
    </div>

    <div class="section-title">Your goal</div>
    <div class="card card--pad move-guidance">
      <div class="row row--between">
        <div class="grow">
          <div class="card__title">Building toward 4 hours</div>
          <div class="small muted">Expert consensus: accumulate <strong>2 h/day</strong> of standing &amp; light activity, progressing toward <strong>4 h/day</strong>. Current goal: ${Utils.fmtDuration(s.standGoalMin)}.</div>
        </div>
        ${s.standGoalMin < 240 ? `<button class="btn btn--secondary btn--sm" data-raise>${Utils.icon('plus', 13)} +15 min</button>`
          : `<span class="badge badge--ok">${Utils.icon('check', 12)} Max goal</span>`}
      </div>
    </div>

    <div class="section-title">This week</div>
    <div class="card card--pad">
      <div class="card__title">${Utils.icon('chart', 16)} Standing minutes per day</div>
      <div class="card__sub">Dashed line is your daily goal</div>
      <canvas id="moveWeek"></canvas>
    </div>`;

  Charts.dayTimeline(el.querySelector('#moveTimeline'), d.movement.segments, d.breaks, {
    startMin: Utils.parseHM(s.workStart), endMin: Utils.parseHM(s.workEnd),
  });
  Charts.weekBars(el.querySelector('#moveWeek'), weekData(), { height: 130, goal: s.standGoalMin, unit: 'min' });
  refreshCountdown();

  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', e => {
      const brk = e.target.closest('[data-break]');
      if (brk) { Breaks.start(brk.dataset.break); return; }
      const posture = e.target.closest('[data-posture]')?.dataset.posture;
      if (posture) {
        if (Store.today().movement.posture !== posture) {
          Store.update('movement', m => { m.posture = posture; m.segments.push({ t: Date.now(), mode: posture }); });
          Notify.toast(posture === 'stand' ? 'Standing' : 'Sitting', posture === 'stand' ? 'Standing time is now counting.' : 'Sitting logged.', 'info', 2000);
        }
        return;
      }
      if (e.target.closest('[data-raise]')) {
        Store.updateSettings({ standGoalMin: Math.min(240, Store.settings().standGoalMin + 15) });
        Notify.toast('Goal raised', `Standing goal is now ${Utils.fmtDuration(Store.settings().standGoalMin)}.`, 'success', 2400);
      }
    });
  }
}

export default {
  id: 'movement',
  title: 'Movement',
  icon: 'walk',

  render,

  onShow() {
    unsub.push(Bus.on('store:changed', ({ scope }) => {
      if (['movement', 'breaks', 'settings'].includes(scope)) render(container);
    }));
    unsub.push(Bus.on('break:done', ({ kind }) => { if (kind === 'move' || kind === 'stretch') render(container); }));
  },

  onHide() { unsub.forEach(off => off()); unsub = []; },

  onTick() { refreshCountdown(); },
};
