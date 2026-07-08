/* ============================================================
   MIND & RESILIENCE — mood/stress check-ins, stress SOS,
   resilience practices (gratitude, reframe, mindfulness),
   trend. Explicitly non-clinical.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Charts } from '../core/charts.js';
import { Notify } from '../core/notify.js';
import { Modal } from '../core/modal.js';
import { Breaks } from '../breaks.js';

let container = null;
let unsub = [];

function cssVal(token) { return getComputedStyle(document.documentElement).getPropertyValue(token).trim(); }
function latestToday() {
  const c = Store.today().mental.checkins;
  return c.length ? c[c.length - 1] : null;
}

function journalHtml() {
  const entries = Store.journal().slice(0, 8);
  if (!entries.length) {
    return `<div class="small muted" style="padding:var(--sp-2) 0">No entries yet — one good thing counts.</div>`;
  }
  return `<div class="mental-journal">${entries.map(e => `
    <div class="mental-journal__item">
      <div class="grow">
        <div class="small">${Utils.esc(e.text)}</div>
        <div class="small muted" style="margin-top:2px">${new Date(e.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${Utils.fmtTime(e.ts)}</div>
      </div>
      <button class="btn btn--ghost btn--icon btn--sm" data-del-journal="${e.id}" title="Delete">${Utils.icon('trash', 13)}</button>
    </div>`).join('')}</div>`;
}

function refreshJournal() {
  const host = container?.querySelector('#mentalJournalList');
  if (host) host.innerHTML = journalHtml();
}

function render(el) {
  container = el;
  const d = Store.today();
  const last = latestToday();
  const mood = last ? last.mood : 6;
  const stress = last ? last.stress : 4;

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-head__title">
          <div class="page-head__icon">${Utils.icon('brain', 20)}</div>
          <div>
            <h1>Mind &amp; Resilience</h1>
            <div class="page-head__sub">Check in · reset · build resilience</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card card--pad" id="mentalCheckin">
      <div class="card__title">${Utils.icon('edit', 16)} How are you right now?</div>
      <div class="card__sub">${last ? `Last check-in ${Utils.fmtTime(last.ts)}` : 'Takes 20 seconds · private to this device'}</div>
      <div class="mental-sliders">
        <div class="msk-slider">
          <div class="msk-slider__head"><span>Mood · 😔 low … great 😊</span><b data-val="mood">${mood}</b></div>
          <input type="range" class="slider" min="1" max="10" step="1" value="${mood}" data-field="mood">
        </div>
        <div class="msk-slider">
          <div class="msk-slider__head"><span>Stress · 😌 calm … maxed 🤯</span><b data-val="stress">${stress}</b></div>
          <input type="range" class="slider" min="1" max="10" step="1" value="${stress}" data-field="stress">
        </div>
      </div>
      <div class="row row--between mt-4">
        <div class="stat"><div class="stat__value">${d.mental.interventionsDone}</div><div class="stat__label">practices done today</div></div>
        <button class="btn btn--primary" data-save-mood>${Utils.icon('check', 15)} Save check-in</button>
      </div>
    </div>

    <div class="card card--pad mental-sos">
      <div class="grow">
        <div class="card__title">${Utils.icon('heart', 16)} Feeling stressed?</div>
        <div class="small muted">3 minutes, private, right here.</div>
      </div>
      <button class="btn btn--primary btn--lg" data-sos>${Utils.icon('wind', 16)} I feel stressed</button>
    </div>

    <div class="section-title">Resilience practices</div>
    <div class="card-grid cols-3">
      <div class="card card--pad">
        <div class="card__title">${Utils.icon('book', 16)} Gratitude journal</div>
        <div class="card__sub">Name one good thing</div>
        <textarea class="input" id="mentalJournalInput" rows="2" placeholder="Today I appreciated…" maxlength="2000"></textarea>
        <button class="btn btn--secondary btn--sm btn--block mt-2" data-add-journal>${Utils.icon('plus', 13)} Add entry</button>
        <div id="mentalJournalList" class="mt-3">${journalHtml()}</div>
      </div>

      <div class="card card--pad">
        <div class="card__title">${Utils.icon('sparkle', 16)} Cognitive reframe</div>
        <div class="card__sub">When a thought spirals</div>
        <ol class="mental-steps">
          <li>Name the thought — say it plainly to yourself.</li>
          <li>What would you tell a friend who said it?</li>
          <li>Name one thing here that's in your control.</li>
        </ol>
        <button class="btn btn--secondary btn--sm btn--block mt-2" data-reframe>${Utils.icon('check', 13)} That helped</button>
      </div>

      <div class="card card--pad">
        <div class="card__title">${Utils.icon('wind', 16)} Micro-mindfulness</div>
        <div class="card__sub">One mindful minute</div>
        <p class="small muted">A single round of slow, guided breathing to drop your shoulders and reset your attention.</p>
        <button class="btn btn--secondary btn--sm btn--block mt-2" data-break="breathing">${Utils.icon('play', 13)} One mindful minute</button>
      </div>
    </div>

    <div class="section-title">Trend</div>
    <div class="card card--pad">
      <div class="card__title">${Utils.icon('chart', 16)} Mood &amp; stress · last 7 days</div>
      <div class="card__sub">Latest daily rating</div>
      <canvas id="mentalTrend"></canvas>
      <div class="dash-legend" id="mentalLegend"></div>
    </div>

    <div class="disclaimer mt-4">
      ${Utils.icon('alert', 14)}
      <span>Self-help support, not therapy or diagnosis. If distress feels severe or persistent, please reach out — e.g. the 988 Suicide &amp; Crisis Lifeline (US, call or text 988) or your local equivalent. You deserve real support.</span>
    </div>`;

  // trend
  const days = [...Utils.pastDateKeys(6), Utils.dateKey()];
  const labels = days.map(Utils.weekdayShort);
  const val = (date, field) => {
    const c = Store.day(date)?.mental.checkins;
    return c && c.length ? c[c.length - 1][field] : null;
  };
  const series = [
    { name: 'Mood', color: cssVal('--m-mental') || '#c084fc', values: days.map(dt => val(dt, 'mood')) },
    { name: 'Stress', color: cssVal('--m-msk') || '#fb923c', values: days.map(dt => val(dt, 'stress')) },
  ];
  Charts.lines(el.querySelector('#mentalTrend'), series, labels, { height: 150, max: 10 });
  el.querySelector('#mentalLegend').innerHTML = series.map(s =>
    `<span><i style="background:${s.color}"></i>${Utils.esc(s.name)}</span>`).join('');

  el.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      el.querySelector(`[data-val="${input.dataset.field}"]`).textContent = input.value;
    });
  });

  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('click', async e => {
      const brk = e.target.closest('[data-break]');
      if (brk) { Breaks.start(brk.dataset.break); return; }

      if (e.target.closest('[data-save-mood]')) {
        const moodV = Number(container.querySelector('input[data-field="mood"]').value);
        const stressV = Number(container.querySelector('input[data-field="stress"]').value);
        Store.update('mental', m => { m.checkins.push({ ts: Date.now(), mood: moodV, stress: stressV }); });
        Notify.toast('Check-in saved', stressV >= 7 ? 'That looks like a rough one — the stress reset is one tap away.' : 'Thanks for checking in.', 'success', 2800);
        return;
      }
      if (e.target.closest('[data-sos]')) {
        Store.update('mental', m => { m.sos++; });
        const choice = await Modal.open({
          title: 'Take three minutes',
          body: `<p>Pick what feels right — both are private and stay on this device.</p>`,
          buttons: [
            { id: 'breathing', label: 'Box breathing', primary: true },
            { id: 'grounding', label: '5-4-3-2-1 grounding' },
          ],
        });
        if (choice === 'breathing') Breaks.start('breathing');
        else if (choice === 'grounding') Breaks.start('grounding');
        return;
      }
      if (e.target.closest('[data-reframe]')) {
        Store.update('mental', m => { m.interventionsDone++; });
        Notify.toast('Nice', 'Reframing is a skill — it gets easier each time.', 'success', 2600);
        return;
      }
      if (e.target.closest('[data-add-journal]')) {
        const input = container.querySelector('#mentalJournalInput');
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        Store.addJournal(text);
        input.value = '';
        refreshJournal();
        Notify.toast('Saved', 'Added to your gratitude journal.', 'success', 2000);
        return;
      }
      const del = e.target.closest('[data-del-journal]');
      if (del) { Store.deleteJournal(del.dataset.delJournal); refreshJournal(); }
    });
  }
}

export default {
  id: 'mental',
  title: 'Mind & Resilience',
  icon: 'brain',

  render,

  onShow() {
    unsub.push(Bus.on('store:changed', ({ scope }) => {
      if (['mental', 'settings'].includes(scope)) render(container);
      if (scope === 'journal') refreshJournal();
    }));
    unsub.push(Bus.on('break:done', ({ kind }) => { if (['breathing', 'grounding'].includes(kind)) render(container); }));
    unsub.push(Bus.on('mental:open-checkin', () => {
      const card = container?.querySelector('#mentalCheckin');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('flash-highlight'); void card.offsetWidth; card.classList.add('flash-highlight');
      }
    }));
  },

  onHide() { unsub.forEach(off => off()); unsub = []; },
};
