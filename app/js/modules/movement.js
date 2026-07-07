/* ============================================================
   MOVEMENT MODULE — Sedentary & Movement Tracking
   ============================================================ */

const MovementModule = (() => {
  let _initialized = false;

  const MOVEMENT_EXERCISES = [
    { name: 'Walk Around', icon: '🚶', duration: '2-5 min', desc: 'Walk around your room, hallway, or building. Take the stairs if available.' },
    { name: 'Standing Stretch', icon: '🧍', duration: '2 min', desc: 'Stand up and reach for the ceiling. Do side bends and gentle twists.' },
    { name: 'Stair Walk', icon: '🪜', duration: '3 min', desc: 'Walk up and down stairs at a comfortable pace. Great for circulation.' },
    { name: 'Calf Raises', icon: '🦶', duration: '1 min', desc: 'Stand and rise onto your toes, hold for 2 seconds, lower. Repeat 15 times.' },
    { name: 'Desk Push-ups', icon: '💪', duration: '2 min', desc: 'Place hands on desk edge, step back, and do 10-15 push-ups.' },
    { name: 'March in Place', icon: '🏃', duration: '2 min', desc: 'March in place, lifting your knees high. Swing your arms naturally.' },
  ];

  function init() {
    if (_initialized) return;
    _initialized = true;
    _startMovementTimer();
    render();
  }

  function _startMovementTimer() {
    const settings = Store.getSettings();
    if (!settings.modules.movement) return;

    const intervalSec = settings.movementInterval * 60;

    TimerEngine.create('movement', intervalSec,
      (remaining) => {
        AppEvents.emit('movement:tick', { remaining });
      },
      () => {
        if (!TimerEngine.isInterventionActive()) {
          triggerMovement();
        }
      },
      { repeat: true }
    );
  }

  function triggerMovement() {
    const exercise = Utils.randomFrom(MOVEMENT_EXERCISES);
    const settings = Store.getSettings();
    const duration = settings.movementDuration * 60; // convert to seconds

    Notifications.showBreak(
      `🚶 Time to Move!`,
      `${exercise.name}: ${exercise.desc}`,
      duration,
      (result) => {
        if (result === 'completed') {
          const data = Store.getMovementData();
          Store.updateMovementData({
            movementBlocks: (data.movementBlocks || 0) + 1,
            standingMinutes: (data.standingMinutes || 0) + settings.movementDuration,
            lastMovement: Date.now()
          });
          Notifications.toast('Movement Complete!', `${exercise.name} — great job staying active!`, 'success');
        }
        if (!Utils.$('page-movement').classList.contains('page--hidden')) render();
      }
    );
  }

  function logStanding(minutes) {
    const data = Store.getMovementData();
    Store.updateMovementData({
      standingMinutes: (data.standingMinutes || 0) + minutes
    });
    Notifications.toast('Standing Logged', `+${minutes} minutes of standing/activity`, 'success');
    render();
  }

  function render() {
    const page = Utils.$('page-movement');
    const data = Store.getMovementData();
    const settings = Store.getSettings();
    const standingMin = data.standingMinutes || 0;
    const goal = settings.standingGoal || 120;
    const blocks = data.movementBlocks || 0;
    const pct = Math.min(Utils.pct(standingMin, goal), 100);
    const timerState = TimerEngine.getState('movement');
    const remaining = timerState ? timerState.remaining : 0;

    page.innerHTML = `
      <div class="section-header">
        <h2>Sedentary & Movement</h2>
        <div class="section-header__actions">
          <button class="btn btn--primary" onclick="MovementModule.triggerMovement()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M13 4v16"/><path d="M17 4v16"/><circle cx="5" cy="9" r="3"/></svg>
            Move Now
          </button>
        </div>
      </div>

      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        <!-- Standing Goal -->
        <div class="card card--glow-green" style="text-align:center;">
          <div class="card__title" style="margin-bottom:var(--space-4);">Daily Standing Goal</div>
          <div id="movGauge" style="width:160px; height:160px; margin:0 auto;"></div>
          <div style="margin-top:var(--space-3); display:flex; justify-content:center; gap:var(--space-4);">
            <button class="btn btn--sm btn--secondary" onclick="MovementModule.logStanding(15)">+15 min</button>
            <button class="btn btn--sm btn--secondary" onclick="MovementModule.logStanding(30)">+30 min</button>
            <button class="btn btn--sm btn--secondary" onclick="MovementModule.logStanding(60)">+60 min</button>
          </div>
        </div>

        <!-- Next Prompt -->
        <div class="card" style="text-align:center;">
          <div class="card__title" style="margin-bottom:var(--space-4);">Next Movement Prompt</div>
          <div id="movTimerDisplay" style="font-family:var(--font-heading); font-size:var(--text-2xl); font-weight:var(--weight-bold); color:var(--accent-amber); font-variant-numeric:tabular-nums;">${Utils.formatTime(remaining)}</div>
          <p style="font-size:var(--text-sm); color:var(--text-tertiary); margin-top:var(--space-2);">Every ${settings.movementInterval} min</p>
          <div style="margin-top:var(--space-6);">
            <div class="card__value">${blocks}</div>
            <div class="card__label">Movement blocks today</div>
          </div>
        </div>

        <!-- Weekly Standing -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Weekly Standing Time</div>
          <div id="movWeekChart" style="width:100%; height:140px;"></div>
        </div>
      </div>

      <!-- Sit-Less Timeline -->
      <div class="section-header">
        <h3>Today's Sit/Stand Timeline</h3>
      </div>
      <div class="card" style="margin-bottom: var(--space-8);">
        <div class="sit-timeline" id="movSitTimeline"></div>
        <div style="display:flex; gap:var(--space-6); margin-top:var(--space-3); flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:var(--space-2); font-size:var(--text-xs); color:var(--text-secondary);">
            <div style="width:12px; height:12px; border-radius:3px; background:hsla(350, 75%, 60%, 0.4);"></div>Sitting
          </div>
          <div style="display:flex; align-items:center; gap:var(--space-2); font-size:var(--text-xs); color:var(--text-secondary);">
            <div style="width:12px; height:12px; border-radius:3px; background:hsla(145, 65%, 48%, 0.5);"></div>Standing
          </div>
          <div style="display:flex; align-items:center; gap:var(--space-2); font-size:var(--text-xs); color:var(--text-secondary);">
            <div style="width:12px; height:12px; border-radius:3px; background:hsla(175, 80%, 48%, 0.5);"></div>Moving
          </div>
        </div>
        <div style="margin-top:var(--space-4);">
          <p style="font-size:var(--text-sm); color:var(--text-secondary);">
            <strong>Goal:</strong> Accumulate ${goal >= 120 ? (goal / 60) + ' hours' : goal + ' minutes'} of standing/light activity per workday.
            Expert guidance recommends starting at 2 hours/day and progressing toward 4 hours/day.
          </p>
        </div>
      </div>

      <!-- Movement Exercises -->
      <div class="section-header">
        <h3>Movement Library</h3>
      </div>
      <div class="grid grid--3 anim-stagger">
        ${MOVEMENT_EXERCISES.map(ex => `
          <div class="movement-card" onclick="MovementModule.startExercise('${ex.name}')">
            <div class="movement-card__icon">${ex.icon}</div>
            <div class="movement-card__info">
              <div class="movement-card__name">${ex.name}</div>
              <div class="movement-card__duration">${ex.duration}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        `).join('')}
      </div>
    `;

    // Charts
    setTimeout(() => {
      const gauge = Utils.$('movGauge');
      if (gauge) Charts.gauge(gauge, standingMin, goal, { size: 160, color: 'green', label: `/ ${goal} MIN` });

      const chartEl = Utils.$('movWeekChart');
      if (chartEl) {
        const week = Store.getWeeklyData('movement', 7);
        Charts.barChart(chartEl, week.map(d => Utils.dayName(d.date)), [{ data: week.map(d => d.data.standingMinutes || 0), color: 'green' }], { height: 140 });
      }
    }, 150);

    // Sit-less timeline
    _renderSitTimeline();

    // Live timer
    AppEvents.off('movement:tick', _updateTimer);
    AppEvents.on('movement:tick', _updateTimer);
  }

  function _updateTimer({ remaining }) {
    const el = Utils.$('movTimerDisplay');
    if (el) el.textContent = Utils.formatTime(remaining);
  }

  function _renderSitTimeline() {
    const timeline = Utils.$('movSitTimeline');
    if (!timeline) return;

    const settings = Store.getSettings();
    const startH = parseInt(settings.workStart?.split(':')[0]) || 9;
    const endH = parseInt(settings.workEnd?.split(':')[0]) || 18;
    const totalBlocks = (endH - startH) * 4;
    const hour = Utils.currentHour();
    const data = Store.getMovementData();
    const standingRatio = data.standingMinutes ? Math.min(data.standingMinutes / ((endH - startH) * 60), 0.5) : 0.1;

    let html = '';
    for (let i = 0; i < totalBlocks; i++) {
      const blockH = startH + Math.floor(i / 4);
      let type = 'sitting';
      if (blockH < hour) {
        const r = Math.random();
        if (r < standingRatio) type = 'moving';
        else if (r < standingRatio * 2.5) type = 'standing';
      }
      html += `<div class="sit-timeline__segment sit-timeline__segment--${type}" style="flex:1;" title="${blockH}:${String((i % 4) * 15).padStart(2, '0')}"></div>`;
    }
    timeline.innerHTML = html;
  }

  function startExercise(name) {
    const ex = MOVEMENT_EXERCISES.find(e => e.name === name);
    if (!ex) return;
    const durSec = parseInt(ex.duration) * 60 || 120;
    Notifications.showBreak(`🏃 ${ex.name}`, ex.desc, durSec, (result) => {
      if (result === 'completed') {
        const data = Store.getMovementData();
        Store.updateMovementData({
          movementBlocks: (data.movementBlocks || 0) + 1,
          standingMinutes: (data.standingMinutes || 0) + Math.ceil(durSec / 60)
        });
      }
      if (!Utils.$('page-movement').classList.contains('page--hidden')) render();
    });
  }

  function onShow() { render(); }

  return { init, render, onShow, triggerMovement, logStanding, startExercise };
})();
