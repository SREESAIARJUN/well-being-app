/* ============================================================
   BUS — app-wide event emitter (contract in ARCHITECTURE.md)
   ============================================================ */

const listeners = new Map(); // event -> Set<fn>

export const Bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => Bus.off(event, fn);
  },
  off(event, fn) {
    listeners.get(event)?.delete(fn);
  },
  once(event, fn) {
    const off = Bus.on(event, payload => { off(); fn(payload); });
    return off;
  },
  emit(event, payload) {
    for (const fn of [...(listeners.get(event) ?? [])]) {
      try { fn(payload); }
      catch (e) { console.error(`Bus handler for "${event}" failed`, e); }
    }
  },
};
