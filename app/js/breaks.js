/* ============================================================
   BREAKS — full-screen guided break overlay.
   Kinds: eye, palming, figure8, stretch, breathing, grounding,
   posture, move. Emits Bus 'break:done' {kind, completed} and
   logs to the Store. ESC skips.
   ============================================================ */

import { Utils } from './core/utils.js';
import { Bus } from './core/bus.js';
import { Store } from './core/store.js';
import { Charts } from './core/charts.js';
import { Notify } from './core/notify.js';

const STRETCHES = [
  { name: 'Neck rotations', secs: 20, desc: 'Slowly roll your head in a half-circle, ear toward shoulder, chin to chest, other ear. Keep shoulders down.' },
  { name: 'Shoulder rolls', secs: 20, desc: 'Roll both shoulders backward in big, slow circles. Feel the shoulder blades slide down your back.' },
  { name: 'Upper-back extension', secs: 20, desc: 'Clasp hands behind your head, gently arch your upper back over the chair, eyes to the ceiling.' },
  { name: 'Wrist stretches', secs: 20, desc: 'Arm out, palm up. Gently pull fingers back with the other hand. Switch after 10 seconds.' },
  { name: 'Seated twist', secs: 20, desc: 'Sit tall, rotate your torso to one side holding the chair back. Breathe. Switch halfway.' },
];

const MOVE_STEPS = [
  { name: 'Stand up', secs: 10, desc: 'Push the chair back and stand tall. Shake out your legs.' },
  { name: 'Walk', secs: 60, desc: 'Take a short walk — around the room, down the hallway, or grab some water.' },
  { name: 'Calf raises', secs: 25, desc: 'Rise onto your toes and lower slowly. Keep going — this wakes up circulation.' },
  { name: 'Hip openers', secs: 25, desc: 'Hands on hips, make slow circles with your hips. Both directions.' },
];

const GROUNDING = [
  { name: '5 things you can see', secs: 15, desc: 'Look around and silently name five things you can see right now.' },
  { name: '4 things you can touch', secs: 12, desc: 'Notice four textures — your chair, the desk, your sleeve, the floor under your feet.' },
  { name: '3 things you can hear', secs: 12, desc: 'Close your eyes if you like. Pick out three distinct sounds.' },
  { name: '2 things you can smell', secs: 10, desc: 'Two scents — coffee, fresh air, anything. Take your time.' },
  { name: '1 slow breath', secs: 8, desc: 'One long, deep breath in… and all the way out. You are here.' },
];

const POSTURE_CHECKS = [
  'Feet flat on the floor, knees at ~90°',
  'Hips all the way back in the chair',
  'Spine tall, shoulders relaxed (not shrugged)',
  'Screen top at eye level, an arm’s length away',
  'Wrists straight, elbows close to your body',
];

const KIND_META = {
  eye:       { kicker: 'Eye break · 20-20-20', title: 'Look far away', icon: 'eye',
               desc: 'Focus on something at least 20 feet (6 m) away. Let your eye muscles fully relax.' },
  palming:   { kicker: 'Eye exercise', title: 'Palming', icon: 'hand',
               desc: 'Rub your palms warm, then cup them gently over closed eyes. Breathe slowly in the dark.' },
  figure8:   { kicker: 'Eye exercise', title: 'Figure eight', icon: 'eye',
               desc: 'Follow the moving dot with your eyes only — keep your head still.' },
  stretch:   { kicker: 'Micro-stretches', title: 'Desk stretch sequence', icon: 'spine' },
  breathing: { kicker: 'Stress relief', title: 'Box breathing', icon: 'wind',
               desc: 'Breathe with the circle: in 4 · hold 4 · out 4 · hold 4. Four rounds.' },
  grounding: { kicker: 'Grounding', title: '5-4-3-2-1', icon: 'brain' },
  posture:   { kicker: 'Ergonomics', title: 'Posture reset', icon: 'spine',
               desc: 'Run through the checklist. Small adjustments now save your back later.' },
  move:      { kicker: 'Movement block', title: 'Get moving', icon: 'walk' },
};

let overlay = null;
let active = null; // {kind, timers:[], cleanup(), completed}

function ensureDom() {
  if (overlay) return;
  overlay = Utils.el('div', { class: 'break-overlay' }, `<div class="break-stage"></div>`);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) finish(false);
  });
}

function stage() { return overlay.querySelector('.break-stage'); }

