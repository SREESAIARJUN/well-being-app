# WellBeing Companion

**🌐 Website: [sreesaiarjun.github.io/well-being-app](https://sreesaiarjun.github.io/well-being-app/)**

A privacy-first **health & productivity desktop app** for desk workers. It runs quietly
in the system tray and watches your back — nudging you toward eye breaks, movement,
better posture, hydration, and calmer focus, with a fully **on-device AI coach** that
never sends your data anywhere.

> Built with vanilla JavaScript, a hand-rolled CSS design system, and Tauri v2 (Rust).
> The AI coach runs LiquidAI's **LFM2.5-230M** locally on your GPU via WebGPU.

![privacy](https://img.shields.io/badge/privacy-100%25%20on--device-2dd4bf) ![stack](https://img.shields.io/badge/Tauri-v2-8b5cf6) ![ai](https://img.shields.io/badge/AI-LFM2.5--230M%20WebGPU-38bdf8) ![platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-64748b) ![license](https://img.shields.io/badge/license-MIT-94a3b8)

## Download

Grab the installer for your platform from the **[latest release](https://github.com/SREESAIARJUN/well-being-app/releases/latest)**, or use a direct link below:

| Platform | Download |
|---|---|
| 🪟 **Windows** (x64) | [Setup .exe](https://github.com/SREESAIARJUN/well-being-app/releases/latest/download/WellBeing.Companion_1.1.1_x64-setup.exe) (recommended) · [.msi](https://github.com/SREESAIARJUN/well-being-app/releases/latest/download/WellBeing.Companion_1.1.1_x64_en-US.msi) |
| 🍎 **macOS** — Apple Silicon | [.dmg](https://github.com/SREESAIARJUN/well-being-app/releases/latest/download/WellBeing.Companion_1.1.1_aarch64.dmg) |
| 🍎 **macOS** — Intel | [.dmg](https://github.com/SREESAIARJUN/well-being-app/releases/latest/download/WellBeing.Companion_1.1.1_x64.dmg) |
| 🐧 **Linux** (x64) | [.AppImage](https://github.com/SREESAIARJUN/well-being-app/releases/latest/download/WellBeing.Companion_1.1.1_amd64.AppImage) (portable) · [.deb](https://github.com/SREESAIARJUN/well-being-app/releases/latest/download/WellBeing.Companion_1.1.1_amd64.deb) · [.rpm](https://github.com/SREESAIARJUN/well-being-app/releases/latest/download/WellBeing.Companion-1.1.1-1.x86_64.rpm) |

> The direct links above point at v1.1.1. If a newer release has shipped since,
> grab it from the **[releases page](https://github.com/SREESAIARJUN/well-being-app/releases/latest)** instead — filenames change with the version number.

**Platform notes**
- **macOS** builds aren't code-signed (no Apple Developer account behind this project). On
  first launch: right-click the app → **Open** (or allow it under *System Settings → Privacy
  & Security*). The AI coach needs a WebGPU-capable WebKit; on older macOS it falls back to
  the rule-based coach automatically.
- **Linux** AppImage: `chmod +x` then run. The tray icon needs an AppIndicator extension on
  some GNOME setups. WebKitGTK has no WebGPU yet, so the AI coach runs rule-based.
- **Windows** is the most thoroughly verified target — every feature, plus the native popup
  window and on-device AI, tested end-to-end on real hardware.

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
  to a rich rule-based coach when WebGPU is unavailable, with an optional auto-load setting.
- **🔔 Non-intrusive reminders** — a dedicated always-on-top popup that appears above the
  tray **without stealing focus**; in-app banners when the window is already focused; a
  one-click **Do Not Disturb** to pause everything for an hour.
- **📊 Dashboard** — composite health score with an animated ring, per-pillar breakdown,
  an activity streak, a weekly summary, and a 7-day trend.
- **🎨 Premium UI** — glassmorphism, per-module accent theming, light/dark/auto themes,
  four intervention modes (Balanced / Focus / Recovery / Resilience), keyboard shortcuts
  (press `?` in-app to see them).
- **🖥 Cross-platform** — native builds for Windows, macOS (Apple Silicon + Intel), and
  Linux, from one codebase.

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
  js/selftest.js  runtime self-test harness (see below)
  js/lib/       vendored LFM2.5 WebGPU runtime
src-tauri/      Rust: tray, close-to-tray, autostart, always-on-top popup window
.github/workflows/release.yml   CI matrix — builds & publishes all platforms on a `v*` tag
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
npm run build                # release build + installers for your current OS
```

Installers are emitted under `src-tauri/target/release/bundle/`.

### Cross-platform releases (CI)

Pushing a `v*` tag (or running the workflow manually against an existing tag) triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which builds and uploads
installers for Windows, macOS (both architectures), and Linux to that GitHub release:

```bash
git tag v1.2.0 && git push origin v1.2.0
```

### Verify a build

The app ships a runtime self-test. Launch it with `--selftest` and it will exercise the
reminder popup, autostart round-trip, and the real on-device AI (WebGPU model load +
generation), writing each step to a log file (`%TEMP%\wellbeing-selftest.log` on Windows,
your OS temp dir elsewhere):

```bash
"wellbeing.exe" --selftest
```

Without the flag the harness is inert.

## Status & contributing

Active development on this project is complete — everything originally planned is built,
tested end-to-end, and shipped. From here it's open for the community to take further.
[ARCHITECTURE.md](ARCHITECTURE.md) is the contract new modules should follow; PRs, forks,
and issues are welcome.

## Privacy

WellBeing Companion is **on-device by design**. Health check-ins, journals, and settings
never leave your computer. The AI coach runs entirely locally on your GPU. WellBeing
offers general wellness guidance — it is **not** medical, psychological, or crisis care.

## License

MIT
