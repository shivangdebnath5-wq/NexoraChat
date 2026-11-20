/* =========================================================================
   advent-calendar.js — Nexora Winter Wonderland Advent Calendar (UI + animation only)
   -------------------------------------------------------------------------
   Everything about the Advent Calendar lives in this one file:
     1. Day logic ... which door is "today" / locked / already opened (pure date math +
                      a tiny bit of localStorage UI memory — see the restriction below)
     2. Build ....... overlay (reuses the shared .modal shell), opening-animation doors,
                       village strip and the 25-door grid — built once, on first open
     3. Interactions . entry handle, opening animation, door click → swing + sparkle,
                        close (button / Escape / backdrop), console preview helper
   Styles live in style.css under "WINTER WONDERLAND ADVENT CALENDAR 2026". The falling
   snow reuses the existing .fm-flake markup/keyframes (style.css, Frosted Midnight section)
   so it matches the look of the rest of the app's snow exactly.

   IMPORTANT — this is UI/animation only, by design:
   Opening a door only plays an animation and remembers (locally, for this browser) that the
   door was clicked — it does NOT grant, unlock, or store any reward, point, currency or
   inventory data, and there is no placeholder reward content anywhere in this file.
   onDoorOpened(day) below is the single, clearly-marked hook a future update should build
   reward logic on top of; everything else here only has to keep that function's contract
   (it's told which day was opened) and must not be touched for the calendar to keep working.
   ========================================================================= */
