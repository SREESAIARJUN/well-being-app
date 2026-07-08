/* ============================================================
   LIFESTYLE — hydration, nutrition nudges, sleep/wind-down,
   weekly recovery plan.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Scheduler } from '../core/scheduler.js';
import { Charts } from '../core/charts.js';
import { Notify } from '../core/notify.js';

const TIPS = [
  'Keep a full glass or bottle in your line of sight — visibility drives the habit.',
  'Leafy greens (spinach, kale) are rich in lutein &amp; zeaxanthin, which support eye health.',
  'Omega-3s from fish, walnuts, or flax help tear-film quality and dry-eye comfort.',
  'Swap refined carbs for whole grains at lunch to avoid the 3 pm energy crash.',
  'Add a palm-sized portion of protein to snacks for steadier afternoon focus.',
  'Cut caffeine after mid-afternoon so it doesn\'t erode tonight\'s sleep.',
  'Eat away from your desk when you can — it aids digestion and gives your eyes a real break.',
  'Colourful vegetables at each meal cover most micronutrients desk workers miss.',
  'Feeling snacky at 4 pm? Try water first — mild thirst often masquerades as hunger.',
  'Batch a fruit or nut portion in the morning so the healthy option is the easy one.',
];

const WINDDOWN_ITEMS = [
  'Screens dimmed / blue-light reduced',
  'No caffeine since mid-afternoon',
  'Tomorrow\'s top task written down',
  'Bedroom cool and dark',
  'Heading to bed at a consistent time',
];

const STARTER_PLAN = [
  'Two 20-minute outdoor walks',
  'One screen-free evening',
  'One social catch-up',
  'One session of real exercise',
];

let container = null;
let unsub = [];

function refreshHydrateCountdown() {
  const el = container?.querySelector('#lifeHydrateNext');
  if (!el) return;
  const next = Scheduler.next().find(r => r.kind === 'hydrate');
  el.textContent = next ? Utils.fmtRelative(next.at - Date.now()) : 'paused';
}

function weekData() {
  const days = [...Utils.pastDateKeys(6), Utils.dateKey()];
  return days.map(date => {
    const data = Store.day(date);
    const v = data ? data.lifestyle.water : 0;
    return { label: Utils.weekdayShort(date), value: v, hint: `${v} glasses` };
  });
}

function render(el) {
  container = el;
  const s = Store.settings();
  const d = Store.today();
  const water = d.lifestyle.water;
  const tip = TIPS[d.lifestyle.nudgeIndex % TIPS.length];
  const plan = Store.recoveryPlan();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('leaf', 20)}</div>
          <div>
            <h1>Lifestyle</h1>
            <div class="page-head__sub">Hydration · nutrition · sleep · recovery</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card-grid cols-2 life-hero">
      <div class="card card--pad life-water">
        <div id="lifeWaterRing"></div>
        <div class="life-water__controls">
          <div class="card__title">Hydration</div>
          <div class="small muted">${water} of ${s.waterGoal} glasses today · next ${' '}<b id="lifeHydrateNext">–</b></div>
          <div class="row mt-3">
            <button class="btn btn--icon btn--secondary" data-water="-1" title="Remove a glass">${Utils.icon('minus', 16)}</button>
            <button class="btn btn--primary grow" data-water="1">${Utils.icon('drop', 15)} Log a glass</button>
          </div>
        </div>
      </div>
      <div class="card card--pad">
        <div class="card__title">${Utils.icon('leaf', 16)} Nutrition nudge</div>
        <div class="card__sub">Small, evidence-informed habits</div>
        <p class="life-tip">${tip}</p>
        <button class="btn btn--ghost btn--sm" data-next-tip>${Utils.icon('refresh', 13)} Next tip</button>
      </div>
    </div>

    <div class="section-title">Sleep &amp; wind-down</div>
    <div class="card card--pad" id="lifeWinddown">
      <div class="row row--between">
        <div class="grow">
          <div class="card__title">${Utils.icon('moon', 16)} Evening wind-down</div>
          <div class="small muted">Reminder set for ${s.winddownAt ? `<b>${Utils.esc(s.winddownAt)}</b>` : '<b>off</b>'}</div>
        </div>
        ${d.lifestyle.winddownDone ? `<span class="badge badge--ok">${Utils.icon('check', 12)} Done tonight</span>` : ''}
      </div>
      <div class="row row--wrap mt-3" style="gap:var(--sp-3);align-items:center">
        <label class="field__label" for="lifeWinddownTime">Wind-down time</label>
        <input type="time" class="input" id="lifeWinddownTime" style="width:auto" value="${Utils.esc(s.winddownAt || '')}">
        <label class="row" style="gap:8px;cursor:pointer">
          <span class="toggle"><input type="checkbox" id="lifeWinddownOn" ${s.winddownAt ? 'checked' : ''}><i></i></span>
          <span class="small">Enabled</span>
        </label>
      </div>
      <div class="break-check mt-4" style="width:100%">
        ${WINDDOWN_ITEMS.map((item, i) => `
          <label><input type="checkbox" data-wind="${i}" ${d.lifestyle.winddownDone ? 'checked' : ''}><span>${Utils.esc(item)}</span></label>`).join('')}
      </div>
    </div>

    <div class="section-title">This week's recovery plan</div>
    <div class="card card--pad">
      <div class="card__sub" style="margin-bottom:var(--sp-3)">${Utils.esc(Utils.isoWeekKey())} · schedule off-screen recovery</div>
      <div id="lifePlanList">${planListHtml(plan)}</div>
      <div class="row mt-3">
        <input type="text" class="input grow" id="lifePlanInput" placeholder="Add a recovery intention…" maxlength="120">
        <button class="btn btn--secondary" data-add-plan>${Utils.icon('plus', 15)} Add</button>
      </div>
      ${plan.items.length === 0 ? `<button class="btn btn--ghost btn--sm btn--block mt-3" data-starter-plan>${Utils.icon('sparkle', 13)} Suggest a starter plan</button>` : ''}
    </div>

    <div class="section-title">Hydration this week</div>
    <div class="card card--pad">
      <div class="card__title">${Utils.icon('chart', 16)} Glasses per day</div>
      <div class="card__sub">Dashed line is your daily goal</div>
      <canvas id="lifeWeek"></canvas>
    </div>`;

  Charts.ring(el.querySelector('#lifeWaterRing'), {
    value: Math.round(Utils.clamp(water / Math.max(1, s.waterGoal), 0, 1) * 100),
    size: 148, thickness: 11, valueText: water, label: `of ${s.waterGoal}`,
    color: getComputedStyle(document.documentElement).getPropertyValue('--m-lifestyle').trim(),
  });
  Charts.weekBars(el.querySelector('#lifeWeek'), weekData(), { height: 130, goal: s.waterGoal, unit: 'glasses' });
  refreshHydrateCountdown();

  el.querySelector('#lifeWinddownTime').addEventListener('change', e => {
    const v = e.target.value;
    Store.updateSettings({ winddownAt: v });
  });
  el.querySelector('#lifeWinddownOn').addEventListener('change', e => {
    if (e.target.checked) Store.updateSettings({ winddownAt: container.querySelector('#lifeWinddownTime').value || '21:30' });
    else Store.updateSettings({ winddownAt: '' });
  });

  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', e => {
      const water = e.target.closest('[data-water]');
      if (water) {
        const delta = Number(water.dataset.water);
        const before = Store.today().lifestyle.water;
        Store.update('lifestyle', l => { l.water = Math.max(0, l.water + delta); });
        const now = Store.today().lifestyle.water;
        if (delta > 0 && now === Store.settings().waterGoal && before < now) {
          Notify.toast('Goal reached! 💧', `${now} glasses — nicely hydrated.`, 'success', 3000);
        }
        return;
      }
      if (e.target.closest('[data-next-tip]')) {
        Store.update('lifestyle', l => { l.nudgeIndex = (l.nudgeIndex + 1) % TIPS.length; });
        return;
      }
      if (e.target.closest('[data-add-plan]')) {
        const input = container.querySelector('#lifePlanInput');
        const label = input.value.trim();
        if (!label) { input.focus(); return; }
        Store.updateRecoveryPlan(p => p.items.push({ id: Utils.uid(), label, done: false }));
        input.value = '';
        return;
      }
      if (e.target.closest('[data-starter-plan]')) {
        Store.updateRecoveryPlan(p => { STARTER_PLAN.forEach(label => p.items.push({ id: Utils.uid(), label, done: false })); });
        return;
      }
      const del = e.target.closest('[data-del-plan]');
      if (del) { Store.updateRecoveryPlan(p => { p.items = p.items.filter(i => i.id !== del.dataset.delPlan); }); }
    });

    el.addEventListener('change', e => {
      const planToggle = e.target.closest('[data-plan-toggle]');
      if (planToggle) {
        Store.updateRecoveryPlan(p => { const it = p.items.find(i => i.id === planToggle.dataset.planToggle); if (it) it.done = planToggle.checked; });
        return;
      }
      if (e.target.matches('[data-wind]')) {
        const boxes = Utils.$$('[data-wind]', container);
        if (boxes.every(b => b.checked)) {
          if (!Store.today().lifestyle.winddownDone) {
            Store.update('lifestyle', l => { l.winddownDone = true; });
            Notify.toast('Wind-down complete', 'Good habits tonight — sleep well. 🌙', 'success', 3000);
          }
        }
      }
    });

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.id === 'lifePlanInput') container.querySelector('[data-add-plan]').click();
    });
  }
}

function planListHtml(plan) {
  if (!plan.items.length) {
    return `<div class="small muted">No items yet — add your own or use a starter plan.</div>`;
  }
  return `<div class="life-plan">${plan.items.map(it => `
    <label class="life-plan__item">
      <span class="toggle"><input type="checkbox" data-plan-toggle="${it.id}" ${it.done ? 'checked' : ''}><i></i></span>
      <span class="grow ${it.done ? 'life-plan__done' : ''}">${Utils.esc(it.label)}</span>
      <button class="btn btn--ghost btn--icon btn--sm" data-del-plan="${it.id}" title="Remove">${Utils.icon('x', 13)}</button>
    </label>`).join('')}</div>`;
}

export default {
  id: 'lifestyle',
  title: 'Lifestyle',
  icon: 'leaf',

  render,

  onShow() {
    unsub.push(Bus.on('store:changed', ({ scope }) => {
      if (['lifestyle', 'recovery', 'settings'].includes(scope)) render(container);
    }));
    unsub.push(Bus.on('lifestyle:open-winddown', () => {
      const card = container?.querySelector('#lifeWinddown');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('flash-highlight'); void card.offsetWidth; card.classList.add('flash-highlight');
      }
    }));
  },

  onHide() { unsub.forEach(off => off()); unsub = []; },

  onTick() { refreshHydrateCountdown(); },
};
