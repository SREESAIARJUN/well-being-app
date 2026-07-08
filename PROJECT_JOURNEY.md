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
*Built with ❤️ using Vanilla JS, WebGPU, Rust, and Tauri.*
