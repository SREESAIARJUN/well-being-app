/* ============================================================
   NOTIFICATIONS — Toast, Modal, Break Overlay System
   ============================================================ */

const Notifications = (() => {
  const ICONS = {
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
  };

  /* ---------- NATIVE WINDOW ---------- */
  let _wasHiddenBeforeBreak = false;

  async function _bringToFront(forBreak = false) {
    try {
      if (window.__TAURI__ && window.__TAURI__.core) {
        const invoke = window.__TAURI__.core.invoke;
        const isVisible = await invoke('plugin:window|is_visible', { label: 'main' });
        
        if (forBreak && !isVisible) {
           _wasHiddenBeforeBreak = true;
        }

        await invoke('plugin:window|show', { label: 'main' });
        await invoke('plugin:window|set_always_on_top', { label: 'main', alwaysOnTop: true });
        await invoke('plugin:window|set_focus', { label: 'main' });
        await invoke('plugin:window|set_always_on_top', { label: 'main', alwaysOnTop: false });
        return !isVisible;
      }
    } catch(e) { console.warn('Failed to focus native window via invoke', e); return false; }
  }

  async function _hideIfWasHidden() {
    try {
      if (_wasHiddenBeforeBreak && window.__TAURI__ && window.__TAURI__.core) {
        await window.__TAURI__.core.invoke('plugin:window|hide', { label: 'main' });
      }
      _wasHiddenBeforeBreak = false;
    } catch(e) { console.warn('Failed to hide native window via invoke', e); }
  }

  /* ---------- TOAST ---------- */
  async function toast(title, message, type = 'info', duration = 4000) {
    const wasHidden = await _bringToFront(false);
    
    // If the app popped up just for this toast, track if the user interacts with it
    let userInteracted = false;
    const interactListener = () => { userInteracted = true; };
    if (wasHidden) {
       document.addEventListener('mousemove', interactListener, { once: true });
       document.addEventListener('click', interactListener, { once: true });
       document.addEventListener('keydown', interactListener, { once: true });
    }

    const container = Utils.$('toastContainer');
    const el = Utils.createElement('div', {
      className: `toast toast--${type}`,
      innerHTML: `
        <div class="toast__icon">${ICONS[type] || ICONS.info}</div>
        <div class="toast__content">
          <div class="toast__title">${title}</div>
          ${message ? `<div class="toast__message">${message}</div>` : ''}
        </div>
        <button class="toast__dismiss" aria-label="Dismiss">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `
    });

    container.appendChild(el);

    const dismiss = () => {
      el.classList.add('exiting');
      setTimeout(async () => {
         el.remove();
         // If it was hidden, the user didn't interact, and no break is active, hide it again!
         if (wasHidden && !userInteracted && window.__TAURI__ && window.__TAURI__.core && !isBreakActive()) {
            try {
               await window.__TAURI__.core.invoke('plugin:window|hide', { label: 'main' });
            } catch(e) {}
         }
         // Clean up listeners
         document.removeEventListener('mousemove', interactListener);
         document.removeEventListener('click', interactListener);
         document.removeEventListener('keydown', interactListener);
      }, 300);
    };

    el.querySelector('.toast__dismiss').addEventListener('click', dismiss);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }

    return { dismiss };
  }

  /* ---------- MODAL ---------- */
  let _modalResolve = null;

  async function modal(title, bodyHTML, footerButtons = []) {
    await _bringToFront(true); // Treat modals like breaks for visibility purposes
    const overlay = Utils.$('modalOverlay');
    const titleEl = Utils.$('modalTitle');
    const bodyEl = Utils.$('modalBody');
    const footerEl = Utils.$('modalFooter');

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHTML;
    footerEl.innerHTML = '';

    footerButtons.forEach(btn => {
      const el = Utils.createElement('button', {
        className: `btn ${btn.primary ? 'btn--primary' : 'btn--secondary'}`,
        textContent: btn.label,
        onClick: () => {
          closeModal();
          if (btn.action) btn.action();
          if (_modalResolve) _modalResolve(btn.value);
        }
      });
      footerEl.appendChild(el);
    });

    overlay.classList.add('active');

    return new Promise(resolve => {
      _modalResolve = resolve;
    });
  }

  function closeModal() {
    Utils.$('modalOverlay').classList.remove('active');
    _modalResolve = null;
    _hideIfWasHidden();
  }

  // Close modal on overlay click or close button
  document.addEventListener('DOMContentLoaded', () => {
    Utils.$('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target === Utils.$('modalOverlay')) closeModal();
    });
    Utils.$('modalClose')?.addEventListener('click', closeModal);
  });

  /* ---------- BREAK OVERLAY ---------- */
  let _breakTimer = null;
  let _breakCallback = null;

  async function showBreak(title, description, durationSec, onComplete) {
    await _bringToFront(true);
    const overlay = Utils.$('breakOverlay');
    const titleEl = Utils.$('breakTitle');
    const descEl = Utils.$('breakDescription');
    const timeEl = Utils.$('breakTimeDisplay');
    const progressEl = Utils.$('breakRingProgress');
    const startBtn = Utils.$('breakStartBtn');
    const skipBtn = Utils.$('breakSkipBtn');

    titleEl.textContent = title;
    descEl.textContent = description;
    timeEl.textContent = durationSec;
    _breakCallback = onComplete;

    // Reset progress ring
    const circumference = 2 * Math.PI * 45;
    progressEl.style.strokeDasharray = circumference;
    progressEl.style.strokeDashoffset = '0';
    progressEl.style.transition = 'none';

    overlay.classList.add('active');
    startBtn.textContent = 'Start';

    let running = false;
    let remaining = durationSec;

    const tick = () => {
      remaining--;
      timeEl.textContent = remaining;
      const offset = ((durationSec - remaining) / durationSec) * circumference;
      progressEl.style.transition = 'stroke-dashoffset 1s linear';
      progressEl.style.strokeDashoffset = offset;

      if (remaining <= 0) {
        clearInterval(_breakTimer);
        _breakTimer = null;
        hideBreak();
        if (_breakCallback) _breakCallback('completed');
        toast('Break Complete', 'Great job taking that break!', 'success');
      }
    };

    startBtn.onclick = () => {
      if (!running) {
        running = true;
        startBtn.textContent = 'Pause';
        _breakTimer = setInterval(tick, 1000);
      } else {
        running = false;
        startBtn.textContent = 'Resume';
        clearInterval(_breakTimer);
      }
    };

    skipBtn.onclick = () => {
      clearInterval(_breakTimer);
      _breakTimer = null;
      hideBreak();
      if (_breakCallback) _breakCallback('skipped');
    };
  }

  function hideBreak() {
    Utils.$('breakOverlay').classList.remove('active');
    if (_breakTimer) {
      clearInterval(_breakTimer);
      _breakTimer = null;
    }
    _hideIfWasHidden();
  }

  function isBreakActive() {
    return Utils.$('breakOverlay').classList.contains('active');
  }

  return {
    toast, modal, closeModal,
    showBreak, hideBreak, isBreakActive
  };
})();
