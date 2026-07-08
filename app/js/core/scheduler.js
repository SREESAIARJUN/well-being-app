/* ============================================================
   SCHEDULER — central reminder engine.
   Absolute epoch deadlines + 1 Hz tick (sleep/suspend safe).
   Work-hours gating, mode matrix, focus suppression, and a
   spacing guard so the user never gets stacked interruptions.
   ============================================================ */

import { Utils } from './utils.js';
import { Bus } from './bus.js';
import { Store } from './store.js';
import { Notify } from './notify.js';

const INTERVAL_KINDS = ['eye', 'blink', 'move', 'hydrate', 'posture'];
const PRIORITY = ['eye', 'move', 'posture', 'hydrate', 'mood', 'blink', 'winddown'];
const MIN_GAP_MS = 90_000;

/* which settings module-toggle governs each reminder kind */
const KIND_MODULE = {
  eye: 'eye', blink: 'eye', move: 'movement', posture: 'msk',
  hydrate: 'lifestyle', mood: 'mental', winddown: 'lifestyle',
};

/* mode matrix: false = suppressed, number = interval multiplier */
const MODE_MATRIX = {
  balanced:   { eye: 1, blink: 1, move: 1,    hydrate: 1, posture: 1, mood: 1, winddown: 1 },
  focus:      { eye: 1, blink: 0, move: 1,    hydrate: 0, posture: 0, mood: 0, winddown: 1 },
  recovery:   { eye: 1, blink: 1, move: 0.67, hydrate: 1, posture: 1, mood: 1, winddown: 1 },
  resilience: { eye: 1, blink: 1, move: 1,    hydrate: 1, posture: 1, mood: 1, winddown: 1 },
};

/* focus-session suppression (applies on top of the mode) */
const FOCUS_ALLOW = {
  soft: { eye: 1, blink: 0, move: 1, hydrate: 0, posture: 0, mood: 0, winddown: 1 },
  hard: { eye: 1, blink: 0, move: 0, hydrate: 0, posture: 0, mood: 0, winddown: 1 },
  off: null,
};

const deadlines = new Map();      // interval kind -> epochMs
let promptedMoodSlots = new Set();
let winddownFiredFor = null;      // dateKey
let lastFiredAt = 0;
let focusActive = false;
let tickHandle = null;
let dayKey = null;

function settings() { return Store.settings(); }

function intervalMinutes(kind) {
  const s = settings();
  const base = { eye: s.eyeBreakEvery, blink: s.blinkEvery, move: s.moveEvery,
                 hydrate: s.hydrateEvery, posture: s.postureEvery }[kind];
  if (!base || base <= 0) return 0; // disabled
  const mult = MODE_MATRIX[s.mode]?.[kind] ?? 1;
  if (mult === 0) return 0;
  return Math.max(3, Math.round(base * (typeof mult === 'number' ? (mult === 1 ? 1 : mult) : 1)));
}

function kindEnabled(kind) {
  const s = settings();
  if (!s.modules[KIND_MODULE[kind]]) return false;
  if ((MODE_MATRIX[s.mode]?.[kind] ?? 1) === 0) return false;
  if (focusActive) {
    const allow = FOCUS_ALLOW[s.focusSuppression];
    if (allow && allow[kind] === 0) return false;
  }
  return true;
}

function inWorkHours(now = new Date()) {
  const s = settings();
  if (!s.workDays.includes(now.getDay())) return false;
  const min = now.getHours() * 60 + now.getMinutes();
  return min >= Utils.parseHM(s.workStart) && min < Utils.parseHM(s.workEnd);
}

function nextWorkStartMs(from = new Date()) {
  const s = settings();
  const startMin = Utils.parseHM(s.workStart);
  for (let add = 0; add <= 7; add++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + add,
      Math.floor(startMin / 60), startMin % 60, 0, 0);
    if (d.getTime() > from.getTime() && s.workDays.includes(d.getDay())) return d.getTime();
  }
  return from.getTime() + 864e5;
}

function arm(kind, fromNow = null) {
  const mins = intervalMinutes(kind);
  if (!mins) { deadlines.delete(kind); return; }
  deadlines.set(kind, Date.now() + (fromNow ?? mins) * 60_000);
}

function armAll() { for (const k of INTERVAL_KINDS) arm(k); }

/* mood slots in minutes-of-day, given settings + mode */
function moodSlots() {
  const s = settings();
  if (s.moodCheck === 'off') return [];
  const start = Utils.parseHM(s.workStart);
  const twice = s.moodCheck === 'twice' || s.mode === 'resilience';
  return twice ? [start + 90, start + 330] : [start + 120];
}

function fire(kind) {
  lastFiredAt = Date.now();
  Bus.emit('reminder:due', { kind });
  Notify.reminder(kind, action => Scheduler.handleAction(action, kind));
}

let lastAccrualMin = -1;

