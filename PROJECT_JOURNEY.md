# The WellBeing Project Journey

## How It Started
The **WellBeing Companion** began with a simple but critical observation: desk workers are slowly destroying their bodies. Between staring at monitors for 10 hours a day, developing "tech neck," and forgetting to drink water while deep in the execution zone, the physical and mental toll of modern desk work is immense. 

We set out to build an ultra-premium, cross-platform desktop application that would sit silently in the background and literally watch the user's back—tracking hydration, eye strain, posture, and deep work intervals.

## Architectural Transitions

Building this application required several major pivots and architectural decisions to achieve the perfect balance of performance, privacy, and user experience.

### Phase 1: The Glassmorphism Web App
We started by building the core UI using pure, dependency-free HTML, CSS, and Vanilla JavaScript. We designed a stunning glassmorphism interface with smooth micro-animations to ensure the app felt premium. The frontend was modularized into specific health categories (Eye Health, Movement, Focus, Mental Health) managed by a central state store.

### Phase 2: WebGPU Local AI Integration
To make the app truly intelligent, we wanted an AI coach. However, sending personal health data to the cloud was a massive privacy concern. We pivoted to an entirely **on-device AI** using WebGPU. We integrated the `LFM-2.5-230M` model, which runs directly on the user's local graphics card. This guaranteed zero latency and 100% data privacy.

### Phase 3: The Prompt Engineering to Orchestrator Pivot
Integrating a microscopic 230M parameter model came with severe limitations. When we tried feeding the user's live stats directly into the prompt (RAG style), the tiny model broke down. It turned into a robotic data-parser, repeated itself, and sometimes stubbornly refused to answer due to baked-in safety biases ("I don't have access to your data").

**The Fix:** We completely threw out heavy context injection and built a **JavaScript Agentic Orchestrator**. We separated the responsibilities: JavaScript now deterministically generates the factual data prefix (e.g., *"I notice you've taken 0 eye breaks today."*), and the LLM is *only* asked to append a single sentence of conversational advice. This solved the robotic behavior, saved massive token usage, and made the AI feel incredibly natural.

### Phase 4: Native Desktop Packaging with Tauri v2
A background app isn't useful if it lives in a browser tab. We transitioned the web app into a native Windows executable using **Rust and Tauri v2**. 
- We configured the app to start completely silently (invisible) on system boot using `tauri-plugin-autostart`.
- We embedded it directly into the Windows System Tray so it wouldn't clutter the taskbar.
- We hit a snag with Tauri v2's global window API changes, which broke our notification pop-outs. We solved this by using native Rust `core.invoke` channels to force the application window to dynamically "pop out" on top of the screen when a break is triggered, and intelligently hide itself back in the tray when the user finishes.

---

## Current Feature Set

Today, the WellBeing Companion is a fully packaged `v0.1` desktop application featuring:

### ⚙️ Core Engine
- **System Tray Integration:** Runs silently in the background.
- **Boot Persistence:** Automatically launches invisibly when the computer starts.
- **Dynamic Pop-outs:** Intelligently forces itself to the front of the screen for important breaks, and auto-hides when dismissed.

### 🤖 Local AI Coach
- **100% Private:** Powered by a local WebGPU Liquid 2.5 230M model.
- **Agentic Orchestrator:** Seamlessly combines your live health data with conversational AI advice without robotic parsing.

### 👁️ Eye Health
- **20-20-20 Rule:** Enforces a 20-second break every 20 minutes to look 20 feet away.
- **Blink Reminders:** Gentle screen toasts to prevent dry eyes.
- **Eye Exercises:** Guided palming and figure-8 exercises.

### 🚶 Movement & Posture
- **Stand/Sit Tracking:** Monitors intervals to prevent muscle atrophy.
- **Stretching Routines:** Guided desk-friendly stretches.
- **Ergonomic Checks:** Posture resets.

### 💧 Lifestyle & Mental Health
- **Hydration Tracking:** Logs water intake with smart reminders.
- **Breathing Exercises:** Box breathing animations to reduce stress spikes.
- **Gratitude Journal:** A private space to log daily wins.

### 🧠 Deep Work
- **Focus Timer:** Pomodoro-style deep work tracking that pauses non-critical health reminders to protect your flow state.

---

## Problems Faced & Key Learnings

Building a desktop app with an embedded local AI presented several unique challenges:

1. **The "Robotic" Local AI Problem**
   - **Problem:** When we initially fed the user's raw health data to the small 230M parameter model in a single prompt (RAG approach), the AI struggled. It tried to parse the data rather than converse, resulting in repetitive, robotic responses, or outright refusing to answer due to its training biases.
   - **Learning:** Tiny models cannot handle complex data parsing and conversational nuance simultaneously. By building a JavaScript Agentic Orchestrator to handle the deterministic data logic, we freed the AI to do what it does best: generate natural, conversational text.

2. **Window Management in Tauri v2**
   - **Problem:** We wanted the app to run invisibly in the system tray but "pop out" automatically when it was time for an eye break. Tauri v2 completely overhauled its window management API, moving it out of the global `window` object for security reasons, which broke our initial pop-out logic.
   - **Learning:** Instead of relying on injected global variables that change between framework versions, we learned to communicate directly with the Rust backend using the robust `core.invoke` channel (`window.__TAURI__.core.invoke`). This guaranteed stable, native window management without exposing unnecessary APIs.

