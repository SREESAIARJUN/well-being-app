# WellBeing Companion — Architecture

Ground-up rebuild (v1.0). Steering documents: `PROJECT_JOURNEY.md` (vision + lessons) and
`Ultra-Premium Cross-Platform Health & Productivity Desktop App – Expanded Whole-Body & Mental Health Scope.md` (PRD).

Stack: **vanilla ES-module JavaScript + hand-rolled CSS design system + Tauri v2 (Rust)**.
No frontend frameworks, no external fonts/CDNs — the app must work fully offline
(the only network use is the optional one-time AI model download from Hugging Face).

## Hard lessons the previous build taught (do not regress)

1. **Never steal focus for notifications.** The old build popped the *main window* to the
   front for every toast. Reminders now go to a dedicated frameless, always-on-top,
   non-focusable `popup` window positioned above the tray; the main window is only shown
   on explicit user action.
2. **Tiny local models can't do RAG.** The AI coach uses a JS agentic orchestrator:
   JavaScript computes the factual sentence deterministically from the Store; the LLM is
   only asked for 1–2 sentences of conversational advice. No data dumps in prompts.
3. **No phantom dependencies.** Old code called `window.marked` which was never loaded.
   Everything used must exist in-repo. Markdown rendering is `Utils.md()` (tiny, safe).
4. **Timers must survive suspend/sleep.** All scheduling uses absolute epoch deadlines
   recomputed on every tick — never accumulated `setInterval` counts.

## File layout

```
app/
  index.html            main window shell (sidebar + pages + overlay roots)
  popup.html            reminder popup window (tiny, self-contained)
  css/
    tokens.css          design tokens (dark default + light), module accents
    base.css            reset, typography, keyframes, scrollbars
    components.css      shared components (see inventory below)
    layout.css          app shell, sidebar, pages, transitions
    breaks.css          full-screen guided-break overlay
    popup.css           popup window styles
    modules/<id>.css    per-module styles (owned by that module ONLY)
  js/
    main.js             boot, router, sidebar, page mounting, global wiring
    breaks.js           guided break overlay controller (Breaks.start(kind))
    popup.js            logic for popup.html
    core/
      utils.js  bus.js  store.js  score.js  tauri.js
      notify.js  scheduler.js  modal.js  charts.js
    modules/
      dashboard.js eye.js movement.js msk.js mental.js
      lifestyle.js focus.js coach.js settings.js
    lib/lfm2_5.js       vendored LFM2.5 WebGPU runtime (Hugging Face) — DO NOT EDIT
src-tauri/              Rust backend (tray, popup window mgmt, autostart)
lfm2-webgpu-kernels/    upstream HF Space clone (reference only, not shipped)
```

## Module interface

Every file in `js/modules/` default-exports:

```js
export default {
  id: 'movement',            // page id, css file name, store scope
  title: 'Movement',
  icon: 'walk',              // key from Utils icon set
  render(container) {},      // (re)build page DOM; bind listeners inside
  onShow() {},               // page became visible (optional)
  onHide() {},               // optional
  onTick(now) {},            // optional; 1 Hz while page visible (countdowns)
}
```

Rules for modules:
- Build DOM with template strings + `container.querySelector` bindings, or `Utils.el()`.
  **No inline `onclick=` globals.** Use `addEventListener` after rendering.
- Re-render on `Bus.on('store:changed')` only while visible (main.js emits
  `page:shown`/`page:hidden`; modules can also check `document.getElementById(...)`).
  Simplest correct pattern (used by eye.js exemplar): subscribe in `onShow`,
  unsubscribe in `onHide`.
- All persistent state lives in the Store — modules never touch `localStorage` directly.
- Escape all user-entered text with `Utils.esc()` before inserting into HTML.
- Module-specific CSS goes in `css/modules/<id>.css` (linked from index.html).
  Shared components/tokens must be reused — do not redefine buttons/cards.

## Store (core/store.js)

localStorage-backed, all keys prefixed `wb.`. Daily data lives under `wb.day.<YYYY-MM-DD>`;
`Store.rolloverIfNeeded()` runs at boot and midnight. History is derived by reading past
day keys (retention pruning per settings, default 90 days).

### Day record shape (`Store.today()` returns this, never null)

```js
{
  eye:      { breaksTaken:0, breaksSkipped:0, exercisesDone:0, blinksShown:0 },
  movement: { standingMin:0, blocksDone:0, blocksSkipped:0, posture:'sit',
              segments:[{t:epochMs, mode:'sit'|'stand'}] },   // day posture timeline
  msk:      { checkins:[{ts, areas:{neck,shoulders,upperBack,lowerBack,wrists}}], // 0..10
              exercisesDone:0, postureChecks:0 },
  mental:   { checkins:[{ts, mood:1..10, stress:1..10}], interventionsDone:0, sos:0 },
  lifestyle:{ water:0, winddownDone:false, nudgeIndex:0 },
  focus:    { sessions:[{start, end, minutes, completed:bool}], minutes:0 },
  breaks:   []   // unified log [{ts, kind, action:'done'|'skipped'|'ignored'}]
}
```