function tick() {
  const now = Date.now();
  const nowDate = new Date(now);

  // midnight rollover
  const key = Utils.dateKey(nowDate);
  if (key !== dayKey) {
    dayKey = key;
    promptedMoodSlots = new Set();
    Store.rolloverIfNeeded();
    armAll();
  }

  // standing-time accrual: +1 min for every wall-clock minute spent standing
  const minuteStamp = Math.floor(now / 60_000);
  if (minuteStamp !== lastAccrualMin) {
    lastAccrualMin = minuteStamp;
    if (Store.today().movement.posture === 'stand') {
      Store.update('movement', m => { m.standingMin++; });
    }
  }

  if (now - lastFiredAt < MIN_GAP_MS) return; // spacing guard — due kinds stay due

  const due = [];

  // interval reminders (work hours only)
  for (const kind of INTERVAL_KINDS) {
    const at = deadlines.get(kind);
    if (!at || now < at) continue;
    if (!kindEnabled(kind)) { arm(kind); continue; }
    if (!inWorkHours(nowDate)) {
      deadlines.set(kind, nextWorkStartMs(nowDate) + intervalMinutes(kind) * 60_000);
      continue;
    }
    due.push(kind);
  }

  // mood check-ins (time-of-day slots)
  if (kindEnabled('mood')) {
    const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
    const checkins = Store.today().mental.checkins.length;
    moodSlots().forEach((slot, i) => {
      if (nowMin >= slot && nowMin < slot + 120 && checkins <= i && !promptedMoodSlots.has(i)) {
        due.push('mood');
        promptedMoodSlots.add(i);
      }
    });
  }

  // wind-down (fires once/day at the configured time, any day of week)
  const s = settings();
  if (s.winddownAt && kindEnabled('winddown') && winddownFiredFor !== dayKey) {
    const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
    const target = Utils.parseHM(s.winddownAt);
    if (nowMin >= target && nowMin < target + 60 && !Store.today().lifestyle.winddownDone) {
      due.push('winddown');
      winddownFiredFor = dayKey;
    }
  }

  if (!due.length) return;
  due.sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  const kind = due[0];                      // one interruption at a time
  if (INTERVAL_KINDS.includes(kind)) arm(kind);
  fire(kind);
}

export const Scheduler = {
  init() {
    dayKey = Utils.dateKey();
    armAll();
    Bus.on('store:changed', ({ scope }) => { if (scope === 'settings') armAll(); });
    Bus.on('focus:changed', ({ active }) => { focusActive = !!active; });
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(tick, 1000);
  },

  /** upcoming reminders, soonest first (dashboard widget) */
  next() {
    const out = [];
    const now = Date.now();
    for (const kind of INTERVAL_KINDS) {
      if (!kindEnabled(kind) || !deadlines.get(kind)) continue;
      let at = deadlines.get(kind);
      if (!inWorkHours(new Date(Math.max(at, now)))) at = Math.max(at, nextWorkStartMs());
      out.push({ kind, at });
    }
    const s = settings();
    if (kindEnabled('mood')) {
      const checkins = Store.today().mental.checkins.length;
      const slots = moodSlots();
      const nowMin = Utils.nowMinutes();
      const idx = slots.findIndex((slot, i) => checkins <= i && nowMin < slot);
      if (idx >= 0) {
        const d = new Date(); d.setHours(0, slots[idx], 0, 0);
        out.push({ kind: 'mood', at: d.getTime() });
      }
    }
    if (s.winddownAt && kindEnabled('winddown') && !Store.today().lifestyle.winddownDone) {
      const target = Utils.parseHM(s.winddownAt);
      if (Utils.nowMinutes() < target) {
        const d = new Date(); d.setHours(0, target, 0, 0);
        out.push({ kind: 'winddown', at: d.getTime() });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  },

  snooze(kind, min = 5) {
    if (INTERVAL_KINDS.includes(kind)) deadlines.set(kind, Date.now() + min * 60_000);
    else if (kind === 'mood') { promptedMoodSlots.clear(); }
    else if (kind === 'winddown') { winddownFiredFor = null; }
    lastFiredAt = Date.now(); // snoozing counts as an interaction; keep spacing
  },

  done(kind) { if (INTERVAL_KINDS.includes(kind)) arm(kind); },

  skip(kind) {
    if (INTERVAL_KINDS.includes(kind)) arm(kind);
    if (kind === 'eye' || kind === 'move') Store.logBreak(kind, 'skipped');
  },

  /** actions coming back from banners or the native popup */
  handleAction(action, kind) {
    switch (action) {
      case 'open':
        Scheduler.done(kind);
        Bus.emit('reminder:action', { kind, action: 'open' });
        break;
      case 'done':
        Scheduler.done(kind);
        Bus.emit('reminder:action', { kind, action: 'done' });
        break;
      case 'snooze':
        Scheduler.snooze(kind, 5);
        break;
      case 'skip':
        Scheduler.skip(kind);
        break;
      case 'ignored':
      default:
        // unattended popup: gentle retry in 5 minutes, log for adherence stats
        if (kind === 'eye' || kind === 'move') Store.logBreak(kind, 'ignored');
        Scheduler.snooze(kind, 5);
        break;
    }
  },

  setFocusActive(active) { focusActive = !!active; },

  /* test/dev hook */
  _debugFire(kind) { fire(kind); },
};