3. **Background Notification Annoyance**
   - **Problem:** Getting a pop-up window while you are deep in focus can be incredibly jarring.
   - **Learning:** We tied our notification logic directly to the Focus Timer. When a user is in "Focus Mode," non-critical health reminders are suppressed. Furthermore, when normal toasts do pop out from the tray, they intelligently auto-hide themselves if the user doesn't interact with them, completely preserving the user's flow state.

4. **The Reality of Bleeding-Edge Dev & AI Failures**
   - **Problem:** To be completely transparent, absolutely nothing in this build works as expected other than the basic timers. The UI/UX is fundamentally flawed, and the embedded WebGPU AI integration was a complete disaster. The pop-in and pop-out window logic broke constantly, even after reinstallation, highlighting the severe incapabilities and flaws of the AI assistant used to build it.
   - **Learning:** Sometimes, an architecture is just completely broken from the ground up. This build proved that relying on experimental tools and a flawed AI assistant results in a completely broken product where nothing functions correctly.

---

## v1.0 — The Ground-Up Rebuild

The honest reality check above described the first attempt: a beautiful-looking shell where
almost nothing actually worked. Rather than keep patching it, we **deleted the entire
implementation and rebuilt from scratch**, keeping only the two steering documents (this
journey and the expanded PRD), the app icons, and the vendored LFM2.5 WebGPU runtime pulled
from Hugging Face. The new architecture is written down as a hard contract in
[ARCHITECTURE.md](ARCHITECTURE.md), and every one of the earlier failures was addressed head-on:

- **The pop-out window that "broke constantly."** The old build shoved the *main* window to
  the foreground for every notification, fighting Tauri v2's window API and stealing focus
  mid-task. The rebuild uses a **dedicated, frameless, always-on-top popup window** that is
  configured `focus: false` and positioned above the tray from the Rust side using the
  monitor work-area. It shows a reminder **without ever taking focus** from what you're doing,
  and reports the chosen action back to the main window over a clean event channel. Reminders
  route through a single `notify.js` decision point — popup when the app is in the background,
  in-app banner when it's already focused.
- **The "robotic" local AI.** We kept the agentic-orchestrator insight but implemented it
  properly: `score.js` deterministically computes the factual sentence from your real data,
  a small intent classifier picks the topic, and the 230M model is asked for exactly one warm
  conversational sentence (≤96 tokens, streamed). When WebGPU or the model isn't available,
  a genuinely useful rule-based coach takes over — no dead ends, no phantom `window.marked`
  dependency like before.
- **Timers that die on sleep.** Everything time-based (the scheduler, focus timer, and break
  countdowns) now runs off **absolute epoch deadlines recomputed every tick**, so suspending
  the machine or hiding the window never desynchronises a countdown. A 90-second spacing guard
  and a mode matrix (Balanced / Focus / Recovery / Resilience) mean you get **one** relevant
  nudge at a time instead of a pile-up.
- **A real, whole-body scope.** The PRD's full vision is now actually built: eye health,
  movement, musculoskeletal, mental health & resilience, lifestyle/recovery, and deep work —
  each a self-contained module against a shared design system and store, tied together by a
  dashboard with a composite health score and per-pillar breakdown.

The frontend was verified end-to-end in a browser (every page renders with zero console
errors; water logging, guided breaks, the focus-timer lifecycle, check-ins, the AI coach,
reminders, and theme switching were all exercised), and the native shell builds cleanly.

The historically-fragile native paths were then verified **at runtime** with a built-in
`--selftest` harness (`app/js/selftest.js` + two small Rust commands) that drives the real
desktop app and logs each step. Confirmed on Windows 11 with WebView2:

- **On-device AI actually runs.** WebGPU is exposed in WebView2; the LFM2.5-230M model
  downloaded (~210 MB, ~19 s), warmed up, and generated a real reply
  (*"Take a moment to breathe, and remember that small steps make big changes."*).
- **The reminder popup works** — it appears **visible and always-on-top, positioned
  bottom-right of the monitor work area, and does NOT steal foreground focus** (verified via
  Win32 window inspection while a video call held the foreground). This is the exact
  behaviour the old build could never get right.
- **Autostart** enable/disable round-trips correctly, and **close-to-tray** hides the window
  while keeping the process alive in the tray.

**Learning:** when the foundation is wrong, the fastest path forward is an honest teardown
plus a written contract — not another patch on top of the crack.

### v1.1 — Full-app audit, fixes, and polish

A second exhaustive pass drove **every feature end-to-end in a live browser** (60+ scripted
assertions: every check-in, break kind, timer state, reminder path including a real
clock-shifted scheduler fire, settings persistence, export/import round-trip, XSS attempts
on every free-text field — all green, zero console errors). Six real defects were found and
fixed: completing a stretch sequence credited the wrong module's counter; a brand-new day
displayed a punishing score of 0 instead of a neutral 50; toggling *any* setting (even the
theme) silently reset every reminder countdown; disabling the module of the page you were
viewing stranded you on a hidden page; the eye countdown rendered nonsense like "574:13"
outside work hours; and a user's very first trend check-in drew an invisible chart.

v1.1 also added: **Do-Not-Disturb** (one click pauses all reminders for an hour, with a
live countdown in the sidebar), an activity **streak** chip, a weekly summary row on the
dashboard, an animated score ring, point markers on trend charts, auto-load option for the
AI model, a keyboard-shortcuts overlay (press `?`), and a visible mode label.

---
*Built with ❤️ using Vanilla JS, WebGPU, Rust, and Tauri v2.*
