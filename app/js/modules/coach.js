/* ============================================================
   AI COACH — LFM2.5-230M on WebGPU (vendored runtime), with the
   JS agentic orchestrator: deterministic facts from the Store,
   one short conversational sentence from the model. Rich
   rule-based fallback when WebGPU/model is unavailable.
   ============================================================ */

import { Utils } from '../core/utils.js';
import { Store } from '../core/store.js';
import { Score } from '../core/score.js';
import { Notify } from '../core/notify.js';

const MODEL_ID = 'LiquidAI/LFM2.5-230M-GGUF';

let container = null;
let model = null;
let availability = null;     // null=unknown, {ok, reason}
let loadState = 'idle';      // idle | loading | ready | error
let loadPct = 0;
let loadLabel = '';
let generating = false;
let abortCtl = null;

/* ---------------- intent classification (deterministic) ---------------- */
const TOPICS = [
  { id: 'eye', re: /(eye|vision|sight|blur|strain|dry|screen.*(hurt|tired)|20.?20)/i,
    ask: 'the user\'s eyes feel strained from screen work. Suggest resting them' },
  // body-pain complaints are checked before movement so "my back hurts from
  // sitting" gets posture/stretch advice rather than a generic move-more nudge.
  { id: 'msk', re: /(back|neck|shoulder|wrist|posture|spine|ache|pain|hurt|stiff|sore)/i,
    ask: 'the user has desk-related body discomfort. Suggest gentle stretching and checking their setup' },
  { id: 'movement', re: /\b(stand|sit|sitting|walk|move|movement|sedentary|steps?)\b/i,
    ask: 'the user asks about sitting less and moving more. Encourage a short standing or walking break' },
  { id: 'mental', re: /(stress|anxious|anxiety|overwhelm|burn.?out|panic|worried|tense|frustrat)/i,
    ask: 'the user feels stressed. Offer a calm, kind suggestion like a short breathing exercise' },
  { id: 'sleep', re: /(sleep|insomnia|tired at night|wind.?down|bedtime|rest)/i,
    ask: 'the user asks about sleeping better. Suggest one evening wind-down habit' },
  { id: 'nutrition', re: /(eat|food|nutrition|diet|snack|lunch|meal)/i,
    ask: 'the user asks what to eat as a desk worker. Suggest one simple healthy eating habit' },
  { id: 'hydrate', re: /(water|hydrat|drink|thirst)/i,
    ask: 'the user asks about hydration. Encourage them to keep water nearby' },
  { id: 'focus', re: /(focus|concentrat|pomodoro|deep work|productiv|distract)/i,
    ask: 'the user wants to focus better. Suggest working in timed blocks with real breaks' },
  { id: 'fatigue', re: /(exhaust|fatigue|drained|tired|no energy|energy)/i,
    ask: 'the user feels exhausted from long desk work. Give one gentle recovery suggestion' },
  { id: 'stats', re: /(score|stats|status|how am i|progress|data|doing today)/i,
    ask: 'the user asked how they are doing. Give a short encouraging comment' },
];

function classify(text) {
  for (const t of TOPICS) if (t.re.test(text)) return t;
  return null;
}

const FACT_TOPIC = { eye: 'eye', movement: 'movement', msk: 'msk', mental: 'mental',
  hydrate: 'hydrate', focus: 'focus', fatigue: 'focus', stats: 'stats' };

