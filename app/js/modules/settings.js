/* ============================================================
   SETTINGS MODULE
   ============================================================ */

const SettingsModule = (() => {
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;
    render();
  }

  function render() {
    const page = Utils.$('page-settings');
    const settings = Store.getSettings();
    const storageUsed = Store.storageUsed();
    const storageKB = (storageUsed / 1024).toFixed(1);

    page.innerHTML = `
      <div class="section-header">
        <h2>Settings</h2>
      </div>

      <!-- Profile -->
      <div class="settings-section">
        <div class="settings-section__title">📋 Work Schedule</div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Work Start Time</div>
            <div class="setting-row__desc">When your workday typically begins</div>
          </div>
          <div class="setting-row__control">
            <input type="time" class="input" value="${settings.workStart}" onchange="SettingsModule.update('workStart', this.value)" style="width:120px;">
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Work End Time</div>
            <div class="setting-row__desc">When your workday typically ends</div>
          </div>
          <div class="setting-row__control">
            <input type="time" class="input" value="${settings.workEnd}" onchange="SettingsModule.update('workEnd', this.value)" style="width:120px;">
          </div>
        </div>
      </div>

      <!-- Eye Health Settings -->
      <div class="settings-section">
        <div class="settings-section__title">👁️ Eye Health</div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Break Interval</div>
            <div class="setting-row__desc">How often to prompt for eye breaks (minutes)</div>
          </div>
          <div class="setting-row__control">
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <input type="range" class="slider" min="5" max="60" value="${settings.eyeBreakInterval}" 
                     onchange="SettingsModule.update('eyeBreakInterval', parseInt(this.value)); this.nextElementSibling.textContent=this.value+'m'" style="width:100px;">
              <span style="font-size:var(--text-sm); width:30px;">${settings.eyeBreakInterval}m</span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Break Duration</div>
            <div class="setting-row__desc">How long each eye break lasts (seconds)</div>
          </div>
          <div class="setting-row__control">
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <input type="range" class="slider" min="10" max="60" value="${settings.eyeBreakDuration}" 
                     onchange="SettingsModule.update('eyeBreakDuration', parseInt(this.value)); this.nextElementSibling.textContent=this.value+'s'" style="width:100px;">
              <span style="font-size:var(--text-sm); width:30px;">${settings.eyeBreakDuration}s</span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Blink Reminders</div>
            <div class="setting-row__desc">Subtle reminders to blink consciously</div>
          </div>
          <div class="setting-row__control">
            <label class="toggle">
              <input type="checkbox" ${settings.blinkReminder ? 'checked' : ''} onchange="SettingsModule.update('blinkReminder', this.checked)">
              <span class="toggle__track"></span>
              <span class="toggle__thumb"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Movement Settings -->
      <div class="settings-section">
        <div class="settings-section__title">🚶 Movement</div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Movement Interval</div>
            <div class="setting-row__desc">Time between movement prompts (minutes)</div>
          </div>
          <div class="setting-row__control">
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <input type="range" class="slider" min="15" max="90" value="${settings.movementInterval}" 
                     onchange="SettingsModule.update('movementInterval', parseInt(this.value)); this.nextElementSibling.textContent=this.value+'m'" style="width:100px;">
              <span style="font-size:var(--text-sm); width:30px;">${settings.movementInterval}m</span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Daily Standing Goal</div>
            <div class="setting-row__desc">Target standing/activity minutes per day</div>
          </div>
          <div class="setting-row__control">
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <input type="range" class="slider" min="30" max="360" step="30" value="${settings.standingGoal}" 
                     onchange="SettingsModule.update('standingGoal', parseInt(this.value)); this.nextElementSibling.textContent=this.value+'m'" style="width:100px;">
              <span style="font-size:var(--text-sm); width:40px;">${settings.standingGoal}m</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Focus Settings -->
      <div class="settings-section">
        <div class="settings-section__title">⏱️ Focus Timer</div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Focus Duration</div>
            <div class="setting-row__desc">Length of each focus session (minutes)</div>
          </div>
          <div class="setting-row__control">
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <input type="range" class="slider" min="5" max="90" value="${settings.focusDuration}" 
                     onchange="SettingsModule.update('focusDuration', parseInt(this.value)); this.nextElementSibling.textContent=this.value+'m'" style="width:100px;">
              <span style="font-size:var(--text-sm); width:30px;">${settings.focusDuration}m</span>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Long Break After</div>
            <div class="setting-row__desc">Number of focus sessions before a long break</div>
          </div>
          <div class="setting-row__control">
            <select class="input" onchange="SettingsModule.update('longBreakAfter', parseInt(this.value))" style="width:80px;">
              ${[2, 3, 4, 5, 6].map(n => `<option value="${n}" ${settings.longBreakAfter === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Lifestyle Settings -->
      <div class="settings-section">
        <div class="settings-section__title">🌿 Lifestyle</div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Hydration Goal</div>
            <div class="setting-row__desc">Daily water intake target (glasses)</div>
          </div>
          <div class="setting-row__control">
            <select class="input" onchange="SettingsModule.update('hydrationGoal', parseInt(this.value))" style="width:80px;">
              ${[4, 6, 8, 10, 12].map(n => `<option value="${n}" ${settings.hydrationGoal === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Sleep Reminder Time</div>
            <div class="setting-row__desc">When to prompt for winding down</div>
          </div>
          <div class="setting-row__control">
            <input type="time" class="input" value="${settings.sleepReminder}" onchange="SettingsModule.update('sleepReminder', this.value)" style="width:120px;">
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div class="settings-section">
        <div class="settings-section__title">🔔 Notifications</div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Sound Effects</div>
            <div class="setting-row__desc">Play sound when prompts appear</div>
          </div>
          <div class="setting-row__control">
            <label class="toggle">
              <input type="checkbox" ${settings.soundEnabled ? 'checked' : ''} onchange="SettingsModule.update('soundEnabled', this.checked)">
              <span class="toggle__track"></span>
              <span class="toggle__thumb"></span>
            </label>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row__info">
            <div class="setting-row__label">Notification Style</div>
            <div class="setting-row__desc">How break notifications appear</div>
          </div>
          <div class="setting-row__control">
            <select class="input" onchange="SettingsModule.update('notificationStyle', this.value)" style="width:120px;">
              <option value="overlay" ${settings.notificationStyle === 'overlay' ? 'selected' : ''}>Full Screen</option>
              <option value="toast" ${settings.notificationStyle === 'toast' ? 'selected' : ''}>Toast Only</option>
              <option value="both" ${settings.notificationStyle === 'both' ? 'selected' : ''}>Both</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Module Toggles -->
      <div class="settings-section">
        <div class="settings-section__title">📦 Modules</div>
        <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-bottom:var(--space-3);">Enable or disable individual health modules</p>
        ${Object.entries(settings.modules).map(([key, enabled]) => `
          <div class="setting-row">
            <div class="setting-row__info">
              <div class="setting-row__label">${_moduleLabel(key)}</div>
            </div>
            <div class="setting-row__control">
              <label class="toggle">
                <input type="checkbox" ${enabled ? 'checked' : ''} onchange="SettingsModule.toggleModule('${key}', this.checked)">
                <span class="toggle__track"></span>
                <span class="toggle__thumb"></span>
              </label>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Data Management -->
      <div class="settings-section">
        <div class="settings-section__title">💾 Data Management</div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-4);">
          <span style="font-size:var(--text-sm); color:var(--text-secondary);">Storage used: <strong>${storageKB} KB</strong></span>
        </div>
        <div style="display:flex; gap:var(--space-3); flex-wrap:wrap;">
          <button class="btn btn--secondary" onclick="SettingsModule.exportData()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Data (JSON)
          </button>
          <button class="btn btn--danger" onclick="SettingsModule.clearAllData()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Clear All Data
          </button>
        </div>
      </div>

      <!-- About -->
      <div class="settings-section">
        <div class="settings-section__title">ℹ️ About</div>
        <div class="card card--compact" style="background:var(--bg-secondary);">
          <h4 style="margin-bottom:var(--space-2);">WellBeing</h4>
          <p style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-3);">Ultra-premium health & productivity companion for desk workers.</p>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-bottom:var(--space-2);">Version 1.0.0 · Built with vanilla HTML/CSS/JS</p>
          <p style="font-size:var(--text-xs); color:var(--text-tertiary); margin-bottom:var(--space-3);">AI Coach powered by LFM-2.5-230M (Liquid AI) via Transformers.js</p>
          <div class="disclaimer" style="font-size:var(--text-xs);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>This app provides general wellness guidance only. It is not a medical device or clinical tool. For health concerns, consult your healthcare provider.</span>
          </div>
        </div>
      </div>
    `;
  }

  function _moduleLabel(key) {
    const labels = {
      eyeHealth: '👁️ Eye Health',
      movement: '🚶 Movement & Sedentary',
      musculoskeletal: '🏋️ Body & Posture',
      mentalHealth: '🧠 Mental Health',
      lifestyle: '🌿 Lifestyle & Recovery',
      aiCoach: '🤖 AI Coach',
      focus: '⏱️ Focus Timer'
    };
    return labels[key] || key;
  }

  function update(key, value) {
    Store.updateSettings({ [key]: value });
    Notifications.toast('Setting Updated', `${key} has been updated.`, 'info', 2000);
  }

  function toggleModule(key, enabled) {
    const settings = Store.getSettings();
    const modules = { ...settings.modules, [key]: enabled };
    Store.updateSettings({ modules });
    Notifications.toast('Module Updated', `${_moduleLabel(key)} has been ${enabled ? 'enabled' : 'disabled'}.`, 'info', 2000);
  }

  function exportData() {
    const data = Store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellbeing-export-${Utils.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Notifications.toast('Data Exported', 'Your data has been downloaded as JSON.', 'success');
  }

  function clearAllData() {
    Notifications.modal(
      '⚠️ Clear All Data',
      '<p style="color:var(--text-secondary);">This will permanently delete all your health data, settings, and chat history. This action cannot be undone.</p>',
      [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Delete Everything', primary: true, value: 'confirm', action: () => {
          Store.clear();
          Notifications.toast('Data Cleared', 'All data has been permanently deleted.', 'warning');
          setTimeout(() => location.reload(), 1000);
        }}
      ]
    );
  }

  function onShow() { render(); }

  return { init, render, onShow, update, toggleModule, exportData, clearAllData };
})();
