/* ============================================================
   DEEP WORK — pomodoro focus timer that protects flow.
   While a focus session runs, the scheduler suppresses
   non-critical reminders (via Bus 'focus:changed').

   Engine: absolute deadline timestamps + ONE module-level
   interval created on start and cleared on stop, so the
   countdown keeps running while the page is hidden. onTick
   only repaints.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Charts } from '../core/charts.js';
import { Notify } from '../core/notify.js';
import { Modal } from '../core/modal.js';
import { Breaks } from '../breaks.js';

let container = null;
let unsub = [];

// engine state (module scope — persists across page show/hide)
let phase = 'idle';          // idle | focus | break
let endAt = 0;
let remainAtPause = null;    // ms remaining when paused (focus only)
let startedAt = 0;
let isLongBreak = false;
let engineTimer = null;

function s() { return Store.settings(); }

function sessionsToday() { return Store.today().focus.sessions.filter(x => x.completed).length; }

function remainMs() {
  if (phase === 'idle') return s().focusMin * 60_000;
  if (remainAtPause !== null) return remainAtPause;
  return Math.max(0, endAt - Date.now());
}

function startEngine() {
  if (engineTimer) return;
  engineTimer = setInterval(() => {
    if (remainAtPause !== null) return;               // paused
    if (Date.now() >= endAt) completePhase();
    else paint();
  }, 500);
}
function stopEngine() { if (engineTimer) { clearInterval(engineTimer); engineTimer = null; } }

function beginFocus() {
  phase = 'focus';
  remainAtPause = null;
  startedAt = Date.now();
  endAt = startedAt + s().focusMin * 60_000;
  Bus.emit('focus:changed', { active: true, phase: 'focus' });
  startEngine();
  paint();
}

function beginBreak() {
  const completed = sessionsToday();
  isLongBreak = completed > 0 && completed % s().longBreakEvery === 0;
  phase = 'break';
  remainAtPause = null;
  const mins = isLongBreak ? s().longBreakMin : s().shortBreakMin;
  endAt = Date.now() + mins * 60_000;
  Bus.emit('focus:changed', { active: false, phase: 'break' });
  startEngine();
  paint();
}

function goIdle() {
  phase = 'idle';
  remainAtPause = null;
  stopEngine();
  Bus.emit('focus:changed', { active: false, phase: 'idle' });
  paint();
}

function completePhase() {
  if (phase === 'focus') {
    const minutes = s().focusMin;
    Store.update('focus', f => {
      f.sessions.push({ start: startedAt, end: Date.now(), minutes, completed: true });
      f.minutes += minutes;
    });
    Notify.chime();
    Notify.toast('Focus complete', 'Great block. Time for a real break — rest your eyes.', 'success', 5000);
    beginBreak();
  } else if (phase === 'break') {
    Notify.chime();
    Notify.toast('Break over', 'Ready for the next round when you are.', 'info', 4000);
    goIdle();
  }
}

function focusStreak() {
  // consecutive days (ending today) with any focus minutes
  let streak = 0;
  if (Store.today().focus.minutes > 0) streak = 1;
  const past = Store.pastDays(14).reverse(); // yesterday backward
  if (Store.today().focus.minutes === 0) {
    // streak can still be 0; but if today empty, count trailing days? define streak as ending today
    return 0;
  }
  for (const { data } of past) {
    if (data && data.focus.minutes > 0) streak++;
    else break;
  }
  return streak;
}

/* ---------------- paint ---------------- */
function paint() {
  const ring = container?.querySelector('#focusRing');
  if (!ring) return;
  const total = phase === 'idle' ? s().focusMin * 60_000
    : phase === 'focus' ? s().focusMin * 60_000
    : (isLongBreak ? s().longBreakMin : s().shortBreakMin) * 60_000;
  const remain = remainMs();
  const label = phase === 'focus' ? (remainAtPause !== null ? 'paused' : 'focus')
    : phase === 'break' ? (isLongBreak ? 'long break' : 'break') : 'ready';
  Charts.ring(ring, {
    value: phase === 'idle' ? 0 : (1 - remain / total) * 100,
    size: 200, thickness: 13,
    valueText: Utils.fmtClock(remain), label,
    color: phase === 'break' ? getComputedStyle(document.documentElement).getPropertyValue('--m-lifestyle').trim() : undefined,
  });

  // controls + badge + dots
  const controls = container.querySelector('#focusControls');
  if (controls) controls.innerHTML = controlsHtml();
  const badge = container.querySelector('#focusPhaseBadge');
  if (badge) {
    badge.className = `badge ${phase === 'focus' ? 'badge--accent' : phase === 'break' ? 'badge--warn' : ''}`;
    badge.innerHTML = `<span class="dot"></span>${phase === 'focus' ? 'In focus' : phase === 'break' ? (isLongBreak ? 'Long break' : 'Short break') : 'Ready'}`;
  }
  const dots = container.querySelector('#focusDots');
  if (dots) dots.innerHTML = dotsHtml();
}

function dotsHtml() {
  const per = s().longBreakEvery;
  const total = sessionsToday();
  // position within the current cycle; a just-completed full cycle shows all filled
  const done = total > 0 && total % per === 0 ? per : total % per;
  return Array.from({ length: per }, (_, i) =>
    `<i class="focus-dot ${i < done ? 'is-done' : ''}"></i>`).join('');
}