function clearTimers() {
  if (!active) return;
  active.timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  active.timers = [];
}

function finish(completed) {
  if (!active) return;
  const { kind } = active;
  clearTimers();
  active.cleanup?.();
  overlay.classList.remove('active');
  active = null;

  const logKind = kind === 'move' ? 'move' : kind === 'eye' ? 'eye' : null;
  if (logKind) {
    Store.logBreak(logKind, completed ? 'done' : 'skipped');
  } else if (completed) {
    // credit the break to its home module
    if (kind === 'breathing' || kind === 'grounding') Store.update('mental', m => { m.interventionsDone++; });
    else if (kind === 'posture') Store.update('msk', m => { m.postureChecks++; });
    else if (kind === 'stretch') Store.update('msk', m => { m.exercisesDone++; });
    else Store.update('eye', e => { e.exercisesDone++; }); // palming, figure8
  }

  Bus.emit('break:done', { kind, completed });
  if (completed) Notify.toast('Nice work', 'Break completed — back to it.', 'success', 3000);
}

function baseHtml(kind, extra = '', actions = null) {
  const m = KIND_META[kind];
  return `
    <div class="break-stage__kicker">${Utils.icon(m.icon, 15)} ${Utils.esc(m.kicker)}</div>
    <div class="break-stage__title">${Utils.esc(m.title)}</div>
    ${m.desc ? `<p class="break-stage__desc">${Utils.esc(m.desc)}</p>` : ''}
    ${extra}
    <div class="break-stage__actions">
      ${actions ?? `<button class="btn btn--ghost" data-skip>Skip</button>`}
    </div>
    <div class="break-stage__esc">press <span class="kbd">Esc</span> to skip</div>`;
}

function bindSkip() {
  stage().querySelector('[data-skip]')?.addEventListener('click', () => finish(false));
  stage().querySelector('[data-done]')?.addEventListener('click', () => finish(true));
}

/* ---------- countdown ring helper ---------- */
function runCountdown(totalSecs, ringHost, onDone, accent) {
  const endAt = Date.now() + totalSecs * 1000;
  const draw = () => {
    const remain = Math.max(0, endAt - Date.now());
    const secs = Math.ceil(remain / 1000);
    Charts.ring(ringHost, {
      value: (1 - remain / (totalSecs * 1000)) * 100,
      size: 180, thickness: 10, valueText: String(secs), label: 'seconds', color: accent,
    });
    if (remain <= 0) { clearInterval(iv); onDone(); }
  };
  draw();
  const iv = setInterval(draw, 250);
  active.timers.push(iv);
}

/* ---------- sequence player (stretch / move / grounding) ---------- */
function runSequence(kind, steps) {
  let idx = 0;
  const render = () => {
    const step = steps[idx];
    stage().innerHTML = baseHtml(kind, `
      <div class="break-steps">${steps.map((_, i) =>
        `<i class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></i>`).join('')}</div>
      <div class="break-stage__title" style="font-size:var(--text-xl)">${Utils.esc(step.name)}</div>
      <p class="break-stage__desc">${Utils.esc(step.desc)}</p>
      <div class="break-ring"></div>`,
      `<button class="btn btn--ghost" data-skip>End early</button>
       <button class="btn btn--secondary" data-next>${idx === steps.length - 1 ? 'Finish' : 'Next step'}</button>`);
    bindSkip();
    stage().querySelector('[data-next]').addEventListener('click', advance);
    runCountdown(step.secs, stage().querySelector('.break-ring'), advance);
  };
  const advance = () => {
    clearTimers();
    idx++;
    if (idx >= steps.length) finish(true);
    else render();
  };
  render();
}

