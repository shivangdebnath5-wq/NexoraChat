/* =========================================================================
   wishing.js — Nexora Greeting Wisher (Greeting Card Studio)
   -------------------------------------------------------------------------
   Everything about the Greeting Wisher lives in this one file:
     1. Data ........ templates, frames, fonts, stickers, quick-start messages
     2. State ....... card state + auto-saved draft
     3. Side tab .... the floating "Greeting Studio" handle/panel on the home screen
     4. Studio UI ... editor on the LEFT, live preview on the RIGHT (built on first open)
     5. Preview ..... canvas renderer + sticker dragging (re-renders on every change)
     6. Sharing ..... recipient picker (friends + Hubs) and sending through Nexora's
                      existing message stores (DB.getMessages / DB.saveMessages for
                      direct chats, getHubs / saveHubs for Hubs)
   Nexora globals it reuses (all optional-guarded): currentUser, activeFriend,
   activeHub, DB, getHubs, saveHubs, renderMessages, renderHubMessages,
   rewardQuestProgress, hubImageSource, DEFAULT_AVATAR,
   window.firestoreFriendUsernames.
   Styles live in style.css under "GREETING CARD STUDIO".
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     1. DATA
     --------------------------------------------------------------------- */
  const TEMPLATES = [
    { id: 'royal-amavasya', name: 'Midnight Amavasya', c1: '#1c1136', c2: '#090d20', accent: '#F5D98A', glow: 'rgba(214,168,75,0.32)' },
    { id: 'marigold-palace', name: 'Royal Marigold', c1: '#4a151b', c2: '#1f0812', accent: '#FFD166', glow: 'rgba(255,159,28,0.35)' },
    { id: 'lotus-silk', name: 'Lotus Magenta', c1: '#3b0d3e', c2: '#170626', accent: '#F5D5E0', glow: 'rgba(232,95,199,0.3)' },
    { id: 'emerald-darbar', name: 'Emerald Darbar', c1: '#0c382c', c2: '#061914', accent: '#F5D98A', glow: 'rgba(52,211,153,0.25)' }
  ];
  const FRAMES = [
    ['royal-gold', 'Royal Gold Filigree'],
    ['minimal-glow', 'Minimal Golden Border'],
    ['arch-mandala', 'Palace Arch Frame'],
    ['none', 'Borderless Modern']
  ];
  const HEADING_FONTS = [
    ["'Cinzel Decorative', serif", 'Cinzel Decorative (Royal)'],
    ["'Great Vibes', cursive", 'Great Vibes (Calligraphy)'],
    ["'Dr Sugiyama', cursive", 'Dr Sugiyama (Festive Script)'],
    ["'Playfair Display', serif", 'Playfair Display (Editorial)'],
    ["'Rozha One', serif", 'Rozha One (Classic Heritage)'],
    ["'Dancing Script', cursive", 'Dancing Script (Warm)'],
    ["'Cormorant Garamond', serif", 'Cormorant Garamond (Luxe)'],
    ["'Montserrat', sans-serif", 'Montserrat (Modern Geometric)'],
    ["'Poppins', sans-serif", 'Poppins (Clean Contemporary)']
  ];
  const BODY_FONTS = [
    ["'Poppins', sans-serif", 'Poppins'],
    ["'Cormorant Garamond', serif", 'Cormorant Garamond'],
    ["'Playfair Display', serif", 'Playfair Display'],
    ["'Montserrat', sans-serif", 'Montserrat'],
    ["'Inter', sans-serif", 'Inter']
  ];
  const STICKERS = [
    ['🪔', 'Diya'], ['✨', 'Sparkles'], ['🎆', 'Fireworks'], ['🪷', 'Lotus'],
    ['🏮', 'Lantern'], ['🕉️', 'Om'], ['🌼', 'Marigold'], ['🎇', 'Sparkler']
  ];
  const PRESETS = [
    { label: 'Classic blessing', heading: 'Shubh Deepavali', message: 'May the divine light of Diwali bring peace, prosperity, and endless joy to your home.' },
    { label: 'For family', heading: 'Happy Diwali', message: 'Wishing you and your loved ones a festival full of laughter, sweets, and glowing diyas.' },
    { label: 'For friends', heading: 'Happy Deepavali!', message: 'Here\u2019s to bright lights, great food, and even better company. Have a sparkling Diwali!' },
    { label: 'New beginnings', heading: 'Shubh Deepavali', message: 'May this festival of lights usher in a new year of health, happiness, and fresh beginnings.' }
  ];
  const TABS = [
    ['templates', 'Templates'], ['message', 'Message'], ['typography', 'Style'], ['adjust', 'Filters'], ['decor', 'Stickers']
  ];
  const CARD_W = 720, CARD_H = 900;
  const MAX_SEND_CHARS = 900000; // keeps one card comfortably inside Nexora's message size limits

  /* ---------------------------------------------------------------------
     2. STATE (+ auto-saved draft)
     --------------------------------------------------------------------- */
  function defaultState() {
    return {
      templateId: 'royal-amavasya',
      frame: 'royal-gold',
      customBgUrl: '',
      heading: 'Shubh Deepavali',
      subheading: PRESETS[0].message,
      footer: 'Warm wishes from Nexora',
      headingFont: "'Cinzel Decorative', serif",
      bodyFont: "'Poppins', sans-serif",
      headingColor: '#F5D98A',
      bodyColor: '#EEEAF7',
      textOffsetY: 0,
      brightness: 100,
      contrast: 100,
      saturation: 110,
      temperature: 15,
      stickers: [
        { id: 1, emoji: '🪔', x: 360, y: 210, size: 64 },
        { id: 2, emoji: '✨', x: 150, y: 170, size: 42 },
        { id: 3, emoji: '✨', x: 570, y: 170, size: 42 }
      ]
    };
  }
  let state = defaultState();
  let customBgImg = null;       // loaded background image (not persisted)
  let dragging = null;          // sticker being dragged
  let studioEl = null, canvas = null, ctx = null;
  let renderQueued = false, saveTimer = null, resetArmed = null;
  let shareFilter = 'all', shareSelected = new Set(), shareDone = false;

  const g = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };
  const me = () => g(() => currentUser, null);
  const draftKey = () => 'nexora_wisher_draft_' + (me() || 'guest');
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function loadDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey()) || 'null');
      if (saved && typeof saved === 'object') state = Object.assign(defaultState(), saved, { stickers: Array.isArray(saved.stickers) ? saved.stickers : defaultState().stickers });
    } catch (e) { /* ignore corrupt drafts */ }
    state.customBgUrl = state.customBgUrl && /^https?:/i.test(state.customBgUrl) ? state.customBgUrl : '';
    if (state.customBgUrl) loadBackground(state.customBgUrl);
  }
  function saveDraftSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(draftKey(), JSON.stringify(state)); } catch (e) { /* quota */ } }, 350);
  }

  /* ---------------------------------------------------------------------
     3. FLOATING SIDE TAB (home screen handle + quick panel)
     --------------------------------------------------------------------- */
  function toggleTab(event) {
    if (event) event.stopPropagation();
    const root = document.getElementById('greeting-studio-tab');
    if (!root) return;
    document.getElementById('header-more-menu')?.classList.add('hidden');
    document.getElementById('hub-more-menu')?.classList.add('hidden');
    const expand = !root.classList.contains('is-expanded');
    root.classList.toggle('is-expanded', expand);
    document.getElementById('gs-tab-handle')?.setAttribute('aria-expanded', String(expand));
    document.getElementById('gs-floating-panel')?.setAttribute('aria-hidden', String(!expand));
  }
  function collapseTab(event) {
    if (event) event.stopPropagation();
    const root = document.getElementById('greeting-studio-tab');
    if (!root || !root.classList.contains('is-expanded')) return;
    root.classList.remove('is-expanded');
    document.getElementById('gs-tab-handle')?.setAttribute('aria-expanded', 'false');
    document.getElementById('gs-floating-panel')?.setAttribute('aria-hidden', 'true');
  }
  document.addEventListener('click', (e) => {
    const root = document.getElementById('greeting-studio-tab');
    if (root && root.classList.contains('is-expanded') && !e.target.closest('#greeting-studio-tab')) collapseTab();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    collapseTab();
    if (!studioEl || studioEl.classList.contains('hidden')) return;
    if (!$('#gs-share', studioEl).classList.contains('hidden')) closeShare(); else closeStudio();
  });

  /* ---------------------------------------------------------------------
     4. STUDIO UI (built once, on first open)
     --------------------------------------------------------------------- */
  function rangeField(key, label, min, max, unit) {
    return `<div class="gs-field"><label class="gs-field-label" for="gs-${key}">${label} <output data-gs-out="${key}">${state[key]}</output>${unit || ''}</label>
      <input type="range" id="gs-${key}" data-gs="${key}" min="${min}" max="${max}" value="${state[key]}"></div>`;
  }
  function selectOptions(list) { return list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''); }

  function studioHTML() {
    return `
    <div class="card gs-studio-workspace">
      <header class="gs-workspace-topbar">
        <div class="gs-workspace-brand">
          <span class="gs-workspace-badge">✦ DIWALI EDITION</span>
          <h2 id="gs-workspace-title">Greeting Card Studio</h2>
        </div>
        <div class="gs-workspace-top-actions">
          <button type="button" class="gs-btn gs-btn-ghost" data-gs-action="reset">Reset</button>
          <button type="button" class="gs-icon-btn" data-gs-action="close" aria-label="Close Greeting Studio">&times;</button>
        </div>
      </header>

      <div class="gs-workspace-body">
        <section class="gs-controls-pane" aria-label="Card editor">
          <div class="gs-control-tabs" role="tablist" aria-label="Editor sections">
            ${TABS.map(([id, label], i) => `<button type="button" role="tab" class="gs-ctrl-tab${i ? '' : ' active'}" id="gs-tab-${id}" data-gs-tab="${id}" aria-selected="${i ? 'false' : 'true'}" aria-controls="gs-panel-${id}" tabindex="${i ? '-1' : '0'}">${label}</button>`).join('')}
          </div>

          <div class="gs-ctrl-panel" id="gs-panel-templates" role="tabpanel" aria-labelledby="gs-tab-templates" data-gs-panel="templates">
            <div class="gs-group">
              <span class="gs-field-label">Template</span>
              <div id="gs-template-grid" class="gs-template-grid"></div>
            </div>
            <div class="gs-group">
              <label class="gs-field-label" for="gs-frame">Card frame</label>
              <select id="gs-frame" data-gs="frame">${selectOptions(FRAMES)}</select>
            </div>
            <div class="gs-group">
              <label class="gs-field-label" for="gs-customBgUrl">Background image <em>(optional)</em></label>
              <input type="text" id="gs-customBgUrl" data-gs="customBgUrl" placeholder="Paste an image link  https://…" autocomplete="off">
              <div class="gs-inline-row">
                <label class="gs-btn gs-btn-glass gs-file-btn">Upload photo<input type="file" id="gs-bg-file" accept="image/*" hidden></label>
                <button type="button" class="gs-btn gs-btn-ghost" data-gs-action="clear-bg">Remove background</button>
              </div>
            </div>
          </div>

          <div class="gs-ctrl-panel hidden" id="gs-panel-message" role="tabpanel" aria-labelledby="gs-tab-message" data-gs-panel="message">
            <div class="gs-group">
              <span class="gs-field-label">Quick starts</span>
              <div class="gs-chips">${PRESETS.map((p, i) => `<button type="button" class="gs-chip" data-gs-preset="${i}">${esc(p.label)}</button>`).join('')}</div>
            </div>
            <div class="gs-group">
              <label class="gs-field-label" for="gs-heading">Heading</label>
              <input type="text" id="gs-heading" data-gs="heading" maxlength="60" autocomplete="off">
              <label class="gs-field-label" for="gs-subheading">Message <output id="gs-msg-count" class="gs-count"></output></label>
              <textarea id="gs-subheading" data-gs="subheading" rows="4" maxlength="220"></textarea>
              <label class="gs-field-label" for="gs-footer">From line</label>
              <input type="text" id="gs-footer" data-gs="footer" maxlength="60" autocomplete="off">
            </div>
          </div>

          <div class="gs-ctrl-panel hidden" id="gs-panel-typography" role="tabpanel" aria-labelledby="gs-tab-typography" data-gs-panel="typography">
            <div class="gs-group">
              <label class="gs-field-label" for="gs-headingFont">Heading font</label>
              <select id="gs-headingFont" data-gs="headingFont">${selectOptions(HEADING_FONTS)}</select>
              <label class="gs-field-label" for="gs-bodyFont">Body font</label>
              <select id="gs-bodyFont" data-gs="bodyFont">${selectOptions(BODY_FONTS)}</select>
            </div>
            <div class="gs-group gs-row-2col">
              <div><label class="gs-field-label" for="gs-headingColor">Heading colour</label><input type="color" id="gs-headingColor" data-gs="headingColor"></div>
              <div><label class="gs-field-label" for="gs-bodyColor">Body colour</label><input type="color" id="gs-bodyColor" data-gs="bodyColor"></div>
            </div>
            <div class="gs-group">${rangeField('textOffsetY', 'Text position', -60, 60, ' px')}</div>
          </div>

          <div class="gs-ctrl-panel hidden" id="gs-panel-adjust" role="tabpanel" aria-labelledby="gs-tab-adjust" data-gs-panel="adjust">
            <div class="gs-group">
              ${rangeField('brightness', 'Brightness', 60, 140, '%')}
              ${rangeField('contrast', 'Contrast', 70, 140, '%')}
              ${rangeField('saturation', 'Saturation', 50, 180, '%')}
              ${rangeField('temperature', 'Warmth', 0, 60, '%')}
              <button type="button" class="gs-btn gs-btn-ghost" data-gs-action="reset-filters">Reset filters</button>
            </div>
          </div>

          <div class="gs-ctrl-panel hidden" id="gs-panel-decor" role="tabpanel" aria-labelledby="gs-tab-decor" data-gs-panel="decor">
            <div class="gs-group">
              <span class="gs-field-label">Add a sticker</span>
              <div class="gs-sticker-palette">${STICKERS.map(([e, n]) => `<button type="button" class="gs-sticker-btn" data-gs-sticker="${e}" title="${n}" aria-label="Add ${n} sticker"><span>${e}</span><small>${n}</small></button>`).join('')}</div>
            </div>
            <div class="gs-group">
              <span class="gs-field-label">On your card <em>(drag on the preview to move)</em></span>
              <div id="gs-layers-list" class="gs-layers-list"></div>
            </div>
          </div>
        </section>

        <section class="gs-preview-stage" aria-label="Live preview">
          <div class="gs-stage-head"><span class="gs-live"><i aria-hidden="true"></i>Live preview</span><span class="gs-stage-meta">Updates as you type</span></div>
          <div class="gs-card-canvas-wrap" id="gs-card-canvas-wrap"><canvas id="gs-card-canvas" width="${CARD_W}" height="${CARD_H}" role="img" aria-label="Greeting card preview"></canvas></div>
          <div class="gs-stage-actions">
            <button type="button" class="gs-btn gs-btn-glass" data-gs-action="download">⬇ Download</button>
            <button type="button" class="gs-btn gs-btn-gold" data-gs-action="share">Send card <span aria-hidden="true">➤</span></button>
          </div>
        </section>
      </div>

      <div id="gs-share" class="gs-share hidden" role="dialog" aria-modal="true" aria-labelledby="gs-share-title">
        <div class="gs-share-panel">
          <div class="gs-share-head">
            <div><h3 id="gs-share-title">Send your card</h3><p id="gs-share-sub">Pick friends or Hubs to receive it.</p></div>
            <button type="button" class="gs-icon-btn" data-gs-action="share-close" aria-label="Close">&times;</button>
          </div>
          <div class="gs-share-body" id="gs-share-body">
            <div class="gs-share-compose">
              <img id="gs-share-thumb" alt="Your greeting card">
              <textarea id="gs-share-caption" rows="3" maxlength="200" placeholder="Add a personal note (optional)" aria-label="Personal note"></textarea>
            </div>
            <div class="gs-share-tools">
              <input type="search" id="gs-share-search" placeholder="Search friends and Hubs" aria-label="Search friends and Hubs" autocomplete="off">
              <div class="gs-seg" role="group" aria-label="Filter recipients">
                <button type="button" class="active" data-gs-filter="all">All</button>
                <button type="button" data-gs-filter="friend">Friends</button>
                <button type="button" data-gs-filter="hub">Hubs</button>
              </div>
            </div>
            <div id="gs-recipient-list" class="gs-recipient-list" role="listbox" aria-multiselectable="true" aria-label="Recipients"></div>
          </div>
          <div class="gs-share-foot">
            <span id="gs-share-count" class="gs-share-count">Nobody selected</span>
            <button type="button" class="gs-btn gs-btn-gold" id="gs-share-send" data-gs-action="share-send" disabled>Send card <span aria-hidden="true">➤</span></button>
          </div>
        </div>
      </div>

      <div id="gs-toast" class="gs-toast" role="status" aria-live="polite"></div>
    </div>`;
  }

  function buildStudio() {
    if (studioEl) return;
    studioEl = document.createElement('div');
    studioEl.id = 'greeting-studio-modal';
    studioEl.className = 'modal gs-modal hidden';
    studioEl.setAttribute('role', 'dialog');
    studioEl.setAttribute('aria-modal', 'true');
    studioEl.setAttribute('aria-labelledby', 'gs-workspace-title');
    studioEl.innerHTML = studioHTML();
    document.body.appendChild(studioEl);
    canvas = $('#gs-card-canvas', studioEl);
    ctx = canvas.getContext('2d');
    bindStudio();
  }

  function bindStudio() {
    // backdrop click closes
    studioEl.addEventListener('mousedown', (e) => { if (e.target === studioEl) closeStudio(); });

    // all text/select/range/colour controls
    const onControl = (e) => {
      const el = e.target.closest('[data-gs]');
      if (!el) return;
      const key = el.dataset.gs;
      state[key] = el.type === 'range' ? parseInt(el.value, 10) : el.value;
      const out = $(`[data-gs-out="${key}"]`, studioEl); if (out) out.textContent = state[key];
      if (key === 'customBgUrl') loadBackground(state.customBgUrl.trim());
      if (key === 'headingFont' || key === 'bodyFont') ensureFonts();
      if (key === 'subheading') updateCount();
      scheduleRender(); saveDraftSoon();
    };
    studioEl.addEventListener('input', onControl);
    studioEl.addEventListener('change', onControl);

    // clicks (delegated)
    studioEl.addEventListener('click', (e) => {
      const t = e.target;
      const act = t.closest('[data-gs-action]');
      if (act) return handleAction(act.dataset.gsAction, act);
      const tab = t.closest('[data-gs-tab]'); if (tab) return switchTab(tab.dataset.gsTab);
      const tpl = t.closest('[data-gs-template]'); if (tpl) return selectTemplate(tpl.dataset.gsTemplate);
      const preset = t.closest('[data-gs-preset]'); if (preset) return applyPreset(parseInt(preset.dataset.gsPreset, 10));
      const stk = t.closest('[data-gs-sticker]'); if (stk) return addSticker(stk.dataset.gsSticker);
      const del = t.closest('[data-gs-remove]'); if (del) return removeSticker(del.dataset.gsRemove);
      const flt = t.closest('[data-gs-filter]'); if (flt) return setShareFilter(flt.dataset.gsFilter);
      const row = t.closest('.gs-recipient'); if (row && !row.disabled) return toggleRecipient(row);
    });

    // sticker size sliders
    $('#gs-layers-list', studioEl).addEventListener('input', (e) => {
      const r = e.target.closest('[data-gs-size]'); if (!r) return;
      const s = state.stickers.find((x) => String(x.id) === r.dataset.gsSize);
      if (s) { s.size = parseInt(r.value, 10); scheduleRender(); saveDraftSoon(); }
    });

    // tab keyboard navigation
    $('.gs-control-tabs', studioEl).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = $$('.gs-ctrl-tab', studioEl), i = tabs.indexOf(document.activeElement); if (i < 0) return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); switchTab(next.dataset.gsTab); e.preventDefault();
    });

    // background upload
    $('#gs-bg-file', studioEl).addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      if (file.size > 4 * 1024 * 1024) { toast('Choose an image under 4 MB.'); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => { customBgImg = img; state.customBgUrl = ''; $('#gs-customBgUrl', studioEl).value = ''; scheduleRender(); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    // share search
    $('#gs-share-search', studioEl).addEventListener('input', renderRecipients);

    bindCanvas();
  }

  function handleAction(action, el) {
    switch (action) {
      case 'close': closeStudio(); break;
      case 'reset': armReset(el); break;
      case 'download': downloadPNG(); break;
      case 'share': openShare(); break;
      case 'share-close': closeShare(); break;
      case 'share-send': shareDone ? closeShare(true) : sendSelected(); break;
      case 'clear-bg': customBgImg = null; state.customBgUrl = ''; $('#gs-customBgUrl', studioEl).value = ''; scheduleRender(); saveDraftSoon(); break;
      case 'reset-filters':
        Object.assign(state, { brightness: 100, contrast: 100, saturation: 110, temperature: 15 });
        syncControls(); scheduleRender(); saveDraftSoon(); break;
    }
  }

  function armReset(btn) {
    if (resetArmed) { clearTimeout(resetArmed); resetArmed = null; btn.textContent = 'Reset'; btn.classList.remove('is-armed'); resetCard(); return; }
    btn.textContent = 'Tap again to reset'; btn.classList.add('is-armed');
    resetArmed = setTimeout(() => { resetArmed = null; btn.textContent = 'Reset'; btn.classList.remove('is-armed'); }, 3000);
  }
  function resetCard() {
    state = defaultState(); customBgImg = null;
    syncControls(); renderTemplates(); renderLayers(); ensureFonts(); scheduleRender(); saveDraftSoon();
    toast('Card reset to the default design.');
  }

  function syncControls() {
    $$('[data-gs]', studioEl).forEach((el) => { if (state[el.dataset.gs] !== undefined) el.value = state[el.dataset.gs]; });
    $$('[data-gs-out]', studioEl).forEach((o) => { o.textContent = state[o.dataset.gsOut]; });
    updateCount();
  }
  function updateCount() {
    const c = $('#gs-msg-count', studioEl); if (c) c.textContent = `${(state.subheading || '').length}/220`;
  }

  function switchTab(id) {
    $$('.gs-ctrl-tab', studioEl).forEach((b) => {
      const on = b.dataset.gsTab === id; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    $$('.gs-ctrl-panel', studioEl).forEach((p) => p.classList.toggle('hidden', p.dataset.gsPanel !== id));
  }

  function renderTemplates() {
    $('#gs-template-grid', studioEl).innerHTML = TEMPLATES.map((t) => `
      <button type="button" class="gs-template-card${state.templateId === t.id ? ' active' : ''}" data-gs-template="${t.id}" aria-pressed="${state.templateId === t.id}"
        style="--c1:${t.c1};--c2:${t.c2};--accent:${t.accent};--glow:${t.glow}">
        <i class="gs-template-glow" aria-hidden="true"></i><i class="gs-template-frame" aria-hidden="true"></i>
        <span class="gs-template-name">${esc(t.name)}</span><span class="gs-template-check" aria-hidden="true">✓</span>
      </button>`).join('');
  }
  function selectTemplate(id) { state.templateId = id; renderTemplates(); scheduleRender(); saveDraftSoon(); }
  function applyPreset(i) {
    const p = PRESETS[i]; if (!p) return;
    state.heading = p.heading; state.subheading = p.message;
    syncControls(); scheduleRender(); saveDraftSoon();
  }

  function addSticker(emoji) {
    state.stickers.push({ id: Date.now() + Math.random(), emoji, x: 360 + (Math.random() * 120 - 60), y: 450 + (Math.random() * 120 - 60), size: 56 });
    renderLayers(); scheduleRender(); saveDraftSoon();
  }
  function removeSticker(id) {
    state.stickers = state.stickers.filter((s) => String(s.id) !== String(id));
    renderLayers(); scheduleRender(); saveDraftSoon();
  }
  function renderLayers() {
    const list = $('#gs-layers-list', studioEl);
    if (!state.stickers.length) { list.innerHTML = '<p class="gs-empty">No stickers yet — add one above.</p>'; return; }
    list.innerHTML = state.stickers.map((s, i) => `
      <div class="gs-layer-item">
        <span class="gs-layer-emoji" aria-hidden="true">${s.emoji}</span>
        <input type="range" min="24" max="140" value="${Math.round(s.size)}" data-gs-size="${s.id}" aria-label="Size of sticker ${i + 1}">
        <button type="button" class="gs-layer-del" data-gs-remove="${s.id}" aria-label="Remove sticker ${i + 1}">Remove</button>
      </div>`).join('');
  }

  function openStudio() {
    collapseTab();
    buildStudio();
    loadDraft();
    syncControls(); renderTemplates(); renderLayers();
    studioEl.classList.remove('hidden');
    ensureFonts(); scheduleRender();
    setTimeout(() => { const first = $('.gs-ctrl-tab.active', studioEl); if (first) first.focus({ preventScroll: true }); }, 60);
  }
  function closeStudio() {
    if (!studioEl) return;
    closeShare();
    studioEl.classList.add('hidden');
  }

  function toast(message) {
    const t = $('#gs-toast', studioEl); if (!t) return;
    t.textContent = message; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------------------------------------------------------------------
     5. LIVE PREVIEW (canvas)
     --------------------------------------------------------------------- */
  function loadBackground(url) {
    if (!url) { customBgImg = null; return; }
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { if (state.customBgUrl === url) { customBgImg = img; scheduleRender(); } };
    img.onerror = () => { if (state.customBgUrl === url) { customBgImg = null; scheduleRender(); } };
    img.src = url;
  }
  function ensureFonts() {
    if (!(document.fonts && document.fonts.load)) return;
    Promise.all([document.fonts.load(`700 52px ${state.headingFont}`), document.fonts.load(`400 24px ${state.bodyFont}`), document.fonts.load(`600 18px ${state.bodyFont}`)])
      .then(scheduleRender).catch(() => {});
  }
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderCard(); });
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    const lines = [];
    String(text || '').split('\n').forEach((para) => {
      const words = para.split(' '); let line = '';
      words.forEach((w, n) => {
        const test = line + w + ' ';
        if (c.measureText(test).width > maxWidth && n > 0) { lines.push(line.trim()); line = w + ' '; } else line = test;
      });
      lines.push(line.trim());
    });
    lines.forEach((l, i) => c.fillText(l, x, y + i * lineHeight));
    return lines.length;
  }

  function renderCard() {
    if (!ctx) return;
    const W = CARD_W, H = CARD_H;
    const tpl = TEMPLATES.find((t) => t.id === state.templateId) || TEMPLATES[0];

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, tpl.c1); grad.addColorStop(1, tpl.c2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    if (customBgImg) { ctx.globalAlpha = 0.45; ctx.drawImage(customBgImg, 0, 0, W, H); ctx.globalAlpha = 1; }

    const radial = ctx.createRadialGradient(W / 2, H * 0.36, 20, W / 2, H * 0.36, 360);
    radial.addColorStop(0, tpl.glow); radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial; ctx.fillRect(0, 0, W, H);

    if (state.temperature > 0) { ctx.fillStyle = `rgba(255, 168, 52, ${(state.temperature / 100) * 0.24})`; ctx.fillRect(0, 0, W, H); }

    ctx.strokeStyle = tpl.accent;
    if (state.frame === 'royal-gold') {
      ctx.lineWidth = 3; ctx.strokeRect(34, 34, W - 68, H - 68);
      ctx.lineWidth = 1; ctx.strokeRect(46, 46, W - 92, H - 92);
    } else if (state.frame === 'minimal-glow') {
      ctx.lineWidth = 2; ctx.strokeRect(42, 42, W - 84, H - 84);
    } else if (state.frame === 'arch-mandala') {
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(38, 38, W - 76, H - 76, [140, 140, 24, 24]); ctx.stroke();
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';           // stickers must not inherit the warmth overlay's faint fill
    state.stickers.forEach((s) => {
      ctx.font = `${s.size}px sans-serif`; ctx.fillText(s.emoji, s.x, s.y);
      if (dragging === s) {            // guide ring only while dragging (never in exports)
        ctx.save(); ctx.filter = 'none'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(245,217,138,.9)';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 0.72, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    });

    const off = state.textOffsetY;
    ctx.fillStyle = state.headingColor; ctx.font = `700 52px ${state.headingFont}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'; ctx.shadowBlur = 14;
    wrapText(ctx, state.heading, W / 2, 370 + off, W - 130, 62);

    ctx.fillStyle = state.bodyColor; ctx.font = `400 24px ${state.bodyFont}`; ctx.shadowBlur = 8;
    wrapText(ctx, state.subheading, W / 2, 500 + off, W - 150, 36);

    ctx.fillStyle = tpl.accent; ctx.font = `600 18px ${state.bodyFont}`;
    ctx.fillText(state.footer, W / 2, H - 86);
    ctx.restore();
  }

  function bindCanvas() {
    const point = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (CARD_W / r.width), y: (e.clientY - r.top) * (CARD_H / r.height) };
    };
    const hit = (p) => { for (let i = state.stickers.length - 1; i >= 0; i--) { const s = state.stickers[i]; if (Math.hypot(p.x - s.x, p.y - s.y) <= s.size * 0.7) return s; } return null; };
    canvas.addEventListener('pointerdown', (e) => {
      const s = hit(point(e)); if (!s) return;
      dragging = s; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-dragging'); scheduleRender();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = point(e);
      if (!dragging) { canvas.style.cursor = hit(p) ? 'grab' : 'default'; return; }
      dragging.x = Math.max(0, Math.min(CARD_W, p.x)); dragging.y = Math.max(0, Math.min(CARD_H, p.y)); scheduleRender();
    });
    const stop = () => { if (!dragging) return; dragging = null; canvas.classList.remove('is-dragging'); scheduleRender(); saveDraftSoon(); };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  /* ---- exports ---- */
  function downloadPNG() {
    try {
      const a = document.createElement('a');
      a.download = `nexora-diwali-greeting-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast('Card downloaded.');
    } catch (e) { toast('Could not export — the background image blocks it. Try uploading it instead.'); }
  }
  // compact JPEG for chat (PNG would be too large for Nexora's message store)
  function cardForChat() {
    let q = 0.9, url = canvas.toDataURL('image/jpeg', q);
    while (url.length > MAX_SEND_CHARS && q > 0.5) { q -= 0.1; url = canvas.toDataURL('image/jpeg', q); }
    if (url.length > MAX_SEND_CHARS) {
      const t = document.createElement('canvas'); t.width = 540; t.height = 675;
      t.getContext('2d').drawImage(canvas, 0, 0, 540, 675); url = t.toDataURL('image/jpeg', 0.8);
    }
    return url;
  }

  /* ---------------------------------------------------------------------
     6. SHARING — friends + Hubs, via Nexora's existing message stores
     --------------------------------------------------------------------- */
  function friendList() { return (window.firestoreFriendUsernames || []).slice(); }
  function hubList() { return g(() => getHubs(), []).filter((h) => h && Array.isArray(h.members) && h.members.includes(me())); }
  function hubBlocked(h) { return !!(h.permissions && h.permissions.messaging === 'owner' && h.owner !== me()); }
  function avatarFor(name) {
    const users = g(() => DB.getUsers(), {});
    return (users[name] && users[name].pfp) || g(() => DEFAULT_AVATAR, '');
  }
  function hubIconFor(h) { return h.icon ? g(() => hubImageSource(h.icon), '') : ''; }

  function openShare() {
    try { $('#gs-share-thumb', studioEl).src = canvas.toDataURL('image/jpeg', 0.7); } catch (e) { return toast('Could not prepare the card — the background image blocks it. Try uploading it instead.'); }
    shareDone = false; shareFilter = 'all'; shareSelected = new Set();
    const af = g(() => activeFriend, null), ah = g(() => activeHub, null);
    if (ah) shareSelected.add('hub:' + ah); else if (af && friendList().includes(af)) shareSelected.add('friend:' + af);
    $('#gs-share-search', studioEl).value = '';
    $('#gs-share-caption', studioEl).value = '';
    $('#gs-share-title', studioEl).textContent = 'Send your card';
    $('#gs-share-sub', studioEl).textContent = 'Pick friends or Hubs to receive it.';
    $$('[data-gs-filter]', studioEl).forEach((b) => b.classList.toggle('active', b.dataset.gsFilter === 'all'));
    $('#gs-share-body', studioEl).classList.remove('is-results');
    const sendBtn = $('#gs-share-send', studioEl); sendBtn.innerHTML = 'Send card <span aria-hidden="true">➤</span>';
    renderRecipients();
    $('#gs-share', studioEl).classList.remove('hidden');
    setTimeout(() => $('#gs-share-search', studioEl).focus({ preventScroll: true }), 60);
  }
  function closeShare(refocus) {
    if (!studioEl) return;
    const sheet = $('#gs-share', studioEl);
    if (sheet.classList.contains('hidden')) return;
    sheet.classList.add('hidden');
    if (refocus) $('[data-gs-action="share"]', studioEl)?.focus({ preventScroll: true });
  }
  function setShareFilter(f) {
    shareFilter = f;
    $$('[data-gs-filter]', studioEl).forEach((b) => b.classList.toggle('active', b.dataset.gsFilter === f));
    renderRecipients();
  }

  function renderRecipients() {
    const list = $('#gs-recipient-list', studioEl);
    const q = ($('#gs-share-search', studioEl).value || '').trim().toLowerCase();
    const friends = shareFilter === 'hub' ? [] : friendList().filter((n) => n.toLowerCase().includes(q));
    const hubs = shareFilter === 'friend' ? [] : hubList().filter((h) => String(h.name || '').toLowerCase().includes(q));
    let html = '';
    if (friends.length) {
      html += '<div class="gs-recipient-group">Friends</div>' + friends.map((n) => {
        const key = 'friend:' + n;
        return `<button type="button" class="gs-recipient" role="option" aria-selected="${shareSelected.has(key)}" data-key="${esc(key)}">
          <img src="${esc(avatarFor(n))}" alt="" class="gs-recipient-avatar"><span class="gs-recipient-text"><b>@${esc(n)}</b><small>Direct message</small></span><span class="gs-check" aria-hidden="true"></span></button>`;
      }).join('');
    }
    if (hubs.length) {
      html += '<div class="gs-recipient-group">Hubs</div>' + hubs.map((h) => {
        const key = 'hub:' + h.id, blocked = hubBlocked(h), icon = hubIconFor(h);
        const art = icon ? `<img src="${esc(icon)}" alt="" class="gs-recipient-avatar">` : `<span class="gs-recipient-avatar gs-hub-initial" aria-hidden="true">${esc((h.name || '#').trim().charAt(0).toUpperCase() || '#')}</span>`;
        if (blocked) shareSelected.delete(key);
        return `<button type="button" class="gs-recipient${blocked ? ' is-blocked' : ''}" role="option" aria-selected="${shareSelected.has(key)}" data-key="${esc(key)}"${blocked ? ' disabled' : ''}>
          ${art}<span class="gs-recipient-text"><b># ${esc(h.name)}</b><small>${blocked ? 'Only the owner can post here' : `Hub · ${h.members.length} member${h.members.length === 1 ? '' : 's'}`}</small></span><span class="gs-check" aria-hidden="true"></span></button>`;
      }).join('');
    }
    if (!html) {
      const none = !friendList().length && !hubList().length;
      html = `<p class="gs-empty gs-empty-big">${none ? 'No friends or Hubs yet — add some friends or join a Hub to share your card.' : 'No matches. Try another name.'}</p>`;
    }
    list.innerHTML = html;
    updateShareCount();
  }
  function toggleRecipient(row) {
    const key = row.dataset.key;
    if (shareSelected.has(key)) shareSelected.delete(key); else shareSelected.add(key);
    row.setAttribute('aria-selected', String(shareSelected.has(key)));
    updateShareCount();
  }
  function updateShareCount() {
    const n = shareSelected.size;
    $('#gs-share-count', studioEl).textContent = n ? `${n} selected` : 'Nobody selected';
    $('#gs-share-send', studioEl).disabled = !n;
  }

  function sendSelected() {
    if (!shareSelected.size) return;
    const caption = ($('#gs-share-caption', studioEl).value || '').trim();
    let dataUrl;
    try { dataUrl = cardForChat(); } catch (e) { return toast('Could not prepare the card — the background image blocks it. Try uploading it instead.'); }
    const user = me(); if (!user) return toast('Please sign in to send cards.');
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let seq = 0; const nextId = () => Date.now() + (seq++);
    const attachment = () => ({ name: 'nexora-diwali-greeting.jpg', type: 'image', data: dataUrl });
    const keys = Array.from(shareSelected);
    const friends = keys.filter((k) => k.startsWith('friend:')).map((k) => k.slice(7));
    const hubIds = keys.filter((k) => k.startsWith('hub:')).map((k) => k.slice(4));
    const results = [];

    if (friends.length) {
      try {
        const all = g(() => DB.getMessages(), []);
        friends.forEach((name) => all.push({ id: nextId(), sender: user, receiver: name, text: caption, attachment: attachment(), reactions: {}, replyTo: null, timestamp: stamp }));
        DB.saveMessages(all);
        friends.forEach((name) => {
          results.push({ ok: true, label: '@' + name });
          g(() => { rewardQuestProgress('messages'); rewardQuestProgress('images'); });
        });
      } catch (e) { friends.forEach((name) => results.push({ ok: false, label: '@' + name, why: 'Not enough storage space' })); }
    }
    if (hubIds.length) {
      try {
        const hubs = getHubs(); let changed = false;
        hubIds.forEach((id) => {
          const hub = hubs.find((h) => String(h.id) === String(id));
          if (!hub) return results.push({ ok: false, label: 'Hub', why: 'Hub not found' });
          if (hubBlocked(hub)) return results.push({ ok: false, label: '# ' + hub.name, why: 'Only the owner can post' });
          hub.messages = hub.messages || [];
          hub.messages.push({ id: nextId(), sender: user, text: caption, attachment: attachment(), replyTo: null, timestamp: stamp });
          changed = true; results.push({ ok: true, label: '# ' + hub.name });
        });
        if (changed) saveHubs(hubs);
      } catch (e) { hubIds.forEach(() => results.push({ ok: false, label: 'Hub', why: 'Not enough storage space' })); }
    }

    // refresh whichever conversation is on screen
    const ah = g(() => activeHub, null), af = g(() => activeFriend, null);
    if (ah && hubIds.includes(String(ah))) g(() => renderHubMessages(true));
    else if (!ah && af && friends.includes(af)) g(() => renderMessages(true));

    showResults(results);
  }

  function showResults(results) {
    shareDone = true;
    const okCount = results.filter((r) => r.ok).length;
    $('#gs-share-title', studioEl).textContent = okCount ? 'Card sent ✨' : 'Couldn’t send';
    $('#gs-share-sub', studioEl).textContent = okCount ? `Delivered to ${okCount} ${okCount === 1 ? 'chat' : 'chats'}.` : 'Nothing was sent. Try again.';
    $('#gs-share-body', studioEl).classList.add('is-results');
    $('#gs-recipient-list', studioEl).innerHTML = results.map((r) =>
      `<div class="gs-result ${r.ok ? 'is-ok' : 'is-fail'}"><span class="gs-result-icon" aria-hidden="true">${r.ok ? '✓' : '!'}</span><span class="gs-recipient-text"><b>${esc(r.label)}</b><small>${r.ok ? 'Sent' : esc(r.why || 'Failed')}</small></span></div>`).join('');
    const btn = $('#gs-share-send', studioEl); btn.disabled = false; btn.textContent = 'Done';
    $('#gs-share-count', studioEl).textContent = okCount === results.length ? 'All delivered' : `${okCount} of ${results.length} delivered`;
    if (okCount) toast('Greeting card sent!');
  }

  /* ---------------------------------------------------------------------
     PUBLIC API  (names kept so the side-tab markup in index.html still works)
     --------------------------------------------------------------------- */
  window.toggleGreetingStudioTab = toggleTab;
  window.collapseGreetingStudioTab = collapseTab;
  window.openDiwaliGreetingStudio = openStudio;
  window.closeDiwaliGreetingStudio = closeStudio;
  window.NexoraWisher = { open: openStudio, close: closeStudio, templates: TEMPLATES, getState: () => JSON.parse(JSON.stringify(state)) };
})();
