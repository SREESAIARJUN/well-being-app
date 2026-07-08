/* ============================================================
   UTILS — helpers, formatting, icons, tiny markdown
   ============================================================ */

export const Utils = {
  $(sel, root = document) { return root.querySelector(sel); },
  $$(sel, root = document) { return [...root.querySelectorAll(sel)]; },

  el(tag, attrs = {}, html = '') {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('data-')) node.setAttribute(k, v);
      else node[k] = v;
    }
    if (html) node.innerHTML = html;
    return node;
  },

  esc(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  },

  clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },
  round1(v) { return Math.round(v * 10) / 10; },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  debounce(fn, ms = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  /* ---------- time & dates ---------- */
  dateKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
  isoWeekKey(d = new Date()) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); // nearest Thursday
    const week1 = new Date(t.getFullYear(), 0, 4);
    const wk = 1 + Math.round(((t - week1) / 864e5 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${t.getFullYear()}-W${String(wk).padStart(2, '0')}`;
  },
  pastDateKeys(n) { // n keys ending yesterday, oldest first
    const out = [];
    for (let i = n; i >= 1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push(Utils.dateKey(d));
    }
    return out;
  },
  weekdayShort(dateKey) {
    return new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
  },
  parseHM(hm) { // '09:30' -> minutes since midnight, NaN-safe
    const [h, m] = String(hm || '').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  },
  nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },

  fmtClock(ms) { // 90000 -> "1:30"
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
  fmtDuration(min) { // 135 -> "2h 15m"
    min = Math.max(0, Math.round(min));
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  },
  fmtTime(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  },
  fmtRelative(ms) { // ms from now -> "in 12 min" / "now"
    const min = Math.round(ms / 60000);
    if (min <= 0) return 'now';
    if (min < 60) return `in ${min} min`;
    return `in ${Utils.fmtDuration(min)}`;
  },
  greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  },

  /* ---------- tiny safe markdown (bold, italics, code, lists, paragraphs) ---------- */
  md(text) {
    const esc = Utils.esc(text);
    const lines = esc.split('\n');
    let out = '', inList = false;
    const inline = s => s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    for (const raw of lines) {
      const line = raw.trimEnd();
      const li = line.match(/^\s*[-*•]\s+(.*)/) || line.match(/^\s*\d+[.)]\s+(.*)/);
      if (li) {
        if (!inList) { out += '<ul>'; inList = true; }
        out += `<li>${inline(li[1])}</li>`;
      } else {
        if (inList) { out += '</ul>'; inList = false; }
        if (line.trim()) out += `<p>${inline(line)}</p>`;
      }
    }
    if (inList) out += '</ul>';
    return out || '<p></p>';
  },

  /* ---------- icons (24x24 stroke set; stroke=currentColor) ---------- */
  icon(name, size = 16) {
    const paths = ICON_PATHS[name] || ICON_PATHS.sparkle;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  },
};

const ICON_PATHS = {
  logo: '<path d="M12 21C7 17 3 13.5 3 9.5A4.5 4.5 0 0 1 7.5 5c1.8 0 3.4 1 4.5 2.5C13.1 6 14.7 5 16.5 5A4.5 4.5 0 0 1 21 9.5c0 4-4 7.5-9 11.5z"/><path d="M7 12h3l1.5-3 2 5 1.5-2h3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M12.5 8.5 10 12l1.5 3.5L10 21"/><path d="M12.5 8.5c1.5.5 2 1.5 2.5 3l2.5 1"/><path d="M12.5 8.5 9 9.5 7.5 12.5"/><path d="M11.5 15.5 14 17.5l1 4"/>',
  spine: '<path d="M12 2v20"/><path d="M9 5h6M8.5 9h7M8.5 13h7M9 17h6"/><circle cx="12" cy="5" r="0.5"/><circle cx="12" cy="9" r="0.5"/><circle cx="12" cy="13" r="0.5"/><circle cx="12" cy="17" r="0.5"/>',
  brain: '<path d="M9.5 3A3.5 3.5 0 0 0 6 6.5c-1.8.5-3 2-3 4a4 4 0 0 0 2 3.5c-.3 2.5 1.3 4.5 3.5 5 .6 1.2 1.7 2 3.5 2V3.7A3.5 3.5 0 0 0 9.5 3z"/><path d="M14.5 3A3.5 3.5 0 0 1 18 6.5c1.8.5 3 2 3 4a4 4 0 0 1-2 3.5c.3 2.5-1.3 4.5-3.5 5-.6 1.2-1.7 2-3.5 2V3.7A3.5 3.5 0 0 1 14.5 3z"/>',
  leaf: '<path d="M4 20c0-9 5-15 16-16-1 11-7 16-16 16z"/><path d="M4 20c3-6 7-10 12-12"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3h.1a1.6 1.6 0 0 0 .9-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7v.1a1.6 1.6 0 0 0 1.5.9h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z"/>',
  drop: '<path d="M12 2.5S5.5 9.5 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.5 12 2.5 12 2.5z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>',
  wind: '<path d="M3 8h9a3 3 0 1 0-3-3"/><path d="M3 12h14a3 3 0 1 1-3 3"/><path d="M3 16h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'chevron-l': '<path d="M15 18l-6-6 6-6"/>',
  'chevron-r': '<path d="M9 18l6-6-6-6"/>',
  flame: '<path d="M12 2c1 4-4 5.5-4 10a4 4 0 0 0 8 0c0-1.5-.5-2.5-1-3.5-1.5 1-2 2-2 3.5"/><path d="M12 2c4 3 7 7 7 11a7 7 0 0 1-14 0c0-2 .8-4 2-5.5"/>',
  heart: '<path d="M12 21C7 17 3 13.5 3 9.5A4.5 4.5 0 0 1 7.5 5c1.8 0 3.4 1 4.5 2.5C13.1 6 14.7 5 16.5 5A4.5 4.5 0 0 1 21 9.5c0 4-4 7.5-9 11.5z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v-4M12 17V8M17 15v-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  coffee: '<path d="M17 8h1.5a3.5 3.5 0 0 1 0 7H17"/><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M8 2v2.5M12 2v2.5"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  keyboard: '<rect x="2" y="7" width="20" height="12" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 15h10"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  snooze: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6"/><path d="M9.5 10.5h5l-5 5h5"/>',
  skip: '<path d="M5 4.5v15l10-7.5z"/><path d="M19 5v14"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  send: '<path d="m22 2-11 11"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  export: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  import: '<path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  zap: '<path d="M13 2 3 14h8l-1 8 11-13h-9z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  hand: '<path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11"/><path d="M15 10.5V4.8a1.5 1.5 0 0 0-3 0V10"/><path d="M12 10.2V6a1.5 1.5 0 0 0-3 0v6"/><path d="M9 12V8.5a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 7 7 7 7 0 0 0 7-7v-4a1.5 1.5 0 0 0-3 0"/>',
};