/* ---------------- rule-based fallback coach ---------------- */
function fallbackReply(text) {
  const topic = classify(text)?.id;
  const s = Store.settings();
  const d = Store.today();
  switch (topic) {
    case 'eye':
      return `${Score.factFor('eye')} Follow the **20-20-20 rule**: every 20 minutes, look at something 20 feet away for 20 seconds. Also check that your screen sits at arm's length with its top at eye level — and blink deliberately; screen work cuts your blink rate roughly in half.`;
    case 'movement':
      return `${Score.factFor('movement')} Expert guidance for desk workers is to build up **2–4 hours of standing or light activity per working day**. Easy wins: stand for calls, walk after lunch, and let the movement-block reminders pull you up every ${s.moveEvery} minutes.`;
    case 'msk':
      return `${Score.factFor('msk')} Try this now: relax your shoulders away from your ears, sit tall, and do slow neck rotations for 20 seconds. The **Posture & Body** page has targeted micro-stretches. If pain is sharp, persistent, or radiating, please see a professional.`;
    case 'mental':
      return `${Score.factFor('mental')} A 3-minute **box-breathing** round (in 4 · hold 4 · out 4 · hold 4) reliably takes the edge off. You'll find it under Mind & Resilience → "I feel stressed". Be kind to yourself — stress on deadline weeks is normal, not a failure.`;
    case 'sleep':
      return `Good sleep starts before bed: dim screens 30–60 minutes ahead, keep a consistent time, and skip caffeine after mid-afternoon. Your wind-down reminder is set for **${s.winddownAt || 'off'}** — the evening checklist on the Lifestyle page walks you through it.`;
    case 'nutrition':
      return `Simple beats perfect: regular meals, vegetables or whole grains at lunch, and water within reach. For eye health specifically, leafy greens and omega-3-rich foods (lutein and DHA) genuinely help. Avoid heavy lunches that cause the 3 pm crash.`;
    case 'hydrate':
      return `${Score.factFor('hydrate')} Keep a full glass or bottle in sight — visibility is 90% of the habit. Your goal is ${s.waterGoal} glasses; the tracker on the Lifestyle page logs one tap per glass.`;
    case 'focus':
      return `${Score.factFor('focus')} Work with your attention, not against it: ${s.focusMin}-minute focus blocks with real breaks between them. Start one on the Deep Work page — non-critical health nudges pause automatically while you're in a session.`;
    case 'fatigue':
      return `${Score.factFor('stats')} Fatigue after long desk days usually stacks up from three things: too little movement, shallow hydration, and zero real breaks. Pick one now — a 2-minute walk is the fastest reset. ${d.movement.standingMin < 30 ? 'You\'ve barely stood today, so start there.' : 'Your movement is decent today, so water and an eye break are next.'}`;
    case 'stats': {
      const score = Score.composite();
      const insight = Score.insights()[0]?.text ?? '';
      return `Your health score is **${score}/100** right now. ${insight} ${score >= 75 ? 'Strong day — keep the rhythm.' : score >= 50 ? 'Solid, with room to improve.' : 'Small steps count; pick one nudge and do it now.'}`;
    }
    default:
      if (/(hello|hi|hey|yo)\b/i.test(text)) {
        return `${Utils.greeting()}! I'm your wellness coach. Ask me about eye strain, movement, posture, stress, sleep, food, hydration, or focus — or just tell me how you feel.`;
      }
      return `I can help with eye care, movement, posture, stress, sleep, nutrition, hydration, and focus. Your health score is **${Score.composite()}/100** today. What's on your mind?`;
  }
}

/* ---------------- model lifecycle ---------------- */
async function checkAvailability() {
  if (availability) return availability;
  if (!navigator.gpu) {
    availability = { ok: false, reason: 'WebGPU is not available in this environment.' };
    return availability;
  }
  try {
    const { Lfm2Mobile } = await import('../lib/lfm2_5.js');
    const res = await Lfm2Mobile.checkAvailability(MODEL_ID);
    availability = res && res.ok === false
      ? { ok: false, reason: res.reason || 'This device cannot run the model.' }
      : { ok: true };
  } catch (e) {
    // network hiccup on the header probe — allow trying a real load
    availability = { ok: true, reason: String(e?.message ?? e) };
  }
  return availability;
}

async function loadModel() {
  if (loadState === 'loading' || loadState === 'ready') return;
  loadState = 'loading'; loadPct = 0; loadLabel = 'Requesting WebGPU device…';
  renderEngine();
  try {
    const { Lfm2Mobile } = await import('../lib/lfm2_5.js');
    model = await Lfm2Mobile.load(MODEL_ID, {
      onProgress(ev) {
        const labels = { init: 'Requesting WebGPU device…', tokenizer: 'Loading tokenizer…',
          weights: 'Downloading model weights…', ready: 'Preparing GPU…' };
        loadLabel = labels[ev.status] || ev.status;
        if (ev.status === 'weights' && Number.isFinite(ev.fraction)) {
          loadPct = Math.round(5 + 90 * Math.min(1, Math.max(0, ev.fraction)));
          loadLabel = `Downloading model weights… ${loadPct}%`;
        } else if (ev.status === 'ready') loadPct = 96;
        renderEngine();
      },
    });
    loadLabel = 'Warming up kernels…'; loadPct = 98; renderEngine();
    await model.warmup();
    loadState = 'ready'; loadPct = 100;
    renderEngine();
    Notify.toast('AI coach ready', 'LFM2.5 is running on your GPU — fully private.', 'success');
  } catch (e) {
    console.error('Model load failed:', e);
    loadState = 'error';
    loadLabel = String(e?.message ?? e);
    model = null;
    renderEngine();
  }
}

