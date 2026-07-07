/* ============================================================
   MUSCULOSKELETAL HEALTH MODULE
   ============================================================ */

const MusculoskeletalModule = (() => {
  let _initialized = false;

  const BODY_REGIONS = [
    { key: 'neck', label: 'Neck', top: '8%', left: '35%', width: '30%', height: '8%' },
    { key: 'shoulders', label: 'Shoulders', top: '16%', left: '15%', width: '70%', height: '8%' },
    { key: 'upperBack', label: 'Upper Back', top: '24%', left: '28%', width: '44%', height: '12%' },
    { key: 'lowerBack', label: 'Lower Back', top: '36%', left: '30%', width: '40%', height: '12%' },
    { key: 'wrists', label: 'Wrists', top: '50%', left: '10%', width: '80%', height: '8%' },
  ];

  const EXERCISES = {
    neck: [
      { name: 'Neck Rotations', desc: 'Slowly rotate head in circles. 5 times clockwise, 5 counter-clockwise.', duration: 30 },
      { name: 'Chin Tucks', desc: 'Pull chin straight back, creating a "double chin." Hold 5 sec. Repeat 10x.', duration: 30 },
      { name: 'Side Tilts', desc: 'Tilt ear toward shoulder. Hold 15 sec each side. Do not shrug.', duration: 30 },
    ],
    shoulders: [
      { name: 'Shoulder Rolls', desc: 'Roll shoulders forward 10 times, then backward 10 times. Big, slow circles.', duration: 30 },
      { name: 'Shoulder Shrugs', desc: 'Raise shoulders to ears, hold 5 sec, release. Repeat 10 times.', duration: 30 },
      { name: 'Doorway Stretch', desc: 'Place forearms on doorframe, lean forward gently. Hold 20 sec.', duration: 25 },
    ],
    upperBack: [
      { name: 'Cat-Cow Seated', desc: 'Arch back (cow), then round back (cat). Slow, 10 repetitions.', duration: 30 },
      { name: 'Seated Twist', desc: 'Cross arms, rotate torso left, hold 10 sec. Repeat right side.', duration: 30 },
      { name: 'Upper Back Extension', desc: 'Clasp hands behind head, lean back gently. Hold 10 sec, repeat 5x.', duration: 30 },
    ],
    lowerBack: [
      { name: 'Seated Forward Fold', desc: 'Sit on edge, hinge at hips, reach for floor. Hold 20 sec.', duration: 25 },
      { name: 'Pelvic Tilts', desc: 'Rock pelvis forward and backward while seated. 15 repetitions.', duration: 30 },
      { name: 'Standing Back Extension', desc: 'Stand, place hands on lower back, lean back gently. Hold 10 sec, 5x.', duration: 30 },
    ],
    wrists: [
      { name: 'Wrist Circles', desc: 'Rotate wrists slowly, 10 times each direction.', duration: 20 },
      { name: 'Prayer Stretch', desc: 'Press palms together at chest, lower hands keeping palms together. Hold 20 sec.', duration: 25 },
      { name: 'Flexion/Extension', desc: 'Extend arm, pull fingers back gently 15 sec. Then push down 15 sec. Both hands.', duration: 30 },
    ],
  };

  const POSTURE_CHECKS = [
    { key: 'spine', label: 'Spine is neutral (not slumped or over-arched)' },
    { key: 'shoulders', label: 'Shoulders are relaxed (not hunched up)' },
    { key: 'elbows', label: 'Elbows at 90° angle while typing' },
    { key: 'wrists', label: 'Wrists are neutral (not bent up/down)' },
    { key: 'feet', label: 'Feet flat on the floor or footrest' },
    { key: 'monitor', label: 'Monitor at eye level, arm\'s length away' },
    { key: 'head', label: 'Head balanced over spine (not jutting forward)' },
  ];

  function init() {
    if (_initialized) return;
    _initialized = true;
    render();
  }

  function render() {
    const page = Utils.$('page-musculoskeletal');
    const data = Store.getMskData();
    const discomfort = data.discomfort || {};
    const postureChecks = data.postureChecks || {};
    const exercisesDone = data.exercisesDone || 0;

    page.innerHTML = `
      <div class="section-header">
        <h2>Body & Posture</h2>
      </div>

      <div class="grid grid--3 anim-stagger" style="margin-bottom: var(--space-8);">
        <!-- Body Map -->
        <div class="card" style="text-align:center;">
          <div class="card__title" style="margin-bottom:var(--space-4);">Discomfort Map</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-bottom:var(--space-4);">Click a region to rate discomfort (0-10)</p>
          <div class="body-map" id="mskBodyMap">
            <div style="position:absolute; top:0; left:50%; transform:translateX(-50%); width:40px; height:40px; border-radius:50%; background:var(--glass-bg); border:1px solid var(--glass-border); display:flex; align-items:center; justify-content:center; font-size:20px;">🧑</div>
            ${BODY_REGIONS.map(r => {
              const level = discomfort[r.key] || 0;
              const painClass = level === 0 ? '' : level < 4 ? 'pain-low' : level < 7 ? 'pain-medium' : 'pain-high';
              return `<div class="body-map__region ${painClass}" 
                          style="top:${r.top}; left:${r.left}; width:${r.width}; height:${r.height};"
                          onclick="MusculoskeletalModule.rateDiscomfort('${r.key}', '${r.label}')"
                          title="${r.label}: ${level}/10">
                        ${r.label} ${level > 0 ? `(${level})` : ''}
                      </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Posture Checklist -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">Posture Checklist</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-bottom:var(--space-3);">Check your posture right now</p>
          ${POSTURE_CHECKS.map(pc => `
            <div class="posture-check ${postureChecks[pc.key] ? 'checked' : ''}" onclick="MusculoskeletalModule.togglePosture('${pc.key}')">
              <div class="posture-check__box">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="14" height="14" style="display:${postureChecks[pc.key] ? 'block' : 'none'}"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span class="posture-check__label">${pc.label}</span>
            </div>
          `).join('')}
          <div style="margin-top:var(--space-4); padding-top:var(--space-3); border-top:1px solid var(--glass-border);">
            <div style="font-size:var(--text-sm); color:var(--text-secondary);">
              Score: <strong>${Object.values(postureChecks).filter(v => v).length}/${POSTURE_CHECKS.length}</strong>
            </div>
          </div>
        </div>

        <!-- Stats & Trend -->
        <div class="card">
          <div class="card__title" style="margin-bottom:var(--space-4);">This Week</div>
          <div style="text-align:center; margin-bottom:var(--space-6);">
            <div class="card__value">${exercisesDone}</div>
            <div class="card__label">Exercises done today</div>
          </div>
          <div id="mskTrendChart" style="width:100%; height:120px;"></div>
        </div>
      </div>

      <!-- Targeted Exercises -->
      <div class="section-header">
        <h3>Targeted Exercises</h3>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary);">Based on your discomfort areas</p>
      </div>
      ${_renderExercises(discomfort)}

      <!-- Ergonomic Recommendations -->
      ${_renderErgonomicRecs(discomfort)}
    `;

    // Trend chart
    setTimeout(() => {
      const chartEl = Utils.$('mskTrendChart');
      if (chartEl) {
        const week = Store.getWeeklyData('msk', 7);
        const avgDiscomfort = week.map(d => {
          if (!d.data.discomfort) return 0;
          const vals = Object.values(d.data.discomfort);
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        Charts.lineChart(chartEl, week.map(d => Utils.dayName(d.date)),
          [{ data: avgDiscomfort, color: 'amber' }], { height: 120 });
      }
    }, 150);
  }

  function _renderExercises(discomfort) {
    // Show exercises for regions with discomfort, or all if no discomfort
    const activeRegions = Object.entries(discomfort).filter(([_, v]) => v > 0).map(([k]) => k);
    const regions = activeRegions.length > 0 ? activeRegions : Object.keys(EXERCISES);

    return `<div class="grid grid--auto-fill anim-stagger" style="margin-bottom: var(--space-8);">
      ${regions.map(region => {
        const exercises = EXERCISES[region] || [];
        const regionLabel = BODY_REGIONS.find(r => r.key === region)?.label || region;
        return exercises.map(ex => `
          <div class="card card--compact card--interactive" onclick="MusculoskeletalModule.startExercise('${region}', '${ex.name}')">
            <div class="badge badge--amber" style="margin-bottom:var(--space-2);">${regionLabel}</div>
            <div class="card__title" style="font-size:var(--text-sm); margin-top:var(--space-2);">${ex.name}</div>
            <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-1);">${ex.desc}</p>
            <div style="font-size:var(--text-xs); color:var(--accent-amber); margin-top:var(--space-2);">${ex.duration}s</div>
          </div>
        `).join('');
      }).join('')}
    </div>`;
  }

  function _renderErgonomicRecs(discomfort) {
    const hasChronicPain = Object.values(discomfort).some(v => v >= 6);
    if (!hasChronicPain) return '';

    return `
      <div class="section-header">
        <h3>Ergonomic Recommendations</h3>
      </div>
      <div class="disclaimer" style="margin-bottom: var(--space-4);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>High discomfort detected. Consider ergonomic adjustments and consult a healthcare professional if pain persists.</span>
      </div>
      <div class="grid grid--3 anim-stagger">
        <div class="card card--compact">
          <div style="font-size:28px; margin-bottom:var(--space-2);">⌨️</div>
          <div class="card__title" style="font-size:var(--text-sm);">Split Keyboard</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-2);">Reduces wrist ulnar deviation and allows natural arm positioning.</p>
        </div>
        <div class="card card--compact">
          <div style="font-size:28px; margin-bottom:var(--space-2);">🖱️</div>
          <div class="card__title" style="font-size:var(--text-sm);">Vertical Mouse</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-2);">Maintains a handshake grip, reducing forearm pronation strain.</p>
        </div>
        <div class="card card--compact">
          <div style="font-size:28px; margin-bottom:var(--space-2);">🖥️</div>
          <div class="card__title" style="font-size:var(--text-sm);">Monitor Arm/Stand</div>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:var(--space-2);">Position your screen at the correct height and distance to reduce neck strain.</p>
        </div>
      </div>
    `;
  }

  function rateDiscomfort(key, label) {
    Notifications.modal(
      `Rate ${label} Discomfort`,
      `
        <p style="margin-bottom:var(--space-4); color:var(--text-secondary);">How much discomfort are you feeling in your ${label.toLowerCase()}?</p>
        <div style="display:flex; justify-content:space-between; margin-bottom:var(--space-2);">
          <span style="font-size:var(--text-xs); color:var(--text-tertiary);">None</span>
          <span style="font-size:var(--text-xs); color:var(--text-tertiary);">Severe</span>
        </div>
        <input type="range" class="slider" id="mskDiscomfortSlider" min="0" max="10" value="${(Store.getMskData().discomfort || {})[key] || 0}">
        <div style="text-align:center; margin-top:var(--space-3); font-size:var(--text-2xl); font-weight:var(--weight-bold);" id="mskDiscomfortVal">${(Store.getMskData().discomfort || {})[key] || 0}</div>
      `,
      [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Save', primary: true, value: 'save', action: () => {
          const val = parseInt(Utils.$('mskDiscomfortSlider').value);
          const data = Store.getMskData();
          const discomfort = data.discomfort || {};
          discomfort[key] = val;
          Store.updateMskData({ discomfort });
          render();
        }}
      ]
    );
    // Update display on slider change
    setTimeout(() => {
      const slider = Utils.$('mskDiscomfortSlider');
      if (slider) {
        slider.oninput = () => {
          Utils.$('mskDiscomfortVal').textContent = slider.value;
        };
      }
    }, 100);
  }

  function togglePosture(key) {
    const data = Store.getMskData();
    const checks = data.postureChecks || {};
    checks[key] = !checks[key];
    Store.updateMskData({ postureChecks: checks });
    render();
  }

  function startExercise(region, name) {
    const ex = (EXERCISES[region] || []).find(e => e.name === name);
    if (!ex) return;
    Notifications.showBreak(`🏋️ ${ex.name}`, ex.desc, ex.duration, (result) => {
      if (result === 'completed') {
        const data = Store.getMskData();
        Store.updateMskData({ exercisesDone: (data.exercisesDone || 0) + 1 });
        Notifications.toast('Exercise Complete!', `${ex.name} — keep it up!`, 'success');
      }
      if (!Utils.$('page-musculoskeletal').classList.contains('page--hidden')) render();
    });
  }

  function onShow() { render(); }

  return { init, render, onShow, rateDiscomfort, togglePosture, startExercise };
})();
