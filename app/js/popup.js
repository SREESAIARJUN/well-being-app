/* ============================================================
   POPUP — logic for the always-on-top reminder window.
   Receives `popup:show` events from Rust, renders the card,
   runs the auto-hide countdown (paused on hover), and reports
   every outcome back through the `popup_action` command.
   ============================================================ */

import { Utils } from './core/utils.js';

const invoke = window.__TAURI__?.core?.invoke;
const listen = window.__TAURI__?.event?.listen;

const pop = Utils.$('#pop');
const iconEl = Utils.$('#popIcon');
const titleEl = Utils.$('#popTitle');
const msgEl = Utils.$('#popMsg');
const actionsEl = Utils.$('#popActions');
const timerEl = Utils.$('#popTimer');

let currentKind = null;
let deadline = 0;
let totalMs = 0;
let raf = 0;
let paused = false;
let acted = false;

function act(action) {
  if (acted) return;
  acted = true;
  cancelAnimationFrame(raf);
  pop.style.display = 'none';
  invoke?.('popup_action', { action, kind: currentKind ?? '' });
}

function tickTimer(now) {
  if (paused) { deadline = Date.now() + remainAtPause; raf = requestAnimationFrame(tickTimer); return; }
  const remain = deadline - Date.now();
  timerEl.style.transform = `scaleX(${Math.max(0, remain / totalMs)})`;
  if (remain <= 0) { act('ignored'); return; }
  raf = requestAnimationFrame(tickTimer);
}

let remainAtPause = 0;
pop.addEventListener('mouseenter', () => { remainAtPause = deadline - Date.now(); paused = true; });
pop.addEventListener('mouseleave', () => { paused = false; });

Utils.$('#popClose').innerHTML = Utils.icon('x', 13);
Utils.$('#popClose').addEventListener('click', () => act('skip'));

function show(payload) {
  const { kind, title, body, icon = 'bell', accent = '', timeoutMs = 25000, actions = [] } = payload || {};
  currentKind = kind ?? '';
  acted = false;
  paused = false;

  document.documentElement.style.setProperty('--accent', accent || `var(--m-${kind}, var(--m-coach))`);
  iconEl.innerHTML = Utils.icon(icon, 19);
  titleEl.textContent = title || 'Reminder';
  msgEl.textContent = body || '';
  actionsEl.innerHTML = '';
  for (const a of actions) {
    const btn = Utils.el('button', { class: `btn btn--sm ${a.primary ? 'btn--primary' : 'btn--ghost'}` });
    btn.textContent = a.label;
    btn.addEventListener('click', () => act(a.id));
    actionsEl.appendChild(btn);
  }
  actionsEl.style.display = actions.length ? 'flex' : 'none';

  totalMs = Math.max(4000, timeoutMs);
  deadline = Date.now() + totalMs;
  pop.style.display = 'flex';
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tickTimer);
}

if (listen) {
  listen('popup:show', e => show(e.payload));
} else {
  // browser dev preview: show a sample card
  show({ kind: 'eye', title: 'Eye break', body: 'Look at something 20 feet away for 20 seconds.',
    icon: 'eye', timeoutMs: 20000,
    actions: [{ id: 'open', label: 'Start', primary: true }, { id: 'snooze', label: 'Snooze 5m' }, { id: 'skip', label: 'Skip' }] });
}