/* ---------------- generation (orchestrator) ---------------- */
async function generateReply(userText, bubble) {
  const topic = classify(userText);
  const factTopic = topic ? FACT_TOPIC[topic.id] : null;
  const fact = factTopic ? Score.factFor(factTopic) + ' ' : '';
  const instruction = topic
    ? `You are a warm, encouraging workplace wellness coach. In one or two short sentences, ${topic.ask}. Be specific and kind. Do not ask questions. Do not mention data, numbers, or apps.`
    : `You are a warm, encouraging workplace wellness coach for desk workers. Reply to this in one or two short, kind sentences: ${userText}`;

  abortCtl = new AbortController();
  let llmText = '';
  try {
    const stream = model.generate([{ role: 'user', content: instruction }],
      { maxNewTokens: 90, signal: abortCtl.signal });
    for await (const { text } of stream) {
      llmText = text;
      bubble.innerHTML = Utils.md(fact + llmText.trim());
      scrollChat();
    }
  } finally {
    abortCtl = null;
  }
  let final = (fact + llmText.trim()).trim();
  if (!llmText.trim()) final = fallbackReply(userText); // model returned nothing
  bubble.innerHTML = Utils.md(final);
  return final;
}

/* ---------------- UI ---------------- */
function engineBadge() {
  if (loadState === 'ready') return `<span class="badge badge--ok"><span class="dot"></span>On-device AI · LFM2.5-230M</span>`;
  if (loadState === 'loading') return `<span class="badge badge--accent"><span class="dot"></span>Loading model…</span>`;
  if (availability && !availability.ok) return `<span class="badge">Rule-based coach</span>`;
  return `<span class="badge">Rule-based · AI available</span>`;
}

