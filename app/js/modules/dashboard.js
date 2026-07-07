/* ============================================================
   DASHBOARD MODULE
   ============================================================ */

const DashboardModule = (() => {
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;
    render();
    
    // Listen for data changes to refresh
    AppEvents.on('data:eye', refresh);
    AppEvents.on('data:movement', refresh);
    AppEvents.on('data:msk', refresh);
    AppEvents.on('data:mental', refresh);
    AppEvents.on('data:lifestyle', refresh);
    AppEvents.on('data:focus', refresh);
  }

  function render() {
    const page = Utils.$('page-dashboard');
    const score = Store.getHealthScore();
    const eye = Store.getEyeData();
    const mov = Store.getMovementData();
    const msk = Store.getMskData();
    const mental = Store.getMentalData();
    const life = Store.getLifestyleData();
    const focus = Store.getFocusData();
    const settings = Store.getSettings();

    const breaksTaken = eye.breaksTaken || 0;
    const standingMin = mov.standingMinutes || 0;
    const standingGoal = settings.standingGoal || 120;
    const mskLevel = _getMskLevel(msk);
    const mood = mental.mood || 0;
    const focusMin = focus.totalFocusMinutes || 0;
    const hydration = life.hydration || 0;
    const hydrationGoal = settings.hydrationGoal || 8;

    page.innerHTML = `
      <div class="section-header">
        <div>
          <h2>${Utils.greeting()} 👋</h2>
          <p style="margin-top: var(--space-2);">Here's your health overview for today</p>
        </div>
        <div class="section-header__actions">
          <span class="badge badge--cyan">
            <span style="font-size: 10px;">●</span>
            ${Utils.today()}
          </span>
        </div>
      </div>

      <!-- Health Score + Quick Stats -->
      <div class="grid grid--dashboard anim-stagger" style="margin-bottom: var(--space-8);">
        
        <!-- Health Score Ring -->
        <div class="card card--glow-cyan" style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div id="dashHealthGauge" style="width:180px; height:180px;"></div>
          <p style="text-align:center; margin-top: var(--space-3); color: var(--text-secondary); font-size: var(--text-sm);">Composite Health Score</p>
        </div>

        <!-- Quick Stats Grid -->
        <div class="grid grid--2 grid__span-2" style="gap: var(--space-4);">
          
          <!-- Eye Breaks -->
          <div class="card card--compact card--glow-cyan card--interactive" onclick="App.navigate('eye-health')">
            <div class="card__header">
              <div class="card__icon card__icon--cyan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <span class="card__trend card__trend--${breaksTaken > 3 ? 'up' : 'neutral'}">
                ${breaksTaken > 3 ? '↑ Good' : '—'}
              </span>
            </div>
            <div class="card__value">${breaksTaken}</div>
            <div class="card__label">Eye breaks taken</div>
          </div>

          <!-- Standing Time -->
          <div class="card card--compact card--glow-green card--interactive" onclick="App.navigate('movement')">
            <div class="card__header">
              <div class="card__icon card__icon--green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>
              </div>
              <span class="card__trend card__trend--${standingMin >= standingGoal ? 'up' : 'neutral'}">
                ${Utils.pct(standingMin, standingGoal)}%
              </span>
            </div>
            <div class="card__value">${standingMin}<span style="font-size:var(--text-sm); color:var(--text-tertiary);">min</span></div>
            <div class="card__label">Standing / Activity</div>
            <div class="progress" style="margin-top:var(--space-2)"><div class="progress__fill progress__fill--green" style="width:${Math.min(Utils.pct(standingMin, standingGoal), 100)}%"></div></div>
          </div>

          <!-- MSK Status -->
          <div class="card card--compact card--glow-amber card--interactive" onclick="App.navigate('musculoskeletal')">
            <div class="card__header">
              <div class="card__icon card__icon--${mskLevel.color}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M12 8v8"/><path d="M8 12h8"/><path d="M9 20l3-4 3 4"/></svg>
              </div>
            </div>
            <div class="card__value" style="color: var(--accent-${mskLevel.color})">${mskLevel.label}</div>
            <div class="card__label">Body Comfort</div>
          </div>

          <!-- Mood -->
          <div class="card card--compact card--glow-violet card--interactive" onclick="App.navigate('mental-health')">
            <div class="card__header">
              <div class="card__icon card__icon--violet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              </div>
            </div>
            <div class="card__value">${mood > 0 ? mood + '/10' : '—'}</div>
            <div class="card__label">Mood Score</div>
          </div>

          <!-- Focus Time -->
          <div class="card card--compact card--interactive" onclick="App.navigate('focus')">
            <div class="card__header">
              <div class="card__icon card__icon--blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
              </div>
            </div>
            <div class="card__value">${focusMin}<span style="font-size:var(--text-sm); color:var(--text-tertiary);">min</span></div>
            <div class="card__label">Deep Work Today</div>
          </div>

          <!-- Hydration -->
          <div class="card card--compact card--interactive" onclick="App.navigate('lifestyle')">
            <div class="card__header">
              <div class="card__icon card__icon--cyan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              </div>
            </div>
            <div class="card__value">${hydration}<span style="font-size:var(--text-sm); color:var(--text-tertiary);">/${hydrationGoal}</span></div>
            <div class="card__label">Glasses of Water</div>
          </div>
        </div>
      </div>

      <!-- 7-Day Trends -->
      <div class="section-header">
        <h3>7-Day Trends</h3>
      </div>
      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        <div class="card card--compact">
          <div class="card__title" style="margin-bottom:var(--space-3);">Eye Breaks</div>
          <div id="dashSparkEye" style="width:100%; height:50px;"></div>
        </div>
        <div class="card card--compact">
          <div class="card__title" style="margin-bottom:var(--space-3);">Standing Time</div>
          <div id="dashSparkMovement" style="width:100%; height:50px;"></div>
        </div>
        <div class="card card--compact">
          <div class="card__title" style="margin-bottom:var(--space-3);">Mood</div>
          <div id="dashSparkMood" style="width:100%; height:50px;"></div>
        </div>
      </div>

      <!-- Activity Timeline -->
      <div class="section-header">
        <h3>Today's Activity</h3>
      </div>
      <div class="card" style="margin-bottom: var(--space-8);">
        <div id="dashTimeline" class="timeline" style="height: 40px;"></div>
        <div class="timeline__legend">
          <div class="timeline__legend-item"><div class="timeline__legend-dot" style="background:var(--accent-cyan)"></div>Focus</div>
          <div class="timeline__legend-item"><div class="timeline__legend-dot" style="background:var(--accent-green)"></div>Break</div>
          <div class="timeline__legend-item"><div class="timeline__legend-dot" style="background:var(--accent-amber)"></div>Movement</div>
          <div class="timeline__legend-item"><div class="timeline__legend-dot" style="background:var(--accent-violet)"></div>Mental</div>
          <div class="timeline__legend-item"><div class="timeline__legend-dot" style="background:var(--bg-tertiary)"></div>Idle</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="section-header">
        <h3>Quick Actions</h3>
      </div>
      <div class="grid grid--4 anim-stagger">
        <button class="card card--compact card--interactive card--glow-cyan" onclick="EyeHealthModule.triggerBreak()" style="text-align:center; border:none; cursor:pointer;">
          <div style="font-size:28px; margin-bottom:var(--space-2);">👁️</div>
          <div class="card__title" style="font-size:var(--text-sm);">Eye Break</div>
        </button>
        <button class="card card--compact card--interactive card--glow-green" onclick="MovementModule.triggerMovement()" style="text-align:center; border:none; cursor:pointer;">
          <div style="font-size:28px; margin-bottom:var(--space-2);">🚶</div>
          <div class="card__title" style="font-size:var(--text-sm);">Move Now</div>
        </button>
        <button class="card card--compact card--interactive card--glow-violet" onclick="MentalHealthModule.startBreathing()" style="text-align:center; border:none; cursor:pointer;">
          <div style="font-size:28px; margin-bottom:var(--space-2);">🧘</div>
          <div class="card__title" style="font-size:var(--text-sm);">Breathe</div>
        </button>
        <button class="card card--compact card--interactive" onclick="App.navigate('ai-coach')" style="text-align:center; border:none; cursor:pointer;">
          <div style="font-size:28px; margin-bottom:var(--space-2);">🤖</div>
          <div class="card__title" style="font-size:var(--text-sm);">AI Coach</div>
        </button>
      </div>
    `;

    _renderCharts(score);
  }

  function _renderCharts(score) {
    // Health score gauge
    setTimeout(() => {
      const gaugeEl = Utils.$('dashHealthGauge');
      if (gaugeEl) Charts.gauge(gaugeEl, score, 100, { size: 180, label: 'HEALTH' });
    }, 100);

    // Sparklines
    const eyeWeek = Store.getWeeklyData('eye', 7).map(d => d.data.breaksTaken || 0);
    const movWeek = Store.getWeeklyData('movement', 7).map(d => d.data.standingMinutes || 0);
    const moodWeek = Store.getWeeklyData('mental', 7).map(d => d.data.mood || 0);

    setTimeout(() => {
      const sparkEye = Utils.$('dashSparkEye');
      if (sparkEye) Charts.sparkline(sparkEye, eyeWeek, 'cyan', { height: 50 });

      const sparkMov = Utils.$('dashSparkMovement');
      if (sparkMov) Charts.sparkline(sparkMov, movWeek, 'green', { height: 50 });

      const sparkMood = Utils.$('dashSparkMood');
      if (sparkMood) Charts.sparkline(sparkMood, moodWeek, 'violet', { height: 50 });
    }, 200);

    // Timeline
    _renderTimeline();
  }

  function _renderTimeline() {
    const timeline = Utils.$('dashTimeline');
    if (!timeline) return;

    // Generate sample blocks based on current hour
    const hour = Utils.currentHour();
    const settings = Store.getSettings();
    const startH = parseInt(settings.workStart?.split(':')[0]) || 9;
    const endH = parseInt(settings.workEnd?.split(':')[0]) || 18;
    const totalBlocks = Math.max((endH - startH) * 4, 8); // 15-min blocks

    let html = '';
    for (let i = 0; i < totalBlocks; i++) {
      const blockHour = startH + Math.floor(i / 4);
      let type = 'idle';
      if (blockHour < hour) {
        // Past blocks — mix types based on data
        const rand = Math.random();
        if (rand < 0.5) type = 'focus';
        else if (rand < 0.7) type = 'break';
        else if (rand < 0.85) type = 'movement';
        else type = 'mental';
      }
      const width = 100 / totalBlocks;
      html += `<div class="timeline__block timeline__block--${type}" style="width:${width}%" title="${blockHour}:${String((i % 4) * 15).padStart(2, '0')} — ${type}"></div>`;
    }
    timeline.innerHTML = html;
  }

  function _getMskLevel(msk) {
    if (!msk.discomfort) return { label: 'Good', color: 'green' };
    const vals = Object.values(msk.discomfort);
    if (vals.length === 0) return { label: 'Good', color: 'green' };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg < 3) return { label: 'Good', color: 'green' };
    if (avg < 6) return { label: 'Fair', color: 'amber' };
    return { label: 'Poor', color: 'rose' };
  }

  const refresh = Utils.debounce(() => {
    if (Utils.$('page-dashboard') && !Utils.$('page-dashboard').classList.contains('page--hidden')) {
      render();
    }
  }, 500);

  function onShow() {
    render();
  }

  return { init, render, onShow };
})();
