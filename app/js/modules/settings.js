/* ============================================================
   SETTINGS — full control panel over every setting, plus
   data & privacy management and system (Tauri) controls.
   Inputs persist immediately; this page only re-renders on a
   full data reset (scope '*'), never on its own writes.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Tauri } from '../core/tauri.js';
import { Notify } from '../core/notify.js';
import { Modal } from '../core/modal.js';

let container = null;
let unsub = [];

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index 0..6, 0=Sun

function slider(id, label, min, max, step, value, fmt) {
  return `
    <div class="set-slider">
      <div class="set-slider__head"><span>${Utils.esc(label)}</span><b data-out="${id}">${fmt ? fmt(value) : value}</b></div>
      <input type="range" class="slider" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
    </div>`;
}

function seg(name, options, active) {
  return `<div class="seg" data-seg="${name}">${options.map(o =>
    `<button class="seg__btn ${o.id === active ? 'is-active' : ''}" data-val="${o.id}">${Utils.esc(o.label)}</button>`).join('')}</div>`;
}

function toggleRow(id, label, sub, checked, opts = {}) {
  return `
    <label class="set-row ${opts.disabled ? 'is-disabled' : ''}">
      <div class="grow">
        <div class="list__title">${Utils.esc(label)}</div>
        ${sub ? `<div class="list__sub">${sub}</div>` : ''}
      </div>
      <span class="toggle"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${opts.disabled ? 'disabled' : ''}><i></i></span>
    </label>`;
}

function render(el) {
  container = el;
  const st = Store.settings();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('gear', 20)}</div>
          <div>
            <h1>Settings</h1>
            <div class="page-head__sub">Everything is stored on this device</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">Schedule</div>
    <div class="card card--pad">
      <div class="set-grid">
        <div class="field"><label class="field__label">Work starts</label><input type="time" class="input" id="setWorkStart" value="${Utils.esc(st.workStart)}"></div>
        <div class="field"><label class="field__label">Work ends</label><input type="time" class="input" id="setWorkEnd" value="${Utils.esc(st.workEnd)}"></div>
      </div>
      <div class="field mt-4">
        <label class="field__label">Work days</label>
        <div class="set-days" id="setWorkDays">
          ${DOW.map((d, i) => `<button class="set-day ${st.workDays.includes(i) ? 'is-active' : ''}" data-day="${i}">${d}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="section-title">Reminders &amp; goals</div>
    <div class="card card--pad set-sliders">
      ${slider('setEyeEvery', 'Eye break every', 10, 60, 5, st.eyeBreakEvery, v => `${v} min`)}
      ${slider('setEyeSecs', 'Eye break length', 10, 60, 5, st.eyeBreakSecs, v => `${v} s`)}
      ${slider('setBlink', 'Blink reminder every', 0, 30, 5, st.blinkEvery, v => v == 0 ? 'off' : `${v} min`)}
      ${slider('setMove', 'Movement block every', 30, 60, 5, st.moveEvery, v => `${v} min`)}
      ${slider('setHydrate', 'Hydration every', 30, 120, 10, st.hydrateEvery, v => `${v} min`)}
      ${slider('setPosture', 'Posture check every', 30, 120, 10, st.postureEvery, v => `${v} min`)}
      ${slider('setStandGoal', 'Standing goal', 60, 240, 15, st.standGoalMin, v => Utils.fmtDuration(Number(v)))}
      ${slider('setWaterGoal', 'Water goal', 4, 15, 1, st.waterGoal, v => `${v} glasses`)}
      <div class="set-slider">
        <div class="set-slider__head"><span>Mood check-ins</span></div>
        ${seg('moodCheck', [{ id: 'daily', label: 'Daily' }, { id: 'twice', label: 'Twice' }, { id: 'off', label: 'Off' }], st.moodCheck)}
      </div>
      <div class="set-slider">
        <div class="set-slider__head"><span>Wind-down reminder</span></div>
        <div class="row" style="gap:var(--sp-3)">
          <input type="time" class="input" id="setWinddown" style="width:auto" value="${Utils.esc(st.winddownAt || '')}" ${st.winddownAt ? '' : 'disabled'}>
          <label class="row" style="gap:8px;cursor:pointer"><span class="toggle"><input type="checkbox" id="setWinddownOn" ${st.winddownAt ? 'checked' : ''}><i></i></span><span class="small">On</span></label>
        </div>
      </div>
    </div>

    <div class="section-title">Deep work</div>
    <div class="card card--pad set-sliders">
      ${slider('setFocusMin', 'Focus block', 15, 60, 5, st.focusMin, v => `${v} min`)}
      ${slider('setShortBreak', 'Short break', 3, 15, 1, st.shortBreakMin, v => `${v} min`)}
      ${slider('setLongBreak', 'Long break', 10, 30, 5, st.longBreakMin, v => `${v} min`)}
      ${slider('setLongEvery', 'Long break every', 2, 6, 1, st.longBreakEvery, v => `${v} sessions`)}
      <div class="set-slider">
        <div class="set-slider__head"><span>Reminders during focus</span></div>
        ${seg('focusSuppression', [{ id: 'soft', label: 'Soft' }, { id: 'hard', label: 'Hard' }, { id: 'off', label: 'Off' }], st.focusSuppression)}
        <div class="list__sub mt-2" id="setSuppressHint"></div>
      </div>
    </div>

    <div class="section-title">Notifications</div>
    <div class="card card--pad">
      <div class="set-slider">
        <div class="set-slider__head"><span>Reminder style</span></div>
        ${seg('notifyStyle', [{ id: 'auto', label: 'Auto' }, { id: 'popup', label: 'Popup' }, { id: 'inapp', label: 'In-app' }], st.notifyStyle)}
        <div class="list__sub mt-2" id="setNotifyHint"></div>
      </div>
      ${toggleRow('setSound', 'Sound', 'Play a soft chime with reminders', st.soundOn)}
      <button class="btn btn--secondary btn--sm mt-3" id="setPreview">${Utils.icon('bell', 13)} Preview a reminder</button>
    </div>

    <div class="section-title">Appearance</div>
    <div class="card card--pad">
      <div class="set-slider">
        <div class="set-slider__head"><span>Theme</span></div>
        ${seg('theme', [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'auto', label: 'Auto' }], st.theme)}
      </div>
    </div>

    <div class="section-title">Modules</div>
    <div class="card card--pad">
      ${[['eye', 'Eye Health'], ['movement', 'Movement'], ['msk', 'Posture & Body'], ['mental', 'Mind & Resilience'], ['lifestyle', 'Lifestyle'], ['focus', 'Deep Work'], ['coach', 'AI Coach']]
        .map(([id, label]) => toggleRow(`setMod_${id}`, label, '', st.modules[id] !== false)).join('')}
    </div>

    <div class="section-title">System</div>
    <div class="card card--pad">
      ${toggleRow('setAutostart', 'Start with the computer', Tauri.isTauri ? 'Launches quietly to the tray on boot' : 'Available in the desktop app', st.autostart, { disabled: !Tauri.isTauri })}
      ${Tauri.isTauri ? `<div class="row mt-3"><button class="btn btn--ghost btn--sm" id="setQuit">${Utils.icon('stop', 13)} Quit WellBeing</button></div>` : ''}
    </div>

    <div class="section-title">Data &amp; privacy</div>
    <div class="card card--pad">
      <div class="small muted mb-3">Everything WellBeing tracks lives on this device (~${Store.storageUsedKB()} KB used). The only time it touches the network is the optional one-time AI model download.</div>
      <div class="row row--wrap" style="gap:var(--sp-2)">
        <button class="btn btn--secondary btn--sm" id="setExport">${Utils.icon('export', 13)} Export data</button>
        <button class="btn btn--secondary btn--sm" id="setImport">${Utils.icon('import', 13)} Import data</button>
        <button class="btn btn--danger btn--sm" id="setErase">${Utils.icon('trash', 13)} Erase all data</button>
        <input type="file" id="setImportFile" accept="application/json,.json" hidden>
      </div>
    </div>

    <div class="card card--pad mt-4 set-about">
      <div class="brand__mark">${Utils.icon('logo', 19)}</div>
      <div>
        <div class="list__title">WellBeing Companion · v1.1</div>
        <div class="small muted">Built with Tauri + WebGPU. Privacy-first wellness guidance — not medical advice.</div>
      </div>
    </div>`;

  updateHints();
  bindHandlers(el);
}

function updateHints() {
  const st = Store.settings();
  const supp = { soft: 'Soft — eye & movement reminders stay on during focus.',
    hard: 'Hard — only eye breaks stay on during focus.',
    off: 'Off — reminders are never suppressed.' }[st.focusSuppression];
  const notify = { auto: 'Auto — a desktop popup when the app is in the background, an in-app banner when it\'s focused.',
    popup: 'Popup — always use the desktop popup window.',
    inapp: 'In-app — only show banners inside the app.' }[st.notifyStyle];
  const sh = container?.querySelector('#setSuppressHint');
  const nh = container?.querySelector('#setNotifyHint');
  if (sh) sh.textContent = supp;
  if (nh) nh.textContent = notify;
}

function bindHandlers(el) {
  // time + work days
  el.querySelector('#setWorkStart').addEventListener('change', e => Store.updateSettings({ workStart: e.target.value }));
  el.querySelector('#setWorkEnd').addEventListener('change', e => Store.updateSettings({ workEnd: e.target.value }));
  el.querySelector('#setWorkDays').addEventListener('click', e => {
    const btn = e.target.closest('[data-day]');
    if (!btn) return;
    const day = Number(btn.dataset.day);
    const days = new Set(Store.settings().workDays);
    if (days.has(day)) { if (days.size <= 1) return; days.delete(day); } else days.add(day);
    Store.updateSettings({ workDays: [...days].sort() });
    btn.classList.toggle('is-active');
  });

  // sliders: live label on input, persist on change
  const SLIDER_MAP = {
    setEyeEvery: ['eyeBreakEvery', v => `${v} min`],
    setEyeSecs: ['eyeBreakSecs', v => `${v} s`],
    setBlink: ['blinkEvery', v => v == 0 ? 'off' : `${v} min`],
    setMove: ['moveEvery', v => `${v} min`],
    setHydrate: ['hydrateEvery', v => `${v} min`],
    setPosture: ['postureEvery', v => `${v} min`],
    setStandGoal: ['standGoalMin', v => Utils.fmtDuration(Number(v))],
    setWaterGoal: ['waterGoal', v => `${v} glasses`],
    setFocusMin: ['focusMin', v => `${v} min`],
    setShortBreak: ['shortBreakMin', v => `${v} min`],
    setLongBreak: ['longBreakMin', v => `${v} min`],
    setLongEvery: ['longBreakEvery', v => `${v} sessions`],
  };
  for (const [id, [key, fmt]] of Object.entries(SLIDER_MAP)) {
    const input = el.querySelector('#' + id);
    const out = el.querySelector(`[data-out="${id}"]`);
    input.addEventListener('input', () => { out.textContent = fmt(input.value); });
    input.addEventListener('change', () => Store.updateSettings({ [key]: Number(input.value) }));
  }

  // segmented controls
  el.querySelectorAll('[data-seg]').forEach(segEl => {
    segEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-val]');
      if (!btn) return;
      segEl.querySelectorAll('.seg__btn').forEach(b => b.classList.toggle('is-active', b === btn));
      Store.updateSettings({ [segEl.dataset.seg]: btn.dataset.val });
      updateHints();
    });
  });

  // wind-down
  el.querySelector('#setWinddown').addEventListener('change', e => Store.updateSettings({ winddownAt: e.target.value }));
  el.querySelector('#setWinddownOn').addEventListener('change', e => {
    const timeEl = el.querySelector('#setWinddown');
    if (e.target.checked) { timeEl.disabled = false; Store.updateSettings({ winddownAt: timeEl.value || '21:30' }); if (!timeEl.value) timeEl.value = '21:30'; }
    else { timeEl.disabled = true; Store.updateSettings({ winddownAt: '' }); }
  });

  // notifications
  el.querySelector('#setSound').addEventListener('change', e => Store.updateSettings({ soundOn: e.target.checked }));
  el.querySelector('#setPreview').addEventListener('click', () => Notify.reminder('eye', () => {}));

  // modules
  el.querySelectorAll('[id^="setMod_"]').forEach(input => {
    input.addEventListener('change', () => Store.updateSettings({ modules: { [input.id.slice(7)]: input.checked } }));
  });

  // system
  const autostart = el.querySelector('#setAutostart');
  if (Tauri.isTauri) {
    Tauri.getAutostart().then(on => { autostart.checked = on; });
    autostart.addEventListener('change', async () => {
      const result = await Tauri.setAutostart(autostart.checked);
      autostart.checked = !!result;
      Store.updateSettings({ autostart: !!result });
      Notify.toast('Autostart', result ? 'WellBeing will start with your computer.' : 'Autostart disabled.', 'info', 2400);
    });
    el.querySelector('#setQuit')?.addEventListener('click', () => Tauri.quit());
  }

  // data & privacy
  el.querySelector('#setExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(Store.exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Utils.el('a', { href: url, download: `wellbeing-export-${Utils.dateKey()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Notify.toast('Exported', 'Your data was saved as a JSON file.', 'success', 2600);
  });
  const fileInput = el.querySelector('#setImportFile');
  el.querySelector('#setImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importAll(JSON.parse(reader.result));
        Notify.toast('Imported', 'Your data was restored.', 'success', 2800);
      } catch (err) {
        Notify.toast('Import failed', String(err.message || err), 'error', 4200);
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });
  el.querySelector('#setErase').addEventListener('click', async () => {
    const ok = await Modal.confirm('Erase all data?', 'This permanently deletes every check-in, log, journal entry, and setting on this device. This cannot be undone.', 'Erase everything', true);
    if (ok) { Store.clearAll(); Notify.toast('Erased', 'All data has been cleared.', 'info', 2600); }
  });
}

export default {
  id: 'settings',
  title: 'Settings',
  icon: 'gear',

  render,

  onShow() {
    // only rebuild on a full reset — never on our own writes (would fight inputs)
    unsub.push(Bus.on('store:changed', ({ scope }) => { if (scope === '*') render(container); }));
  },

  onHide() { unsub.forEach(off => off()); unsub = []; },
};
