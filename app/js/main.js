/* ============================================================
   MAIN — boot, router, sidebar, global wiring
   ============================================================ */

import { Utils } from './core/utils.js';
import { Bus } from './core/bus.js';
import { Store } from './core/store.js';
import { Score } from './core/score.js';
import { Tauri } from './core/tauri.js';
import { Notify } from './core/notify.js';
import { Scheduler } from './core/scheduler.js';
import { Modal } from './core/modal.js';
import { Breaks } from './breaks.js';

import dashboard from './modules/dashboard.js';
import focus from './modules/focus.js';
import eye from './modules/eye.js';
import movement from './modules/movement.js';
import msk from './modules/msk.js';
import mental from './modules/mental.js';
import lifestyle from './modules/lifestyle.js';
import coach from './modules/coach.js';
import settings from './modules/settings.js';

const NAV_SECTIONS = [
  { title: null, items: [dashboard] },
  { title: 'Health', items: [eye, movement, msk, mental, lifestyle] },
  { title: 'Work', items: [focus, coach] },
  { title: null, items: [settings] },
];
const MODULES = NAV_SECTIONS.flatMap(s => s.items);

let current = null;
const rendered = new Set();

/* ---------------- theme ---------------- */
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = Store.settings().theme;
  const theme = pref === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
}
darkQuery.addEventListener('change', () => { if (Store.settings().theme === 'auto') { applyTheme(); rerenderCurrent(); } });

/* ---------------- sidebar ---------------- */
function buildNav() {
  const nav = Utils.$('#nav');
  nav.innerHTML = '';
  const enabled = Store.settings().modules;
  for (const section of NAV_SECTIONS) {
    const items = section.items.filter(m =>
      m.id === 'dashboard' || m.id === 'settings' || enabled[m.id] !== false);
    if (!items.length) continue;
    if (section.title) nav.appendChild(Utils.el('div', { class: 'nav__section' }, Utils.esc(section.title)));
    for (const m of items) {
      const btn = Utils.el('button', { class: 'nav__item', 'data-nav': m.id },
        `${Utils.icon(m.icon, 17)}<span>${Utils.esc(m.title)}</span>`);
      btn.addEventListener('click', () => navigate(m.id));
      nav.appendChild(btn);
    }
  }
  markActiveNav();
}

function markActiveNav() {
  Utils.$$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.nav === current));
}

function updateScore() {
  const el = Utils.$('#sideScoreVal');
  const score = Score.composite();
  if (el && el.textContent !== String(score)) {
    el.textContent = score;
    el.classList.remove('tick-flash');
    void el.offsetWidth;
    el.classList.add('tick-flash');
  }
}

