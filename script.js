/* =========================================================================
   hub-decors.js — Nexora Hub Decor Editor  (everything lives in this one file, styles included)
   -------------------------------------------------------------------------
   A small glowing hammer button in the HUB header (top-right) switches that Hub from Chat Mode to an
   editing-only workspace: messages are hidden (never deleted) and chatting is disabled until you press
   "Return to Chat". A side panel offers: Backgrounds · Banners · Ambient Effects · Patterns ·
   Seasonal Decors (Diyas, Hanging Diyas, Garlands, Lanterns, Bells & Chimes, Rangoli — images in /decor).

   PLACEMENT RULES (each decoration type has its own highlighted zone):
     • Garlands, Hanging Diyas, Lanterns, Bells  → hang from the top rail, directly under the header
     • Diyas                                     → sit on the floor, near the bottom
     • Rangoli                                   → need open space (no overlap with other decor)
   Items are clamped into their zone while you drag, so invalid spots can't be reached; overlaps that
   would break the "open area" rule bounce back.  Selected items can be moved, resized, rotated, deleted.

   HUBS ONLY: decorations exist on a Hub (hub.decor) and render only while a Hub is open — never in DMs,
   the home screen or the main workspace.  Editing = Nexora's existing hubCanManage() permission.
   Reuses Nexora globals: activeHub, hubById, getHubs, saveHubs, hubCanManage, selectHub, selectFriend,
   goHome, sendMessage, renderHubMessages, openHubSettings.
   ========================================================================= */
