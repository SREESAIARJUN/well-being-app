/* ============================================================
   TIMER — Unified Timer Engine
   ============================================================ */

const TimerEngine = (() => {
  const _timers = {};
  let _globalInterval = null;
  let _lastMinute = -1;

  /**
   * Create a named timer
   * @param {string} name - unique timer name
   * @param {number} intervalSec - fire every N seconds
   * @param {Function} onTick - called every second with remaining seconds
   * @param {Function} onFire - called when timer reaches 0
   * @param {Object} opts - { repeat, paused }
   */
  function create(name, intervalSec, onTick, onFire, opts = {}) {
    _timers[name] = {
      name,
      interval: intervalSec,
      remaining: intervalSec,
      onTick,
      onFire,
      repeat: opts.repeat !== false,
      paused: opts.paused || false,
      running: !opts.paused,
      firedCount: 0
    };
    _ensureGlobalTick();
    return _timers[name];
  }

  /**
   * Start / resume a timer
   */
  function start(name) {
    const t = _timers[name];
    if (!t) return;
    t.paused = false;
    t.running = true;
    _ensureGlobalTick();
  }

  /**
   * Pause a timer
   */
  function pause(name) {
    const t = _timers[name];
    if (!t) return;
    t.paused = true;
    t.running = false;
  }

  /**
   * Reset a timer to its full interval
   */
  function reset(name) {
    const t = _timers[name];
    if (!t) return;
    t.remaining = t.interval;
  }

  /**
   * Stop and remove a timer
   */
  function stop(name) {
    delete _timers[name];
    if (Object.keys(_timers).length === 0) {
      clearInterval(_globalInterval);
      _globalInterval = null;
    }
  }

  /**
   * Get timer state
   */
  function getState(name) {
    return _timers[name] || null;
  }

  /**
   * Get all active timers
   */
  function getAll() {
    return { ..._timers };
  }

  /**
   * Check if any intervention is currently active
   * (break overlay or modal visible)
   */
  function isInterventionActive() {
    return Notifications.isBreakActive();
  }

  /**
   * Internal: ensure the global 1-second tick is running
   */
  function _ensureGlobalTick() {
    if (_globalInterval) return;
    _globalInterval = setInterval(_tick, 1000);
  }

  /**
   * Internal: global tick — fires every second
   */
  function _tick() {
    const now = new Date();
    const currentMinute = now.getMinutes();

    // Emit minute-level events for modules that need it
    if (currentMinute !== _lastMinute) {
      _lastMinute = currentMinute;
      AppEvents.emit('timer:minute', { hour: now.getHours(), minute: currentMinute });
    }

    // Tick each timer
    for (const name of Object.keys(_timers)) {
      const t = _timers[name];
      if (!t || t.paused) continue;

      t.remaining--;

      // Notify tick listener
      if (t.onTick) t.onTick(t.remaining, t);

      // Timer fired
      if (t.remaining <= 0) {
        t.firedCount++;
        if (t.onFire) t.onFire(t);

        if (t.repeat) {
          t.remaining = t.interval;
        } else {
          stop(name);
        }
      }
    }

    // Emit global tick
    AppEvents.emit('timer:tick', { timers: _timers });
  }

  /**
   * Convenience: create a one-shot countdown
   */
  function countdown(name, durationSec, onTick, onComplete) {
    return create(name, durationSec, onTick, onComplete, { repeat: false });
  }

  return {
    create, start, pause, reset, stop,
    getState, getAll, isInterventionActive, countdown
  };
})();