function controlsHtml() {
  if (phase === 'idle') {
    return `<button class="btn btn--primary btn--lg" data-start>${Utils.icon('play', 16)} Start focus</button>`;
  }
  if (phase === 'focus') {
    const paused = remainAtPause !== null;
    return `
      <button class="btn btn--secondary btn--lg" data-toggle>${paused ? Utils.icon('play', 16) + ' Resume' : Utils.icon('pause', 16) + ' Pause'}</button>
      <button class="btn btn--ghost btn--lg" data-end>${Utils.icon('stop', 16)} End session</button>`;
  }
  // break
  return `
    <button class="btn btn--secondary btn--lg" data-eyebreak>${Utils.icon('eye', 16)} Eye break</button>
    <button class="btn btn--ghost btn--lg" data-skip-break>${Utils.icon('skip', 16)} Skip break</button>`;
}

function weekData() {
  const days = [...Utils.pastDateKeys(6), Utils.dateKey()];
  return days.map(date => {
    const data = Store.day(date);
    const v = data ? data.focus.minutes : 0;
    return { label: Utils.weekdayShort(date), value: v, hint: Utils.fmtDuration(v) };
  });
}

function render(el) {
  container = el;
  const d = Store.today();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('timer', 20)}</div>
          <div>
            <h1>Deep Work</h1>
            <div class="page-head__sub">Focus blocks that protect your flow</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card card--pad focus-hero">
      <span class="badge" id="focusPhaseBadge"><span class="dot"></span>Ready</span>
      <div id="focusRing"></div>
      <div class="focus-dots" id="focusDots"></div>
      <div class="focus-controls" id="focusControls"></div>
    </div>

    <div class="card card--pad focus-suppress">
      <div class="row">
        ${Utils.icon('info', 15)}
        <div class="grow small">
          <b>${s().mode[0].toUpperCase() + s().mode.slice(1)} mode</b> ·
          ${s().focusSuppression === 'soft' ? 'While focusing, only eye &amp; movement reminders stay on.'
            : s().focusSuppression === 'hard' ? 'While focusing, only eye breaks stay on — everything else is paused.'
            : 'Reminders are not suppressed during focus.'}
        </div>
        <button class="btn btn--ghost btn--sm" data-settings>${Utils.icon('gear', 13)} Adjust</button>
      </div>
    </div>

    <div class="card-grid cols-3">
      <div class="card card--pad"><div class="stat"><div class="stat__value">${Utils.fmtDuration(d.focus.minutes)}</div><div class="stat__label">focus today</div></div></div>
      <div class="card card--pad"><div class="stat"><div class="stat__value">${sessionsToday()}</div><div class="stat__label">sessions done</div></div></div>
      <div class="card card--pad"><div class="stat"><div class="stat__value">${focusStreak()}<span class="unit">d</span></div><div class="stat__label">focus streak</div></div></div>
    </div>

    <div class="section-title">Today's sessions</div>
    <div class="card card--pad">
      ${d.focus.sessions.length ? `<div class="list">${[...d.focus.sessions].reverse().slice(0, 8).map(x => `
        <div class="list__item">
          <div class="list__icon">${Utils.icon(x.completed ? 'check' : 'stop', 15)}</div>
          <div class="list__body">
            <div class="list__title">${Utils.fmtTime(x.start)} – ${Utils.fmtTime(x.end)}</div>
            <div class="list__sub">${Utils.fmtDuration(x.minutes)} focused</div>
          </div>
          <span class="badge badge--${x.completed ? 'ok' : 'warn'}">${x.completed ? 'complete' : 'ended early'}</span>
        </div>`).join('')}</div>`
        : `<div class="empty">${Utils.icon('timer', 30)}<div class="empty__title">No sessions yet today</div><div class="empty__sub">Start a focus block above — non-critical nudges pause automatically.</div></div>`}
    </div>

    <div class="section-title">This week</div>
    <div class="card card--pad">
      <div class="card__title">${Utils.icon('chart', 16)} Focus minutes per day</div>
      <canvas id="focusWeek"></canvas>
    </div>`;

  Charts.weekBars(el.querySelector('#focusWeek'), weekData(), { height: 130, unit: 'min' });
  paint();

  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', async e => {
      if (e.target.closest('[data-start]')) { beginFocus(); render(container); return; }
      if (e.target.closest('[data-toggle]')) {
        if (remainAtPause !== null) { endAt = Date.now() + remainAtPause; remainAtPause = null; }
        else { remainAtPause = Math.max(0, endAt - Date.now()); }
        paint();
        return;
      }
      if (e.target.closest('[data-end]')) {
        const ok = await Modal.confirm('End session?', 'This focus block will be logged as ended early.', 'End session', true);
        if (!ok) return;
        const worked = Math.round((Date.now() - startedAt) / 60_000);
        if (worked >= 1) {
          Store.update('focus', f => {
            f.sessions.push({ start: startedAt, end: Date.now(), minutes: worked, completed: false });
            f.minutes += worked;
          });
        }
        goIdle();
        render(container);
        return;
      }
      if (e.target.closest('[data-eyebreak]')) { Breaks.start('eye'); return; }
      if (e.target.closest('[data-skip-break]')) { goIdle(); render(container); return; }
      if (e.target.closest('[data-settings]')) { Bus.emit('nav:go', { id: 'settings' }); return; }
    });
  }
}

export default {
  id: 'focus',
  title: 'Deep Work',
  icon: 'timer',

  render,

  onShow() {
    unsub.push(Bus.on('store:changed', ({ scope }) => {
      // don't fight the live timer: only re-render the static parts on relevant changes
      if (['focus', 'settings'].includes(scope)) render(container);
    }));
  },

  onHide() { unsub.forEach(off => off()); unsub = []; },

  onTick() { paint(); },
};