function renderEngine() {
  const host = container?.querySelector('#coachEngine');
  if (!host) return;
  container.querySelector('#coachBadge').innerHTML = engineBadge();

  if (loadState === 'ready') { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = 'block';

  if (loadState === 'loading') {
    host.innerHTML = `
      <div class="coach-engine card card--pad">
        <div class="row">
          <div class="spinner"></div>
          <div class="grow">
            <div class="small" style="font-weight:600">${Utils.esc(loadLabel)}</div>
            <div class="progress mt-2"><div class="progress__fill" style="width:${loadPct}%"></div></div>
          </div>
        </div>
        <p class="muted small mt-3">One-time download (~210 MB), cached locally. Everything runs on your GPU — no data ever leaves this computer.</p>
      </div>`;
    return;
  }
  if (loadState === 'error') {
    host.innerHTML = `
      <div class="coach-engine card card--pad">
        <div class="row">
          <span class="badge badge--bad">Load failed</span>
          <span class="small muted grow">${Utils.esc(loadLabel)}</span>
          <button class="btn btn--secondary btn--sm" data-load-model>${Utils.icon('refresh', 13)} Retry</button>
        </div>
        <p class="muted small mt-2">The rule-based coach keeps working meanwhile.</p>
      </div>`;
    return;
  }
  if (availability && !availability.ok) {
    host.innerHTML = `
      <div class="coach-engine card card--pad">
        <div class="row">
          ${Utils.icon('info', 15)}
          <span class="small grow">${Utils.esc(availability.reason)} You still get the full rule-based coach.</span>
        </div>
      </div>`;
    return;
  }
  host.innerHTML = `
    <div class="coach-engine card card--pad">
      <div class="row">
        <div class="grow">
          <div class="small" style="font-weight:650">Upgrade to on-device AI</div>
          <div class="small muted">LFM2.5-230M runs privately on your GPU via WebGPU. One-time ~210 MB download.</div>
        </div>
        <button class="btn btn--primary btn--sm" data-load-model>${Utils.icon('download', 13)} Load AI model</button>
      </div>
    </div>`;
}

function chipSuggestions() {
  const d = Store.today();
  const out = [];
  if (d.eye.breaksTaken === 0) out.push('My eyes are bothering me');
  if (d.movement.standingMin < 30) out.push('How much should I stand today?');
  const lastMood = d.mental.checkins.at(-1);
  if (lastMood && lastMood.stress >= 6) out.push('I need quick stress relief');
  for (const extra of ['I feel exhausted after coding all day', 'My back hurts from sitting',
    'What should I eat for my eyes?', 'How am I doing today?', 'Help me sleep better']) {
    if (out.length >= 4) break;
    if (!out.includes(extra)) out.push(extra);
  }
  return out.slice(0, 4);
}

function messageHtml(role, html) {
  return `<div class="chat-msg chat-msg--${role}"><div class="chat-msg__bubble">${html}</div></div>`;
}

function scrollChat() {
  const box = container?.querySelector('#coachMsgs');
  if (box) box.scrollTop = box.scrollHeight;
}

function addBubble(role, html = '') {
  const box = container.querySelector('#coachMsgs');
  box.insertAdjacentHTML('beforeend', messageHtml(role, html));
  scrollChat();
  return box.lastElementChild.querySelector('.chat-msg__bubble');
}

async function send(text) {
  text = String(text ?? '').trim();
  if (!text || generating) return;
  const input = container.querySelector('#coachInput');
  input.value = '';
  container.querySelector('#coachEmpty')?.remove();

  addBubble('user', Utils.esc(text));
  Store.addChat({ role: 'user', content: text });

  generating = true;
  syncSendBtn();
  const bubble = addBubble('coach', '<span class="chat-typing"><i></i><i></i><i></i></span>');

  let reply;
  try {
    if (loadState === 'ready' && model) reply = await generateReply(text, bubble);
    else {
      await new Promise(r => setTimeout(r, 350)); // small beat so it feels conversational
      reply = fallbackReply(text);
      bubble.innerHTML = Utils.md(reply);
    }
  } catch (e) {
    console.error('Generation failed:', e);
    reply = fallbackReply(text);
    bubble.innerHTML = Utils.md(reply);
  }
  Store.addChat({ role: 'coach', content: reply });
  generating = false;
  syncSendBtn();
  renderChips();
  scrollChat();
}

function syncSendBtn() {
  const btn = container.querySelector('#coachSend');
  if (!btn) return;
  btn.innerHTML = generating ? Utils.icon('stop', 15) : Utils.icon('send', 15);
  btn.title = generating ? 'Stop' : 'Send';
}

function renderChips() {
  const host = container.querySelector('#coachChips');
  if (!host) return;
  host.innerHTML = chipSuggestions().map(s =>
    `<button class="chip chip--btn">${Utils.esc(s)}</button>`).join('');
}

export default {
  id: 'coach',
  title: 'AI Coach',
  icon: 'chat',

  render(el) {
    container = el;
    const history = Store.chat();
    el.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-head__title">
            <div class="page-head__icon">${Utils.icon('chat', 20)}</div>
            <div>
              <h1>AI Coach</h1>
              <div class="page-head__sub" id="coachBadge">${engineBadge()}</div>
            </div>
          </div>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--ghost btn--sm" id="coachClear">${Utils.icon('trash', 13)} Clear chat</button>
        </div>
      </div>

      <div id="coachEngine"></div>

      <div class="card coach-chat">
        <div class="coach-chat__msgs" id="coachMsgs">
          ${history.length === 0 ? `
            <div class="empty" id="coachEmpty">
              ${Utils.icon('sparkle', 30)}
              <div class="empty__title">${Utils.esc(Utils.greeting())} — I'm your wellness coach</div>
              <div class="empty__sub">Ask about eye strain, movement, posture, stress, sleep, food, or focus. Answers combine your real day with practical advice.</div>
            </div>` :
            history.map(m => messageHtml(m.role === 'user' ? 'user' : 'coach',
              m.role === 'user' ? Utils.esc(m.content) : Utils.md(m.content))).join('')}
        </div>
        <div class="coach-chat__chips" id="coachChips"></div>
        <div class="coach-chat__input">
          <input type="text" class="input" id="coachInput" placeholder="Ask me anything about your health & focus…" maxlength="500" />
          <button class="btn btn--primary btn--icon" id="coachSend" title="Send">${Utils.icon('send', 15)}</button>
        </div>
      </div>

      <div class="disclaimer mt-4">
        ${Utils.icon('alert', 14)}
        <span>The coach offers general wellness guidance, not medical or psychological care. In a crisis, contact local emergency services or a helpline such as the 988 Suicide &amp; Crisis Lifeline (US) — you deserve real support.</span>
      </div>`;

    el.querySelector('#coachSend').addEventListener('click', () => {
      if (generating) { abortCtl?.abort(); return; }
      send(el.querySelector('#coachInput').value);
    });
    el.querySelector('#coachInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') send(e.target.value);
    });
    el.querySelector('#coachChips').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip) send(chip.textContent);
    });
    el.querySelector('#coachClear').addEventListener('click', () => {
      Store.clearChat();
      model?.reset?.();
      this.render(el);
    });
    el.querySelector('#coachEngine').addEventListener('click', e => {
      if (e.target.closest('[data-load-model]')) loadModel();
    });

    renderChips();
    renderEngine();
    scrollChat();
    checkAvailability().then(renderEngine);
  },

  onShow() { scrollChat(); },
};