### API (all synchronous)

```js
Store.init()                          // rollover + prune; call once at boot
Store.settings()                      // full settings object (defaults merged)
Store.updateSettings(patch)           // persists + Bus.emit('store:changed',{scope:'settings'})
Store.today()                         // today's day record (auto-created)
Store.day(dateKey)                    // day record for 'YYYY-MM-DD' or null
Store.update(scope, fn)               // fn(mutable today[scope]) → persisted,
                                      //   emits store:changed {scope}
Store.logBreak(kind, action)          // append to today.breaks + counters
Store.pastDays(n)                     // [{date:'YYYY-MM-DD', data:dayRecord|null}] oldest→newest, excludes today
Store.journal()                       // [{id, ts, text}] gratitude entries (global)
Store.addJournal(text) / Store.deleteJournal(id)
Store.chat() / Store.addChat(msg) / Store.clearChat()
Store.recoveryPlan()                  // this ISO week's plan {items:[{id,label,done}]}
Store.updateRecoveryPlan(fn)
Store.exportAll() / Store.importAll(json) / Store.clearAll()
Store.storageUsedKB()
```

### Settings defaults (complete — settings.js must expose all of these)

```js
{
  onboarded: false,
  theme: 'dark',                    // 'dark' | 'light' | 'auto'
  mode: 'balanced',                 // 'balanced' | 'focus' | 'recovery' | 'resilience'
  workStart: '09:00', workEnd: '18:00', workDays: [1,2,3,4,5],   // 0=Sun
  eyeBreakEvery: 20,                // min
  eyeBreakSecs: 20,
  blinkEvery: 10,                   // min, gentle toast; 0 = off
  moveEvery: 45,                    // min (PRD: 30–60)
  standGoalMin: 120,                // PRD: 2h → 4h/day
  hydrateEvery: 60,                 // min
  waterGoal: 8,                     // glasses
  postureEvery: 60,                 // min
  moodCheck: 'daily',               // 'daily' | 'twice' | 'off'
  winddownAt: '21:30',              // '' = off
  focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4,
  focusSuppression: 'soft',         // 'soft' (eye+move still fire) | 'hard' (only eye) | 'off'
  notifyStyle: 'auto',              // 'auto' (popup when unfocused, in-app when focused) | 'popup' | 'inapp'
  soundOn: true,
  autostart: false,                 // mirrored to OS via Tauri
  retentionDays: 90,
  modules: { eye:true, movement:true, msk:true, mental:true,
             lifestyle:true, focus:true, coach:true },
}
```

## Bus (core/bus.js)

`Bus.on(evt, fn)` → unsubscribe fn, `Bus.off`, `Bus.once`, `Bus.emit(evt, payload)`.

Events contract:

| event               | payload                          | emitted by |
|---------------------|----------------------------------|------------|
| `store:changed`     | `{scope}`                        | store      |
| `reminder:due`      | `{kind}`                         | scheduler  |
| `break:done`        | `{kind, completed:bool}`         | breaks.js  |
| `focus:changed`     | `{active:bool, phase}`           | focus.js   |
| `page:shown`        | `{id}`                           | main.js    |
| `popup:action`      | `{action, kind}`                 | tauri.js (from popup window) |

## Scheduler (core/scheduler.js)

Central 1 Hz engine. Reminder kinds: `eye`, `blink`, `move`, `hydrate`, `posture`,
`mood`, `winddown`. Absolute-deadline based; only fires inside work hours/days
(mood + winddown ignore work hours). Respects `settings.modules` toggles + mode matrix:

| kind     | balanced | focus                     | recovery | resilience |
|----------|----------|---------------------------|----------|------------|
| eye      | on       | on                        | on       | on         |
| blink    | on       | off                       | on       | on         |
| move     | on       | soft-suppression-dependent| on ×1.5 freq | on     |
| hydrate  | on       | off (soft) / off (hard)   | on       | on         |
| posture  | on       | off                       | on       | on         |
| mood     | per set. | off                       | on       | on ×2      |
| winddown | on       | on                        | on       | on         |

While a `focus.js` session is running, the suppression column applies (per
`settings.focusSuppression`). Spacing guard: ≥90 s between any two fired reminders
(deferred kinds keep their order). API:

```js
Scheduler.init()
Scheduler.next()                 // [{kind, at:epochMs}] soonest-first (for dashboard)
Scheduler.snooze(kind, min=5)
Scheduler.done(kind)             // user completed → reschedule from now
Scheduler.skip(kind)             // reschedule + log skip
Scheduler.reset(kind)            // recompute deadline after settings change (auto on store:changed)
Scheduler.setFocusActive(bool)   // called by focus module via Bus
```

