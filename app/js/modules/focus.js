/* ============================================================
   FOCUS / POMODORO MODULE
   ============================================================ */

const FocusModule = (() => {
  let _initialized = false;
  let _running = false;
  let _phase = 'focus'; // focus | shortBreak | longBreak
  let _sessionsCompleted = 0;
  let _totalFocusSec = 0;

  function init() {
    if (_initialized) return;
    _initialized = true;
    render();
  }

  function render() {
    const page = Utils.$('page-focus');
    const settings = Store.getSettings();
    const data = Store.getFocusData();
    const totalMin = data.totalFocusMinutes || 0;
    const sessions = data.sessions || [];
    const timerState = TimerEngine.getState('focus');
    const remaining = timerState ? timerState.remaining : settings.focusDuration * 60;

    const focusDur = settings.focusDuration;
    const shortBreakDur = settings.shortBreak;
    const longBreakDur = settings.longBreak;

    let currentDuration;
    if (_phase === 'shortBreak') currentDuration = shortBreakDur * 60;
    else if (_phase === 'longBreak') currentDuration = longBreakDur * 60;
    else currentDuration = focusDur * 60;

    const circumference = 2 * Math.PI * 120;
    const progress = timerState ? ((currentDuration - remaining) / currentDuration) : 0;
    const dashoffset = circumference * (1 - progress);

    page.innerHTML = `
      <div class="section-header">
        <h2>Focus Timer</h2>
        <div class="section-header__actions">
          <div class="tabs">
            <button class="tab ${_phase === 'focus' ? 'active' : ''}" onclick="FocusModule.setPhase('focus')">Focus</button>
            <button class="tab ${_phase === 'shortBreak' ? 'active' : ''}" onclick="FocusModule.setPhase('shortBreak')">Short Break</button>
            <button class="tab ${_phase === 'longBreak' ? 'active' : ''}" onclick="FocusModule.setPhase('longBreak')">Long Break</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom: var(--space-8);">
        <div class="pomodoro">
          <!-- Timer Ring -->
          <div class="pomodoro__ring">
            <svg viewBox="0 0 260 260">
              <circle class="pomodoro__ring-bg" cx="130" cy="130" r="120"/>
              <circle class="pomodoro__ring-progress${_phase !== 'focus' ? ' pomodoro__ring-progress--break' : ''}" 
                      cx="130" cy="130" r="120"
                      style="stroke-dasharray:${circumference}; stroke-dashoffset:${dashoffset};" 
                      id="focusRingProgress"/>
            </svg>
            <div class="pomodoro__center">
              <div class="pomodoro__time" id="focusTimeDisplay">${Utils.formatTime(remaining)}</div>
              <div class="pomodoro__phase">${_phase === 'focus' ? 'Focus' : _phase === 'shortBreak' ? 'Short Break' : 'Long Break'}</div>
            </div>
          </div>

          <!-- Controls -->
          <div class="pomodoro__controls">
            ${!_running ? `
              <button class="btn btn--primary btn--lg" onclick="FocusModule.start()">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start
              </button>
            ` : `
              <button class="btn btn--secondary btn--lg" onclick="FocusModule.pause()">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Pause
              </button>
            `}
            <button class="btn btn--ghost btn--lg" onclick="FocusModule.reset()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Reset
            </button>
          </div>

          <!-- Stats -->
          <div class="pomodoro__stats">
            <div class="pomodoro__stat">
              <div class="pomodoro__stat-value" style="color:var(--accent-cyan);">${_sessionsCompleted}</div>
              <div class="pomodoro__stat-label">Sessions Today</div>
            </div>
            <div class="pomodoro__stat">
              <div class="pomodoro__stat-value" style="color:var(--accent-green);">${totalMin}</div>
              <div class="pomodoro__stat-label">Focus Minutes</div>
            </div>
            <div class="pomodoro__stat">
              <div class="pomodoro__stat-value" style="color:var(--accent-violet);">${Math.round(totalMin / 60 * 10) / 10}</div>
              <div class="pomodoro__stat-label">Hours Focused</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Session Configuration -->
      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        <div class="card card--compact">
          <div class="card__title" style="font-size:var(--text-sm); margin-bottom:var(--space-3);">Focus Duration</div>
          <div style="display:flex; align-items:center; gap:var(--space-3);">
            <input type="range" class="slider" min="5" max="90" value="${focusDur}" 
                   onchange="FocusModule.updateSetting('focusDuration', this.value)" style="flex:1;">
            <span style="font-size:var(--text-sm); font-weight:var(--weight-medium); width:40px; text-align:right;">${focusDur}m</span>
          </div>
        </div>
        <div class="card card--compact">
          <div class="card__title" style="font-size:var(--text-sm); margin-bottom:var(--space-3);">Short Break</div>
          <div style="display:flex; align-items:center; gap:var(--space-3);">
            <input type="range" class="slider" min="1" max="15" value="${shortBreakDur}" 
                   onchange="FocusModule.updateSetting('shortBreak', this.value)" style="flex:1;">
            <span style="font-size:var(--text-sm); font-weight:var(--weight-medium); width:40px; text-align:right;">${shortBreakDur}m</span>
          </div>
        </div>
        <div class="card card--compact">
          <div class="card__title" style="font-size:var(--text-sm); margin-bottom:var(--space-3);">Long Break</div>
          <div style="display:flex; align-items:center; gap:var(--space-3);">
            <input type="range" class="slider" min="5" max="30" value="${longBreakDur}" 
                   onchange="FocusModule.updateSetting('longBreak', this.value)" style="flex:1;">
            <span style="font-size:var(--text-sm); font-weight:var(--weight-medium); width:40px; text-align:right;">${longBreakDur}m</span>
          </div>
        </div>
      </div>

      <!-- Session History -->
      <div class="section-header">
        <h3>Today's Sessions</h3>
      </div>
      <div class="card">
        ${sessions.length === 0 ? `
          <div class="empty-state" style="padding:var(--space-8);">
            <div style="font-size:48px; margin-bottom:var(--space-4);">⏱️</div>
            <div class="empty-state__title">No sessions yet</div>
            <div class="empty-state__text">Start your first focus session to begin tracking your deep work.</div>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:var(--space-2);">
            ${sessions.map((s, i) => `
              <div style="display:flex; align-items:center; gap:var(--space-3); padding:var(--space-3) var(--space-4); background:var(--glass-bg); border-radius:var(--radius-md); border:1px solid var(--glass-border);">
                <div style="width:32px; height:32px; border-radius:50%; background:var(--accent-cyan-dim); color:var(--accent-cyan); display:flex; align-items:center; justify-content:center; font-size:var(--text-sm); font-weight:var(--weight-bold);">${i + 1}</div>
                <div style="flex:1;">
                  <div style="font-size:var(--text-sm); font-weight:var(--weight-medium);">${s.duration || 25} min focus session</div>
                  <div style="font-size:var(--text-xs); color:var(--text-tertiary);">${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                ${s.rating ? `<span class="badge badge--cyan">${s.rating}/5</span>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Setup live timer updates
    AppEvents.off('focus:tick', _liveUpdate);
    AppEvents.on('focus:tick', _liveUpdate);
  }

  function _liveUpdate({ remaining, total }) {
    const timeEl = Utils.$('focusTimeDisplay');
    if (timeEl) timeEl.textContent = Utils.formatTime(remaining);

    const ringEl = Utils.$('focusRingProgress');
    if (ringEl && total > 0) {
      const circumference = 2 * Math.PI * 120;
      const progress = (total - remaining) / total;
      ringEl.style.strokeDashoffset = circumference * (1 - progress);
    }
  }

  function start() {
    const settings = Store.getSettings();
    let duration;
    if (_phase === 'shortBreak') duration = settings.shortBreak * 60;
    else if (_phase === 'longBreak') duration = settings.longBreak * 60;
    else duration = settings.focusDuration * 60;

    _running = true;

    TimerEngine.create('focus', duration,
      (remaining) => {
        AppEvents.emit('focus:tick', { remaining, total: duration });
      },
      () => {
        // Timer completed
        _running = false;
        if (_phase === 'focus') {
          _sessionsCompleted++;
          _totalFocusSec += duration;

          // Save session
          const data = Store.getFocusData();
          const sessions = data.sessions || [];
          sessions.push({
            duration: Math.round(duration / 60),
            timestamp: Date.now(),
            phase: 'focus'
          });
          Store.updateFocusData({
            sessions,
            totalFocusMinutes: (data.totalFocusMinutes || 0) + Math.round(duration / 60)
          });

          Notifications.toast('Focus Session Complete! 🎉', `${Math.round(duration / 60)} minutes of deep work logged.`, 'success');

          // Auto switch to break
          if (_sessionsCompleted % (settings.longBreakAfter || 4) === 0) {
            _phase = 'longBreak';
          } else {
            _phase = 'shortBreak';
          }
        } else {
          // Break complete
          Notifications.toast('Break Over', 'Ready for another focus session?', 'info');
          _phase = 'focus';
        }
        render();
      },
      { repeat: false }
    );

    render();
  }

  function pause() {
    TimerEngine.pause('focus');
    _running = false;
    render();
  }

  function reset() {
    TimerEngine.stop('focus');
    _running = false;
    render();
  }

  function setPhase(phase) {
    if (_running) {
      TimerEngine.stop('focus');
      _running = false;
    }
    _phase = phase;
    render();
  }

  function updateSetting(key, value) {
    Store.updateSettings({ [key]: parseInt(value) });
    if (!_running) render();
  }

  function onShow() {
    const data = Store.getFocusData();
    _sessionsCompleted = (data.sessions || []).length;
    render();
  }

  return { init, render, onShow, start, pause, reset, setPhase, updateSetting };
})();
