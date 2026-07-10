/* ============================================================
   SELF-TEST — runs only when the app is launched with --selftest.
   Exercises the historically-fragile native paths (popup window,
   autostart) and the real on-device AI, logging every step to a
   file (via the selftest_log command) so an external harness can
   read the results from a running native app.
   ============================================================ */

import { Tauri } from './core/tauri.js';

const MODEL_ID = 'LiquidAI/LFM2.5-230M-GGUF';

async function log(line) {
  console.log('[selftest]', line);
  try { await Tauri.invoke('selftest_log', { line: `[${new Date().toISOString()}] ${line}` }); }
  catch (e) { console.warn('selftest_log failed', e); }
}

export async function runSelfTest() {
  await log('===== SELFTEST START =====');
  await log('userAgent: ' + navigator.userAgent);
  await log('webgpu: ' + (('gpu' in navigator && navigator.gpu) ? 'present' : 'ABSENT'));

  // ---- 1. autostart round-trip ----
  try {
    const orig = await Tauri.getAutostart();
    await log('autostart initial=' + orig);
    const setOn = await Tauri.setAutostart(true);
    const getOn = await Tauri.getAutostart();
    await log(`autostart enable: set=${setOn} get=${getOn} ${getOn === true ? 'PASS' : 'FAIL'}`);
    const setOff = await Tauri.setAutostart(false);
    const getOff = await Tauri.getAutostart();
    await log(`autostart disable: set=${setOff} get=${getOff} ${getOff === false ? 'PASS' : 'FAIL'}`);
    await Tauri.setAutostart(orig); // restore
    await log('autostart restored=' + orig);
  } catch (e) {
    await log('autostart ERROR: ' + (e?.message ?? e));
  }

  // ---- 2. reminder popup (the piece that was chronically broken) ----
  try {
    await Tauri.showPopup({
      kind: 'eye',
      title: 'Self-test reminder',
      body: 'If this sits above the tray without stealing focus, the popup works.',
      icon: 'eye',
      timeoutMs: 120000, // stay up long enough to observe with the window harness
      actions: [{ id: 'open', label: 'Start', primary: true }, { id: 'skip', label: 'Skip' }],
    });
    await log('popup: show_popup invoked PASS');
  } catch (e) {
    await log('popup ERROR: ' + (e?.message ?? e));
  }

  // ---- 3. on-device AI (real WebGPU load + generate) ----
  if ('gpu' in navigator && navigator.gpu) {
    try {
      await log('ai: importing runtime…');
      const { Lfm2Mobile } = await import('./lib/lfm2_5.js');
      await log('ai: checkAvailability…');
      let avail = null;
      try { avail = await Lfm2Mobile.checkAvailability(MODEL_ID); } catch (e) { await log('ai: availability probe threw ' + (e?.message ?? e)); }
      await log('ai: availability=' + JSON.stringify(avail));
      if (avail && avail.ok === false) {
        await log('ai: SKIP — device reports unavailable: ' + (avail.reason || ''));
      } else {
        await log('ai: loading model (one-time ~210MB download)…');
        const t0 = Date.now();
        let lastLogged = -1;
        const model = await Lfm2Mobile.load(MODEL_ID, {
          onProgress: ev => { if (ev.status === 'weights' && Number.isFinite(ev.fraction)) {
            const pct = Math.round(ev.fraction * 100);
            if (pct >= lastLogged + 25) { lastLogged = pct - (pct % 25); log('ai: download ' + pct + '%'); }
          }},
        });
        await log(`ai: model loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s, warming up…`);
        await model.warmup();
        await log('ai: generating a test reply…');
        let text = '';
        for await (const chunk of model.generate(
          [{ role: 'user', content: 'Give a tired desk worker one short, kind sentence of encouragement.' }],
          { maxNewTokens: 48 })) {
          text = chunk.text;
        }
        await log('ai: GENERATED=' + JSON.stringify(text.trim().slice(0, 240)));
        await log('ai: ' + (text.trim().length > 0 ? 'PASS' : 'FAIL — empty output'));
        model.dispose();
      }
    } catch (e) {
      await log('ai ERROR: ' + (e?.stack ?? e?.message ?? e));
    }
  } else {
    await log('ai: SKIP — WebGPU not exposed in this WebView');
  }

  await log('===== SELFTEST DONE =====');
}
