/* ============================================================
   APP — Main Application Controller
   ============================================================ */

const App = (() => {
  const PAGES = {
    'dashboard':       { title: 'Dashboard',          subtitle: 'Your health at a glance',       module: () => DashboardModule },
    'eye-health':      { title: 'Eye Health',          subtitle: '20-20-20 rule & eye care',      module: () => EyeHealthModule },
    'movement':        { title: 'Sedentary & Movement', subtitle: 'Stand more, sit less',         module: () => MovementModule },
    'musculoskeletal': { title: 'Body & Posture',      subtitle: 'Musculoskeletal wellness',      module: () => MusculoskeletalModule },
    'mental-health':   { title: 'Mental Health',       subtitle: 'Resilience & stress relief',    module: () => MentalHealthModule },
    'lifestyle':       { title: 'Lifestyle & Recovery', subtitle: 'Nutrition, sleep, recovery',   module: () => LifestyleModule },
    'ai-coach':        { title: 'AI Health Coach',     subtitle: 'LFM-2.5-230M · On-device AI',   module: () => AICoachModule },
    'focus':           { title: 'Focus Timer',         subtitle: 'Deep work & productivity',      module: () => FocusModule },
    'settings':        { title: 'Settings',            subtitle: 'Customize your experience',     module: () => SettingsModule },
  };

  const MODES = {
    focus:      { label: 'Focus',      class: 'mode-focus',      color: 'var(--accent-cyan)' },
    recovery:   { label: 'Recovery',   class: 'mode-recovery',   color: 'var(--accent-green)' },
    resilience: { label: 'Resilience', class: 'mode-resilience', color: 'var(--accent-violet)' },
  };

  let _currentPage = 'dashboard';
  let _currentMode = 'focus';

  function init() {
    // Initialize all modules
    Object.values(PAGES).forEach(p => {
      try { p.module().init(); } catch (e) { console.warn('Module init error:', e); }
    });

    // Setup routing
    _setupRouting();

    // Setup mode switching
    _setupMode();

    // Start clock
    _startClock();

    // Navigate to initial page
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigate(hash);

    // Listen for settings changes that affect timers
    AppEvents.on('settings:changed', _onSettingsChanged);

    console.log('✨ WellBeing app initialized');
  }

  function _setupRouting() {
    // Sidebar navigation
    const navButtons = Utils.$qa('.sidebar__item[data-page]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        navigate(page);
      });
    });

    // Hash change
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1) || 'dashboard';
      if (hash !== _currentPage) navigate(hash);
    });
  }

  function navigate(pageName) {
    if (!PAGES[pageName]) pageName = 'dashboard';
    _currentPage = pageName;

    // Update URL hash
    window.location.hash = pageName;

    // Update sidebar
    Utils.$qa('.sidebar__item[data-page]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageName);
    });

    // Update topbar
    const pageInfo = PAGES[pageName];
    Utils.$('pageTitle').textContent = pageInfo.title;
    Utils.$('pageSubtitle').textContent = pageInfo.subtitle;

    // Show/hide pages
    Utils.$qa('.page').forEach(p => p.classList.add('page--hidden'));
    const pageEl = Utils.$(`page-${pageName}`);
    if (pageEl) {
      pageEl.classList.remove('page--hidden');
      // Trigger page animation
      pageEl.classList.remove('page-enter');
      void pageEl.offsetWidth; // force reflow
      pageEl.classList.add('page-enter');
    }

    // Notify module
    try { pageInfo.module().onShow(); } catch (e) { /* ignore */ }

    // Scroll to top
    Utils.$('contentArea').scrollTop = 0;
  }

  function _setupMode() {
    const settings = Store.getSettings();
    _currentMode = settings.currentMode || 'focus';
    _updateModeUI();

    Utils.$('modeButton').addEventListener('click', () => {
      const modes = Object.keys(MODES);
      const idx = modes.indexOf(_currentMode);
      _currentMode = modes[(idx + 1) % modes.length];
      Store.updateSettings({ currentMode: _currentMode });
      _updateModeUI();
      Notifications.toast('Mode Changed', `Switched to ${MODES[_currentMode].label} mode`, 'info', 2000);
    });
  }

  function _updateModeUI() {
    const btn = Utils.$('modeButton');
    const mode = MODES[_currentMode];
    // Remove all mode classes
    Object.values(MODES).forEach(m => btn.classList.remove(m.class));
    // Add current
    btn.classList.add(mode.class);
    Utils.$('modeName').textContent = mode.label;
  }

  function _startClock() {
    const update = () => {
      Utils.$('currentTime').textContent = Utils.currentTime();
    };
    update();
    setInterval(update, 10000); // Update every 10 seconds
  }

  function _onSettingsChanged(updates) {
    // Restart timers if intervals changed
    if (updates.eyeBreakInterval !== undefined) {
      TimerEngine.stop('eyeBreak');
      EyeHealthModule.init(); // Will recreate timer
    }
    if (updates.movementInterval !== undefined) {
      TimerEngine.stop('movement');
      MovementModule.init();
    }
  }

  function getCurrentPage() {
    return _currentPage;
  }

  function getCurrentMode() {
    return _currentMode;
  }

  return { init, navigate, getCurrentPage, getCurrentMode };
})();

// ==================== BOOT ==================== 
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