On `reminder:due`, **notify.js** decides routing (nobody else calls popups directly):
window focused → in-app banner toast with action buttons; unfocused/hidden + Tauri →
native popup window; browser dev fallback → in-app toast always.

## Breaks overlay (breaks.js)

`Breaks.start(kind)` with kinds: `eye` (20 s countdown ring), `palming`, `figure8`,
`stretch` (multi-step sequence player), `breathing` (box-breathing animation),
`grounding` (5-4-3-2-1), `posture` (posture reset checklist). Emits `break:done`
`{kind, completed}` and logs via `Store.logBreak`. Full-screen glass overlay inside the
main window; ESC = skip.

## Tauri bridge (core/tauri.js)

Safe in both Tauri and plain browsers (all functions no-op/fallback outside Tauri).

```js
Tauri.isTauri                     // bool
Tauri.invoke(cmd, args)           // -> Promise (rejects outside Tauri)
Tauri.listen(evt, cb)             // tauri event -> cb(payload)
Tauri.showPopup({kind,title,body,icon,accent,timeoutMs,actions:[{id,label,primary}]})
Tauri.hidePopup()
Tauri.showMain() / Tauri.hideMain() / Tauri.quit()
Tauri.setAutostart(bool) / Tauri.getAutostart()
Tauri.isFocused()                 // Promise<bool>, browser: document.hasFocus()
```

Rust commands (src-tauri): `show_popup`, `hide_popup`, `popup_action`, `show_main`,
`hide_main`, `quit_app`, `set_autostart`, `get_autostart`. Popup window: frameless,
transparent, always-on-top, skip-taskbar, **never focused**, positioned bottom-right of
the primary monitor work-area. `popup_action` forwards `{action,kind}` to the main
window as event `popup:action` (and shows main first when `action==='open'`).

## AI coach (modules/coach.js) — LFM2.5-230M on WebGPU

- Vendored runtime: `import { Lfm2Mobile } from '../lib/lfm2_5.js'`.
- Model id `LiquidAI/LFM2.5-230M-GGUF` (~210 MB GGUF fetched once from HF, cached).
- Gate with `Lfm2Mobile.checkAvailability(MODEL_ID)` before offering the download.
- `Lfm2Mobile.load(MODEL_ID, {onProgress})` — progress events
  `{status:'init'|'tokenizer'|'weights'|'ready', fraction, loaded, total}`.
- `model.generate(messages, {maxNewTokens, signal})` → async iterable of
  `{token, delta, text}`. `model.warmup()`, `model.reset()`, `model.dispose()`.
- **Orchestrator**: JS classifies intent (eye/movement/msk/stress/sleep/nutrition/
  hydration/focus/stats), builds a deterministic fact sentence from Store, asks the
  model for ONE short empathetic sentence. maxNewTokens ≤ 96. Streamed into the bubble.
- Rich rule-based fallback whenever WebGPU/model is unavailable.
- Non-clinical disclaimer pinned in UI; crisis-resources footer per PRD.

## Design system quick reference (components.css)

Buttons: `.btn` + `.btn--primary|--secondary|--ghost|--danger|--sm|--lg|--icon|--block`
Cards: `.card`, `.card--pad`, `.card__title`, `.card__sub`, `.card-grid` (+`.cols-2/3/4`)
Stats: `.stat`, `.stat__value`, `.stat__label`, `.stat__delta` (+`.up/.down`)
Rings: `.ring` wrapper — built by `Charts.ring(el, {value, size, label})`
Progress: `.progress` > `.progress__fill`; `.meter` for goal bars
Inputs: `.field`, `.field__label`, `.input`, `.select`, `.toggle` (checkbox hack),
        `.slider` (range), `.seg` (segmented control) > `.seg__btn.is-active`
Chips: `.chip`, `.chip--accent`; Badges: `.badge`, `.badge--ok|warn|bad`
Lists: `.list`, `.list__item`, `.list__icon`, `.list__body`, `.list__aside`
Tabs: `.tabs` > `.tab.is-active`; Empty state: `.empty`
Page scaffolding: `.page-head`, `.page-head__title`, `.page-head__sub`,
        `.page-head__actions`, `.section-title`
Module accent: each page root gets `data-module="<id>"`; tokens.css maps it to
`--accent` so `.btn--primary`, rings, etc. pick up the module color automatically.
Icons: `Utils.icon(name, size?)` → inline SVG string. Available names:
`logo eye walk spine brain leaf timer chat gear home drop wind sun moon bell pause
play stop check x plus minus arrow-right chevron-l chevron-r flame heart star
sparkle chart clock coffee monitor keyboard alert info snooze skip refresh download
send trash export import zap target book edit list`

## Verification

- Frontend runs standalone in a browser (`tools/serve.mjs` static server) — Tauri
  bridge degrades gracefully; use for fast UI iteration.
- `cargo check` in `src-tauri`, then `npm run build` for the installer.
