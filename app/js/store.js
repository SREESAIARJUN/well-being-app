/* ============================================================
   STORE — localStorage Persistence Layer
   ============================================================ */

const Store = (() => {
  const PREFIX = 'wb_';

  /* ---------- Low-level helpers ---------- */
  function _key(name) { return PREFIX + name; }

  function get(name, fallback = null) {
    try {
      const raw = localStorage.getItem(_key(name));
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function set(name, value) {
    try {
      localStorage.setItem(_key(name), JSON.stringify(value));
    } catch (e) {
      console.warn('Store: unable to save', name, e);
    }
  }

  function remove(name) {
    localStorage.removeItem(_key(name));
  }

  function clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }

  function storageUsed() {
    let total = 0;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) {
        total += localStorage.getItem(key).length;
      }
    }
    return total;
  }

  /* ---------- Daily log helpers ---------- */
  function _dailyKey(module, date) {
    return `${module}_${date || Utils.today()}`;
  }

  function getDaily(module, date) {
    return get(_dailyKey(module, date), {});
  }

  function setDaily(module, data, date) {
    set(_dailyKey(module, date || Utils.today()), data);
  }

  function updateDaily(module, updates, date) {
    const existing = getDaily(module, date);
    setDaily(module, { ...existing, ...updates }, date);
  }

  /* ---------- Settings ---------- */
  const DEFAULT_SETTINGS = {
    // Profile
    workStart: '09:00',
    workEnd: '18:00',
    workDays: [1, 2, 3, 4, 5], // Mon-Fri

    // Mode
    currentMode: 'focus', // focus | recovery | resilience
    autoModeSwitch: true,

    // Eye health
    eyeBreakInterval: 20,      // minutes
    eyeBreakDuration: 20,      // seconds
    blinkReminder: true,

    // Movement
    movementInterval: 45,      // minutes
    movementDuration: 3,       // minutes
    standingGoal: 120,         // minutes per day (2 hours)

    // Focus
    focusDuration: 25,         // minutes
    shortBreak: 5,             // minutes
    longBreak: 15,             // minutes
    longBreakAfter: 4,         // sessions

    // Notifications
    soundEnabled: false,
    notificationStyle: 'overlay', // overlay | toast | both

    // Modules enabled
    modules: {
      eyeHealth: true,
      movement: true,
      musculoskeletal: true,
      mentalHealth: true,
      lifestyle: true,
      aiCoach: true,
      focus: true
    },

    // Mental health
    moodCheckInterval: 'daily', // daily | twice | manual
    
    // Lifestyle
    hydrationGoal: 8,  // glasses per day
    sleepReminder: '22:00',
    
    // Data
    dataRetentionDays: 90
  };

  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...get('settings', {}) };
  }

  function updateSettings(updates) {
    const current = getSettings();
    set('settings', { ...current, ...updates });
    AppEvents.emit('settings:changed', updates);
  }

  function getSetting(key) {
    return getSettings()[key];
  }

  /* ---------- Data models ---------- */

  /**
   * Eye health daily: { breaksTaken, breaksSkipped, desRating, lastBreak }
   */
  function getEyeData(date) {
    return getDaily('eye', date);
  }

  function updateEyeData(updates, date) {
    updateDaily('eye', updates, date);
    AppEvents.emit('data:eye', updates);
  }

  /**
   * Movement daily: { standingMinutes, movementBlocks, stepsLogged, segments[] }
   */
  function getMovementData(date) {
    return getDaily('movement', date);
  }

  function updateMovementData(updates, date) {
    updateDaily('movement', updates, date);
    AppEvents.emit('data:movement', updates);
  }

  /**
   * MSK daily: { discomfort: { neck, shoulders, upperBack, lowerBack, wrists }, exercisesDone, postureChecks }
   */
  function getMskData(date) {
    return getDaily('msk', date);
  }

  function updateMskData(updates, date) {
    updateDaily('msk', updates, date);
    AppEvents.emit('data:msk', updates);
  }

  /**
   * Mental health daily: { mood, stress, exercisesDone[], journalEntries[] }
   */
  function getMentalData(date) {
    return getDaily('mental', date);
  }

  function updateMentalData(updates, date) {
    updateDaily('mental', updates, date);
    AppEvents.emit('data:mental', updates);
  }

  /**
   * Lifestyle daily: { hydration, nutritionNudges, sleepScore, recoveryPlanned }
   */
  function getLifestyleData(date) {
    return getDaily('lifestyle', date);
  }

  function updateLifestyleData(updates, date) {
    updateDaily('lifestyle', updates, date);
    AppEvents.emit('data:lifestyle', updates);
  }

  /**
   * Focus daily: { sessions[], totalFocusMinutes, totalBreakMinutes }
   */
  function getFocusData(date) {
    return getDaily('focus', date);
  }

  function updateFocusData(updates, date) {
    updateDaily('focus', updates, date);
    AppEvents.emit('data:focus', updates);
  }

  /**
   * Chat history (global, not daily)
   */
  function getChatHistory() {
    return get('chat_history', []);
  }

  function addChatMessage(msg) {
    const history = getChatHistory();
    history.push({ ...msg, timestamp: Date.now() });
    // Keep last 100 messages
    if (history.length > 100) history.splice(0, history.length - 100);
    set('chat_history', history);
  }

  function clearChatHistory() {
    set('chat_history', []);
  }

  /**
   * Get composite health score (0-100) from today's data
   */
  function getHealthScore(date) {
    const eye = getEyeData(date);
    const mov = getMovementData(date);
    const msk = getMskData(date);
    const mental = getMentalData(date);
    const life = getLifestyleData(date);
    const focus = getFocusData(date);
    const settings = getSettings();

    let score = 50; // base score
    let factors = 0;

    // Eye: breaks adherence (+20 max)
    const totalBreaks = (eye.breaksTaken || 0) + (eye.breaksSkipped || 0);
    if (totalBreaks > 0) {
      score += ((eye.breaksTaken || 0) / totalBreaks) * 20;
      factors++;
    }

    // Movement: standing time vs goal (+20 max)
    if (mov.standingMinutes !== undefined) {
      const movScore = Math.min((mov.standingMinutes / settings.standingGoal) * 20, 20);
      score += movScore;
      factors++;
    }

    // MSK: low discomfort = good (+15 max)
    if (msk.discomfort) {
      const vals = Object.values(msk.discomfort);
      const avgDiscomfort = vals.reduce((a, b) => a + b, 0) / vals.length;
      score += Math.max(0, 15 - avgDiscomfort * 1.5);
      factors++;
    }

    // Mental: mood score (+15 max)
    if (mental.mood) {
      score += (mental.mood / 10) * 15;
      factors++;
    }

    // Lifestyle: hydration (+10 max)
    if (life.hydration !== undefined) {
      score += Math.min((life.hydration / settings.hydrationGoal) * 10, 10);
      factors++;
    }

    // Focus: sessions done (+10 max)
    if (focus.totalFocusMinutes) {
      score += Math.min(focus.totalFocusMinutes / 120 * 10, 10);
      factors++;
    }

    // Normalize if few factors present
    if (factors === 0) return 50;
    return Math.round(Utils.clamp(score, 0, 100));
  }

  /**
   * Get weekly data for a module
   */
  function getWeeklyData(module, days = 7) {
    return Utils.pastDays(days).map(date => ({
      date,
      data: getDaily(module, date)
    }));
  }

  /**
   * Export all data as JSON
   */
  function exportData() {
    const data = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) {
        data[key.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(key));
      }
    }
    return data;
  }

  return {
    get, set, remove, clear, storageUsed,
    getDaily, setDaily, updateDaily,
    getSettings, updateSettings, getSetting, DEFAULT_SETTINGS,
    getEyeData, updateEyeData,
    getMovementData, updateMovementData,
    getMskData, updateMskData,
    getMentalData, updateMentalData,
    getLifestyleData, updateLifestyleData,
    getFocusData, updateFocusData,
    getChatHistory, addChatMessage, clearChatHistory,
    getHealthScore, getWeeklyData, exportData
  };
})();
