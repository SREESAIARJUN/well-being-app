/* ============================================================
   LIFESTYLE & RECOVERY MODULE
   ============================================================ */

const LifestyleModule = (() => {
  let _initialized = false;

  const NUTRITION_TIPS = [
    { icon: '💧', tip: 'Stay hydrated — aim for 8 glasses of water per day. Dehydration worsens eye strain and fatigue.' },
    { icon: '🐟', tip: 'Include omega-3 rich foods (salmon, walnuts, flaxseed). They support tear film quality and reduce inflammation.' },
    { icon: '🥬', tip: 'Eat leafy greens (kale, spinach) rich in lutein and zeaxanthin — key nutrients for eye health.' },
    { icon: '🫐', tip: 'Berries are packed with antioxidants that combat oxidative stress from prolonged screen exposure.' },
    { icon: '🥚', tip: 'Eggs contain lutein, zeaxanthin, and vitamin E — a powerhouse for eye and brain health.' },
    { icon: '🥕', tip: 'Orange and yellow vegetables provide beta-carotene (vitamin A), essential for vision.' },
    { icon: '🌾', tip: 'Choose whole grains over refined — they provide steady energy without sugar crashes.' },
    { icon: '🥜', tip: 'Nuts and seeds are rich in vitamin E and zinc, supporting both eye health and immunity.' },
  ];

  const SLEEP_TIPS = [
    'Stop using screens 30-60 minutes before bed',
    'Enable night mode / blue light filter after sunset',
    'Keep your bedroom cool (60-67°F / 15-19°C)',
    'Avoid caffeine after 2:00 PM',
    'Establish a consistent sleep and wake time',
    'Use blackout curtains or an eye mask',
    'Try a relaxation technique before sleep',
  ];

  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const RECOVERY_ACTIVITIES = [
    { key: 'outdoor', label: 'Outdoor Walk', icon: '🌳' },
    { key: 'social', label: 'Social Time', icon: '👥' },
    { key: 'offscreen', label: 'Off-Screen', icon: '📵' },
    { key: 'hobby', label: 'Hobby/Creative', icon: '🎨' },
    { key: 'exercise', label: 'Exercise', icon: '🏃' },
    { key: 'nature', label: 'Nature Time', icon: '🏞️' },
  ];

  function init() {
    if (_initialized) return;
    _initialized = true;
    render();
  }

  function render() {
    const page = Utils.$('page-lifestyle');
    const data = Store.getLifestyleData();
    const settings = Store.getSettings();
    const hydration = data.hydration || 0;
    const hydrationGoal = settings.hydrationGoal || 8;
    const fillPct = Math.min((hydration / hydrationGoal) * 100, 100);
    const sleepChecks = data.sleepChecks || {};
    const recoveryPlan = data.recoveryPlan || {};
    const nudgesShown = data.nutritionNudges || 0;

    // Pick 3 random nutrition tips
    const shuffled = [...NUTRITION_TIPS].sort(() => 0.5 - Math.random());
    const tips = shuffled.slice(0, 3);

    page.innerHTML = `
      <div class="section-header">
        <h2>Lifestyle & Recovery</h2>
      </div>

      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        <!-- Hydration Tracker -->
        <div class="card card--glow-cyan" style="text-align:center;">
          <div class="card__title" style="margin-bottom:var(--space-4);">Hydration</div>
          <div class="hydration" style="justify-content:center;">
            <div class="hydration__glass">
              <div class="hydration__fill" style="height:${fillPct}%"></div>
            </div>
            <div style="text-align:left;">
              <div style="font-size:var(--text-2xl); font-weight:var(--weight-bold);">${hydration}</div>
              <div style="font-size:var(--text-xs); color:var(--text-tertiary);">of ${hydrationGoal} glasses</div>
              <div class="hydration__buttons" style="margin-top:var(--space-3);">
                <button class="btn btn--sm btn--primary" onclick="LifestyleModule.addWater(1)">+ 1 Glass</button>
                <button class="btn btn--sm btn--ghost" onclick="LifestyleModule.addWater(-1)">Undo</button>
              </div>
            </div>
          </div>
          <div class="progress" style="margin-top:var(--space-4);">
            <div class="progress__fill" style="width:${fillPct}%;"></div>
          </div>
        </div>

        <!-- Lifestyle Score -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Lifestyle Score</div>
          <div id="lifeScoreGauge" style="width:140px; height:140px; margin:0 auto;"></div>
          <div style="margin-top:var(--space-4);">
            <div style="display:flex; justify-content:space-between; font-size:var(--text-xs); margin-bottom:var(--space-2);">
              <span style="color:var(--text-tertiary);">Hydration</span>
              <span style="color:var(--accent-cyan);">${Utils.pct(hydration, hydrationGoal)}%</span>
            </div>
            <div class="progress" style="margin-bottom:var(--space-3); height:4px;">
              <div class="progress__fill" style="width:${Math.min(Utils.pct(hydration, hydrationGoal), 100)}%"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:var(--text-xs); margin-bottom:var(--space-2);">
              <span style="color:var(--text-tertiary);">Sleep Hygiene</span>
              <span style="color:var(--accent-violet);">${Utils.pct(Object.values(sleepChecks).filter(v => v).length, SLEEP_TIPS.length)}%</span>
            </div>
            <div class="progress" style="height:4px;">
              <div class="progress__fill progress__fill--violet" style="width:${Utils.pct(Object.values(sleepChecks).filter(v => v).length, SLEEP_TIPS.length)}%"></div>
            </div>
          </div>
        </div>

        <!-- Weekly Hydration Chart -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Weekly Hydration</div>
          <div id="lifeHydrationChart" style="width:100%; height:120px;"></div>
        </div>
      </div>

      <!-- Nutrition Nudges -->
      <div class="section-header">
        <h3>Nutrition Tips</h3>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary);">Simple, non-prescriptive dietary guidance</p>
      </div>
      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        ${tips.map(t => `
          <div class="card card--compact">
            <div style="font-size:32px; margin-bottom:var(--space-3);">${t.icon}</div>
            <p style="font-size:var(--text-sm); color:var(--text-secondary); line-height:var(--leading-relaxed);">${t.tip}</p>
          </div>
        `).join('')}
      </div>

      <!-- Sleep Hygiene Coach -->
      <div class="section-header">
        <h3>Sleep Hygiene Checklist</h3>
        <div class="section-header__actions">
          <span class="badge badge--violet">🌙 Wind-down at ${settings.sleepReminder || '22:00'}</span>
        </div>
      </div>
      <div class="card" style="margin-bottom: var(--space-8);">
        ${SLEEP_TIPS.map((tip, i) => `
          <div class="posture-check ${sleepChecks[i] ? 'checked' : ''}" onclick="LifestyleModule.toggleSleep(${i})">
            <div class="posture-check__box">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="14" height="14" style="display:${sleepChecks[i] ? 'block' : 'none'}"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span class="posture-check__label">${tip}</span>
          </div>
        `).join('')}
        <div style="margin-top:var(--space-4); padding-top:var(--space-3); border-top:1px solid var(--glass-border); font-size:var(--text-sm); color:var(--text-secondary);">
          Score: <strong>${Object.values(sleepChecks).filter(v => v).length}/${SLEEP_TIPS.length}</strong>
        </div>
      </div>

      <!-- Recovery Planner -->
      <div class="section-header">
        <h3>Weekly Recovery Plan</h3>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary);">Schedule off-screen time, outdoor walks, and social connections</p>
      </div>
      <div class="card">
        <div style="display:flex; flex-direction:column; gap:var(--space-3);">
          ${DAYS_OF_WEEK.map(day => `
            <div class="recovery-day">
              <div class="recovery-day__name">${day}</div>
              <div class="recovery-day__activities">
                ${RECOVERY_ACTIVITIES.map(act => {
                  const isPlanned = recoveryPlan[day]?.includes(act.key);
                  return `<span class="chip ${isPlanned ? 'active' : ''}" onclick="LifestyleModule.toggleRecovery('${day}', '${act.key}')" style="font-size:var(--text-xs);">${act.icon} ${act.label}</span>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Charts
    setTimeout(() => {
      const scoreEl = Utils.$('lifeScoreGauge');
      if (scoreEl) {
        const lifeScore = _calcLifestyleScore(data, settings);
        Charts.gauge(scoreEl, lifeScore, 100, { size: 140, color: 'cyan', label: 'LIFESTYLE' });
      }

      const chartEl = Utils.$('lifeHydrationChart');
      if (chartEl) {
        const week = Store.getWeeklyData('lifestyle', 7);
        Charts.barChart(chartEl, week.map(d => Utils.dayName(d.date)),
          [{ data: week.map(d => d.data.hydration || 0), color: 'cyan' }], { height: 120 });
      }
    }, 150);
  }

  function _calcLifestyleScore(data, settings) {
    let score = 0;
    const hydration = data.hydration || 0;
    const goal = settings.hydrationGoal || 8;
    score += Math.min((hydration / goal) * 40, 40);

    const sleepChecks = data.sleepChecks || {};
    const sleepScore = Object.values(sleepChecks).filter(v => v).length;
    score += (sleepScore / SLEEP_TIPS.length) * 30;

    const recovery = data.recoveryPlan || {};
    const totalPlanned = Object.values(recovery).reduce((s, arr) => s + (arr?.length || 0), 0);
    score += Math.min(totalPlanned / 7 * 30, 30);

    return Math.round(score);
  }

  function addWater(amount) {
    const data = Store.getLifestyleData();
    const newVal = Math.max(0, (data.hydration || 0) + amount);
    Store.updateLifestyleData({ hydration: newVal });
    if (amount > 0) {
      const settings = Store.getSettings();
      if (newVal >= settings.hydrationGoal) {
        Notifications.toast('Hydration Goal Met! 🎉', 'You\'ve reached your daily water intake goal.', 'success');
      }
    }
    render();
  }

  function toggleSleep(index) {
    const data = Store.getLifestyleData();
    const checks = data.sleepChecks || {};
    checks[index] = !checks[index];
    Store.updateLifestyleData({ sleepChecks: checks });
    render();
  }

  function toggleRecovery(day, activity) {
    const data = Store.getLifestyleData();
    const plan = data.recoveryPlan || {};
    if (!plan[day]) plan[day] = [];
    const idx = plan[day].indexOf(activity);
    if (idx > -1) {
      plan[day].splice(idx, 1);
    } else {
      plan[day].push(activity);
    }
    Store.updateLifestyleData({ recoveryPlan: plan });
    render();
  }

  function onShow() { render(); }

  return { init, render, onShow, addWater, toggleSleep, toggleRecovery };
})();
