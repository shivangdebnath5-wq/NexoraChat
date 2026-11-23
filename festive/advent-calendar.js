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
  /* ---------------------------------------------------------------------
     PIXEL-ART DOOR SYSTEM — every door is a hand-built pixel grid (crisp,
     non-anti-aliased <rect>s on an integer viewBox, like a retro game sprite)
     rather than smooth vector shapes. A static grid defines the *shape*
     (frame, hinges, wood planks, raised panels, knob, number plate); only the
     *colors* are swapped per door, computed from the same 5-way palette the
     door frame's CSS already cycles through (see .ac-door:nth-child in
     style.css), so the pixel art and the CSS frame always agree.
     --------------------------------------------------------------------- */
  function hexLighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  // Renders a character grid (rows of equal-length strings) as crisp 1x1-unit
  // <rect> pixels, keyed through a {char: color} palette ('.' / ' ' = transparent).
  function gridSvg(rows, palette, cls, stretch) {
    const h = rows.length, w = rows[0].length;
    let cells = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        const color = palette[ch];
        if (!color) continue;
        cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
      }
    }
    // The door leaf must fully cover its opening (a real closed door can't leave
    // gaps the window glow peeks through), so it stretches to fill — everything
    // else (roof, ornaments) keeps its true pixel aspect ratio via "meet".
    const par = stretch ? 'none' : 'xMidYMid meet';
    return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 ${w} ${h}" preserveAspectRatio="${par}" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
  }
  // Matches the 5-way cycle .ac-door:nth-child(5n+2/3/4/5n) already defines in CSS.
  function paletteFor(day) {
    const m = day % 5;
    if (m === 2) return { dc: '#205B40', dc2: '#184a33', df: '#D9B66F' };
    if (m === 3) return { dc: '#163826', dc2: '#102c1c', df: '#F4F1E8' };
    if (m === 4) return { dc: '#651E2B', dc2: '#4f1621', df: '#D9B66F' };
    if (m === 0) return { dc: '#2B6B49', dc2: '#215438', df: '#F4D98A' };
    return { dc: '#A82832', dc2: '#8a2029', df: '#D9B66F' };
  }

  // ---- door leaf: 14x21 grid — frame, 2 hinges, 2 raised panels, a number
  //      plate between them (digits overlaid separately), and a knob. ----
  const LEAF_W = 14, LEAF_H = 21;
  const LEAF_PANELS = [[3, 7], [13, 17]]; // [topRow, bottomRow], always cols 2-11
  function leafKey(x, y) {
    if (y === 0 || y === LEAF_H - 1 || x === 0 || x === LEAF_W - 1) {
      if (x === 0 && ((y >= 4 && y <= 5) || (y >= 14 && y <= 15))) return 'H'; // hinge plates
      return 'F';
    }
    for (const [top, bottom] of LEAF_PANELS) {
      if (y >= top && y <= bottom && x >= 2 && x <= 11) {
        if (x === 2 || y === top) return 'L';
        if (x === 11 || y === bottom) return 'D';
        return 'P';
      }
    }
    if (x === 12 && y === 10) return 'K'; // knob
    if (x === 12 && y === 9) return 'k';  // knob highlight
    if (y >= 8 && y <= 12 && x >= 2 && x <= 11) return 'N'; // number plate
    return (Math.floor(x / 2) % 2 === 0) ? 'A' : 'B'; // plank stiles/rails
  }
  let LEAF_GRID = null;
  function leafGrid() {
    if (LEAF_GRID) return LEAF_GRID;
    const rows = [];
    for (let y = 0; y < LEAF_H; y++) {
      let row = '';
      for (let x = 0; x < LEAF_W; x++) row += leafKey(x, y);
      rows.push(row);
    }
    return (LEAF_GRID = rows);
  }
  // ---- roof: 16x8 stepped-pyramid grid with a lit left edge + eave trim ----
  const ROOF_W = 16, ROOF_H = 8;
  function roofKey(x, y) {
    if (y === ROOF_H - 1) return 'T';
    const half = y + 1, left = 8 - half, right = 7 + half;
    if (x < left || x > right) return '.';
    return x === left ? 'r' : 'R';
  }
  let ROOF_GRID = null;
  function roofGrid() {
    if (ROOF_GRID) return ROOF_GRID;
    const rows = [];
    for (let y = 0; y < ROOF_H; y++) {
      let row = '';
      for (let x = 0; x < ROOF_W; x++) row += roofKey(x, y);
      rows.push(row);
    }
    return (ROOF_GRID = rows);
  }
  // ---- 3x5 pixel digits, drawn straight into the leaf's number-plate band ----
  const DIGIT_GLYPHS = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111']
  };
  function numberRects(day, color) {
    const str = String(day);
    const w = str.length * 4 - 1;             // 3px digit + 1px gap, no trailing gap
    let x0 = 2 + Math.floor((10 - w) / 2);     // center within the plate's x2..11 span
    let out = '';
    for (const ch of str) {
      const g = DIGIT_GLYPHS[ch];
      if (g) for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 3; rx++)
        if (g[ry][rx] === '1') out += `<rect x="${x0 + rx}" y="${8 + ry}" width="1" height="1" fill="${color}"/>`;
      x0 += 4;
    }
    return out;
  }
  function doorLeafSvg(day, pal) {
    const palette = {
      F: pal.df, H: '#2b2016', A: pal.dc, B: pal.dc2,
      L: hexLighten(pal.dc, .4), D: pal.dc2, P: pal.dc,
      N: '#1b140d', K: '#F4D98A', k: '#FFF4D6'
    };
    const rows = leafGrid();
    const base = gridSvg(rows, palette, 'ac-door-leaf-svg', true);
    // splice the day's number pixels in just before the closing </svg>
    return base.replace('</svg>', numberRects(day, '#F4E8C0') + '</svg>');
  }
  function doorRoofSvg(pal) {
    const palette = { R: pal.dc2, r: hexLighten(pal.dc2, .45), T: pal.df };
    return gridSvg(roofGrid(), palette, 'ac-door-roof');
  }

  // ---- hanging ornaments: hand-drawn pixel sprites (holly / bow / bell) ----
  const HOLLY_GRID = ['....G....', '...GgG...', '..G.g.G..', '.G..g..G.', 'G...g...G', '.G..g..G.', '..G...G..', '...RrR...', '....R....'];
  const BOW_GRID = ['RR.......RR', '.RR..K..RR.', '..RR.K.RR..', '...RKKKR...', '..RR.K.RR..', '.RR..K..RR.', 'RR.......RR'];
  const BELL_GRID = ['...F...', '..FKF..', '.FKKKF.', '.FKKKF.', 'FKKKKKF', 'FFFFFFF', '...k...'];
  const ORNAMENT_PALETTES = {
    holly: { G: '#205B40', g: '#2d7a52', R: '#A82832', r: '#c23a46' },
    bow: { R: '#A82832', K: '#D9B66F' },
    bell: { F: '#9C7A3C', K: '#D9B66F', k: '#6b4e22' }
  };
  const ORNAMENT_GRIDS = { holly: HOLLY_GRID, bow: BOW_GRID, bell: BELL_GRID };
  const ORNAMENT_KINDS = ['holly', 'bow', 'bell'];
  function ornamentSvg(kind) { return gridSvg(ORNAMENT_GRIDS[kind], ORNAMENT_PALETTES[kind]); }
  function ornamentFor(day) {
    if (day % 3 !== 0) return '';   // sparse — "around selected doors", not every door
    const kind = ORNAMENT_KINDS[(day / 3) % ORNAMENT_KINDS.length | 0];
    return `<span class="ac-door-ornament" aria-hidden="true">${ornamentSvg(kind)}</span>`;
  }
  function doorHtml(day) {
    const pal = paletteFor(day);
    return `<button type="button" class="ac-door" data-day="${day}" aria-label="December ${day}">
      ${ornamentFor(day)}
      <span class="ac-today-tag hidden" aria-hidden="true">Today</span>
      ${doorRoofSvg(pal)}
      <span class="ac-door-opening">
        <span class="ac-door-window" aria-hidden="true"></span>
        <span class="ac-door-leaf">${doorLeafSvg(day, pal)}</span>
      </span>
      <span class="ac-door-frost hidden" aria-hidden="true"></span>
    </button>`;
  }
  function lightsHtml(n) {
    const colors = ['#A82832', '#205B40', '#D9B66F', '#F4F1E8'];
    let h = '';
    for (let i = 0; i < n; i++) {
      const x = (i + .5) / n;
      const sag = Math.sin(Math.PI * x) * 9;
      const left = (2 + x * 96).toFixed(1);
      const color = colors[i % colors.length];
      h += `<span class="ac-bulb" style="left:${left}%;top:${(6 + sag).toFixed(1)}px;background:${color};box-shadow:0 0 6px 2px ${color}99;animation-delay:${(i * .18).toFixed(2)}s"></span>`;
    }
    return h;
  }
  function garlandHtml(n) {
    let h = '';
    for (let i = 0; i < n; i++) h += `<span aria-hidden="true">${ornamentSvg('holly')}</span>`;
    return h;
  }
  const CORNER_SPRIG_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
      <g fill="#205B40"><path d="M8 72 L48 22 L54 36 L70 16 L67 42 L90 26 L74 56 L52 50Z"/></g>
      <g fill="#123D2B" opacity=".6"><path d="M8 72 L40 34 L44 46 L10 76Z"/></g>
      <g fill="#F4F1E8" opacity=".9"><circle cx="34" cy="46" r="3.6"/><circle cx="54" cy="31" r="2.6"/><circle cx="20" cy="60" r="2.6"/><circle cx="66" cy="42" r="2.2"/></g>
    </svg>`;
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
          <div class="ac-corner-sprig left" aria-hidden="true">${CORNER_SPRIG_SVG}</div>
          <div class="ac-corner-sprig right" aria-hidden="true">${CORNER_SPRIG_SVG}</div>
          <div class="ac-header">
            <h2 class="ac-title">Winter Wonderland Advent Calendar</h2>
            <p class="ac-subtitle">December 2026 · open a door each day</p>
          </div>
          <div class="ac-lights" aria-hidden="true">${lightsHtml(16)}</div>
          <div class="ac-garland" aria-hidden="true">${garlandHtml(13)}</div>
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
    document.getElementById('sb-advent-nav')?.setAttribute('aria-expanded', 'true');
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
    document.getElementById('sb-advent-nav')?.setAttribute('aria-expanded', 'false');
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