function buildModeSeg() {
  const seg = Utils.$('#modeSeg');
  const modes = [
    { id: 'balanced', icon: 'target', label: 'Balanced mode' },
    { id: 'focus', icon: 'zap', label: 'Focus mode — fewer interruptions' },
    { id: 'recovery', icon: 'leaf', label: 'Recovery mode — more movement' },
    { id: 'resilience', icon: 'heart', label: 'Resilience mode — more mental-health support' },
  ];
  seg.innerHTML = modes.map(m =>
    `<button class="seg__btn" data-mode="${m.id}" title="${Utils.esc(m.label)}">${Utils.icon(m.icon, 14)}</button>`).join('');
  seg.addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    Store.updateSettings({ mode: btn.dataset.mode });
    Notify.toast('Mode changed', `${btn.dataset.mode[0].toUpperCase() + btn.dataset.mode.slice(1)} mode is active.`, 'info', 2500);
  });
  syncModeSeg();
}
function syncModeSeg() {
  const mode = Store.settings().mode;
  Utils.$$('#modeSeg .seg__btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
}

/* ---------------- router ---------------- */
function pageEl(id) { return Utils.$(`#page-${id}`); }

export function navigate(id) {
  const mod = MODULES.find(m => m.id === id);
  if (!mod || current === id) return;
  if (current) {
    const prev = MODULES.find(m => m.id === current);
    pageEl(current)?.classList.remove('is-active');
    prev?.onHide?.();
    Bus.emit('page:hidden', { id: current });
  }
  current = id;
  let el = pageEl(id);
  if (!el) {
    el = Utils.el('section', { class: 'page', id: `page-${id}`, 'data-module': id });
    Utils.$('#main').appendChild(el);
  }
  // make the page visible BEFORE first render so canvases measure a real
  // width (charts drawn inside a display:none page fall back to 300px).
  el.classList.add('is-active');
  if (!rendered.has(id)) { mod.render(el); rendered.add(id); }
  Utils.$('#main').scrollTop = 0;
  mod.onShow?.();
  Bus.emit('page:shown', { id });
  markActiveNav();
}

function rerenderCurrent() {
  const mod = MODULES.find(m => m.id === current);
  if (mod) { mod.render(pageEl(current)); mod.onShow?.(); }
}

/* ---------------- reminder actions ---------------- */
function handleReminderAction({ kind, action }) {
  if (action !== 'open' && action !== 'done') return;
  const breakKind = Breaks.forReminder(kind);
  if (breakKind && action === 'open') { Breaks.start(breakKind); return; }
  switch (kind) {
    case 'hydrate':
      Store.update('lifestyle', l => { l.water++; });
      Notify.toast('Logged', `Glass ${Store.today().lifestyle.water} of ${Store.settings().waterGoal} — nice.`, 'success', 2600);
      break;
    case 'mood':
      navigate('mental');
      Bus.emit('mental:open-checkin');
      break;
    case 'winddown':
      navigate('lifestyle');
      Bus.emit('lifestyle:open-winddown');
      break;
    case 'blink':
      break; // acknowledging is enough
  }
}

/* ---------------- onboarding ---------------- */
async function maybeOnboard() {
  if (Store.settings().onboarded) return;
  const body = `
    <p style="margin-bottom:10px">Your privacy-first desk-health companion. It watches the clock so you don't have to:</p>
    <ul style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      <li><strong>20-20-20 eye breaks</strong> and blink reminders</li>
      <li><strong>Movement blocks</strong> toward a 2–4 h/day standing goal</li>
      <li><strong>Posture, hydration, mood</strong> check-ins — one nudge at a time</li>
      <li><strong>On-device AI coach</strong> — your data never leaves this computer</li>
    </ul>
    ${Tauri.isTauri ? `
    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer">
      <span class="toggle"><input type="checkbox" id="obAutostart" checked><i></i></span>
      <span style="font-size:var(--text-sm)">Start quietly with Windows (recommended)</span>
    </label>` : ''}
    <p class="muted small" style="margin-top:12px">WellBeing offers general wellness guidance, not medical advice. For persistent pain, vision problems, or mental-health concerns, please talk to a professional.</p>`;
  await Modal.open({ title: 'Welcome to WellBeing', body, buttons: [{ id: 'go', label: "Let's go", primary: true }] });
  Store.updateSettings({ onboarded: true });
  if (obAutostartChecked && Tauri.isTauri) {
    const ok = await Tauri.setAutostart(true);
    Store.updateSettings({ autostart: !!ok });
  }
}
let obAutostartChecked = true;
document.addEventListener('change', e => {
  if (e.target?.id === 'obAutostart') obAutostartChecked = e.target.checked;
});

/* ---------------- boot ---------------- */
async function boot() {
  Store.init();
  applyTheme();

  Utils.$('#brandMark').innerHTML = Utils.icon('logo', 19);
  buildNav();
  buildModeSeg();
  updateScore();
  Utils.$('#sideScore').addEventListener('click', () => navigate('dashboard'));

  Bus.on('store:changed', ({ scope }) => {
    updateScore();
    if (scope === 'settings') { applyTheme(); buildNav(); syncModeSeg(); }
    if (scope === '*') { rendered.clear(); rerenderCurrent(); }
  });

  Bus.on('reminder:action', handleReminderAction);
  Bus.on('popup:action', ({ action, kind }) => Scheduler.handleAction(action, kind));
  Bus.on('tray:break', () => Breaks.start('eye'));
  Bus.on('nav:go', ({ id }) => navigate(id));

  await Tauri.initEvents();
  Scheduler.init();

  navigate('dashboard');

  // 1 Hz tick for the visible module (countdowns etc.)
  setInterval(() => {
    if (Store.rolloverIfNeeded()) { rendered.clear(); rerenderCurrent(); }
    const mod = MODULES.find(m => m.id === current);
    mod?.onTick?.(Date.now());
  }, 1000);

  // keyboard: Ctrl+1..9 to switch pages
  document.addEventListener('keydown', e => {
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= MODULES.length) {
      const visible = Utils.$$('.nav__item').map(b => b.dataset.nav);
      if (visible[n - 1]) { e.preventDefault(); navigate(visible[n - 1]); }
    }
  });

  maybeOnboard();

  // Runtime self-test harness (only when launched with --selftest).
  if (Tauri.isTauri) {
    Tauri.invoke('is_selftest')
      .then(on => { if (on) return import('./selftest.js').then(m => m.runSelfTest()); })
      .catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
