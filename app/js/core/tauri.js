/* ============================================================
   TAURI BRIDGE — safe in Tauri AND plain browsers.
   All native access goes through here; nothing else touches
   window.__TAURI__ (lesson from the v0.1 breakage).
   ============================================================ */

import { Bus } from './bus.js';

const T = () => window.__TAURI__;
const isTauri = typeof window !== 'undefined' && !!window.__TAURI__;

async function invoke(cmd, args) {
  if (!isTauri) throw new Error(`invoke(${cmd}) outside Tauri`);
  return T().core.invoke(cmd, args);
}

/** invoke that quietly no-ops in the browser (for fire-and-forget calls) */
async function tryInvoke(cmd, args) {
  if (!isTauri) return null;
  try { return await T().core.invoke(cmd, args); }
  catch (e) { console.warn(`invoke ${cmd} failed:`, e); return null; }
}

export const Tauri = {
  isTauri,

  invoke,

  async listen(event, cb) {
    if (!isTauri) return () => {};
    return T().event.listen(event, e => cb(e.payload));
  },

  /* ---------- windows ---------- */
  showMain() { return tryInvoke('show_main'); },
  hideMain() { return tryInvoke('hide_main'); },
  quit() { return tryInvoke('quit_app'); },

  async isFocused() {
    // document.hasFocus() is accurate inside the webview and needs no ACL.
    return document.hasFocus();
  },
  isVisible() {
    return document.visibilityState === 'visible';
  },

  /* ---------- reminder popup ---------- */
  showPopup({ kind, title, body, icon = 'bell', accent = '', timeoutMs = 25000, actions = [] }) {
    return tryInvoke('show_popup', { payload: { kind, title, body, icon, accent, timeoutMs, actions } });
  },
  hidePopup() { return tryInvoke('hide_popup'); },

  /* ---------- autostart ---------- */
  async setAutostart(enable) {
    if (!isTauri) return false;
    try { return await invoke('set_autostart', { enable }); }
    catch (e) { console.warn('setAutostart failed:', e); return !enable; }
  },
  async getAutostart() {
    if (!isTauri) return false;
    try { return await invoke('get_autostart'); }
    catch { return false; }
  },

  /* ---------- event wiring (called once from main.js) ---------- */
  async initEvents() {
    if (!isTauri) return;
    await Tauri.listen('popup:action', payload => Bus.emit('popup:action', payload));
    await Tauri.listen('tray:break', () => Bus.emit('tray:break'));
  },
};