(function () {
  'use strict';
  if (window.NexoraHubDecors) return;

  /* ---------------------------------------------------------------------
     1. CATALOG
     --------------------------------------------------------------------- */
  const ASSET_ROOT = 'decor/';
  const SPRITES = {
    "diyas/clay-diya-1": {
     "name": "Clay Diya",
     "w": 80,
     "h": 73
    },
    "diyas/clay-diya-2": {
     "name": "Clay Diya II",
     "w": 80,
     "h": 77
    },
    "diyas/clay-diya-3": {
     "name": "Clay Diya III",
     "w": 81,
     "h": 74
    },
    "diyas/golden-diya": {
     "name": "Golden Diya",
     "w": 82,
     "h": 74
    },
    "diyas/jade-diya": {
     "name": "Jade Diya",
     "w": 87,
     "h": 78
    },
    "diyas/violet-diya": {
     "name": "Violet Diya",
     "w": 88,
     "h": 78
    },
    "diyas/ember-diya": {
     "name": "Ember Diya",
     "w": 85,
     "h": 76
    },
    "diyas/amethyst-diya": {
     "name": "Amethyst Diya",
     "w": 86,
     "h": 72
    },
    "diyas/marigold-diya": {
     "name": "Marigold Diya",
     "w": 89,
     "h": 68
    },
    "diyas/diya-rangoli-mat": {
     "name": "Diya on Rangoli Mat",
     "w": 109,
     "h": 79
    },
    "diyas/diya-lotus-rangoli": {
     "name": "Diya on Lotus Rangoli",
     "w": 93,
     "h": 79
    },
    "hanging-diyas/hanging-diya-1": {
     "name": "Hanging Diya 1",
     "w": 41,
     "h": 95
    },
    "hanging-diyas/hanging-diya-2": {
     "name": "Hanging Diya 2",
     "w": 42,
     "h": 126
    },
    "hanging-diyas/hanging-diya-3": {
     "name": "Hanging Diya 3",
     "w": 41,
     "h": 97
    },
    "hanging-diyas/hanging-diya-4": {
     "name": "Hanging Diya 4",
     "w": 48,
     "h": 127
    },
    "hanging-diyas/hanging-diya-5": {
     "name": "Hanging Diya 5",
     "w": 57,
     "h": 87
    },
    "hanging-diyas/hanging-diya-6": {
     "name": "Hanging Diya 6",
     "w": 43,
     "h": 128
    },
    "hanging-diyas/hanging-diya-7": {
     "name": "Hanging Diya 7",
     "w": 44,
     "h": 89
    },
    "hanging-diyas/hanging-diya-8": {
     "name": "Hanging Diya 8",
     "w": 44,
     "h": 111
    },
    "hanging-diyas/hanging-diya-9": {
     "name": "Hanging Diya 9",
     "w": 47,
     "h": 141
    },
    "hanging-diyas/hanging-diya-10": {
     "name": "Hanging Diya 10",
     "w": 43,
     "h": 111
    },
    "hanging-diyas/diya-chain-twin-1": {
     "name": "Twin Diya Chain",
     "w": 45,
     "h": 136
    },
    "hanging-diyas/diya-chain-twin-2": {
     "name": "Twin Diya Chain II",
     "w": 44,
     "h": 136
    },
    "hanging-diyas/diya-chain-four": {
     "name": "Four-Diya Chain",
     "w": 48,
     "h": 212
    },
    "garlands/marigold-toran-1": {
     "name": "Marigold Toran 1",
     "w": 95,
     "h": 128
    },
    "garlands/marigold-toran-2": {
     "name": "Marigold Toran 2",
     "w": 108,
     "h": 101
    },
    "garlands/marigold-toran-3": {
     "name": "Marigold Toran 3",
     "w": 111,
     "h": 104
    },
    "garlands/marigold-toran-4": {
     "name": "Marigold Toran 4",
     "w": 107,
     "h": 103
    },
    "garlands/marigold-toran-5": {
     "name": "Marigold Toran 5",
     "w": 111,
     "h": 109
    },
    "garlands/marigold-toran-6": {
     "name": "Marigold Toran 6",
     "w": 102,
     "h": 96
    },
    "lanterns/lantern-trio": {
     "name": "Lantern Trio",
     "w": 98,
     "h": 149
    },
    "lanterns/glow-orb": {
     "name": "Glow Orb",
     "w": 38,
     "h": 86
    },
    "lanterns/glow-orb-small": {
     "name": "Glow Orb Small",
     "w": 43,
     "h": 138
    },
    "lanterns/glow-drop": {
     "name": "Glow Drop",
     "w": 30,
     "h": 98
    },
    "bells/bell-flower": {
     "name": "Bell & Flower",
     "w": 28,
     "h": 88
    },
    "bells/bell-chimes-trio": {
     "name": "Bell Chimes Trio",
     "w": 75,
     "h": 128
    },
    "bells/pink-diya-bell": {
     "name": "Pink Diya Bell",
     "w": 34,
     "h": 130
    },
    "bells/rainbow-diya-bells": {
     "name": "Rainbow Diya Bells",
     "w": 35,
     "h": 184
    },
    "bells/blue-diya-bell": {
     "name": "Blue Diya Bell",
     "w": 35,
     "h": 133
    },
    "rangoli/grand-mandala": {
     "name": "Grand Mandala",
     "w": 273,
     "h": 279
    },
    "rangoli/lotus-rangoli": {
     "name": "Lotus Rangoli",
     "w": 85,
     "h": 96
    },
    "rangoli/red-flower-rangoli": {
     "name": "Red Flower Rangoli",
     "w": 95,
     "h": 95
    },
    "rangoli/mandala-rangoli": {
     "name": "Mandala Rangoli",
     "w": 103,
     "h": 100
    },
    "patterns/pink-mandala": {
     "name": "Pink Mandala",
     "w": 109,
     "h": 109
    },
    "patterns/magenta-bloom": {
     "name": "Magenta Bloom",
     "w": 109,
     "h": 110
    },
    "patterns/teal-mandala": {
     "name": "Teal Mandala",
     "w": 109,
     "h": 110
    }
  };                 // id -> { name, w, h }  (the /decor folder)
  const SEASONAL = [                                    // [folder, label, icon, zone hint]
    ['diyas', 'Diyas', '🪔', 'Sit on the floor'], ['hanging-diyas', 'Hanging Diyas', '🪔', 'Hang from the top'],
    ['garlands', 'Garlands', '🌼', 'Hang from the top'], ['lanterns', 'Lanterns', '🏮', 'Hang from the top'],
    ['bells', 'Bells & Chimes', '🔔', 'Hang from the top'], ['rangoli', 'Rangoli', '🌸', 'Need open space']
  ];
  const BACKGROUNDS = [
    { id: 'none', name: 'Default', css: '' },
    { id: 'midnight-indigo', name: 'Midnight Indigo', css: 'linear-gradient(160deg,#1B2048 0%,#0B0F26 100%)' },
    { id: 'diwali-gold', name: 'Diwali Gold', css: 'radial-gradient(900px 560px at 15% 105%,rgba(214,168,75,.34),transparent 62%),radial-gradient(700px 480px at 90% -5%,rgba(245,217,138,.16),transparent 60%),linear-gradient(170deg,#12163A,#090D20)' },
    { id: 'royal-magenta', name: 'Royal Magenta', css: 'radial-gradient(800px 520px at 80% 0%,rgba(232,95,199,.28),transparent 60%),linear-gradient(155deg,#3b0d3e,#170626)' },
    { id: 'emerald-night', name: 'Emerald Night', css: 'radial-gradient(800px 520px at 10% 100%,rgba(52,211,153,.2),transparent 60%),linear-gradient(160deg,#0f4636,#061914)' },
    { id: 'marigold-dusk', name: 'Marigold Dusk', css: 'radial-gradient(900px 560px at 50% 110%,rgba(255,159,28,.38),transparent 62%),linear-gradient(170deg,#4a151b,#1f0812)' },
    { id: 'rangoli-warm', name: 'Rangoli Warm', css: 'radial-gradient(700px 500px at 20% 20%,rgba(255,92,138,.26),transparent 60%),radial-gradient(700px 500px at 85% 90%,rgba(255,170,60,.26),transparent 60%),linear-gradient(160deg,#2a0f2e,#150a1c)' },
    { id: 'deep-space', name: 'Deep Space', css: 'radial-gradient(700px 480px at 70% 20%,rgba(120,90,255,.24),transparent 60%),linear-gradient(180deg,#0a0b1e,#020309)' }
  ];
  const BANNERS = [
    { id: 'none', name: 'None' },
    { id: 'marigold-toran', name: 'Marigold Toran', sprites: ['garlands/marigold-toran-2', 'garlands/marigold-toran-3', 'garlands/marigold-toran-4', 'garlands/marigold-toran-5'], scale: 1 },
    { id: 'diya-line', name: 'Hanging Diyas', sprites: ['hanging-diyas/hanging-diya-1', 'hanging-diyas/hanging-diya-4', 'hanging-diyas/hanging-diya-3', 'hanging-diyas/hanging-diya-2', 'hanging-diyas/hanging-diya-6'], scale: 1.1 },
    { id: 'lantern-row', name: 'Lantern Row', sprites: ['lanterns/lantern-trio', 'lanterns/glow-orb', 'lanterns/glow-drop', 'lanterns/glow-orb-small'], scale: 1 },
    { id: 'bell-chimes', name: 'Bell Chimes', sprites: ['bells/bell-chimes-trio', 'bells/rainbow-diya-bells', 'bells/pink-diya-bell', 'bells/blue-diya-bell', 'bells/bell-flower'], scale: 1.05 },
    { id: 'festive-mix', name: 'Festive Mix', sprites: ['garlands/marigold-toran-1', 'lanterns/glow-orb-small', 'hanging-diyas/diya-chain-twin-1', 'bells/bell-flower', 'lanterns/glow-drop', 'hanging-diyas/hanging-diya-5'], scale: 1 }
  ];
  const AMBIENT = [
    { id: 'embers', name: 'Floating Embers', icon: '✨', hint: 'Warm sparks drift upward' },
    { id: 'sparkle', name: 'Golden Shimmer', icon: '🌟', hint: 'Twinkling gold stars' },
    { id: 'glow', name: 'Warm Glow', icon: '🔆', hint: 'Soft breathing light' },
    { id: 'fireflies', name: 'Fireflies', icon: '🪲', hint: 'Slow wandering lights' },
    { id: 'candle', name: 'Candlelight', icon: '🕯️', hint: 'Flickering glow from below' }
  ];
  const PATTERNS = [
    { id: 'none', name: 'None' },
    { id: 'spr:patterns/pink-mandala', name: 'Pink Mandala', sprite: 'patterns/pink-mandala', size: 110 },
    { id: 'spr:patterns/magenta-bloom', name: 'Magenta Bloom', sprite: 'patterns/magenta-bloom', size: 110 },
    { id: 'spr:patterns/teal-mandala', name: 'Teal Mandala', sprite: 'patterns/teal-mandala', size: 110 },
    { id: 'css:dots', name: 'Gold Dots', css: 'radial-gradient(circle,#F5D98A 1.4px,transparent 1.8px)', size: 26 },
    { id: 'css:diamonds', name: 'Diamonds', css: 'linear-gradient(45deg,#F5D98A 25%,transparent 25%,transparent 75%,#F5D98A 75%),linear-gradient(45deg,#F5D98A 25%,transparent 25%,transparent 75%,#F5D98A 75%)', size: 36, pos: '0 0,18px 18px' },
    { id: 'css:stars', name: 'Starfield', css: 'radial-gradient(circle at 20% 30%,#fff 1px,transparent 1.5px),radial-gradient(circle at 70% 70%,#F5D98A 1.2px,transparent 1.7px),radial-gradient(circle at 45% 85%,#fff 0.8px,transparent 1.3px)', size: 90 }
  ];
  const DEFAULT_PATTERN_OPACITY = 22;

  /* ---------------------------------------------------------------------
     2. PLACEMENT ZONES + GEOMETRY (all maths in stage pixels, so rotation/size are honoured)
     --------------------------------------------------------------------- */
  const KIND = (id) => /^(garlands|hanging-diyas|lanterns|bells)\//.test(id) ? 'hang' : id.startsWith('diyas/') ? 'floor' : 'open';
  const ANCHOR = { hang: 0, floor: 1, open: 0.5 };                 // where on the sprite it is pinned: top / bottom / centre
  const ZONES = {
    hang: { label: 'Hang from the top rail', short: 'Hangs from the top' },
    floor: { label: 'Floor — place diyas here', short: 'Sits on the floor' },
    open: { label: 'Open area — keep this clear of other decor', short: 'Needs open space' }
  };
  const LAYOUT = { rail: 44, floorTop: 0.78, openTop: 0.17, openBottom: 0.78, openSide: 0.03 };   // fractions of the stage
  const ROT_LIMIT = { hang: 40, floor: 30, open: 180 };
  const SCALE_MIN = 0.4, SCALE_MAX = 3.2, MAX_ITEMS = 40;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const g = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const uOf = (w) => clamp((w || 900) / 900, 0.55, 1.2);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const spriteUrl = (id) => ASSET_ROOT + id + '.png';
  const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const emptyDecor = () => ({ v: 2, background: 'none', pattern: null, banner: 'none', ambient: [], items: [] });
  const num = (v, fb) => (v == null || v === '' || !isFinite(+v) ? fb : +v);                // keeps a legitimate 0 (hanging items sit at y = 0)
  const cleanItem = (i) => ({ uid: typeof i.uid === 'string' && i.uid ? i.uid : uid(), id: i.id, x: clamp(num(i.x, 50), 0, 100), y: clamp(num(i.y, 50), 0, 100), s: clamp(num(i.s, 1) || 1, SCALE_MIN, SCALE_MAX), rot: num(i.rot, 0), flip: !!i.flip });
  const normDecor = (d) => {
    const base = emptyDecor(); if (!d || typeof d !== 'object') return base;
    return Object.assign(base, d, { items: (Array.isArray(d.items) ? d.items : []).filter((i) => i && SPRITES[i.id]).map(cleanItem), ambient: Array.isArray(d.ambient) ? d.ambient : [] });
  };

  // size/position of an item as a rotated rectangle pinned at its anchor
  function geom(it, W, H, u) {
    const sp = SPRITES[it.id], kind = KIND(it.id), ay = ANCHOR[kind];
    const w = sp.w * it.s * u, h = sp.h * it.s * u, ax = it.x / 100 * W, py = it.y / 100 * H;
    const r = (it.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const rot = (px, pyy) => [ax + px * c - pyy * s, py + px * s + pyy * c];
    const pts = [rot(-w / 2, -ay * h), rot(w / 2, -ay * h), rot(w / 2, (1 - ay) * h), rot(-w / 2, (1 - ay) * h)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { w, h, ax, ay: py, kind, c, s, rot, pts, box: { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) } };
  }
  const overlap = (a, b, m) => a.l < b.r - m && a.r > b.l + m && a.t < b.b - m && a.b > b.t + m;
  const overlapArea = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

  // pull an item into its zone (null when it simply can't fit at this size)
  function constrain(it, W, H, u) {
    const kind = KIND(it.id), probe = geom(Object.assign({}, it, { x: 50, y: 50 }), W, H, u);
    const offL = probe.ax - probe.box.l, offR = probe.box.r - probe.ax, offT = probe.ay - probe.box.t, offB = probe.box.b - probe.ay;
    let minX = offL, maxX = W - offR, minY, maxY;
    if (kind === 'open') { minX = Math.max(minX, W * LAYOUT.openSide + offL); maxX = Math.min(maxX, W * (1 - LAYOUT.openSide) - offR); }
    if (kind === 'hang') { minY = maxY = offT; if (offT + offB > H * LAYOUT.floorTop) return null; }
    else if (kind === 'floor') { minY = Math.max(H * LAYOUT.floorTop, offT); maxY = H - offB; }
    else { minY = H * LAYOUT.openTop + offT; maxY = H * LAYOUT.openBottom - offB; }
    if (minX > maxX || minY > maxY) return null;
    const out = Object.assign({}, it);
    out.x = +(clamp(it.x / 100 * W, minX, maxX) / W * 100).toFixed(3);
    out.y = +(kind === 'hang' ? minY / H * 100 : clamp(it.y / 100 * H, minY, maxY) / H * 100).toFixed(3);
    return out;
  }
  // is this placement allowed? (zone rules were applied by constrain(); this adds the "open space" rule)
  function check(it, others, W, H, u) {
    const gm = geom(it, W, H, u), b = gm.box, eps = 1.5;
    if (b.l < -eps || b.r > W + eps || b.t < -eps || b.b > H + eps) return { ok: false, reason: 'Keep it inside the Hub' };
    if (gm.kind === 'hang' && (b.t > eps + 0.5 || b.b > H * LAYOUT.floorTop + eps)) return { ok: false, reason: 'Too long to hang — make it smaller' };
    if (gm.kind === 'floor' && gm.ay < H * LAYOUT.floorTop - eps) return { ok: false, reason: 'Diyas sit near the bottom' };
    if (gm.kind === 'open' && (b.l < W * LAYOUT.openSide - eps || b.r > W * (1 - LAYOUT.openSide) + eps || b.t < H * LAYOUT.openTop - eps || b.b > H * LAYOUT.openBottom + eps)) return { ok: false, reason: 'Rangolis belong in the open area' };
    for (const o of others) {
      if (o.uid === it.uid) continue;
      const ok = KIND(o.id), og = geom(o, W, H, u).box;
      if ((gm.kind === 'open' || ok === 'open') && overlap(b, og, 2)) return { ok: false, reason: 'Needs open space — it overlaps other decor' };
    }
    return { ok: true };
  }
  // best free spot for a new item (null when the zone is full)
  function findSpot(proto, items, W, H, u) {
    const kind = KIND(proto.id), cands = [];
    if (kind === 'open') { for (let y = 26; y <= 70; y += 11) for (let x = 14; x <= 86; x += 13) cands.push([x, y]); }
    else { for (let x = 8; x <= 92; x += 11) cands.push([x, kind === 'hang' ? 0 : 96]); }
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
    let best = null, bestScore = Infinity;
    for (const [x, y] of cands) {
      const it = constrain(Object.assign({}, proto, { x, y }), W, H, u); if (!it) continue;
      if (!check(it, items, W, H, u).ok) continue;
      const b = geom(it, W, H, u).box; let score = 0;
      items.forEach((o) => { if (KIND(o.id) === kind) score += overlapArea(b, geom(o, W, H, u).box); });
      if (score < bestScore) { best = it; bestScore = score; if (!score) break; }
    }
    return best;
  }

  /* ---------------------------------------------------------------------
     3. DATA ACCESS (hub.decor is stored on the Hub like its other appearance fields)
     --------------------------------------------------------------------- */
  const mainChat = () => $('.main-chat');
  // Only touches a class when its state actually changes. classList.add/remove rewrite the attribute even when nothing
  // changes, and a MutationObserver is watching .main-chat's class — an unconditional write there loops forever.
  const setCls = (el, name, on) => { if (el && el.classList.contains(name) !== !!on) el.classList.toggle(name, !!on); };
  const hubId = () => g(() => activeHub, null);
  const inHub = () => { const mc = mainChat(); return hubId() != null && !!mc && mc.classList.contains('hub-active'); };   // Hubs only
  const currentHub = () => (inHub() ? g(() => hubById(hubId()), null) : null);
  const canEdit = (hub) => !!hub && g(() => hubCanManage(hub), false);
  const isOwner = (hub) => !!hub && hub.owner === g(() => currentUser, null);

  let editorOn = false, editHubId = null, work = emptyDecor(), selected = null, saveTimer = null, clearArmed = null;
  let chatScene = null, editScene = null, editorEl = null, layerEl = null, noteTimer = null;

  function persist() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!editorOn || editHubId == null) return;                         // only an open editing session may write, and only to its own Hub
    const id = editHubId;
    g(() => { const hubs = getHubs(); const hub = hubs.find((h) => h.id === id); if (!hub) return; hub.decor = clone(work); saveHubs(hubs); });
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 350); }

  /* ---------------------------------------------------------------------
     4. SCENE — draws a decor (background, pattern, ambient FX, banner, items) into any container.
        Chat Mode: a read-only layer behind the messages. Editor Mode: the interactive stage with
        highlighted zones, drag / resize / rotate / delete handles and placement effects.
     --------------------------------------------------------------------- */
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  class Scene {
    constructor(el, opts) {
      opts = opts || {};
      this.el = el; this.editable = !!opts.editable; this.onChange = opts.onChange; this.onSelect = opts.onSelect; this.onLive = opts.onLive; this.onDelete = opts.onDelete; this.onNote = opts.onNote;
      this.decor = emptyDecor(); this.sel = null; this.fxKey = ''; this.op = null; this.raf = 0; this.zoneTimer = null;
      el.classList.add('hd-scene'); el.classList.toggle('is-editable', this.editable);
      el.innerHTML = '<div class="hd-bg"></div><div class="hd-pattern"></div><div class="hd-fx"></div><div class="hd-banner"></div><div class="hd-items"></div>' +
        (this.editable ? `<div class="hd-zones" data-show=""><div class="hd-zone hd-zone-hang"><span>${ZONES.hang.label}</span></div><div class="hd-zone hd-zone-floor"><span>${ZONES.floor.label}</span></div><div class="hd-zone hd-zone-open"><span>${ZONES.open.label}</span></div></div><div class="hd-ui"></div>` : '');
      this.bg = $('.hd-bg', el); this.pat = $('.hd-pattern', el); this.fx = $('.hd-fx', el); this.banner = $('.hd-banner', el); this.items = $('.hd-items', el);
      this.zones = $('.hd-zones', el); this.ui = $('.hd-ui', el);
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
      if (this.editable) this.bindPointer();
      this.resize(true);
    }
    destroy() { cancelAnimationFrame(this.raf); clearTimeout(this.zoneTimer); this.ro.disconnect(); this.el.innerHTML = ''; this.el.classList.remove('hd-scene', 'is-editable'); }
    size() { const W = this.el.clientWidth || 900, H = this.el.clientHeight || 600; return { W, H, u: uOf(W) }; }
    set(decor, sel) { this.decor = decor; if (sel !== undefined) this.sel = sel; this.render(); }
    resize(skip) { this.el.style.setProperty('--u', uOf(this.el.clientWidth).toFixed(3)); if (!skip) { this.renderBanner(); this.renderItems(); } }
    render() { this.renderBg(); this.renderPattern(); this.renderFx(); this.renderBanner(); this.renderItems(); }
    renderBg() { const b = BACKGROUNDS.find((x) => x.id === this.decor.background); this.bg.style.background = b && b.css ? b.css : ''; this.bg.hidden = !(b && b.css); }
    renderPattern() {
      const p = this.decor.pattern, def = p && PATTERNS.find((x) => x.id === p.id);
      if (!def || def.id === 'none') { this.pat.style.cssText = ''; this.pat.hidden = true; return; }
      this.pat.hidden = false;
      const op = clamp((p.opacity == null ? DEFAULT_PATTERN_OPACITY : p.opacity) / 100, 0, 1);
      if (def.sprite) this.pat.style.cssText = `background-image:url(${spriteUrl(def.sprite)});background-size:calc(var(--u)*${def.size}px);background-repeat:repeat;opacity:${op}`;
      else this.pat.style.cssText = `background-image:${def.css};background-size:${def.size}px ${def.size}px;${def.pos ? `background-position:${def.pos};` : ''}background-repeat:repeat;opacity:${op}`;
    }
    renderFx() {
      const list = (this.decor.ambient || []).filter((id) => AMBIENT.some((a) => a.id === id)), key = list.join(',');
      if (key === this.fxKey) return; this.fxKey = key;
      const small = (this.el.clientWidth || 900) < 640, still = reduceMotion(); let h = '';
      list.forEach((id) => {
        if (id === 'glow') h += '<i class="hd-fx-glow a"></i><i class="hd-fx-glow b"></i>';
        else if (id === 'candle') h += '<i class="hd-fx-candle"></i>';
        else if (still) return;
        else if (id === 'embers') { const n = small ? 12 : 20; for (let i = 0; i < n; i++) { const d = rnd(7, 14); h += `<i class="hd-ember" style="left:${rnd(2, 98).toFixed(1)}%;--s:${rnd(2, 4).toFixed(1)}px;--d:${d.toFixed(1)}s;--dl:-${rnd(0, d).toFixed(1)}s;--dx:${rnd(-40, 40).toFixed(0)}px"></i>`; } }
        else if (id === 'sparkle') { const n = small ? 14 : 24; for (let i = 0; i < n; i++) h += `<i class="hd-star" style="left:${rnd(2, 98).toFixed(1)}%;top:${rnd(3, 96).toFixed(1)}%;--s:${rnd(2, 4).toFixed(1)}px;--d:${rnd(2.2, 5).toFixed(1)}s;--dl:-${rnd(0, 5).toFixed(1)}s"></i>`; }
        else if (id === 'fireflies') { const n = small ? 7 : 12; for (let i = 0; i < n; i++) { const d = rnd(9, 18); h += `<i class="hd-firefly" style="left:${rnd(5, 95).toFixed(1)}%;top:${rnd(10, 92).toFixed(1)}%;--d:${d.toFixed(1)}s;--dl:-${rnd(0, d).toFixed(1)}s;--x:${rnd(-60, 60).toFixed(0)}px;--y:${rnd(-50, 50).toFixed(0)}px"></i>`; } }
      });
      this.fx.innerHTML = h;
    }
    renderBanner() {
      const def = BANNERS.find((b) => b.id === this.decor.banner);
      if (!def || !def.sprites) { this.banner.innerHTML = ''; this.banner.dataset.id = ''; return; }
      const { W, u } = this.size(); const avg = def.sprites.reduce((s, id) => s + (SPRITES[id] ? SPRITES[id].w : 100), 0) / def.sprites.length;
      const n = Math.max(3, Math.ceil(W / (avg * def.scale * u * 1.15))), sig = def.id + ':' + n; if (this.banner.dataset.id === sig) return; this.banner.dataset.id = sig;
      let h = '';
      for (let i = 0; i < n; i++) { const id = def.sprites[i % def.sprites.length]; if (!SPRITES[id]) continue; h += `<img src="${spriteUrl(id)}" alt="" draggable="false" style="width:calc(var(--u)*${(SPRITES[id].w * def.scale).toFixed(1)}px);--sd:${rnd(3.6, 6.4).toFixed(1)}s;--sl:-${rnd(0, 5).toFixed(1)}s">`; }
      this.banner.innerHTML = h;
    }

    /* ---- items ---- */
    nodeStyle(it) {
      const sp = SPRITES[it.id], k = KIND(it.id), a = ANCHOR[k] * 100;
      return `left:${it.x}%;top:${it.y}%;width:calc(var(--u)*${(sp.w * it.s).toFixed(2)}px);transform:translate(-50%,-${a}%)`;
    }
    renderItems() {
      const frag = document.createDocumentFragment();
      this.decor.items.forEach((it, i) => {
        const sp = SPRITES[it.id]; if (!sp) return; const k = KIND(it.id), a = ANCHOR[k] * 100;
        const d = document.createElement('div');
        d.className = `hd-item hd-k-${k}` + (/^(diyas|hanging-diyas|lanterns|bells)\//.test(it.id) ? ' hd-glowy' : '') + (this.sel === it.uid ? ' is-selected' : '');
        d.dataset.uid = it.uid; d.style.cssText = this.nodeStyle(it) + `;z-index:${i + 1}`;
        d.innerHTML = `<div class="hd-rot" style="transform:rotate(${it.rot || 0}deg);transform-origin:50% ${a}%"><div class="hd-sway" style="--sd:${(4 + (i % 4) * 0.7).toFixed(1)}s"><img src="${spriteUrl(it.id)}" alt="${esc(sp.name)}" draggable="false"${it.flip ? ' style="transform:scaleX(-1)"' : ''}></div></div>`;
        frag.appendChild(d);
      });
      this.items.innerHTML = ''; this.items.appendChild(frag); this.updateUI(); this.syncZone();
    }
    node(it) { return $(`.hd-item[data-uid="${it.uid}"]`, this.items); }
    applyNode(it) {
      const n = this.node(it); if (!n) return; const k = KIND(it.id), a = ANCHOR[k] * 100;
      n.style.left = it.x + '%'; n.style.top = it.y + '%'; n.style.width = `calc(var(--u)*${(SPRITES[it.id].w * it.s).toFixed(2)}px)`;
      const r = $('.hd-rot', n); r.style.transform = `rotate(${it.rot || 0}deg)`; r.style.transformOrigin = `50% ${a}%`;
      const img = $('img', n); if (img) img.style.transform = it.flip ? 'scaleX(-1)' : '';
      this.updateUI();
    }
    selItem() { return this.decor.items.find((i) => i.uid === this.sel) || null; }
    select(id) {
      this.sel = id; $$('.hd-item', this.items).forEach((n) => n.classList.toggle('is-selected', n.dataset.uid === id));
      this.updateUI(); this.syncZone(); if (this.onSelect) this.onSelect(id);
    }

    /* ---- zones ---- */
    showZone(kind, bad) { if (!this.zones) return; this.zones.dataset.show = kind || ''; this.zones.classList.toggle('is-bad', !!bad); }
    flashZone(kind, ms) { if (!this.zones) return; clearTimeout(this.zoneTimer); this.showZone(kind); this.zoneTimer = setTimeout(() => this.syncZone(), ms || 1500); }
    syncZone() { if (!this.zones) return; const it = this.selItem(); this.showZone(it ? KIND(it.id) : '', false); }

    /* ---- selection handles (drawn in a UI layer so they never get clipped by the item) ---- */
    updateUI() {
      if (!this.ui) return; const it = this.selItem();
      if (!it || (this.op && this.op.type === 'move')) { this.ui.innerHTML = this.op && this.op.type === 'move' ? '' : ''; return; }
      const { W, H, u } = this.size(), gm = geom(it, W, H, u), k = gm.kind;
      const pin = (px, py) => [clamp(px, 14, W - 14), clamp(py, 14, H - 14)];
      const br = pin(...gm.rot(gm.w / 2 + 4, (1 - ANCHOR[k]) * gm.h + 4));
      const de = pin(...gm.rot(gm.w / 2 + 6, -ANCHOR[k] * gm.h - 6));
      const ro = pin(...(k === 'hang' ? gm.rot(0, (1 - ANCHOR[k]) * gm.h + 30) : gm.rot(0, -ANCHOR[k] * gm.h - 30)));
      this.ui.innerHTML = `<i class="hd-h hd-h-rot" data-h="rot" title="Rotate" style="left:${ro[0]}px;top:${ro[1]}px"></i><i class="hd-h hd-h-size" data-h="size" title="Resize" style="left:${br[0]}px;top:${br[1]}px"></i><i class="hd-h hd-h-del" data-h="del" title="Delete" style="left:${de[0]}px;top:${de[1]}px">×</i>`;
    }

    /* ---- satisfying effects ---- */
    burst(px, py, kind) {
      if (!this.ui || reduceMotion()) return;
      const r = document.createElement('i'); r.className = 'hd-ripple'; r.style.cssText = `left:${px}px;top:${py}px`; this.ui.appendChild(r); setTimeout(() => r.remove(), 750);
      const n = kind === 'poof' ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-.3, .3), d = rnd(22, 46), s = document.createElement('i'); s.className = 'hd-spark' + (kind === 'poof' ? ' poof' : '');
        s.style.cssText = `left:${px}px;top:${py}px;--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px`; this.ui.appendChild(s); setTimeout(() => s.remove(), 700);
      }
    }
    placeFx(it) {
      const { W, H, u } = this.size(), gm = geom(it, W, H, u); const n = this.node(it);
      if (n && !reduceMotion()) { n.classList.remove('hd-pop'); void n.offsetWidth; n.classList.add('hd-pop'); setTimeout(() => n && n.classList.remove('hd-pop'), 600); }
      this.burst(gm.ax, KIND(it.id) === 'hang' ? gm.box.b - 6 : (gm.box.t + gm.box.b) / 2, 'place');
    }
    removeWithFx(it) {
      const { W, H, u } = this.size(), gm = geom(it, W, H, u), n = this.node(it);
      if (this.ui) this.ui.innerHTML = '';
      if (n && !reduceMotion()) n.classList.add('hd-poof');
      this.burst((gm.box.l + gm.box.r) / 2, (gm.box.t + gm.box.b) / 2, 'poof');
      setTimeout(() => this.onDelete && this.onDelete(it.uid), reduceMotion() ? 0 : 190);
    }

    /* ---- pointer interactions: move · resize · rotate · delete ---- */
    pt(e) { const r = this.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    bindPointer() {
      this.el.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button > 0) return;
        const h = e.target.closest('.hd-h'), node = e.target.closest('.hd-item'), { W, H, u } = this.size();
        if (h) {
          const it = this.selItem(); if (!it) return; const t = h.dataset.h;
          if (t === 'del') { e.preventDefault(); return this.removeWithFx(it); }
          const gm = geom(it, W, H, u), [px, py] = this.pt(e);
          this.op = { type: t, it, last: { x: it.x, y: it.y, s: it.s, rot: it.rot }, s0: it.s, d0: Math.max(8, Math.hypot(px - gm.ax, py - gm.ay)), moved: false };
          this.el.setPointerCapture(e.pointerId); this.el.classList.add('is-operating'); e.preventDefault(); return;
        }
        if (!node) { if (this.sel) this.select(null); return; }
        const it = this.decor.items.find((x) => x.uid === node.dataset.uid); if (!it) return;
        this.select(it.uid); const gm = geom(it, W, H, u), [px, py] = this.pt(e);
        this.op = { type: 'move', it, node, dx: px - gm.ax, dy: py - gm.ay, last: { x: it.x, y: it.y }, moved: false, bad: '' };
        node.classList.add('is-dragging'); this.el.setPointerCapture(e.pointerId); this.el.classList.add('is-operating'); this.ui.innerHTML = ''; this.flashZone(KIND(it.id), 99999); e.preventDefault();
      });
      this.el.addEventListener('pointermove', (e) => { if (!this.op) return; this.pending = e; if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; if (this.pending) this.step(this.pending); }); });
      const end = () => this.finish();
      this.el.addEventListener('pointerup', end); this.el.addEventListener('pointercancel', end);
    }
    others(it) { return this.decor.items.filter((x) => x.uid !== it.uid); }
    step(e) {
      const op = this.op; if (!op) return; const it = op.it, { W, H, u } = this.size(), [px, py] = this.pt(e);
      if (op.type === 'move') {
        const n = constrain(Object.assign({}, it, { x: (px - op.dx) / W * 100, y: (py - op.dy) / H * 100 }), W, H, u); if (!n) return;
        const res = check(n, this.others(it), W, H, u); it.x = n.x; it.y = n.y; op.moved = true; this.applyNode(it);
        op.node.classList.toggle('is-invalid', !res.ok); this.showZone(KIND(it.id), !res.ok); op.bad = res.ok ? '' : res.reason; if (res.ok) op.last = { x: it.x, y: it.y };
      } else if (op.type === 'size') {
        const gm = geom(it, W, H, u), d = Math.hypot(px - gm.ax, py - gm.ay);
        const cand = Object.assign({}, it, { s: +clamp(op.s0 * d / op.d0, SCALE_MIN, SCALE_MAX).toFixed(3) }), n = constrain(cand, W, H, u);
        if (n && check(n, this.others(it), W, H, u).ok) { it.s = n.s; it.x = n.x; it.y = n.y; op.last = { x: it.x, y: it.y, s: it.s, rot: it.rot }; op.moved = true; this.applyNode(it); if (this.onLive) this.onLive(); }
        else if (this.onNote) this.onNote('No room to grow here', true);
      } else if (op.type === 'rot') {
        const gm = geom(it, W, H, u); let ang = Math.atan2(py - gm.ay, px - gm.ax) * 180 / Math.PI + (gm.kind === 'hang' ? -90 : 90);
        ang = ((ang + 540) % 360) - 180; if (e.shiftKey || Math.abs(ang) < 4) ang = e.shiftKey ? Math.round(ang / 15) * 15 : 0;
        const lim = ROT_LIMIT[gm.kind]; ang = clamp(ang, -lim, lim);
        const cand = Object.assign({}, it, { rot: +ang.toFixed(1) }), n = constrain(cand, W, H, u);
        if (n && check(n, this.others(it), W, H, u).ok) { it.rot = n.rot; it.x = n.x; it.y = n.y; op.last = { x: it.x, y: it.y, s: it.s, rot: it.rot }; op.moved = true; this.applyNode(it); if (this.onLive) this.onLive(); }
        else if (this.onNote) this.onNote('Can’t rotate further here', true);
      }
    }
    finish() {
      if (!this.op) return;
      if (this.pending) { cancelAnimationFrame(this.raf); this.raf = 0; this.step(this.pending); }     // apply the final pointer position before closing
      const op = this.op; this.op = null; this.pending = null; cancelAnimationFrame(this.raf); this.raf = 0;
      this.el.classList.remove('is-operating'); const it = op.it;
      if (op.type === 'move') {
        op.node.classList.remove('is-dragging', 'is-invalid');
        if (op.bad) {                                          // invalid drop → glide back to the last valid spot
          it.x = op.last.x; it.y = op.last.y; op.node.classList.add('hd-bounce'); this.applyNode(it);
          setTimeout(() => op.node.classList.remove('hd-bounce'), 380); if (this.onNote) this.onNote(op.bad, true); this.shake(op.node);
        } else if (op.moved) this.placeFx(it);
        this.syncZone();
      } else if (op.type !== 'del') { this.syncZone(); }
      this.updateUI(); if (op.moved || op.bad) { if (this.onChange) this.onChange(); }
    }
    shake(n) { if (reduceMotion() || !n) return; n.classList.remove('hd-shake'); void n.offsetWidth; n.classList.add('hd-shake'); setTimeout(() => n.classList.remove('hd-shake'), 420); }
  }

  /* ---------------------------------------------------------------------
     5. CHAT MODE — read-only decor behind the messages (Hubs only)
     --------------------------------------------------------------------- */
  function ensureLayer() {
    const mc = mainChat(); if (!mc) return null;
    if (!layerEl) { layerEl = document.createElement('div'); layerEl.id = 'hub-decor-layer'; layerEl.setAttribute('aria-hidden', 'true'); }
    if (layerEl.parentNode !== mc) mc.insertBefore(layerEl, mc.firstChild);
    return layerEl;
  }
  let listRO = null;                                                  // keeps the layer glued to the message list (reply bar, search panel, typing status… all change its height)
  function watchList() {
    const list = $('#messages-list'); if (!window.ResizeObserver || !list) return;
    if (!listRO) listRO = new ResizeObserver(() => { if (layerEl && chatScene) positionLayer(); });
    listRO.disconnect(); listRO.observe(list);
  }
  function positionLayer() {
    const list = $('#messages-list'); if (!layerEl || !list) return;
    layerEl.style.top = list.offsetTop + 'px'; layerEl.style.height = list.offsetHeight + 'px'; layerEl.style.bottom = 'auto';
  }
  const hasDecor = (d) => !!d && (d.background !== 'none' || d.pattern || d.banner !== 'none' || (d.ambient && d.ambient.length) || (d.items && d.items.length));
  function applyChatDecor() {
    const hub = currentHub(), mc = mainChat();
    if (!hub || !mc) return hideChatDecor();                          // not inside a Hub → nothing is drawn
    const decor = normDecor(hub.decor); if (!hasDecor(decor)) return hideChatDecor();
    const el = ensureLayer(); if (!el) return;
    if (!chatScene) chatScene = new Scene(el, { editable: false });
    setCls(mc, 'hub-decor-on', true); positionLayer(); watchList(); chatScene.fxKey = '\0'; chatScene.set(decor);
  }
  function hideChatDecor() {
    setCls(mainChat(), 'hub-decor-on', false);
    if (chatScene) { chatScene.destroy(); chatScene = null; }
    if (listRO) listRO.disconnect();
    if (layerEl && layerEl.parentNode) layerEl.remove();              // nothing of the decor system stays in the DOM outside a Hub
  }
  window.addEventListener('resize', () => { if (layerEl && chatScene) positionLayer(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (layerEl && chatScene) positionLayer(); }).observe(document.documentElement);

  /* ---------------------------------------------------------------------
     6. EDITOR MODE — hammer button, workspace, side panel, settings
     --------------------------------------------------------------------- */
  const HAMMER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.2 4.2l5.6 5.6-2.4 2.4-5.6-5.6z" fill="currentColor" fill-opacity=".28"/><path d="M12.9 8.4L5 16.3a1.8 1.8 0 0 0 0 2.5l.2.2a1.8 1.8 0 0 0 2.5 0L15.6 11"/><path d="M16.4 3.1l4.5 4.5"/></svg>';
  const GEAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  const DEFAULT_NOTE = 'Live preview · changes save automatically';

  function ensureHammerButton() {
    if ($('#hub-editor-btn')) return;
    const anchor = $('#hub-search-btn'); if (!anchor) return;
    const b = document.createElement('button');
    b.id = 'hub-editor-btn'; b.type = 'button'; b.className = 'icon-btn hub-editor-btn hidden';
    b.title = 'Hub Editor — decorate this Hub'; b.setAttribute('aria-label', 'Open Hub Editor'); b.innerHTML = HAMMER;
    b.onclick = () => (editorOn ? exitEditor() : enterEditor());
    anchor.parentNode.insertBefore(b, anchor);
  }
  function refreshHammer() {
    ensureHammerButton(); const b = $('#hub-editor-btn'); if (!b) return;
    const hub = currentHub(); b.classList.toggle('hidden', !(hub && canEdit(hub)));      // Hubs only, and only for people who may manage the Hub
    b.classList.toggle('is-active', editorOn);
  }

  const sectionHTML = (id, icon, title, body, open) => `<section class="hd-sec${open ? ' open' : ''}" data-sec="${id}"><button type="button" class="hd-sec-head" data-hd-toggle="${id}" aria-expanded="${!!open}"><span class="hd-sec-icon" aria-hidden="true">${icon}</span><span class="hd-sec-title">${title}</span><span class="hd-sec-badge" data-badge="${id}"></span><span class="hd-chev" aria-hidden="true">›</span></button><div class="hd-sec-body">${body}</div></section>`;
  const tileImg = (id) => `<img src="${spriteUrl(id)}" alt="" loading="lazy" decoding="async" draggable="false">`;
  function panelHTML() {
    const bg = BACKGROUNDS.map((b) => `<button type="button" class="hd-tile hd-swatch" data-hd-bg="${b.id}" title="${esc(b.name)}"><span class="hd-swatch-art" style="${b.css ? `background:${b.css}` : ''}">${b.css ? '' : '<em>Auto</em>'}</span><span class="hd-tile-name">${esc(b.name)}</span><span class="hd-check" aria-hidden="true">✓</span></button>`).join('');
    const banners = BANNERS.map((b) => `<button type="button" class="hd-tile hd-wide" data-hd-banner="${b.id}" title="${esc(b.name)}"><span class="hd-banner-prev">${b.sprites ? b.sprites.slice(0, 4).map(tileImg).join('') : '<em>None</em>'}</span><span class="hd-tile-name">${esc(b.name)}</span><span class="hd-check" aria-hidden="true">✓</span></button>`).join('');
    const amb = AMBIENT.map((a) => `<button type="button" class="hd-toggle" data-hd-ambient="${a.id}" aria-pressed="false"><span class="hd-toggle-icon" aria-hidden="true">${a.icon}</span><span class="hd-toggle-text"><b>${a.name}</b><small>${a.hint}</small></span><span class="hd-switch" aria-hidden="true"></span></button>`).join('');
    const pats = PATTERNS.map((p) => `<button type="button" class="hd-tile hd-swatch" data-hd-pattern="${p.id}" title="${esc(p.name)}"><span class="hd-swatch-art hd-pat-prev" style="${p.sprite ? `background-image:url(${spriteUrl(p.sprite)});background-size:44px` : p.css ? `background-image:${p.css};background-size:${Math.round(p.size / 2.2)}px;${p.pos ? 'background-position:' + p.pos.split(',').map((v) => v.trim().replace(/(\d+)px/g, (m, n) => Math.round(n / 2.2) + 'px')).join(',') : ''}` : ''}">${p.id === 'none' ? '<em>None</em>' : ''}</span><span class="hd-tile-name">${esc(p.name)}</span><span class="hd-check" aria-hidden="true">✓</span></button>`).join('');
    const seasonal = SEASONAL.map(([grp, label, icon, hint]) => {
      const list = Object.keys(SPRITES).filter((id) => id.startsWith(grp + '/'));
      return `<div class="hd-sub"><div class="hd-sub-head"><span aria-hidden="true">${icon}</span>${label}<em class="hd-zonechip">${hint}</em><small>${list.length}</small></div><div class="hd-grid hd-grid-3">${list.map((id) => `<button type="button" class="hd-tile hd-sprite" data-hd-add="${id}" title="Add ${esc(SPRITES[id].name)} — ${ZONES[KIND(id)].short.toLowerCase()}" aria-label="Add ${esc(SPRITES[id].name)}">${tileImg(id)}<span class="hd-plus" aria-hidden="true">+</span></button>`).join('')}</div></div>`;
    }).join('');
    return `<div class="hd-panel-scroll">
      ${sectionHTML('backgrounds', '🎨', 'Backgrounds', `<div class="hd-grid hd-grid-2">${bg}</div><div id="hd-bg-note" class="hd-note hidden"></div>`, false)}
      ${sectionHTML('banners', '🚩', 'Banners', `<div class="hd-grid hd-grid-2">${banners}</div>`, false)}
      ${sectionHTML('ambient', '✨', 'Ambient Effects', `<div class="hd-toggles">${amb}</div>`, false)}
      ${sectionHTML('patterns', '🔷', 'Patterns', `<div class="hd-grid hd-grid-3">${pats}</div><label class="hd-range"><span>Pattern strength <output id="hd-pat-out"></output></span><input type="range" id="hd-pat-range" min="5" max="60" step="1"></label>`, false)}
      ${sectionHTML('seasonal', '🪔', 'Seasonal Decors <small>Diwali</small>', `<p class="hd-hint">Tap a decoration to add it — its <b>placement zone</b> lights up on the stage. Drag to move; use the handles to resize, rotate or delete.</p>${seasonal}`, true)}
    </div>
    <div class="hd-selbar hidden" id="hd-selbar">
      <div class="hd-sel-top"><b id="hd-sel-name">Selected</b><em class="hd-zonechip" id="hd-sel-zone"></em><button type="button" class="hd-mini" data-hd-sel="deselect" aria-label="Deselect">✕</button></div>
      <label class="hd-range"><span>Size <output id="hd-size-out"></output></span><input type="range" id="hd-size-range" min="40" max="320" step="5"></label>
      <label class="hd-range"><span>Rotation <output id="hd-rot-out"></output></span><input type="range" id="hd-rot-range" min="-180" max="180" step="1"></label>
      <div class="hd-sel-actions">
        <button type="button" class="hd-mini" data-hd-sel="front">Bring front</button><button type="button" class="hd-mini" data-hd-sel="back">Send back</button>
        <button type="button" class="hd-mini" data-hd-sel="flip">Flip</button><button type="button" class="hd-mini" data-hd-sel="dup">Duplicate</button>
        <button type="button" class="hd-mini" data-hd-sel="unrot">Reset rotation</button><button type="button" class="hd-mini hd-danger" data-hd-sel="del">Delete</button>
      </div>
    </div>
    <div class="hd-panel-foot"><span id="hd-foot-count">No decorations yet</span><button type="button" class="hd-mini hd-danger" data-hd-act="clear">Clear all decor</button></div>`;
  }
  function editorHTML(hub) {
    return `<div class="hd-topbar">
        <div class="hd-title"><span class="hd-title-icon">${HAMMER}</span><div><strong>Hub Editor</strong><small>Decorating “${esc(hub.name)}” · chat is paused, history is safe</small></div></div>
        <div class="hd-actions">
          <button type="button" class="hd-btn hd-gear" data-hd-act="settings" aria-label="Hub settings and permissions" aria-haspopup="dialog" aria-expanded="false" title="Hub settings & permissions">${GEAR}</button>
          <button type="button" class="hd-btn hd-btn-gold" data-hd-act="exit"><span aria-hidden="true">💬</span> Return to Chat</button>
        </div>
      </div>
      <div class="hd-body">
        <div class="hd-stage" id="hd-stage"><div id="hd-scene"></div><div class="hd-stage-chip" id="hd-stage-chip" role="status" aria-live="polite">${DEFAULT_NOTE}</div></div>
        <aside class="hd-panel" aria-label="Decorations">${panelHTML()}</aside>
        <div class="hd-settings hidden" id="hd-settings" role="dialog" aria-label="Hub settings and permissions"></div>
      </div>`;
  }
  function settingsHTML(hub) {
    const owner = isOwner(hub), p = hub.permissions || {};
    const seg = (key, opts, val) => `<div class="hd-seg" role="group">${opts.map(([v, l]) => `<button type="button" class="${(val || opts[0][0]) === v ? 'active' : ''}" data-hd-perm="${key}" data-val="${v}" ${owner ? '' : 'disabled'}>${l}</button>`).join('')}</div>`;
    return `<div class="hd-settings-head"><strong>Hub settings</strong><button type="button" class="hd-mini" data-hd-act="settings" aria-label="Close settings">✕</button></div>
      <button type="button" class="hd-btn hd-full" data-hd-act="full-settings">Open full Hub settings</button>
      <div class="hd-perm-title">Permissions</div>
      <div class="hd-perm"><span>Who can send messages</span>${seg('messaging', [['everyone', 'Everyone'], ['owner', 'Only owner']], p.messaging)}</div>
      <div class="hd-perm"><span>Who can invite members</span>${seg('invites', [['owner', 'Only owner'], ['members', 'Members']], p.invites)}</div>
      <div class="hd-perm"><span>Who can manage the Hub &amp; its decor</span>${seg('management', [['owner', 'Only owner'], ['members', 'Members']], p.management)}</div>
      ${owner ? '' : '<p class="hd-note">Only the Hub owner can change permissions.</p>'}`;
  }

  function enterEditor() {
    const hub = currentHub(), mc = mainChat();
    if (editorOn || !hub || !mc || !canEdit(hub)) return false;       // Hubs only
    editorOn = true; editHubId = hub.id; work = normDecor(hub.decor); selected = null; hideChatDecor();
    editorEl = document.createElement('div'); editorEl.id = 'hub-editor'; editorEl.setAttribute('role', 'region'); editorEl.setAttribute('aria-label', 'Hub Editor'); editorEl.innerHTML = editorHTML(hub);
    const list = $('#messages-list'); list.parentNode.insertBefore(editorEl, list.nextSibling);
    setCls(mc, 'hub-editor-on', true); setCls(document.body, 'hub-editor-active', true); $('#hub-more-menu')?.classList.add('hidden');
    editScene = new Scene($('#hd-scene', editorEl), {
      editable: true,
      onChange: () => { saveSoon(); syncPanel(); }, onLive: () => syncPanel(),
      onSelect: (u) => { selected = u; syncPanel(); },
      onDelete: (id) => { if (!editorOn || !editScene) return; work.items = work.items.filter((i) => i.uid !== id); if (selected === id) selected = null; editScene.set(work, selected); saveSoon(); syncPanel(); },
      onNote: (t, bad) => flashNote(t, bad)
    });
    bindEditor(); editScene.set(work, null);
    work.items = work.items.map((i) => constrain(i, editScene.size().W, editScene.size().H, editScene.size().u) || i); editScene.set(work, null);   // tidy anything saved on a different screen size
    syncPanel(); refreshHammer(); setTimeout(() => $('.hd-btn-gold', editorEl)?.focus({ preventScroll: true }), 80);
    return true;
  }
  function exitEditor(silent) {
    if (!editorOn) return;
    persist(); editorOn = false; editHubId = null; selected = null; clearTimeout(clearArmed); clearArmed = null; clearTimeout(noteTimer);
    if (editScene) { editScene.destroy(); editScene = null; }
    if (editorEl) { editorEl.remove(); editorEl = null; }
    setCls(mainChat(), 'hub-editor-on', false); setCls(document.body, 'hub-editor-active', false);
    refreshHammer();
    if (!silent) { applyChatDecor(); g(() => renderHubMessages(true)); $('#hub-editor-btn')?.focus({ preventScroll: true }); }
  }

  function flashNote(text, bad) {
    const chip = $('#hd-stage-chip', editorEl); if (!chip) return;
    chip.textContent = text; chip.classList.toggle('is-bad', !!bad); clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { chip.textContent = DEFAULT_NOTE; chip.classList.remove('is-bad'); }, 2200);
  }
  const selItem = () => work.items.find((i) => i.uid === selected) || null;
  function changed() { editScene.set(work); saveSoon(); syncPanel(); }
  function syncPanel() {
    if (!editorEl) return;
    $$('[data-hd-bg]', editorEl).forEach((n) => n.classList.toggle('is-active', n.dataset.hdBg === work.background));
    $$('[data-hd-banner]', editorEl).forEach((n) => n.classList.toggle('is-active', n.dataset.hdBanner === work.banner));
    $$('[data-hd-pattern]', editorEl).forEach((n) => n.classList.toggle('is-active', n.dataset.hdPattern === (work.pattern ? work.pattern.id : 'none')));
    $$('[data-hd-ambient]', editorEl).forEach((n) => { const on = work.ambient.includes(n.dataset.hdAmbient); n.classList.toggle('is-on', on); n.setAttribute('aria-pressed', String(on)); });
    const pr = $('#hd-pat-range', editorEl), po = work.pattern ? work.pattern.opacity : DEFAULT_PATTERN_OPACITY;
    pr.disabled = !work.pattern; pr.value = po; $('#hd-pat-out', editorEl).textContent = po + '%';
    const badge = (id, txt) => { const b = $(`[data-badge="${id}"]`, editorEl); if (b) { b.textContent = txt || ''; b.classList.toggle('on', !!txt); } };
    badge('backgrounds', work.background !== 'none' ? '1' : ''); badge('banners', work.banner !== 'none' ? '1' : '');
    badge('ambient', work.ambient.length ? String(work.ambient.length) : ''); badge('patterns', work.pattern ? '1' : ''); badge('seasonal', work.items.length ? String(work.items.length) : '');
    $('#hd-foot-count', editorEl).textContent = work.items.length ? `${work.items.length} of ${MAX_ITEMS} decorations` : 'No decorations yet';
    const it = selItem(), bar = $('#hd-selbar', editorEl); bar.classList.toggle('hidden', !it);
    if (it) {
      const k = KIND(it.id), lim = ROT_LIMIT[k], rr = $('#hd-rot-range', editorEl);
      $('#hd-sel-name', editorEl).textContent = SPRITES[it.id].name; $('#hd-sel-zone', editorEl).textContent = ZONES[k].short;
      $('#hd-size-range', editorEl).value = Math.round(it.s * 100); $('#hd-size-out', editorEl).textContent = Math.round(it.s * 100) + '%';
      rr.min = -lim; rr.max = lim; rr.value = Math.round(it.rot || 0); $('#hd-rot-out', editorEl).textContent = Math.round(it.rot || 0) + '°';
    }
    const hub = currentHub(), note = $('#hd-bg-note', editorEl);
    if (note) { const custom = hub && hub.background; note.classList.toggle('hidden', !custom); if (custom) note.innerHTML = 'This Hub has a custom chat background image (set in Hub settings) that covers decor backgrounds. <button type="button" class="hd-link" data-hd-act="drop-bg-image">Use decor background instead</button>'; }
  }

  /* ---- adding / editing items (every change goes through the same zone + overlap rules) ---- */
  const defaultScale = (id) => (id.startsWith('rangoli/') ? 1 : id.startsWith('garlands/') ? 1.05 : KIND(id) === 'hang' ? 1.2 : 1.35);
  function addItem(id) {
    const sp = SPRITES[id]; if (!sp || !editScene) return; const kind = KIND(id);
    if (work.items.length >= MAX_ITEMS) return flashNote(`Limit reached — ${MAX_ITEMS} decorations per Hub`, true);
    const { W, H, u } = editScene.size(); let proto = { uid: uid(), id, x: 50, y: 50, s: defaultScale(id), rot: 0, flip: false }, spot = findSpot(proto, work.items, W, H, u);
    if (!spot) { proto.s = Math.max(SCALE_MIN, proto.s * 0.65); spot = findSpot(proto, work.items, W, H, u); }
    if (!spot) { editScene.flashZone(kind, 1800); return flashNote(kind === 'open' ? 'No open space left — remove or shrink something' : 'No room left here — remove something first', true); }
    work.items.push(spot); selected = spot.uid; editScene.set(work, selected); editScene.flashZone(kind, 1500); editScene.placeFx(spot); saveSoon(); syncPanel();
  }
  function applyEdit(it, patch, quiet) {
    const { W, H, u } = editScene.size(), n = constrain(Object.assign({}, it, patch), W, H, u), res = n && check(n, work.items.filter((x) => x.uid !== it.uid), W, H, u);
    if (!n || !res.ok) { if (!quiet) flashNote(res && res.reason ? res.reason : 'No room for that change', true); syncPanel(); return false; }
    Object.assign(it, n); editScene.applyNode(it); saveSoon(); syncPanel(); return true;
  }
  function selAction(a) {
    const i = work.items.findIndex((x) => x.uid === selected); if (a === 'deselect') { editScene.select(null); return; } if (i < 0) return;
    const it = work.items[i];
    if (a === 'del') return editScene.removeWithFx(it);
    if (a === 'front') work.items.push(work.items.splice(i, 1)[0]);
    else if (a === 'back') work.items.unshift(work.items.splice(i, 1)[0]);
    else if (a === 'flip') it.flip = !it.flip;
    else if (a === 'unrot') return void applyEdit(it, { rot: 0 });
    else if (a === 'dup') {
      if (work.items.length >= MAX_ITEMS) return flashNote(`Limit reached — ${MAX_ITEMS} decorations per Hub`, true);
      const { W, H, u } = editScene.size(), spot = findSpot(Object.assign({}, it, { uid: uid() }), work.items, W, H, u);
      if (!spot) return flashNote('No room for another one here', true);
      work.items.push(spot); selected = spot.uid; editScene.set(work, selected); editScene.placeFx(spot); saveSoon(); return syncPanel();
    }
    editScene.set(work, selected); saveSoon(); syncPanel();
  }
  function setPermission(key, val) {
    const hub = currentHub(); if (!hub || !isOwner(hub)) return;
    g(() => { const hubs = getHubs(), h = hubs.find((x) => x.id === hub.id); h.permissions = Object.assign({ messaging: 'everyone', invites: 'owner', activities: true, management: 'owner' }, h.permissions, { [key]: val }); saveHubs(hubs); });
    $('#hd-settings', editorEl).innerHTML = settingsHTML(currentHub());
  }
  function act(a, btn) {
    const hub = currentHub();
    if (a === 'exit') return exitEditor();
    if (a === 'settings') { const box = $('#hd-settings', editorEl), open = box.classList.contains('hidden'); if (open) box.innerHTML = settingsHTML(hub); box.classList.toggle('hidden', !open); $('.hd-gear', editorEl).setAttribute('aria-expanded', String(open)); return; }
    if (a === 'full-settings') return g(() => openHubSettings());
    if (a === 'drop-bg-image') { g(() => { const hubs = getHubs(), h = hubs.find((x) => x.id === hub.id); h.background = ''; saveHubs(hubs); const m = $('#messages-list'); if (m) { m.style.backgroundImage = ''; m.classList.remove('hub-chat-bg'); } }); return syncPanel(); }
    if (a === 'clear') {
      if (clearArmed) { clearTimeout(clearArmed); clearArmed = null; btn.textContent = 'Clear all decor'; work = emptyDecor(); selected = null; editScene.fxKey = '\0'; editScene.set(work, null); saveSoon(); return syncPanel(); }
      btn.textContent = 'Tap again to clear'; clearArmed = setTimeout(() => { clearArmed = null; btn.textContent = 'Clear all decor'; }, 3000);
    }
  }
  function bindEditor() {
    editorEl.addEventListener('click', (e) => {
      const t = e.target; let n;
      if ((n = t.closest('[data-hd-toggle]'))) { const s = n.closest('.hd-sec'), open = !s.classList.contains('open'); s.classList.toggle('open', open); n.setAttribute('aria-expanded', String(open)); return; }
      if ((n = t.closest('[data-hd-bg]'))) { work.background = n.dataset.hdBg; return changed(); }
      if ((n = t.closest('[data-hd-banner]'))) { work.banner = n.dataset.hdBanner; return changed(); }
      if ((n = t.closest('[data-hd-ambient]'))) { const id = n.dataset.hdAmbient; work.ambient = work.ambient.includes(id) ? work.ambient.filter((x) => x !== id) : work.ambient.concat(id); return changed(); }
      if ((n = t.closest('[data-hd-pattern]'))) { const id = n.dataset.hdPattern; work.pattern = id === 'none' ? null : { id, opacity: work.pattern ? work.pattern.opacity : DEFAULT_PATTERN_OPACITY }; return changed(); }
      if ((n = t.closest('[data-hd-add]'))) return addItem(n.dataset.hdAdd);
      if ((n = t.closest('[data-hd-sel]'))) return selAction(n.dataset.hdSel);
      if ((n = t.closest('[data-hd-perm]'))) { if (!n.disabled) setPermission(n.dataset.hdPerm, n.dataset.val); return; }
      if ((n = t.closest('[data-hd-act]'))) return act(n.dataset.hdAct, n);
    });
    // hovering a decoration lights up the zone it can be placed in
    editorEl.addEventListener('mouseover', (e) => { const n = e.target.closest('[data-hd-add]'); if (n && editScene) editScene.showZone(KIND(n.dataset.hdAdd)); });
    editorEl.addEventListener('mouseout', (e) => { if (e.target.closest('[data-hd-add]') && editScene && !editScene.op) editScene.syncZone(); });
    editorEl.addEventListener('input', (e) => {
      const id = e.target.id, it = selItem();
      if (id === 'hd-pat-range' && work.pattern) { work.pattern.opacity = +e.target.value; $('#hd-pat-out', editorEl).textContent = e.target.value + '%'; editScene.renderPattern(); saveSoon(); }
      else if (id === 'hd-size-range' && it) applyEdit(it, { s: +e.target.value / 100 }, true) || flashNote('No room to grow here', true);
      else if (id === 'hd-rot-range' && it) applyEdit(it, { rot: +e.target.value }, true) || flashNote('Can’t rotate further here', true);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (!editorOn) return;
    if ($('.modal:not(.hidden)')) return;                             // a Nexora dialog is open on top: keys belong to it, not to the stage
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') && e.target.type !== 'range', it = selItem();
    if (e.key === 'Escape') { const s = $('#hd-settings', editorEl); if (s && !s.classList.contains('hidden')) { s.classList.add('hidden'); return; } if (selected) return selAction('deselect'); return exitEditor(); }
    if (typing || !it) return;
    const step = e.shiftKey ? 2 : 0.5;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); selAction('del'); }
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); applyEdit(it, { x: it.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), y: it.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0) }, true); }
    else if (e.key === '[' || e.key === ']') applyEdit(it, { rot: (it.rot || 0) + (e.key === ']' ? 5 : -5) }, true);
    else if (e.key === '+' || e.key === '=' || e.key === '-') applyEdit(it, { s: it.s * (e.key === '-' ? 0.95 : 1.05) }, true);
  });

  /* ---------------------------------------------------------------------
     7. HOOKS INTO NEXORA'S EXISTING FLOW (wrap, never replace) + the "Hubs only" guard
     --------------------------------------------------------------------- */
  const _selectHub = selectHub;
  selectHub = function () { if (editorOn) exitEditor(true); const r = _selectHub.apply(this, arguments); ensureHammerButton(); refreshHammer(); applyChatDecor(); return r; };
  const _selectFriend = selectFriend;
  selectFriend = function () { if (editorOn) exitEditor(true); const r = _selectFriend.apply(this, arguments); hideChatDecor(); refreshHammer(); return r; };
  if (typeof goHome === 'function') { const _goHome = goHome; goHome = function () { if (editorOn) exitEditor(true); const r = _goHome.apply(this, arguments); hideChatDecor(); refreshHammer(); return r; }; }
  const _sendMessage = sendMessage;                                   // chatting is disabled while editing
  sendMessage = function () { if (editorOn) return; return _sendMessage.apply(this, arguments); };
  // safety net for any other navigation path (notifications, search, deep links…): leaving a Hub always clears decor
  function enforceHubOnly() { if (!inHub()) { if (editorOn) exitEditor(true); hideChatDecor(); } refreshHammer(); }
  const mcInit = mainChat(); if (mcInit) new MutationObserver(enforceHubOnly).observe(mcInit, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('beforeunload', () => { if (editorOn) persist(); });
  document.addEventListener('DOMContentLoaded', () => { ensureHammerButton(); enforceHubOnly(); }); ensureHammerButton();

  /* ---------------------------------------------------------------------
     8. STYLES (injected so this file is fully self-contained)
     --------------------------------------------------------------------- */
  if (!document.getElementById('hub-decors-css')) {
    const st = document.createElement('style'); st.id = 'hub-decors-css'; st.textContent = `/* =========================================================================
   HUB EDITOR MODE (hub-editor.js) — glowing hammer, editing-only workspace, decoration panel,
   and the decor layer that sits behind messages in Chat Mode. Dark glass, independent of theme.
   ========================================================================= */
/* hammer button (Hub header, top-right) */
.hub-editor-btn { position:relative; color:#F5D98A; box-shadow:0 0 0 1px rgba(214,168,75,.5), 0 0 12px rgba(214,168,75,.45); animation:hdGlow 2.8s ease-in-out infinite; }
.hub-editor-btn svg { display:block; filter:drop-shadow(0 0 3px rgba(245,217,138,.7)); }
.hub-editor-btn.is-active { background:linear-gradient(110deg,#F5D98A,#D6A84B); color:#090D20; }
.hub-editor-btn.is-active svg { filter:none; }
.hub-editor-btn.hidden { display:none; }
@keyframes hdGlow { 0%,100% { box-shadow:0 0 0 1px rgba(214,168,75,.45), 0 0 8px rgba(214,168,75,.3); } 50% { box-shadow:0 0 0 1px rgba(245,217,138,.8), 0 0 18px rgba(245,217,138,.65); } }

/* Chat Mode: decor sits behind the messages */
#hub-decor-layer { position:absolute; left:0; right:0; bottom:0; top:0; z-index:0; pointer-events:none; overflow:hidden; }
.main-chat.hub-decor-on > #messages-list { position:relative; z-index:1; background-color:transparent !important; }
.main-chat.hub-decor-on > #typing-status { position:relative; z-index:1; }

/* scene (shared by Chat Mode layer and the editor stage) */
.hd-scene { position:absolute; inset:0; overflow:hidden; --u:1; }
.hd-scene > * { position:absolute; inset:0; }
.hd-scene [hidden] { display:none; }
.hd-fx, .hd-pattern, .hd-bg { pointer-events:none; }
.hd-fx { overflow:hidden; }
.hd-banner { bottom:auto; display:flex; justify-content:space-evenly; align-items:flex-start; pointer-events:none; }
.hd-banner img { height:auto; max-width:none; transform-origin:50% 0; animation:hdSway var(--sd,5s) ease-in-out var(--sl,0s) infinite alternate; }
.hd-items { pointer-events:none; }
.hd-item { position:absolute; inset:auto; pointer-events:none; line-height:0; border-radius:6px; }
.hd-item img { display:block; width:100%; height:auto; pointer-events:none; user-select:none; -webkit-user-drag:none; }
.hd-hang img { transform-origin:50% 0; animation:hdSway var(--sd,5s) ease-in-out infinite alternate; }
.hd-glowy img { filter:drop-shadow(0 0 8px rgba(255,170,60,.38)); }
.hd-scene.is-editable .hd-item { pointer-events:auto; cursor:grab; touch-action:none; }
.hd-item.is-selected { outline:1.5px dashed #F5D98A; outline-offset:5px; }
.hd-item.is-dragging { cursor:grabbing; }
@keyframes hdSway { from { transform:rotate(-1.5deg); } to { transform:rotate(1.5deg); } }

/* ambient effects */
.hd-ember { position:absolute; bottom:-10px; width:var(--s); height:var(--s); border-radius:50%; background:radial-gradient(circle,#FFE9A8,#FF9A2E 60%,transparent 75%); box-shadow:0 0 6px 1px rgba(255,160,50,.6); opacity:0; animation:hdRise var(--d) linear var(--dl) infinite; }
@keyframes hdRise { 0% { transform:translate3d(0,0,0); opacity:0; } 12% { opacity:.9; } 80% { opacity:.5; } 100% { transform:translate3d(var(--dx),-105vh,0); opacity:0; } }
.hd-star { position:absolute; width:var(--s); height:var(--s); border-radius:50%; background:radial-gradient(circle,#fff 0 40%,#F5D98A 70%,transparent 80%); box-shadow:0 0 6px 1px rgba(245,217,138,.55); animation:hdTwinkle var(--d) ease-in-out var(--dl) infinite alternate; }
@keyframes hdTwinkle { from { opacity:.15; transform:scale(.7); } to { opacity:1; transform:scale(1.2); } }
.hd-firefly { position:absolute; width:5px; height:5px; border-radius:50%; background:#E9FF9A; box-shadow:0 0 10px 3px rgba(210,255,120,.55); animation:hdWander var(--d) ease-in-out var(--dl) infinite alternate, hdTwinkle 2.6s ease-in-out infinite alternate; }
@keyframes hdWander { from { transform:translate(0,0); } to { transform:translate(var(--x),var(--y)); } }
.hd-fx-glow { inset:auto; width:70%; aspect-ratio:1; border-radius:50%; background:radial-gradient(circle,rgba(255,190,90,.3),transparent 65%); animation:hdBreathe 9s ease-in-out infinite; }
.hd-fx-glow.a { left:-20%; bottom:-35%; }
.hd-fx-glow.b { right:-18%; top:-30%; background:radial-gradient(circle,rgba(245,217,138,.22),transparent 65%); animation-delay:-4s; }
@keyframes hdBreathe { 0%,100% { opacity:.55; } 50% { opacity:1; } }
.hd-fx-candle { position:absolute; left:0; right:0; bottom:0; height:55%; background:radial-gradient(ellipse at 50% 110%,rgba(255,150,40,.42),transparent 62%); animation:hdFlicker 2.4s ease-in-out infinite; }
@keyframes hdFlicker { 0%,100% { opacity:.7; } 20% { opacity:1; } 45% { opacity:.62; } 70% { opacity:.95; } }
@media (prefers-reduced-motion: reduce) { .hd-ember, .hd-star, .hd-firefly, .hd-fx-glow, .hd-fx-candle, .hd-banner img, .hd-hang img, .hub-editor-btn { animation:none; } }

/* Editor Mode: messages hidden (never deleted), chatting disabled */
.main-chat.hub-editor-on > #messages-list, .main-chat.hub-editor-on > #chat-input-container, .main-chat.hub-editor-on > #hub-search-panel,
.main-chat.hub-editor-on > #typing-status, .main-chat.hub-editor-on > #jump-to-latest-btn, .main-chat.hub-editor-on > #diwali-strip,
.main-chat.hub-editor-on > #festival-fab, .main-chat.hub-editor-on #hub-search-btn, .main-chat.hub-editor-on #hub-settings-btn,
.main-chat.hub-editor-on #hub-more-menu, body.hub-editor-active .gs-floating-root { display:none !important; }
#hub-editor { display:none; flex:1 1 auto; min-height:0; flex-direction:column; position:relative; z-index:3; color:#EEEAF7; background:#0A0D22; animation:hdFade .3s ease both; }
.main-chat.hub-editor-on > #hub-editor { display:flex; }
#hub-editor, #hub-editor * { font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing:border-box; }
@keyframes hdFade { from { opacity:0; } to { opacity:1; } }
@keyframes hdSlide { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:none; } }
.hd-topbar { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; background:linear-gradient(160deg,rgba(30,34,82,.9),rgba(12,15,38,.94)); border-bottom:1px solid rgba(214,168,75,.3); }
.hd-title { display:flex; align-items:center; gap:11px; min-width:0; }
.hd-title-icon { width:34px; height:34px; flex:0 0 auto; display:grid; place-items:center; border-radius:11px; color:#F5D98A; background:rgba(214,168,75,.14); border:1px solid rgba(214,168,75,.45); box-shadow:0 0 14px rgba(214,168,75,.25); }
.hd-title strong { display:block; font-size:15px; font-weight:700; color:#F5D98A; letter-spacing:.01em; }
.hd-title small { display:block; font-size:11.5px; color:#B3AFCB; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hd-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
#hub-editor .hd-btn { width:auto; min-height:38px; margin:0; padding:8px 14px; display:inline-flex; align-items:center; justify-content:center; gap:7px; border-radius:11px; font-size:13px; font-weight:600; cursor:pointer; color:#EEEAF7; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); transition:transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease; }
#hub-editor .hd-btn:hover { background:rgba(255,255,255,.13); border-color:rgba(214,168,75,.55); transform:translateY(-1px); }
#hub-editor .hd-btn:focus-visible, #hub-editor .hd-mini:focus-visible, #hub-editor .hd-tile:focus-visible, #hub-editor .hd-toggle:focus-visible, #hub-editor .hd-sec-head:focus-visible { outline:2px solid #F5D98A; outline-offset:2px; }
#hub-editor .hd-gear { width:38px; padding:0; }
#hub-editor .hd-btn-gold { color:#090D20; border-color:transparent; background:linear-gradient(110deg,#F5D98A 0%,#D6A84B 55%,#B8862F 100%); box-shadow:0 6px 18px rgba(214,168,75,.35), inset 0 1px 0 rgba(255,255,255,.5); }
#hub-editor .hd-btn-gold:hover { background:linear-gradient(110deg,#F5D98A 0%,#D6A84B 55%,#B8862F 100%); filter:brightness(1.06); box-shadow:0 10px 24px rgba(214,168,75,.5); }
.hd-body { position:relative; flex:1 1 auto; min-height:0; display:flex; }
.hd-stage { position:relative; flex:1 1 auto; min-width:0; overflow:hidden; background:#0D1230; }
.hd-stage-chip { position:absolute; left:12px; bottom:12px; z-index:50; padding:6px 12px; font-size:11.5px; color:#B3AFCB; border-radius:99px; background:rgba(10,13,34,.78); border:1px solid rgba(255,255,255,.12); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); pointer-events:none; }

/* side panel */
.hd-panel { flex:0 0 340px; width:340px; min-height:0; display:flex; flex-direction:column; background:linear-gradient(170deg,rgba(26,30,72,.96),rgba(10,13,32,.98)); border-left:1px solid rgba(214,168,75,.28); animation:hdSlide .35s cubic-bezier(.2,.9,.25,1.04) both; }
.hd-panel-scroll { flex:1 1 auto; min-height:0; overflow-y:auto; padding:12px 12px 8px; scrollbar-width:thin; scrollbar-color:rgba(214,168,75,.35) transparent; }
.hd-sec { margin-bottom:10px; border-radius:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); overflow:hidden; }
#hub-editor .hd-sec-head { width:100%; min-height:0; margin:0; padding:11px 12px; display:flex; align-items:center; gap:10px; text-align:left; cursor:pointer; color:#EEEAF7; background:transparent; border:0; border-radius:0; font-size:13.5px; font-weight:700; }
#hub-editor .hd-sec-head:hover { background:rgba(255,255,255,.05); }
.hd-sec-icon { width:26px; height:26px; display:grid; place-items:center; border-radius:8px; font-size:14px; background:rgba(214,168,75,.14); }
.hd-sec-title { flex:1 1 auto; }
.hd-sec-title small { margin-left:6px; font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#D6A84B; }
.hd-sec-badge { min-width:20px; padding:1px 7px; border-radius:99px; font-size:11px; font-weight:700; text-align:center; color:#090D20; background:#F5D98A; opacity:0; transform:scale(.6); transition:all .2s ease; }
.hd-sec-badge.on { opacity:1; transform:none; }
.hd-chev { font-size:18px; line-height:1; color:#B3AFCB; transition:transform .25s ease; }
.hd-sec.open .hd-chev { transform:rotate(90deg); }
.hd-sec-body { display:none; padding:4px 12px 14px; }
.hd-sec.open .hd-sec-body { display:block; animation:hdFade .25s ease both; }
.hd-hint { margin:0 0 10px; font-size:12px; color:#B3AFCB; }
.hd-note { margin:10px 0 0; padding:9px 11px; font-size:12px; line-height:1.45; color:#E8D9B0; background:rgba(214,168,75,.1); border:1px solid rgba(214,168,75,.3); border-radius:10px; }
.hd-note.hidden { display:none; }
#hub-editor .hd-link { width:auto; min-height:0; margin:4px 0 0; padding:0; display:block; background:none; border:0; color:#F5D98A; font-size:12px; font-weight:700; text-decoration:underline; cursor:pointer; }
.hd-sub { margin-top:12px; }
.hd-sub-head { display:flex; align-items:center; gap:7px; margin-bottom:8px; font-size:11.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#B3AFCB; }
.hd-sub-head small { margin-left:auto; font-weight:600; letter-spacing:0; color:#8F8BAE; }
.hd-grid { display:grid; gap:8px; }
.hd-grid-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
.hd-grid-3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
#hub-editor .hd-tile { position:relative; width:auto; min-height:0; margin:0; padding:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; cursor:pointer; color:#EEEAF7; background:rgba(5,8,24,.55); border:1px solid rgba(255,255,255,.1); border-radius:12px; transition:transform .18s cubic-bezier(.2,.9,.25,1.2), border-color .18s ease, background .18s ease, box-shadow .18s ease; }
#hub-editor .hd-tile:hover { transform:translateY(-2px); background:rgba(5,8,24,.55); border-color:rgba(214,168,75,.65); box-shadow:0 8px 18px rgba(0,0,0,.4); }
#hub-editor .hd-tile.is-active { border-color:#F5D98A; background:rgba(214,168,75,.14); box-shadow:0 0 0 1px rgba(245,217,138,.5), 0 6px 16px rgba(214,168,75,.2); }
.hd-check { position:absolute; top:5px; right:5px; width:18px; height:18px; display:grid; place-items:center; border-radius:50%; font-size:11px; font-weight:800; color:#090D20; background:#F5D98A; transform:scale(0); transition:transform .22s cubic-bezier(.2,.9,.25,1.4); }
.hd-tile.is-active .hd-check { transform:scale(1); }
.hd-tile-name { max-width:100%; font-size:11px; font-weight:600; color:#CFCBE6; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hd-swatch-art { display:grid; place-items:center; width:100%; aspect-ratio:16/10; border-radius:8px; background-color:#1a1f45; background-repeat:repeat; border:1px solid rgba(255,255,255,.1); }
.hd-swatch-art em { font-style:normal; font-size:11px; color:#8F8BAE; }
.hd-banner-prev { display:flex; align-items:flex-start; justify-content:space-evenly; width:100%; height:54px; padding-top:2px; overflow:hidden; border-radius:8px; background:rgba(255,255,255,.04); }
.hd-banner-prev img { height:100%; width:auto; max-width:30%; object-fit:contain; object-position:top; }
.hd-banner-prev em { align-self:center; font-style:normal; font-size:11px; color:#8F8BAE; }
#hub-editor .hd-sprite { aspect-ratio:1; padding:8px; }
.hd-sprite img { max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; pointer-events:none; filter:drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
.hd-plus { position:absolute; right:5px; bottom:4px; width:18px; height:18px; display:grid; place-items:center; border-radius:50%; font-size:13px; font-weight:800; line-height:1; color:#090D20; background:#F5D98A; opacity:0; transform:scale(.6); transition:all .18s ease; }
.hd-sprite:hover .hd-plus, .hd-sprite:focus-visible .hd-plus { opacity:1; transform:none; }
.hd-toggles { display:flex; flex-direction:column; gap:7px; }
#hub-editor .hd-toggle { width:100%; min-height:0; margin:0; padding:9px 11px; display:flex; align-items:center; gap:11px; text-align:left; cursor:pointer; color:#EEEAF7; background:rgba(5,8,24,.55); border:1px solid rgba(255,255,255,.1); border-radius:12px; transition:border-color .18s ease, background .18s ease; }
#hub-editor .hd-toggle:hover { background:rgba(5,8,24,.55); border-color:rgba(214,168,75,.6); }
#hub-editor .hd-toggle.is-on { border-color:rgba(245,217,138,.7); background:rgba(214,168,75,.12); }
.hd-toggle-icon { font-size:18px; }
.hd-toggle-text { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; }
.hd-toggle-text b { font-size:13px; font-weight:600; }
.hd-toggle-text small { font-size:11px; color:#B3AFCB; }
.hd-switch { position:relative; flex:0 0 auto; width:34px; height:20px; border-radius:99px; background:rgba(255,255,255,.18); transition:background .2s ease; }
.hd-switch::after { content:''; position:absolute; left:2px; top:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:transform .2s ease; }
.hd-toggle.is-on .hd-switch { background:#D6A84B; }
.hd-toggle.is-on .hd-switch::after { transform:translateX(14px); background:#090D20; }
.hd-range { display:block; margin-top:12px; }
.hd-range > span { display:flex; justify-content:space-between; margin-bottom:5px; font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#B3AFCB; }
.hd-range output { color:#F5D98A; letter-spacing:0; }
#hub-editor input[type="range"] { width:100%; min-height:0; margin:0; padding:0; accent-color:#D6A84B; background:transparent; border:0; cursor:pointer; }
#hub-editor input[type="range"]:disabled { opacity:.4; cursor:not-allowed; }

/* selected-item bar + footer */
.hd-selbar { flex:0 0 auto; padding:11px 14px 12px; background:rgba(214,168,75,.09); border-top:1px solid rgba(214,168,75,.35); animation:hdFade .2s ease both; }
.hd-selbar.hidden { display:none; }
.hd-sel-top { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:13px; color:#F5D98A; }
.hd-sel-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
#hub-editor .hd-mini { width:auto; min-height:0; margin:0; padding:6px 11px; font-size:12px; font-weight:600; cursor:pointer; color:#EEEAF7; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); border-radius:9px; transition:all .18s ease; }
#hub-editor .hd-mini:hover { background:rgba(255,255,255,.14); border-color:rgba(214,168,75,.55); }
#hub-editor .hd-danger { color:#FF9C8F; border-color:rgba(255,120,100,.4); }
#hub-editor .hd-danger:hover { background:rgba(255,120,100,.14); border-color:rgba(255,120,100,.7); }
.hd-panel-foot { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 14px 12px; font-size:12px; color:#B3AFCB; border-top:1px solid rgba(255,255,255,.08); }

/* settings & permissions popover */
.hd-settings { position:absolute; top:8px; right:8px; z-index:60; width:min(320px, calc(100% - 16px)); max-height:calc(100% - 16px); overflow-y:auto; padding:14px; border-radius:16px; background:linear-gradient(160deg,rgba(34,38,92,.97),rgba(12,15,38,.98)); border:1px solid rgba(214,168,75,.45); box-shadow:0 22px 54px rgba(2,4,14,.7); animation:hdFade .2s ease both; }
.hd-settings.hidden { display:none; }
.hd-settings-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:14px; color:#F5D98A; }
#hub-editor .hd-full { width:100%; }
.hd-perm-title { margin:14px 0 6px; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#D6A84B; }
.hd-perm { margin-bottom:10px; }
.hd-perm > span { display:block; margin-bottom:5px; font-size:12.5px; color:#CFCBE6; }
.hd-seg { display:grid; grid-template-columns:1fr 1fr; gap:3px; padding:3px; border-radius:11px; background:rgba(255,255,255,.06); }
#hub-editor .hd-seg button { width:auto; min-height:0; margin:0; padding:7px 8px; font-size:12px; font-weight:600; cursor:pointer; color:#B3AFCB; background:transparent; border:0; border-radius:8px; }
#hub-editor .hd-seg button.active { color:#F5D98A; background:rgba(214,168,75,.2); }
#hub-editor .hd-seg button:disabled { cursor:not-allowed; opacity:.55; }

/* phones: stage on top, decoration panel below */
@media (max-width: 720px) {
  .hd-topbar { padding:8px 12px; }
  .hd-title small { display:none; }
  #hub-editor .hd-btn-gold { padding:8px 12px; }
  .hd-body { flex-direction:column; }
  .hd-stage { flex:0 0 38%; min-height:150px; }
  .hd-panel { flex:1 1 auto; width:100%; border-left:0; border-top:1px solid rgba(214,168,75,.35); animation:none; }
  .hd-stage-chip { display:none; }
}

/* ===== Hub Decor Editor v2: placement zones, handles, placement effects ===== */
.hd-rot { position:relative; width:100%; }
.hd-sway { width:100%; }
.hd-k-hang .hd-sway { transform-origin:50% 0; animation:hdSway var(--sd,5s) ease-in-out infinite alternate; }
.hd-k-floor .hd-sway { transform-origin:50% 100%; }
.hd-k-open .hd-sway { transform-origin:50% 50%; }
.hd-item { outline:none; }
.hd-item.is-selected .hd-sway, .hd-item.is-dragging .hd-sway { animation:none; }
.hd-item.is-selected .hd-rot::after { content:''; position:absolute; inset:-5px; border:1.5px dashed #F5D98A; border-radius:6px; pointer-events:none; box-shadow:0 0 12px rgba(245,217,138,.35); }
.hd-item.is-dragging { cursor:grabbing; z-index:999 !important; }
.hd-item.is-dragging img { filter:drop-shadow(0 12px 14px rgba(0,0,0,.55)); }
.hd-item.is-invalid .hd-rot::after { border-color:#FF6B5E; box-shadow:0 0 16px rgba(255,107,94,.6); }
.hd-item.is-invalid img { filter:saturate(.55) drop-shadow(0 0 9px rgba(255,80,70,.75)); }
.hd-scene.is-operating { cursor:grabbing; user-select:none; }
.hd-bounce { transition:left .36s cubic-bezier(.2,1.25,.3,1), top .36s cubic-bezier(.2,1.25,.3,1); }
.hd-pop .hd-sway { animation:hdPop .52s cubic-bezier(.2,1.3,.3,1); }
.hd-poof .hd-sway { animation:hdPoof .19s ease-in forwards; }
.hd-shake .hd-sway { animation:hdShake .4s ease; }
@keyframes hdPop { 0% { transform:scale(.35); opacity:0; } 55% { transform:scale(1.14); opacity:1; } 100% { transform:scale(1); } }
@keyframes hdPoof { to { transform:scale(.3) rotate(10deg); opacity:0; } }
@keyframes hdShake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-7px); } 40% { transform:translateX(6px); } 60% { transform:translateX(-4px); } 80% { transform:translateX(3px); } }

/* placement zones */
.hd-zones { pointer-events:none; z-index:40; }
.hd-zone { position:absolute; display:flex; opacity:0; border:2px dashed rgba(245,217,138,.9); background:linear-gradient(180deg,rgba(245,217,138,.14),rgba(245,217,138,.05)); transition:opacity .28s ease, border-color .2s ease, background .2s ease; }
.hd-zone span { padding:3px 11px; font-size:11px; font-weight:600; color:#F5D98A; border-radius:99px; background:rgba(9,13,32,.78); border:1px solid rgba(245,217,138,.45); white-space:nowrap; }
.hd-zone-hang { left:0; right:0; top:0; height:44px; justify-content:center; align-items:flex-start; padding-top:6px; border-top:0; border-radius:0 0 14px 14px; }
.hd-zone-floor { left:0; right:0; top:78%; bottom:0; justify-content:center; align-items:flex-end; padding-bottom:7px; border-bottom:0; border-radius:14px 14px 0 0; }
.hd-zone-open { left:3%; right:3%; top:17%; bottom:22%; justify-content:center; align-items:flex-start; padding-top:7px; border-radius:16px; }
.hd-zones[data-show="hang"] .hd-zone-hang, .hd-zones[data-show="floor"] .hd-zone-floor, .hd-zones[data-show="open"] .hd-zone-open { opacity:1; animation:hdZone 1.9s ease-in-out infinite; }
.hd-zones.is-bad .hd-zone { border-color:#FF6B5E; background:linear-gradient(180deg,rgba(255,90,80,.2),rgba(255,90,80,.06)); animation:none; }
.hd-zones.is-bad .hd-zone span { color:#FFB4A8; border-color:rgba(255,107,94,.6); }
@keyframes hdZone { 0%,100% { box-shadow:inset 0 0 0 rgba(245,217,138,0); } 50% { box-shadow:inset 0 0 26px rgba(245,217,138,.28); } }

/* selection handles */
.hd-ui { pointer-events:none; z-index:70; overflow:visible; }
.hd-h { position:absolute; width:24px; height:24px; margin:-12px 0 0 -12px; display:grid; place-items:center; pointer-events:auto; touch-action:none; cursor:pointer; border-radius:50%; font:700 15px/1 Inter, sans-serif; font-style:normal; color:#F5D98A; background:#0B0F26 center/14px no-repeat; border:2px solid #F5D98A; box-shadow:0 3px 10px rgba(0,0,0,.55), 0 0 0 4px rgba(245,217,138,.16); transition:transform .15s ease, box-shadow .15s ease; }
.hd-h:hover { transform:scale(1.2); box-shadow:0 3px 12px rgba(0,0,0,.6), 0 0 0 6px rgba(245,217,138,.25); }
.hd-h-rot { cursor:grab; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F5D98A' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.6-5.9'/%3E%3Cpath d='M20 4v5h-5'/%3E%3C/svg%3E"); }
.hd-h-size { cursor:nwse-resize; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F5D98A' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7'/%3E%3C/svg%3E"); }
.hd-h-del { color:#FF9C8F; border-color:#FF9C8F; font-size:17px; box-shadow:0 3px 10px rgba(0,0,0,.55), 0 0 0 4px rgba(255,120,100,.16); }
.hd-h-del:hover { background-color:#3a1612; }

/* placement effects */
.hd-ripple { position:absolute; width:14px; height:14px; margin:-7px 0 0 -7px; border-radius:50%; border:2px solid #F5D98A; pointer-events:none; animation:hdRipple .72s ease-out forwards; }
@keyframes hdRipple { from { transform:scale(.4); opacity:.95; } to { transform:scale(7.5); opacity:0; } }
.hd-spark { position:absolute; width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; pointer-events:none; background:radial-gradient(circle,#fff,#F5D98A 60%,transparent 75%); box-shadow:0 0 7px #F5D98A; animation:hdSpark .66s ease-out forwards; }
.hd-spark.poof { background:radial-gradient(circle,#fff,#FF9A5E 60%,transparent 75%); box-shadow:0 0 7px #FF9A5E; }
@keyframes hdSpark { from { transform:translate(0,0) scale(1); opacity:1; } to { transform:translate(var(--dx),var(--dy)) scale(.2); opacity:0; } }
.hd-stage-chip { max-width:calc(100% - 24px); transition:color .2s ease, border-color .2s ease; }
.hd-stage-chip.is-bad { color:#FFB4A8; border-color:rgba(255,107,94,.65); }
#hub-editor .hd-zonechip { margin-left:auto; padding:1px 8px; font-style:normal; font-size:10px; font-weight:600; letter-spacing:.02em; text-transform:none; color:#F5D98A; border:1px solid rgba(245,217,138,.4); border-radius:99px; white-space:nowrap; }
.hd-sub-head .hd-zonechip + small { margin-left:8px; }
.hd-sel-top .hd-zonechip { margin-left:8px; margin-right:auto; }
@media (prefers-reduced-motion: reduce) { .hd-zone, .hd-k-hang .hd-sway, .hd-pop .hd-sway, .hd-shake .hd-sway, .hd-ripple, .hd-spark { animation:none !important; } .hd-bounce { transition:none; } }
`; (document.head || document.documentElement).appendChild(st);
  }

  window.NexoraHubDecors = { enter: enterEditor, exit: exitEditor, isOn: () => editorOn, kindOf: KIND, catalog: { SPRITES, BACKGROUNDS, BANNERS, AMBIENT, PATTERNS } };
})();
