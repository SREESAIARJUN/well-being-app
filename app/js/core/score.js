/* ============================================================
   SCORE — composite health score + pillar breakdown + insights
   Deterministic (also feeds the AI coach orchestrator).
   ============================================================ */

import { Utils } from './utils.js';
import { Store } from './store.js';

/* Expected eye breaks so far today, based on elapsed work time */
function expectedEyeBreaks(settings) {
  const start = Utils.parseHM(settings.workStart);
  const end = Utils.parseHM(settings.workEnd);
  const now = Utils.nowMinutes();
  const workedMin = Utils.clamp(now - start, 0, Math.max(0, end - start));
  return Math.floor(workedMin / Math.max(5, settings.eyeBreakEvery));
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

function latestCheckin(list) { return list.length ? list[list.length - 1] : null; }

export const Score = {
  /**
   * Pillar scores 0..100 (null = no signal yet today) + composite.
   * Pillars: eye, movement, msk, mental, lifestyle, focus
   */
  pillars(dateKey) {
    const s = Store.settings();
    const d = dateKey ? Store.day(dateKey) : Store.today();
    if (!d) return null;
    const isToday = !dateKey || dateKey === Utils.dateKey();

    const out = {};

    // Eye: adherence to expected breaks (or taken/(taken+skipped) for past days)
    const expected = isToday ? expectedEyeBreaks(s) : Math.max(1, d.eye.breaksTaken + d.eye.breaksSkipped);
    if (expected <= 0) out.eye = null;
    else out.eye = Math.round(Utils.clamp(d.eye.breaksTaken / expected, 0, 1) * 100);

    // Movement: standing minutes vs goal, blocks adherence blended in
    const standPart = Utils.clamp(d.movement.standingMin / Math.max(30, s.standGoalMin), 0, 1);
    const blocksTotal = d.movement.blocksDone + d.movement.blocksSkipped;
    const blockPart = blocksTotal > 0 ? d.movement.blocksDone / blocksTotal : null;
    out.movement = d.movement.standingMin === 0 && blocksTotal === 0
      ? null
      : Math.round((blockPart === null ? standPart : standPart * 0.7 + blockPart * 0.3) * 100);

    // MSK: inverse of latest discomfort average, plus small credit for exercises
    const mskCheck = latestCheckin(d.msk.checkins);
    if (!mskCheck && !d.msk.exercisesDone) out.msk = null;
    else {
      const discomfort = mskCheck ? avg(Object.values(mskCheck.areas)) : 3;
      const base = Utils.clamp(1 - discomfort / 10, 0, 1) * 85;
      out.msk = Math.round(Utils.clamp(base + Math.min(d.msk.exercisesDone, 3) * 5, 0, 100));
    }

    // Mental: mood high + stress low from latest check-in, credit for interventions
    const mCheck = latestCheckin(d.mental.checkins);
    if (!mCheck && !d.mental.interventionsDone) out.mental = null;
    else {
      const mood = mCheck ? mCheck.mood / 10 : 0.6;
      const calm = mCheck ? 1 - mCheck.stress / 10 : 0.6;
      out.mental = Math.round(Utils.clamp((mood * 0.55 + calm * 0.45) * 90 + Math.min(d.mental.interventionsDone, 2) * 5, 0, 100));
    }

    // Lifestyle: hydration pace (vs prorated goal through the day)
    if (d.lifestyle.water === 0) out.lifestyle = null;
    else {
      const dayFraction = isToday ? Utils.clamp((Utils.nowMinutes() - Utils.parseHM(s.workStart)) /
        Math.max(60, Utils.parseHM(s.workEnd) - Utils.parseHM(s.workStart)), 0.15, 1) : 1;
      const target = Math.max(1, s.waterGoal * dayFraction);
      out.lifestyle = Math.round(Utils.clamp(d.lifestyle.water / target, 0, 1) * 100);
    }

    // Focus: minutes vs a 2h reference
    out.focus = d.focus.minutes === 0 ? null : Math.round(Utils.clamp(d.focus.minutes / 120, 0, 1) * 100);

    return out;
  },

  /** Composite 0..100 across available pillars (50 when nothing logged yet). */
  composite(dateKey) {
    const p = Score.pillars(dateKey);
    if (!p) return null;
    const weights = { eye: 0.22, movement: 0.22, msk: 0.14, mental: 0.16, lifestyle: 0.13, focus: 0.13 };
    let sum = 0, wsum = 0;
    for (const [k, w] of Object.entries(weights)) {
      if (p[k] !== null) { sum += p[k] * w; wsum += w; }
    }
    if (wsum === 0) return 50;
    return Math.round(sum / wsum);
  },

  /**
   * Deterministic insight sentences about today (dashboard cards + AI coach
   * fact prefixes). Ordered most-important first. [{kind, icon, text, tone}]
   */
  insights() {
    const s = Store.settings();
    const d = Store.today();
    const out = [];
    const expected = expectedEyeBreaks(s);

    if (expected >= 2 && d.eye.breaksTaken === 0) {
      out.push({ kind: 'eye', icon: 'eye', tone: 'warn',
        text: `No eye breaks yet today — about ${expected} were due. Your eyes need the 20-20-20 rule.` });
    } else if (expected > 0 && d.eye.breaksTaken >= expected) {
      out.push({ kind: 'eye', icon: 'eye', tone: 'ok',
        text: `Eye break streak: ${d.eye.breaksTaken} taken — right on schedule.` });
    }

    const standPct = Math.round((d.movement.standingMin / Math.max(30, s.standGoalMin)) * 100);
    if (d.movement.standingMin >= s.standGoalMin) {
      out.push({ kind: 'move', icon: 'walk', tone: 'ok',
        text: `Standing goal reached: ${Utils.fmtDuration(d.movement.standingMin)} today. Consider stretching it toward 4h.` });
    } else if (Utils.nowMinutes() > Utils.parseHM(s.workStart) + 180 && standPct < 30) {
      out.push({ kind: 'move', icon: 'walk', tone: 'warn',
        text: `Only ${Utils.fmtDuration(d.movement.standingMin)} of standing so far (goal ${Utils.fmtDuration(s.standGoalMin)}). Try standing for your next call.` });
    }

    const mCheck = latestCheckin(d.mental.checkins);
    if (mCheck && mCheck.stress >= 7) {
      out.push({ kind: 'mental', icon: 'brain', tone: 'warn',
        text: `Stress was ${mCheck.stress}/10 at ${Utils.fmtTime(mCheck.ts)}. A 3-minute breathing break can reset that.` });
    }

    const mskCheck = latestCheckin(d.msk.checkins);
    if (mskCheck) {
      const worst = Object.entries(mskCheck.areas).sort((a, b) => b[1] - a[1])[0];
      if (worst && worst[1] >= 5) {
        const label = { neck: 'neck', shoulders: 'shoulders', upperBack: 'upper back', lowerBack: 'lower back', wrists: 'wrists' }[worst[0]] || worst[0];
        out.push({ kind: 'msk', icon: 'spine', tone: 'warn',
          text: `Your ${label} discomfort is ${worst[1]}/10 — targeted micro-stretches are queued in Posture & Body.` });
      }
    }

    if (d.lifestyle.water < Math.ceil(s.waterGoal / 2) && Utils.nowMinutes() > 13 * 60) {
      out.push({ kind: 'hydrate', icon: 'drop', tone: 'warn',
        text: `${d.lifestyle.water} of ${s.waterGoal} glasses so far — hydration is behind for the afternoon.` });
    } else if (d.lifestyle.water >= s.waterGoal) {
      out.push({ kind: 'hydrate', icon: 'drop', tone: 'ok', text: `Hydration goal hit: ${d.lifestyle.water}/${s.waterGoal} glasses.` });
    }

    if (d.focus.minutes >= 90) {
      out.push({ kind: 'focus', icon: 'timer', tone: 'ok',
        text: `${Utils.fmtDuration(d.focus.minutes)} of deep work logged — strong focus day.` });
    }

    if (out.length === 0) {
      out.push({ kind: 'general', icon: 'sparkle', tone: 'info',
        text: 'A fresh day. Log a mood check-in or take your first eye break to start building your score.' });
    }
    return out;
  },

  /** One-line deterministic status used by the AI coach as a fact prefix. */
  factFor(topic) {
    const s = Store.settings();
    const d = Store.today();
    switch (topic) {
      case 'eye': return `You've taken ${d.eye.breaksTaken} eye break${d.eye.breaksTaken === 1 ? '' : 's'} today (about ${expectedEyeBreaks(s)} were due).`;
      case 'movement': return `You've logged ${Utils.fmtDuration(d.movement.standingMin)} of standing today against a ${Utils.fmtDuration(s.standGoalMin)} goal.`;
      case 'msk': {
        const c = latestCheckin(d.msk.checkins);
        if (!c) return `You haven't logged a body discomfort check-in today.`;
        const worst = Object.entries(c.areas).sort((a, b) => b[1] - a[1])[0];
        const label = { neck: 'neck', shoulders: 'shoulders', upperBack: 'upper back', lowerBack: 'lower back', wrists: 'wrists' }[worst[0]] || worst[0];
        return `Your highest discomfort today is ${label} at ${worst[1]}/10.`;
      }
      case 'mental': {
        const c = latestCheckin(d.mental.checkins);
        return c ? `Your last check-in: mood ${c.mood}/10, stress ${c.stress}/10.`
                 : `You haven't done a mood check-in today.`;
      }
      case 'hydrate': return `You've had ${d.lifestyle.water} of ${s.waterGoal} glasses of water today.`;
      case 'focus': return `You've completed ${Utils.fmtDuration(d.focus.minutes)} of deep work today.`;
      default: return `Your health score right now is ${Score.composite()}/100.`;
    }
  },
};
