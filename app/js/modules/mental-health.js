/* ============================================================
   MENTAL HEALTH & RESILIENCE MODULE
   ============================================================ */

const MentalHealthModule = (() => {
  let _initialized = false;
  let _breathingInterval = null;

  const MOODS = [
    { value: 1, emoji: '😫', label: 'Awful' },
    { value: 2, emoji: '😞', label: 'Bad' },
    { value: 3, emoji: '😕', label: 'Poor' },
    { value: 4, emoji: '😐', label: 'Meh' },
    { value: 5, emoji: '🙂', label: 'Okay' },
    { value: 6, emoji: '😊', label: 'Good' },
    { value: 7, emoji: '😄', label: 'Great' },
    { value: 8, emoji: '🤩', label: 'Amazing' },
  ];

  const GROUNDING_STEPS = [
    { count: 5, sense: 'SEE', prompt: 'Name 5 things you can see around you' },
    { count: 4, sense: 'TOUCH', prompt: 'Name 4 things you can physically feel' },
    { count: 3, sense: 'HEAR', prompt: 'Name 3 things you can hear right now' },
    { count: 2, sense: 'SMELL', prompt: 'Name 2 things you can smell' },
    { count: 1, sense: 'TASTE', prompt: 'Name 1 thing you can taste' },
  ];

  const RESILIENCE_TRACKS = [
    { key: 'reframe', icon: '🔄', title: 'Cognitive Reframing', desc: 'Learn to identify and challenge unhelpful thought patterns', exercises: [
      'Notice a stressful thought → Write it down exactly',
      'Ask: "Is this thought based on facts or assumptions?"',
      'Generate an alternative, more balanced perspective',
      'Rate: How do you feel after reframing? (1-10)',
    ]},
    { key: 'gratitude', icon: '🙏', title: 'Gratitude Practice', desc: 'Strengthen your focus on positive aspects of life', exercises: [
      'Write down 3 things you\'re grateful for today',
      'Include one thing about your work you appreciate',
      'Note one person who made a positive impact recently',
      'Reflect: How does focusing on gratitude change your mood?',
    ]},
    { key: 'values', icon: '🧭', title: 'Values Clarification', desc: 'Reconnect with what matters most to you', exercises: [
      'List your top 5 personal values',
      'Rate how well your current work aligns with each (1-10)',
      'Identify one small action to better align with a value',
      'Commit to that action for the next 3 days',
    ]},
    { key: 'psychoed', icon: '📚', title: 'Understanding Stress', desc: 'Learn about the science of stress and recovery', exercises: [
      'Read: Stress is a normal response, not a weakness',
      'Learn: Acute vs chronic stress — when it becomes harmful',
      'Identify: Your top 3 workplace stress triggers',
      'Plan: One coping strategy for each trigger',
    ]},
  ];

  function init() {
    if (_initialized) return;
    _initialized = true;
    render();
  }

  function render() {
    const page = Utils.$('page-mental-health');
    const data = Store.getMentalData();
    const mood = data.mood || 0;
    const stress = data.stress || 0;
    const exercisesDone = data.exercisesDone || [];

    page.innerHTML = `
      <!-- Crisis disclaimer -->
      <div class="disclaimer disclaimer--danger" style="margin-bottom: var(--space-6);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <strong>This is not a clinical tool.</strong> If you're in crisis or experiencing severe distress, please reach out:
          <a href="tel:988" style="color:var(--accent-rose); text-decoration:underline;">988 Suicide & Crisis Lifeline</a> |
          <a href="sms:741741" style="color:var(--accent-rose); text-decoration:underline;">Crisis Text Line (text HOME to 741741)</a>
        </div>
      </div>

      <div class="section-header">
        <h2>Mental Health & Resilience</h2>
        <div class="section-header__actions">
          <button class="btn btn--primary" onclick="MentalHealthModule.startBreathing()" style="background:linear-gradient(135deg, var(--accent-violet), var(--accent-blue));">
            🧘 I Feel Stressed
          </button>
        </div>
      </div>

      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        <!-- Mood Check-in -->
        <div class="card card--glow-violet">
          <div class="card__title" style="margin-bottom:var(--space-4);">How are you feeling?</div>
          <div class="mood-scale">
            ${MOODS.map(m => `
              <div class="mood-scale__item ${mood === m.value ? 'selected' : ''}" onclick="MentalHealthModule.setMood(${m.value})">
                <span class="mood-scale__emoji">${m.emoji}</span>
                <span class="mood-scale__label">${m.label}</span>
              </div>
            `).join('')}
          </div>
          ${mood > 0 ? `<p style="text-align:center; font-size:var(--text-sm); color:var(--accent-violet); margin-top:var(--space-2);">Current mood: ${MOODS.find(m => m.value === mood)?.label || mood}/8</p>` : ''}
        </div>

        <!-- Stress Level -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Stress Level</div>
          <div style="text-align:center; margin-bottom:var(--space-4);">
            <div style="font-size:var(--text-3xl); font-weight:var(--weight-bold); color:${stress > 6 ? 'var(--accent-rose)' : stress > 3 ? 'var(--accent-amber)' : 'var(--accent-green)'};">${stress || '—'}</div>
            <div style="font-size:var(--text-xs); color:var(--text-tertiary);">/ 10</div>
          </div>
          <input type="range" class="slider" min="0" max="10" value="${stress}" onchange="MentalHealthModule.setStress(this.value)" style="width:100%;">
          <div style="display:flex; justify-content:space-between; margin-top:var(--space-2);">
            <span style="font-size:var(--text-xs); color:var(--text-tertiary);">Calm</span>
            <span style="font-size:var(--text-xs); color:var(--text-tertiary);">Very Stressed</span>
          </div>
        </div>

        <!-- Weekly Mood Trend -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Mood Trend</div>
          <div id="mentalMoodChart" style="width:100%; height:120px;"></div>
          ${_getBurnoutIndicator()}
        </div>
      </div>

      <!-- Quick Interventions -->
      <div class="section-header">
        <h3>Stress Microinterventions</h3>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary);">3-5 minute exercises to reduce stress</p>
      </div>
      <div class="grid grid--4 anim-stagger" style="margin-bottom: var(--space-8);">
        <div class="card card--compact card--interactive card--glow-violet" onclick="MentalHealthModule.startBreathing()" style="text-align:center;">
          <div style="font-size:36px; margin-bottom:var(--space-2);">🫁</div>
          <div class="card__title" style="font-size:var(--text-sm);">Box Breathing</div>
          <div style="font-size:var(--text-xs); color:var(--text-tertiary);">4-4-4-4 pattern</div>
        </div>
        <div class="card card--compact card--interactive" onclick="MentalHealthModule.startMindfulness()" style="text-align:center;">
          <div style="font-size:36px; margin-bottom:var(--space-2);">🧘</div>
          <div class="card__title" style="font-size:var(--text-sm);">3-Min Mindfulness</div>
          <div style="font-size:var(--text-xs); color:var(--text-tertiary);">Present awareness</div>
        </div>
        <div class="card card--compact card--interactive" onclick="MentalHealthModule.startGrounding()" style="text-align:center;">
          <div style="font-size:36px; margin-bottom:var(--space-2);">🌍</div>
          <div class="card__title" style="font-size:var(--text-sm);">5-4-3-2-1</div>
          <div style="font-size:var(--text-xs); color:var(--text-tertiary);">Grounding exercise</div>
        </div>
        <div class="card card--compact card--interactive" onclick="MentalHealthModule.startBodyScan()" style="text-align:center;">
          <div style="font-size:36px; margin-bottom:var(--space-2);">🧍</div>
          <div class="card__title" style="font-size:var(--text-sm);">Body Scan</div>
          <div style="font-size:var(--text-xs); color:var(--text-tertiary);">Release tension</div>
        </div>
      </div>

      <!-- Resilience Tracks -->
      <div class="section-header">
        <h3>Resilience Building</h3>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary);">Self-guided programs for long-term well-being</p>
      </div>
      <div class="grid grid--2 anim-stagger" style="margin-bottom: var(--space-8);">
        ${RESILIENCE_TRACKS.map(track => `
          <div class="resilience-card" onclick="MentalHealthModule.openTrack('${track.key}')">
            <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-3);">
              <span style="font-size:28px;">${track.icon}</span>
              <div>
                <div style="font-weight:var(--weight-semibold);">${track.title}</div>
                <div style="font-size:var(--text-xs); color:var(--text-tertiary);">${track.desc}</div>
              </div>
            </div>
            <div class="progress" style="margin-top:var(--space-2);">
              <div class="progress__fill progress__fill--violet" style="width:${_getTrackProgress(track.key, data)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Gratitude Journal -->
      <div class="section-header">
        <h3>Gratitude Journal</h3>
      </div>
      <div class="card">
        <textarea class="input" id="mentalJournal" placeholder="What are you grateful for today? Write freely..." style="width:100%; min-height:100px;">${(data.journalEntries || []).join('\n')}</textarea>
        <div style="margin-top:var(--space-3); display:flex; justify-content:flex-end;">
          <button class="btn btn--primary btn--sm" onclick="MentalHealthModule.saveJournal()">Save Entry</button>
        </div>
      </div>
    `;

    // Mood trend chart
    setTimeout(() => {
      const chartEl = Utils.$('mentalMoodChart');
      if (chartEl) {
        const week = Store.getWeeklyData('mental', 7);
        Charts.lineChart(chartEl, week.map(d => Utils.dayName(d.date)),
          [
            { data: week.map(d => d.data.mood || 0), color: 'violet' },
            { data: week.map(d => d.data.stress || 0), color: 'rose' },
          ], { height: 120 });
      }
    }, 150);
  }

  function _getBurnoutIndicator() {
    const week = Store.getWeeklyData('mental', 7);
    const moodAvg = week.reduce((s, d) => s + (d.data.mood || 5), 0) / 7;
    const stressAvg = week.reduce((s, d) => s + (d.data.stress || 3), 0) / 7;
    const burnoutRisk = stressAvg > 6 && moodAvg < 4;

    if (burnoutRisk) {
      return `<div style="margin-top:var(--space-3); padding:var(--space-2) var(--space-3); background:var(--accent-rose-dim); border-radius:var(--radius-md); font-size:var(--text-xs); color:var(--accent-rose); display:flex; align-items:center; gap:var(--space-2);">
        ⚠️ Burnout indicators trending upward. Consider taking a longer break.
      </div>`;
    }
    return '';
  }

  function _getTrackProgress(key, data) {
    const completed = data.trackProgress?.[key] || 0;
    const track = RESILIENCE_TRACKS.find(t => t.key === key);
    if (!track) return 0;
    return Math.min((completed / track.exercises.length) * 100, 100);
  }

  function setMood(value) {
    Store.updateMentalData({ mood: value });
    if (value <= 2) {
      Notifications.toast('We\'re here for you', 'Consider trying a breathing exercise or reaching out to someone you trust.', 'warning');
    }
    render();
  }

  function setStress(value) {
    Store.updateMentalData({ stress: parseInt(value) });
    if (parseInt(value) >= 8) {
      Notifications.toast('High Stress Detected', 'Would you like to try a quick breathing exercise?', 'warning');
    }
    render();
  }

  function startBreathing() {
    let phase = 0;
    const phases = ['Breathe In', 'Hold', 'Breathe Out', 'Hold'];
    const phaseDuration = 4; // 4 seconds each
    const totalCycles = 4;
    let cycleCount = 0;
    let secondsInPhase = 0;

    Notifications.showBreak(
      '🫁 Box Breathing',
      `${phases[0]}... ${phaseDuration}`,
      phaseDuration * 4 * totalCycles,
      (result) => {
        if (result === 'completed') {
          _logExercise('box-breathing');
          Notifications.toast('Breathing Complete', 'Notice how you feel. Calmer? More centered?', 'success');
        }
      }
    );
  }

  function startMindfulness() {
    Notifications.showBreak(
      '🧘 Mindfulness Moment',
      'Close your eyes. Focus on your breath. Notice thoughts without judgment. Let them pass like clouds.',
      180,
      (result) => {
        if (result === 'completed') {
          _logExercise('mindfulness');
          Notifications.toast('Mindfulness Complete', 'You just spent 3 minutes being present. Well done!', 'success');
        }
      }
    );
  }

  function startGrounding() {
    const steps = GROUNDING_STEPS.map(s => `${s.count} ${s.sense}: ${s.prompt}`).join('\n\n');
    Notifications.showBreak(
      '🌍 5-4-3-2-1 Grounding',
      `Work through each sense:\n${GROUNDING_STEPS[0].count} things you can ${GROUNDING_STEPS[0].sense}`,
      120,
      (result) => {
        if (result === 'completed') {
          _logExercise('grounding');
          Notifications.toast('Grounding Complete', 'You are anchored in the present moment.', 'success');
        }
      }
    );
  }

  function startBodyScan() {
    Notifications.showBreak(
      '🧍 Body Scan',
      'Starting from your head, slowly notice each part of your body. Release any tension you find. Move from head → neck → shoulders → arms → torso → legs → feet.',
      180,
      (result) => {
        if (result === 'completed') {
          _logExercise('body-scan');
        }
      }
    );
  }

  function _logExercise(name) {
    const data = Store.getMentalData();
    const exercises = data.exercisesDone || [];
    exercises.push({ name, timestamp: Date.now() });
    Store.updateMentalData({ exercisesDone: exercises });
  }

  function openTrack(key) {
    const track = RESILIENCE_TRACKS.find(t => t.key === key);
    if (!track) return;
    const data = Store.getMentalData();
    const progress = data.trackProgress?.[key] || 0;

    const exercisesHTML = track.exercises.map((ex, i) => `
      <div class="grounding-step ${i < progress ? 'active' : ''}" style="cursor:pointer;" onclick="MentalHealthModule.completeTrackStep('${key}', ${i})">
        <div class="grounding-step__number">${i + 1}</div>
        <div style="flex:1;">
          <div style="font-size:var(--text-sm); ${i < progress ? 'text-decoration:line-through; color:var(--text-tertiary);' : ''}">${ex}</div>
        </div>
      </div>
    `).join('');

    Notifications.modal(
      `${track.icon} ${track.title}`,
      `<p style="color:var(--text-secondary); margin-bottom:var(--space-4);">${track.desc}</p>${exercisesHTML}`,
      [{ label: 'Close', value: 'close' }]
    );
  }

  function completeTrackStep(key, step) {
    const data = Store.getMentalData();
    const trackProgress = data.trackProgress || {};
    trackProgress[key] = Math.max(trackProgress[key] || 0, step + 1);
    Store.updateMentalData({ trackProgress });
    Notifications.closeModal();
    openTrack(key);
  }

  function saveJournal() {
    const text = Utils.$('mentalJournal')?.value || '';
    const entries = text.split('\n').filter(l => l.trim());
    Store.updateMentalData({ journalEntries: entries });
    Notifications.toast('Journal Saved', 'Your gratitude entries have been saved.', 'success');
  }

  function onShow() { render(); }

  return {
    init, render, onShow,
    setMood, setStress,
    startBreathing, startMindfulness, startGrounding, startBodyScan,
    openTrack, completeTrackStep, saveJournal
  };
})();
