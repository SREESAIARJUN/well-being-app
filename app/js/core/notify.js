/* ============================================================
   NOTIFY — single router for every user-facing notification.
   Focused window  -> in-app banner (with actions) or toast.
   Hidden/blurred  -> native always-on-top popup (never steals focus).
   Browser dev     -> in-app only.
   ============================================================ */

import { Utils } from './utils.js';
import { Store } from './store.js';
import { Tauri } from './tauri.js';

const REMINDER_META = {
  eye:      { icon: 'eye',   accent: 'var(--m-eye)',       title: 'Eye break',     body: 'Look at something 20 feet away for 20 seconds.' },
  blink:    { icon: 'eye',   accent: 'var(--m-eye)',       title: 'Blink check',   body: 'Blink slowly a few times to re-wet your eyes.',
              actions: [{ id: 'done', label: 'Done', primary: true }] },
  move:     { icon: 'walk',  accent: 'var(--m-movement)',  title: 'Time to move',  body: 'Stand up and move for a couple of minutes.' },
  hydrate:  { icon: 'drop',  accent: 'var(--m-lifestyle)', title: 'Hydration',     body: 'Have a glass of water.',
              actions: [{ id: 'open', label: 'Log a glass', primary: true }, { id: 'snooze', label: 'Snooze 5m' }, { id: 'skip', label: 'Skip' }] },
  posture:  { icon: 'spine', accent: 'var(--m-msk)',       title: 'Posture reset', body: 'Neutral spine, shoulders relaxed, screen at eye level.' },
  mood:     { icon: 'brain', accent: 'var(--m-mental)',    title: 'Mood check-in', body: 'How are you feeling? 20 seconds, once a day.',
              actions: [{ id: 'open', label: 'Check in', primary: true }, { id: 'snooze', label: 'Later' }, { id: 'skip', label: 'Skip' }] },
  winddown: { icon: 'moon',  accent: 'var(--m-lifestyle)', title: 'Wind-down',     body: 'Time to start reducing screen exposure for better sleep.',
              actions: [{ id: 'open', label: 'Evening checklist', primary: true }, { id: 'skip', label: 'Skip' }] },
};

let chimeCtx = null;
function chime() {
  if (!Store.settings().soundOn) return;
  try {
    chimeCtx = chimeCtx || new AudioContext();
    if (chimeCtx.state === 'suspended') chimeCtx.resume().catch(() => {});
    const t0 = chimeCtx.currentTime;
    for (const [freq, start] of [[830, 0], [1108, 0.09]]) {
      const osc = chimeCtx.createOscillator();
      const gain = chimeCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.06, t0 + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.6);
      osc.connect(gain).connect(chimeCtx.destination);
      osc.start(t0 + start); osc.stop(t0 + start + 0.65);
    }
  } catch { /* audio may be unavailable; never break a reminder over a sound */ }
}

function toastStack() {
  let stack = Utils.$('.toast-stack');
  if (!stack) { stack = Utils.el('div', { class: 'toast-stack' }); document.body.appendChild(stack); }
  return stack;
}

function bannerStack() {
  let stack = Utils.$('.banner-stack');
  if (!stack) { stack = Utils.el('div', { class: 'banner-stack' }); document.body.appendChild(stack); }
  return stack;
}

export const Notify = {
  /** transient toast, bottom-right inside the app */
  toast(title, msg = '', type = 'info', ms = 4200) {
    const el = Utils.el('div', { class: `toast toast--${type}` }, `
      <div class="toast__icon">${Utils.icon(type === 'success' ? 'check' : type === 'warning' ? 'alert' : type === 'error' ? 'x' : 'info')}</div>
      <div class="toast__body">
        <div class="toast__title">${Utils.esc(title)}</div>
        ${msg ? `<div class="toast__msg">${Utils.esc(msg)}</div>` : ''}
      </div>
      <button class="toast__close" aria-label="Dismiss">${Utils.icon('x', 13)}</button>`);
    const dismiss = () => {
      el.classList.add('exiting');
      setTimeout(() => el.remove(), 260);
    };
    el.querySelector('.toast__close').addEventListener('click', dismiss);
    toastStack().appendChild(el);
    if (ms > 0) setTimeout(dismiss, ms);
    return dismiss;
  },

  /**
   * Reminder entry point (called by the scheduler).
   * `onAction(actionId)` receives: 'open' | 'done' | 'snooze' | 'skip' | 'ignored'
   */
  async reminder(kind, onAction, overrides = {}) {
    const meta = { ...(REMINDER_META[kind] || REMINDER_META.eye), ...overrides };
    const style = Store.settings().notifyStyle;
    const focused = await Tauri.isFocused();
    const usePopup = Tauri.isTauri && style !== 'inapp' && (style === 'popup' || !focused);

    chime();

    if (usePopup) {
      Tauri.showPopup({
        kind,
        title: meta.title,
        body: meta.body,
        icon: meta.icon,
        accent: meta.accent || '',
        timeoutMs: 25000,
        actions: meta.actions || [
          { id: 'open', label: 'Start', primary: true },
          { id: 'snooze', label: 'Snooze 5m' },
          { id: 'skip', label: 'Skip' },
        ],
      });
      // popup:action events route back through main.js -> scheduler
      return;
    }

    // in-app banner with the same actions
    const stack = bannerStack();
    const el = Utils.el('div', { class: 'banner', 'data-kind': kind }, `
      <div class="banner__icon">${Utils.icon(meta.icon, 17)}</div>
      <div class="banner__body">
        <div class="banner__title">${Utils.esc(meta.title)}</div>
        <div class="banner__msg">${Utils.esc(meta.body)}</div>
      </div>
      <div class="banner__actions">
        ${(meta.actions || [
          { id: 'open', label: 'Start', primary: true },
          { id: 'snooze', label: '5m' },
        ]).map(a => `<button class="btn ${a.primary ? 'btn--primary' : 'btn--ghost'} btn--sm" data-act="${a.id}">${Utils.esc(a.label)}</button>`).join('')}
        <button class="btn btn--ghost btn--icon btn--sm" data-act="skip" title="Dismiss">${Utils.icon('x', 13)}</button>
      </div>`);
    let acted = false;
    const finish = act => {
      if (acted) return;
      acted = true;
      el.remove();
      onAction?.(act);
    };
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (btn) finish(btn.dataset.act);
    });
    stack.appendChild(el);
    setTimeout(() => finish('ignored'), 30000);
  },

  meta(kind) { return REMINDER_META[kind]; },
  chime,
};
