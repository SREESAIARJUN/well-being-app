/* ============================================================
   UTILS — Shared Utility Functions
   ============================================================ */

const Utils = (() => {
  /**
   * Get element by ID with null safety
   */
  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Query selector shorthand
   */
  function $q(selector, parent = document) {
    return parent.querySelector(selector);
  }

  /**
   * Query selector all
   */
  function $qa(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
  }

  /**
   * Create an HTML element with attributes and children
   */
  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') el.className = val;
      else if (key === 'innerHTML') el.innerHTML = val;
      else if (key === 'textContent') el.textContent = val;
      else if (key === 'style' && typeof val === 'object') {
        Object.assign(el.style, val);
      } else if (key.startsWith('on') && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key === 'dataset' && typeof val === 'object') {
        for (const [dk, dv] of Object.entries(val)) el.dataset[dk] = dv;
      } else {
        el.setAttribute(key, val);
      }
    }
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    }
    return el;
  }

  /**
   * Format seconds as MM:SS
   */
  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Format seconds as HH:MM:SS
   */
  function formatTimeLong(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Get today's date as YYYY-MM-DD
   */
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current time as HH:MM
   */
  function currentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Get the current hour (0-23)
   */
  function currentHour() {
    return new Date().getHours();
  }

  /**
   * Clamp value between min and max
   */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Lerp between two values
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Generate a simple unique ID
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Debounce function
   */
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Get days between two dates
   */
  function daysBetween(d1, d2) {
    const ms = Math.abs(new Date(d2) - new Date(d1));
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  /**
   * Get past N days as array of YYYY-MM-DD
   */
  function pastDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  }

  /**
   * Get day name abbreviation
   */
  function dayName(dateStr) {
    return new Date(dateStr).toLocaleDateString('en', { weekday: 'short' });
  }

  /**
   * Ease out cubic
   */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Animate a value from start to end over duration
   */
  function animateValue(start, end, duration, callback, easeFn = easeOutCubic) {
    const startTime = performance.now();
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeFn(progress);
      const value = start + (end - start) * eased;
      callback(value, progress);
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }

  /**
   * Simple event emitter
   */
  class EventBus {
    constructor() {
      this._handlers = {};
    }
    on(event, handler) {
      if (!this._handlers[event]) this._handlers[event] = [];
      this._handlers[event].push(handler);
    }
    off(event, handler) {
      if (!this._handlers[event]) return;
      this._handlers[event] = this._handlers[event].filter(h => h !== handler);
    }
    emit(event, data) {
      if (!this._handlers[event]) return;
      this._handlers[event].forEach(h => h(data));
    }
  }

  /**
   * HSL color to string
   */
  function hsl(h, s, l, a = 1) {
    if (a < 1) return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  /**
   * Get greeting based on time of day
   */
  function greeting() {
    const h = currentHour();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Plural helper
   */
  function plural(n, singular, pluralForm) {
    return n === 1 ? singular : (pluralForm || singular + 's');
  }

  /**
   * Random item from array
   */
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Calculate a percentage safely
   */
  function pct(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  return {
    $, $q, $qa, createElement, formatTime, formatTimeLong,
    today, currentTime, currentHour, clamp, lerp, uid, debounce,
    daysBetween, pastDays, dayName, easeOutCubic, animateValue,
    EventBus, hsl, greeting, plural, randomFrom, pct
  };
})();

// Global event bus
const AppEvents = new Utils.EventBus();