(function () {
  'use strict';
  if (window.NexoraAdventCalendar) return;

  const TOTAL_DAYS = 25;
  // UI memory only (which doors you've already clicked open, so re-opening the calendar
  // doesn't replay the swing animation) — not reward/points/currency/inventory state.
  const OPENED_KEY = 'nexora_advent_2026_opened_days';
  // Optional console override for previewing any day as "today", mirroring the existing
  // window.forceChristmasMode(...) convention in script.js.
  const PREVIEW_KEY = 'nexora_advent_2026_preview_day';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------------------------------------------------------------------
     1. DAY LOGIC
     --------------------------------------------------------------------- */
  // Returns 1-31 for "today" while previewing, otherwise the real December day-of-month,
  // or 0 if it isn't December yet (every door stays locked before December 1).
  function todayDay() {
    try {
      const raw = localStorage.getItem(PREVIEW_KEY);
      if (raw != null) { const n = parseInt(raw, 10); if (n >= 1 && n <= 31) return n; }
    } catch (e) {}
    const d = new Date();
    return d.getMonth() === 11 ? d.getDate() : 0;
  }
  function getOpened() {
    try { return new Set(JSON.parse(localStorage.getItem(OPENED_KEY) || '[]')); } catch (e) { return new Set(); }
  }
  function saveOpened(set) {
    try { localStorage.setItem(OPENED_KEY, JSON.stringify([...set])); } catch (e) {}
  }
  // ---- Future reward integration goes here. ----
  // Called once, right after a door's opening animation finishes, with the day number
  // (1-25) that was just opened. It currently does nothing on purpose (see file header).
  function onDoorOpened(day) {
    // no reward / points / currency / inventory logic yet — intentionally empty
  }

  /* ---------------------------------------------------------------------
     2. BUILD (lazy — first call to open())
     --------------------------------------------------------------------- */
  let root = null, introEl = null, gridEl = null, opened = null, lastFocus = null;

  function snowHtml(count) {
    let h = '';
    for (let i = 0; i < count; i++) {
      const d = rnd(7, 15);
      h += `<span class="fm-flake" style="--x:${rnd(1, 99).toFixed(1)}%;--s:${rnd(2, 5).toFixed(1)}px;--d:${d.toFixed(1)}s;--dl:-${rnd(0, d).toFixed(1)}s;--dx:${rnd(-50, 50).toFixed(0)}px;--o:${rnd(.4, .85).toFixed(2)};--sw:${rnd(3, 6).toFixed(1)}s"><i></i></span>`;
    }
    return h;
  }
  const DECOR = ['', '', '', '❄️', '', '🎀', '', '', '✨', ''];   // sparse — a touch of variety, not clutter
  function doorHtml(day) {
    return `<button type="button" class="ac-door" data-day="${day}" aria-label="December ${day}">
      <span class="ac-today-tag hidden" aria-hidden="true">Today</span>
      ${DECOR[day % DECOR.length] ? `<span class="ac-door-deco" aria-hidden="true">${DECOR[day % DECOR.length]}</span>` : ''}
      <span class="ac-door-num">${day}</span>
      <span class="ac-door-knob" aria-hidden="true"></span>
      <span class="ac-door-frost hidden" aria-hidden="true"></span>
    </button>`;
  }
  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'advent-overlay';
    root.className = 'modal ac-modal hidden';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Winter Wonderland Advent Calendar');

    let doors = '';
    for (let d = 1; d <= TOTAL_DAYS; d++) doors += doorHtml(d);
    let village = '';
    for (let i = 0; i < 11; i++) village += '<span class="ac-house" aria-hidden="true"></span>';

    root.innerHTML = `
      <div class="ac-workspace" role="document">
        <button type="button" class="ac-close-btn" aria-label="Close Advent Calendar" data-ac="close">&times;</button>
        <div class="ac-snow" aria-hidden="true">${snowHtml(36)}</div>
        <div class="ac-intro" aria-hidden="true">
          <div class="ac-intro-leaf left">
            <svg class="ac-intro-emblem" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" stroke="#D9B66F" stroke-width="2.5" opacity=".8"/><path d="M32 10v10M32 44v10M10 32h10M44 32h10" stroke="#D9B66F" stroke-width="2.5" opacity=".8"/></svg>
          </div>
          <div class="ac-intro-leaf right">
            <svg class="ac-intro-emblem" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" stroke="#D9B66F" stroke-width="2.5" opacity=".8"/><path d="M32 10v10M32 44v10M10 32h10M44 32h10" stroke="#D9B66F" stroke-width="2.5" opacity=".8"/></svg>
          </div>
        </div>
        <div class="ac-intro-burst" aria-hidden="true"></div>
        <div class="ac-scene">
          <div class="ac-header">
            <h2 class="ac-title">Winter Wonderland Advent Calendar</h2>
            <p class="ac-subtitle">December 2026 · open a door each day</p>
          </div>
          <div class="ac-village-strip" aria-hidden="true">${village}</div>
          <div class="ac-grid" id="advent-grid">${doors}</div>
        </div>
      </div>`;
    document.body.appendChild(root);
    introEl = root.querySelector('.ac-intro');
    gridEl = root.querySelector('#advent-grid');

    root.addEventListener('click', (e) => {
      if (e.target === root || e.target.closest('[data-ac="close"]')) return close();
      const door = e.target.closest('.ac-door');
      if (door) handleDoorClick(door);
    });
    gridEl.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ac-door')) { e.preventDefault(); handleDoorClick(e.target); }
    });
  }

  function refreshDoors() {
    if (!gridEl) return;
    const day = todayDay();
    opened = getOpened();
    gridEl.querySelectorAll('.ac-door').forEach((btn) => {
      const d = parseInt(btn.dataset.day, 10);
      const locked = day === 0 || d > day;
      const isToday = day > 0 && d === day;
      const isOpened = opened.has(d) && !locked;
      btn.classList.toggle('is-locked', locked);
      btn.classList.toggle('is-today', isToday);
      btn.classList.toggle('is-opened', isOpened);
      btn.disabled = locked;
      btn.setAttribute('aria-disabled', String(locked));
      btn.querySelector('.ac-today-tag')?.classList.toggle('hidden', !isToday);
      btn.querySelector('.ac-door-frost')?.classList.toggle('hidden', !locked);
      btn.setAttribute('aria-label', `December ${d}${locked ? ' — locked until this day' : isOpened ? ' — opened' : ''}`);
    });
  }

  function sparkleBurst(door) {
    if (reduceMq.matches) return;
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span');
      s.className = 'ac-sparkle';
      const angle = rnd(0, Math.PI * 2), dist = rnd(16, 34);
      s.style.setProperty('--sx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
      s.style.setProperty('--sy', `${(Math.sin(angle) * dist).toFixed(1)}px`);
      s.style.animationDelay = `${rnd(0, .12).toFixed(2)}s`;
      door.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  function handleDoorClick(door) {
    if (door.classList.contains('is-locked') || door.disabled) return;
    const day = parseInt(door.dataset.day, 10);
    if (!opened.has(day)) {
      opened.add(day); saveOpened(opened);
      door.classList.add('is-opening');
      sparkleBurst(door);
      setTimeout(() => { door.classList.remove('is-opening'); door.classList.add('is-opened'); }, 560);
      onDoorOpened(day);
    }
  }

  /* ---------------------------------------------------------------------
     3. OPEN / CLOSE + entry handle + console preview helper
     --------------------------------------------------------------------- */
  function onKeydown(e) { if (e.key === 'Escape') close(); }

  function open() {
    build();
    refreshDoors();
    lastFocus = document.activeElement;
    root.classList.remove('hidden');
    document.getElementById('ac-tab-handle')?.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown);

    introEl.classList.remove('is-done', 'is-opening');
    if (reduceMq.matches) {
      introEl.classList.add('is-done');
    } else {
      // force reflow so the leaves are guaranteed to paint closed before animating open
      void introEl.offsetWidth;
      requestAnimationFrame(() => { introEl.classList.add('is-opening'); });
      clearTimeout(open._t);
      open._t = setTimeout(() => introEl.classList.add('is-done'), 1150);
    }
    setTimeout(() => root.querySelector('.ac-close-btn')?.focus({ preventScroll: true }), 60);
  }
  function close() {
    if (!root) return;
    root.classList.add('hidden');
    document.getElementById('ac-tab-handle')?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  window.toggleAdventCalendar = function () {
    if (root && !root.classList.contains('hidden')) close(); else open();
  };
  // Console helper to preview any day as "today" without waiting — same idea as
  // window.forceChristmasMode(...) in script.js. Call with no args to go back to the real date.
  window.setAdventPreviewDay = function (day) {
    try {
      if (day === undefined) localStorage.removeItem(PREVIEW_KEY);
      else localStorage.setItem(PREVIEW_KEY, String(day));
    } catch (e) {}
    console.log('[Nexora] Advent Calendar preview day: ' + (day === undefined ? 'cleared (back to the real date).' : day + '.'));
    refreshDoors();
  };

  window.NexoraAdventCalendar = { open, close, refreshDoors };
})();