/* ---------- kind runners ---------- */
const RUNNERS = {
  eye() {
    const secs = Store.settings().eyeBreakSecs || 20;
    stage().innerHTML = baseHtml('eye', `<div class="break-ring"></div>`);
    bindSkip();
    runCountdown(secs, stage().querySelector('.break-ring'), () => finish(true));
  },

  palming() {
    stage().innerHTML = baseHtml('palming', `
      <div class="palming-glow">${Utils.icon('hand', 64)}</div>
      <div class="break-ring" style="display:none"></div>
      <div class="break-stage__desc" data-count style="font-variant-numeric:tabular-nums"></div>`);
    bindSkip();
    const counter = stage().querySelector('[data-count]');
    const endAt = Date.now() + 30_000;
    const iv = setInterval(() => {
      const remain = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      counter.textContent = `${remain}s of gentle darkness`;
      if (remain <= 0) { clearInterval(iv); finish(true); }
    }, 250);
    active.timers.push(iv);
  },

  figure8() {
    stage().innerHTML = baseHtml('figure8', `
      <svg class="fig8" viewBox="0 0 300 160">
        <path id="fig8path" d="M150 80 C 150 30, 60 30, 60 80 C 60 130, 150 130, 150 80 C 150 30, 240 30, 240 80 C 240 130, 150 130, 150 80 Z"/>
        <circle class="fig8__dot" r="7"/>
      </svg>
      <div class="break-ring" style="display:none"></div>`);
    bindSkip();
    const path = stage().querySelector('#fig8path');
    const dot = stage().querySelector('.fig8__dot');
    const len = path.getTotalLength();
    const start = performance.now();
    const DURATION = 40_000, LAP = 8000;
    let raf;
    const step = now => {
      const t = now - start;
      const p = path.getPointAtLength(((t % LAP) / LAP) * len);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      if (t >= DURATION) { finish(true); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    active.cleanup = () => cancelAnimationFrame(raf);
  },

  stretch() { runSequence('stretch', STRETCHES); },
  move() { runSequence('move', MOVE_STEPS); },
  grounding() { runSequence('grounding', GROUNDING); },

  breathing() {
    const PHASES = [
      { label: 'Breathe in', cls: 'inhale', secs: 4 },
      { label: 'Hold', cls: 'inhale', secs: 4 },
      { label: 'Breathe out', cls: 'exhale', secs: 4 },
      { label: 'Hold', cls: 'exhale', secs: 4 },
    ];
    const ROUNDS = 4;
    stage().innerHTML = baseHtml('breathing', `
      <div class="breathe">
        <div class="breathe__ring"></div>
        <div class="breathe__core"></div>
        <div class="breathe__phase"></div>
        <div class="breathe__count"></div>
      </div>`);
    bindSkip();
    const box = stage().querySelector('.breathe');
    const phaseEl = stage().querySelector('.breathe__phase');
    const countEl = stage().querySelector('.breathe__count');
    let round = 0, phase = 0;
    const stepPhase = () => {
      if (round >= ROUNDS) { finish(true); return; }
      const p = PHASES[phase];
      box.classList.remove('inhale', 'exhale');
      box.classList.add(p.cls);
      phaseEl.textContent = p.label;
      countEl.textContent = `round ${round + 1} of ${ROUNDS}`;
      const t = setTimeout(() => {
        phase = (phase + 1) % PHASES.length;
        if (phase === 0) round++;
        stepPhase();
      }, p.secs * 1000);
      active.timers.push(t);
    };
    stepPhase();
  },

  posture() {
    stage().innerHTML = baseHtml('posture', `
      <div class="break-check">
        ${POSTURE_CHECKS.map((c, i) => `
          <label><input type="checkbox" data-check="${i}"><span>${Utils.esc(c)}</span></label>`).join('')}
      </div>`,
      `<button class="btn btn--ghost" data-skip>Skip</button>
       <button class="btn btn--primary" data-done disabled>All set</button>`);
    bindSkip();
    const doneBtn = stage().querySelector('[data-done]');
    const checkBox = stage().querySelector('.break-check');
    const boxes = Utils.$$('input[type=checkbox]', checkBox);
    checkBox.addEventListener('change', () => {
      doneBtn.disabled = !boxes.every(b => b.checked);
    });
  },
};

export const Breaks = {
  /** map a reminder kind to its default guided break */
  forReminder(kind) {
    return { eye: 'eye', move: 'move', posture: 'posture' }[kind] || null;
  },

  start(kind) {
    if (!RUNNERS[kind]) { console.warn('Unknown break kind:', kind); return; }
    ensureDom();
    if (active) { clearTimers(); active.cleanup?.(); }
    active = { kind, timers: [], cleanup: null, completed: false };
    overlay.classList.add('active');
    // accent follows the break's home module
    const moduleFor = { eye: 'eye', palming: 'eye', figure8: 'eye', stretch: 'msk',
      posture: 'msk', move: 'movement', breathing: 'mental', grounding: 'mental' };
    overlay.dataset.module = moduleFor[kind] || 'dashboard';
    RUNNERS[kind]();
  },

  isActive() { return !!active; },
};
