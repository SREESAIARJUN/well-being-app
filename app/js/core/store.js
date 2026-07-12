/* ============================================================
   STORE — persistence layer (schema in ARCHITECTURE.md)
   All keys prefixed `wb.`; daily records under `wb.day.<date>`.
   ============================================================ */

import { Utils } from './utils.js';
import { Bus } from './bus.js';

const PREFIX = 'wb.';

const DEFAULT_SETTINGS = Object.freeze({
  onboarded: false,
  theme: 'dark',
  mode: 'balanced',
  workStart: '09:00', workEnd: '18:00', workDays: [1, 2, 3, 4, 5],
  eyeBreakEvery: 20,
  eyeBreakSecs: 20,
  blinkEvery: 10,
  moveEvery: 45,
  standGoalMin: 120,
  hydrateEvery: 60,
  waterGoal: 8,
  postureEvery: 60,
  moodCheck: 'daily',
  winddownAt: '21:30',
  focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4,
  focusSuppression: 'soft',
  notifyStyle: 'auto',
  soundOn: true,
  autostart: false,
  coachAutoLoad: false,
  retentionDays: 90,
  modules: { eye: true, movement: true, msk: true, mental: true, lifestyle: true, focus: true, coach: true },
});

function emptyDay() {
  return {
    eye: { breaksTaken: 0, breaksSkipped: 0, exercisesDone: 0, blinksShown: 0 },
    movement: { standingMin: 0, blocksDone: 0, blocksSkipped: 0, posture: 'sit', segments: [] },
    msk: { checkins: [], exercisesDone: 0, postureChecks: 0 },
    mental: { checkins: [], interventionsDone: 0, sos: 0 },
    lifestyle: { water: 0, winddownDone: false, nudgeIndex: 0 },
    focus: { sessions: [], minutes: 0 },
    breaks: [],
  };
}

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
  catch (e) { console.warn('Store write failed:', key, e); }
}

function del(key) { localStorage.removeItem(PREFIX + key); }

function allKeys() {
  return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length));
}

/* merge stored day data over the empty skeleton so new fields never come back undefined */
function hydrateDay(raw) {
  if (!raw) return null;
  const day = emptyDay();
  for (const scope of Object.keys(day)) {
    if (scope === 'breaks') { day.breaks = Array.isArray(raw.breaks) ? raw.breaks : []; }
    else if (raw[scope] && typeof raw[scope] === 'object') Object.assign(day[scope], raw[scope]);
  }
  return day;
}

let settingsCache = null;
let todayCache = null;
let todayKey = null;

function persistToday() { write('day.' + todayKey, todayCache); }

export const Store = {
  DEFAULT_SETTINGS,

  init() {
    Store.rolloverIfNeeded();
    // prune old day records beyond retention
    const keep = Store.settings().retentionDays || 90;
    const cutoff = Utils.pastDateKeys(keep)[0];
    for (const key of allKeys()) {
      if (key.startsWith('day.') && key.slice(4) < cutoff) del(key);
    }
  },

  rolloverIfNeeded() {
    const key = Utils.dateKey();
    if (key === todayKey && todayCache) return false;
    todayKey = key;
    todayCache = hydrateDay(read('day.' + key)) ?? emptyDay();
    persistToday();
    return true;
  },

  /* ---------- settings ---------- */
  settings() {
    if (!settingsCache) {
      const stored = read('settings', {});
      settingsCache = {
        ...DEFAULT_SETTINGS,
        ...stored,
        modules: { ...DEFAULT_SETTINGS.modules, ...(stored.modules || {}) },
      };
    }
    return settingsCache;
  },

  updateSettings(patch) {
    const merged = { ...Store.settings(), ...patch };
    if (patch.modules) merged.modules = { ...Store.settings().modules, ...patch.modules };
    settingsCache = merged;
    write('settings', merged);
    Bus.emit('store:changed', { scope: 'settings' });
  },

  /* ---------- daily data ---------- */
  today() {
    Store.rolloverIfNeeded();
    return todayCache;
  },

  day(dateKey) {
    if (dateKey === todayKey) return Store.today();
    return hydrateDay(read('day.' + dateKey));
  },

  update(scope, fn) {
    const day = Store.today();
    fn(day[scope]);
    persistToday();
    Bus.emit('store:changed', { scope });
  },

  logBreak(kind, action) {
    const day = Store.today();
    day.breaks.push({ ts: Date.now(), kind, action });
    if (kind === 'eye') {
      if (action === 'done') day.eye.breaksTaken++;
      else day.eye.breaksSkipped++;
    }
    if (kind === 'move') {
      if (action === 'done') day.movement.blocksDone++;
      else day.movement.blocksSkipped++;
    }
    persistToday();
    Bus.emit('store:changed', { scope: 'breaks' });
  },

  pastDays(n) {
    return Utils.pastDateKeys(n).map(date => ({ date, data: Store.day(date) }));
  },

  /* ---------- journal (gratitude) ---------- */
  journal() { return read('journal', []); },
  addJournal(text) {
    const entries = Store.journal();
    entries.unshift({ id: Utils.uid(), ts: Date.now(), text: String(text).slice(0, 2000) });
    write('journal', entries.slice(0, 500));
    Bus.emit('store:changed', { scope: 'journal' });
  },
  deleteJournal(id) {
    write('journal', Store.journal().filter(e => e.id !== id));
    Bus.emit('store:changed', { scope: 'journal' });
  },

  /* ---------- chat ---------- */
  chat() { return read('chat', []); },
  addChat(msg) {
    const history = Store.chat();
    history.push({ ...msg, ts: Date.now() });
    write('chat', history.slice(-100));
  },
  clearChat() { write('chat', []); },

  /* ---------- weekly recovery plan ---------- */
  recoveryPlan() {
    const key = 'recovery.' + Utils.isoWeekKey();
    return read(key, { items: [] });
  },
  updateRecoveryPlan(fn) {
    const key = 'recovery.' + Utils.isoWeekKey();
    const plan = Store.recoveryPlan();
    fn(plan);
    write(key, plan);
    Bus.emit('store:changed', { scope: 'recovery' });
  },

  /* ---------- data management ---------- */
  exportAll() {
    const out = {};
    for (const key of allKeys()) out[key] = read(key);
    return { app: 'wellbeing-companion', version: 1, exportedAt: new Date().toISOString(), data: out };
  },

  importAll(payload) {
    if (!payload || payload.app !== 'wellbeing-companion' || typeof payload.data !== 'object') {
      throw new Error('Not a WellBeing Companion export file.');
    }
    for (const key of allKeys()) del(key);
    for (const [key, value] of Object.entries(payload.data)) write(key, value);
    settingsCache = null; todayCache = null; todayKey = null;
    Store.init();
    Bus.emit('store:changed', { scope: '*' });
  },

  clearAll() {
    for (const key of allKeys()) del(key);
    settingsCache = null; todayCache = null; todayKey = null;
    Store.init();
    Bus.emit('store:changed', { scope: '*' });
  },

  storageUsedKB() {
    let bytes = 0;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) bytes += (localStorage.getItem(k) || '').length * 2;
    }
    return Math.round(bytes / 1024);
  },
};
