# WellBeing Companion

A privacy-first **health & productivity desktop app** for desk workers. It runs quietly
in the system tray and watches your back — nudging you toward eye breaks, movement,
better posture, hydration, and calmer focus, with a fully **on-device AI coach** that
never sends your data anywhere.

> Built with vanilla JavaScript, a hand-rolled CSS design system, and Tauri v2 (Rust).
> The AI coach runs LiquidAI's **LFM2.5-230M** locally on your GPU via WebGPU.

![health score](https://img.shields.io/badge/privacy-100%25%20on--device-2dd4bf) ![stack](https://img.shields.io/badge/Tauri-v2-8b5cf6) ![ai](https://img.shields.io/badge/AI-LFM2.5--230M%20WebGPU-38bdf8)

## Features

- **👁 Eye health** — 20-20-20 break enforcement, blink reminders, guided palming /
  figure-8 exercises, screen-ergonomics checklist, weekly adherence trend.
- **🚶 Movement** — sit/stand tracking toward the evidence-based 2→4 h/day standing goal,
  movement blocks, a sit-less timeline, guided desk stretches.
- **🧍 Posture & body** — discomfort check-ins, targeted micro-stretches for the sorest
  areas, posture resets, ergonomic guidance, discomfort trend charts.
- **🧠 Mind & resilience** — mood/stress check-ins, a "I feel stressed" reset (box
  breathing + 5-4-3-2-1 grounding), gratitude journal, cognitive-reframe practice.
  Explicitly non-clinical, with crisis signposting.
- **🌿 Lifestyle** — hydration tracking, rotating nutrition nudges, an evening wind-down
  checklist, and a weekly off-screen recovery plan.
- **⏱ Deep work** — a Pomodoro focus timer that *protects flow* by suppressing
  non-critical reminders while you're in a session.
- **🤖 AI coach** — an agentic orchestrator: JavaScript computes the factual sentence
  from your real data; the tiny local LLM adds one warm, conversational line. Falls back
  to a rich rule-based coach when WebGPU is unavailable.
- **🔔 Non-intrusive reminders** — a dedicated always-on-top popup that appears above the
  tray **without stealing focus**; in-app banners when the window is already focused.
- **🎨 Premium UI** — glassmorphism, per-module accent theming, light/dark/auto themes,
  four intervention modes (Balanced / Focus / Recovery / Resilience).

Everything is stored locally in the browser's `localStorage`. The only network access is
the optional, one-time AI model download (~210 MB) cached by your browser/WebView.

## Architecture

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the full contract. In short:

```
app/            frontend — vanilla ES modules, no build step
  index.html    main window shell        popup.html   reminder popup
  css/          design system (tokens, components, layout, breaks, popup) + per-module
  js/core/      utils · bus · store · score · scheduler · notify · charts · modal · tauri
  js/modules/   dashboard · eye · movement · msk · mental · lifestyle · focus · coach · settings
  js/breaks.js  full-screen guided-break overlay
  js/lib/       vendored LFM2.5 WebGPU runtime
src-tauri/      Rust: tray, close-to-tray, autostart, always-on-top popup window
```

Core engineering decisions (and the lessons behind them) are documented in
[PROJECT_JOURNEY.md](PROJECT_JOURNEY.md).

## Develop

The frontend runs standalone in any WebGPU-capable browser — the Tauri bridge degrades
gracefully, so you can iterate on the UI without building the native shell:

```bash
node tools/serve.mjs        # serves app/ at http://localhost:4173
```

Native desktop app (requires Rust + the platform WebView and bundler toolchain):

```bash
npm install
npm run dev                 # hot dev window
npm run build               # release build + installers (NSIS / MSI on Windows)
```

Installers are emitted under `src-tauri/target/release/bundle/`.

### Verify a build

The app ships a runtime self-test. Launch it with `--selftest` and it will exercise the
reminder popup, autostart round-trip, and the real on-device AI (WebGPU model load +
generation), writing each step to `%TEMP%\wellbeing-selftest.log`:

```bash
"wellbeing.exe" --selftest
```

Without the flag the harness is inert.

## Privacy

WellBeing Companion is **on-device by design**. Health check-ins, journals, and settings
never leave your computer. The AI coach runs entirely locally on your GPU. WellBeing
offers general wellness guidance — it is **not** medical, psychological, or crisis care.

## License

MIT
