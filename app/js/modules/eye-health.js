/* ============================================================
   EYE HEALTH MODULE
   ============================================================ */

const EyeHealthModule = (() => {
  let _initialized = false;
  let _timerActive = false;

  const EXERCISES = [
    { name: 'Distance Focus', icon: '🔭', instruction: 'Look at an object at least 20 feet (6 meters) away for 20 seconds. Let your eye muscles relax.', duration: 20 },
    { name: 'Palming', icon: '🙌', instruction: 'Rub your palms together to warm them, then gently cup them over your closed eyes for 30 seconds.', duration: 30 },
    { name: 'Figure-8 Tracking', icon: '🔄', instruction: 'Imagine a figure-8 about 10 feet away. Trace it slowly with your eyes for 30 seconds.', duration: 30 },
    { name: 'Blink Break', icon: '😌', instruction: 'Close your eyes gently, then blink rapidly 20 times. This helps re-coat your eyes with tears.', duration: 15 },
    { name: 'Near-Far Focus', icon: '📏', instruction: 'Hold your thumb 10 inches away. Focus on it for 5 seconds, then focus on something far away. Repeat 5 times.', duration: 25 },
  ];

  const DES_SYMPTOMS = [
    { key: 'eyeStrain', label: 'Eye Strain', icon: '👀' },
    { key: 'dryness', label: 'Dryness', icon: '💧' },
    { key: 'headache', label: 'Headache', icon: '🤕' },
    { key: 'blurredVision', label: 'Blurred Vision', icon: '🌫️' },
    { key: 'neckPain', label: 'Neck/Shoulder Pain', icon: '😣' },
  ];

  function init() {
    if (_initialized) return;
    _initialized = true;
    _startEyeTimer();
    render();
  }

  function _startEyeTimer() {
    const settings = Store.getSettings();
    if (!settings.modules.eyeHealth) return;

    const intervalSec = settings.eyeBreakInterval * 60;

    TimerEngine.create('eyeBreak', intervalSec,
      // onTick
      (remaining) => {
        AppEvents.emit('eye:tick', { remaining });
      },
      // onFire
      () => {
        if (!TimerEngine.isInterventionActive()) {
          triggerBreak();
        }
      },
      { repeat: true }
    );
    _timerActive = true;
  }

  function triggerBreak() {
    const exercise = Utils.randomFrom(EXERCISES);
    const settings = Store.getSettings();
    const duration = settings.eyeBreakDuration || 20;

    Notifications.showBreak(
      `👁️ ${exercise.name}`,
      exercise.instruction,
      duration,
      (result) => {
        const data = Store.getEyeData();
        if (result === 'completed') {
          Store.updateEyeData({
            breaksTaken: (data.breaksTaken || 0) + 1,
            lastBreak: Date.now()
          });
        } else {
          Store.updateEyeData({
            breaksSkipped: (data.breaksSkipped || 0) + 1
          });
        }
        // Re-render if page is active
        if (!Utils.$('page-eye-health').classList.contains('page--hidden')) {
          render();
        }
      }
    );
  }

  function render() {
    const page = Utils.$('page-eye-health');
    const data = Store.getEyeData();
    const settings = Store.getSettings();
    const timerState = TimerEngine.getState('eyeBreak');
    const remaining = timerState ? timerState.remaining : 0;
    const breaksTaken = data.breaksTaken || 0;
    const breaksSkipped = data.breaksSkipped || 0;
    const totalBreaks = breaksTaken + breaksSkipped;
    const adherence = totalBreaks > 0 ? Math.round((breaksTaken / totalBreaks) * 100) : 100;

    page.innerHTML = `
      <div class="section-header">
        <h2>Eye Health</h2>
        <div class="section-header__actions">
          <button class="btn btn--primary" onclick="EyeHealthModule.triggerBreak()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Take Break Now
          </button>
        </div>
      </div>

      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        <!-- Next Break Timer -->
        <div class="card card--glow-cyan" style="text-align:center;">
          <div class="card__title" style="margin-bottom:var(--space-4);">Next Eye Break</div>
          <div id="eyeTimerDisplay" style="font-family:var(--font-heading); font-size:var(--text-3xl); font-weight:var(--weight-bold); font-variant-numeric:tabular-nums; color:var(--accent-cyan);">${Utils.formatTime(remaining)}</div>
          <p style="font-size:var(--text-sm); color:var(--text-tertiary); margin-top:var(--space-2);">Every ${settings.eyeBreakInterval} min</p>
          <div style="margin-top:var(--space-4); display:flex; gap:var(--space-2); justify-content:center;">
            <button class="btn btn--sm btn--secondary" onclick="EyeHealthModule.toggleTimer()">
              ${_timerActive ? 'Pause' : 'Resume'}
            </button>
            <button class="btn btn--sm btn--ghost" onclick="EyeHealthModule.resetTimer()">Reset</button>
          </div>
        </div>

        <!-- Today's Stats -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Today's Stats</div>
          <div style="display:flex; justify-content:space-around; text-align:center;">
            <div>
              <div style="font-size:var(--text-2xl); font-weight:var(--weight-bold); color:var(--accent-green);">${breaksTaken}</div>
              <div style="font-size:var(--text-xs); color:var(--text-tertiary);">Taken</div>
            </div>
            <div>
              <div style="font-size:var(--text-2xl); font-weight:var(--weight-bold); color:var(--accent-rose);">${breaksSkipped}</div>
              <div style="font-size:var(--text-xs); color:var(--text-tertiary);">Skipped</div>
            </div>
            <div>
              <div style="font-size:var(--text-2xl); font-weight:var(--weight-bold); color:var(--accent-cyan);">${adherence}%</div>
              <div style="font-size:var(--text-xs); color:var(--text-tertiary);">Adherence</div>
            </div>
          </div>
        </div>

        <!-- Weekly Trend -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Weekly Trend</div>
          <div id="eyeWeekChart" style="width:100%; height:120px;"></div>
        </div>
      </div>

      <!-- Eye Exercises -->
      <div class="section-header">
        <h3>Eye Exercises</h3>
      </div>
      <div class="grid grid--auto-fill anim-stagger" style="margin-bottom: var(--space-8);">
        ${EXERCISES.map(ex => `
          <div class="card card--compact card--interactive card--glow-cyan" onclick="EyeHealthModule.startExercise('${ex.name}')" style="text-align:center;">
            <div style="font-size:36px; margin-bottom:var(--space-3);">${ex.icon}</div>
            <div class="card__title" style="font-size:var(--text-sm);">${ex.name}</div>
            <div style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-1);">${ex.duration}s</div>
          </div>
        `).join('')}
      </div>

      <!-- DES Symptom Tracker -->
      <div class="section-header">
        <h3>Digital Eye Strain Check</h3>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary);">Rate your symptoms (0 = none, 10 = severe)</p>
      </div>
      <div class="card" style="margin-bottom: var(--space-8);">
        ${DES_SYMPTOMS.map(s => `
          <div style="display:flex; align-items:center; gap:var(--space-4); padding:var(--space-3) 0; border-bottom:1px solid var(--glass-border);">
            <span style="font-size:20px; width:30px;">${s.icon}</span>
            <span style="flex:1; font-size:var(--text-sm); font-weight:var(--weight-medium);">${s.label}</span>
            <input type="range" class="slider" min="0" max="10" value="${(data.des && data.des[s.key]) || 0}"
                   onchange="EyeHealthModule.updateDES('${s.key}', this.value)"
                   style="width:120px;">
            <span style="width:30px; text-align:right; font-size:var(--text-sm); color:var(--text-secondary); font-variant-numeric:tabular-nums;" id="des-val-${s.key}">${(data.des && data.des[s.key]) || 0}</span>
          </div>
        `).join('')}
      </div>

      <!-- Ergonomic Tips -->
      <div class="section-header">
        <h3>Ergonomic Tips</h3>
      </div>
      <div class="grid grid--3 anim-stagger">
        <div class="card card--compact">
          <div style="font-size:28px; margin-bottom:var(--space-3);">📏</div>
          <div class="card__title" style="font-size:var(--text-sm);">Monitor Distance</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-2);">Keep your screen at arm's length (20-26 inches). The top of the monitor should be at or slightly below eye level.</p>
        </div>
        <div class="card card--compact">
          <div style="font-size:28px; margin-bottom:var(--space-3);">💡</div>
          <div class="card__title" style="font-size:var(--text-sm);">Ambient Lighting</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-2);">Avoid harsh overhead lights. Position your screen to minimize glare from windows. Use bias lighting behind your monitor.</p>
        </div>
        <div class="card card--compact">
          <div style="font-size:28px; margin-bottom:var(--space-3);">🖥️</div>
          <div class="card__title" style="font-size:var(--text-sm);">Display Settings</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-2);">Match screen brightness to your surroundings. Use night mode/blue light filter in the evening. Increase text size if squinting.</p>
        </div>
      </div>
    `;

    // Render weekly chart
    setTimeout(() => {
      const chartEl = Utils.$('eyeWeekChart');
      if (chartEl) {
        const weekData = Store.getWeeklyData('eye', 7);
        const labels = weekData.map(d => Utils.dayName(d.date));
        const values = weekData.map(d => d.data.breaksTaken || 0);
        Charts.barChart(chartEl, labels, [{ data: values, color: 'cyan' }], { height: 120 });
      }
    }, 150);

    // Live timer update
    _setupTimerDisplay();
  }

  function _setupTimerDisplay() {
    AppEvents.off('eye:tick', _updateTimerDisplay);
    AppEvents.on('eye:tick', _updateTimerDisplay);
  }

  function _updateTimerDisplay({ remaining }) {
    const el = Utils.$('eyeTimerDisplay');
    if (el) el.textContent = Utils.formatTime(remaining);
  }

  function toggleTimer() {
    if (_timerActive) {
      TimerEngine.pause('eyeBreak');
      _timerActive = false;
    } else {
      TimerEngine.start('eyeBreak');
      _timerActive = true;
    }
    render();
  }

  function resetTimer() {
    TimerEngine.reset('eyeBreak');
    TimerEngine.start('eyeBreak');
    _timerActive = true;
    render();
  }

  function startExercise(name) {
    const exercise = EXERCISES.find(e => e.name === name);
    if (!exercise) return;
    Notifications.showBreak(
      `👁️ ${exercise.name}`,
      exercise.instruction,
      exercise.duration,
      (result) => {
        if (result === 'completed') {
          const data = Store.getEyeData();
          Store.updateEyeData({ breaksTaken: (data.breaksTaken || 0) + 1, lastBreak: Date.now() });
          Notifications.toast('Exercise Complete', `${exercise.name} done! Your eyes will thank you.`, 'success');
        }
      }
    );
  }

  function updateDES(key, value) {
    const data = Store.getEyeData();
    const des = data.des || {};
    des[key] = parseInt(value);
    Store.updateEyeData({ des, desRating: Object.values(des).reduce((a, b) => a + b, 0) / Object.values(des).length });
    const valEl = Utils.$(`des-val-${key}`);
    if (valEl) valEl.textContent = value;
  }

  function onShow() {
    render();
  }

  return { init, render, onShow, triggerBreak, toggleTimer, resetTimer, startExercise, updateDES };
})();
