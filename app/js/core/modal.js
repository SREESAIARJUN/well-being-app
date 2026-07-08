/* ============================================================
   MODAL — promise-based dialog + confirm helper
   ============================================================ */

import { Utils } from './utils.js';

let overlay = null;
let resolveFn = null;

function ensureDom() {
  if (overlay) return;
  overlay = Utils.el('div', { class: 'modal-overlay' }, `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <div class="modal__title"></div>
        <button class="btn btn--ghost btn--icon btn--sm" data-close aria-label="Close">${Utils.icon('x', 14)}</button>
      </div>
      <div class="modal__body"></div>
      <div class="modal__foot"></div>
    </div>`);
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.closest('[data-close]')) Modal.close(null);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) Modal.close(null);
  });
  document.body.appendChild(overlay);
}

export const Modal = {
  /**
   * open({title, body, buttons:[{id,label,primary,danger}]}) -> Promise<id|null>
   * `body` is trusted HTML built by the caller (caller escapes user input).
   * After open, query the body via Modal.el() to bind extra listeners.
   */
  open({ title, body = '', buttons = [{ id: 'ok', label: 'OK', primary: true }] }) {
    ensureDom();
    overlay.querySelector('.modal__title').textContent = title;
    overlay.querySelector('.modal__body').innerHTML = body;
    const foot = overlay.querySelector('.modal__foot');
    foot.innerHTML = '';
    for (const b of buttons) {
      const btn = Utils.el('button', {
        class: `btn ${b.primary ? 'btn--primary' : b.danger ? 'btn--danger' : 'btn--ghost'}`,
      });
      btn.textContent = b.label;
      btn.addEventListener('click', () => Modal.close(b.id));
      foot.appendChild(btn);
    }
    overlay.classList.add('active');
    return new Promise(resolve => { resolveFn = resolve; });
  },

  close(result) {
    if (!overlay) return;
    overlay.classList.remove('active');
    const r = resolveFn; resolveFn = null;
    r?.(result);
  },

  /** the modal body element (bind inputs after open) */
  el() { return overlay?.querySelector('.modal__body') ?? null; },

  async confirm(title, message, confirmLabel = 'Confirm', danger = false) {
    const r = await Modal.open({
      title,
      body: `<p>${Utils.esc(message)}</p>`,
      buttons: [
        { id: 'cancel', label: 'Cancel' },
        { id: 'ok', label: confirmLabel, primary: !danger, danger },
      ],
    });
    return r === 'ok';
  },
};
