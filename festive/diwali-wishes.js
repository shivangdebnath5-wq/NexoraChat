/* =========================================================================
   Nexora — 🪔 Diwali Wishes
   -------------------------------------------------------------------------
   A compact festive greeting picker, opened from a 🪔 button in the chat
   composer. Pick a pre-written wish, choose who gets it (a friend's DM or a
   Hub), preview it, send.

   Reuses Nexora's own messaging — nothing new to store or sync:
     - a wish is an ordinary message carrying `extension: { type: 'diwali', … }`
       (exactly like Polls / Notes / Countdowns), so it goes through the same
       DB.saveMessages (DMs) and saveHubs (Hubs) paths that already sync to
       Firestore, shows reactions / replies / popovers, and works for sent
       AND received messages;
     - it is drawn by wrapping extensionHTML(), the hook every other special
       message type already uses, in both Direct Chat and Hubs.
   Nothing else is replaced: the text composer, send button, extension menu,
   emoji picker, editing and every existing message type are untouched.
   ========================================================================= */
(function nexoraDiwaliWishes() {
  'use strict';

  /* ---------- Pre-written wishes ---------- */
  const WISHES = [
    { id: 'classic',   label: 'Classic',       title: 'Happy Diwali!',            text: 'May the festival of lights fill your life with joy, prosperity and endless happiness.' },
    { id: 'sparkle',   label: 'Sparkling',     title: 'Shubh Deepavali',          text: 'Wishing you a Diwali sparkling with love, laughter and golden moments.' },
    { id: 'diya',      label: 'Diya Glow',     title: 'Light Up Your Life',       text: 'May every diya you light bring peace to your heart and success to your path.' },
    { id: 'blessings', label: 'Blessings',     title: 'Shubh Deepavali',          text: 'May Goddess Lakshmi bless you and your family with health, wealth and happiness.' },
    { id: 'heartfelt', label: 'Heartfelt',     title: 'Happy Diwali, friend!',    text: 'Thank you for being one of the brightest lights in my life. Wishing you a Diwali full of warmth and joy!' },
    { id: 'dreams',    label: 'Bright Dreams', title: 'Glow On!',                 text: 'May the glow of Diwali brighten your days and carry you closer to every dream.' },
    { id: 'hindi',     label: 'Shubhkamnayein', title: 'Diwali Mubarak!',         text: 'Aapko aur aapke parivaar ko Diwali ki dher saari shubhkamnayein!' },
    { id: 'hub',       label: 'For the Hub',   title: 'Happy Diwali, everyone!',  text: 'Wishing our whole Hub a bright, joyful and sweet festival of lights. Let’s make it a Diwali to remember!' }
  ];
  const TEXT_MAX = 280, TITLE_MAX = 60;
  const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Dr+Sugiyama&family=Inter:wght@400;500;600&display=swap';
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------- Helpers ---------- */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  const $ = (id) => document.getElementById(id);
  const wishById = (id) => WISHES.find((w) => w.id === id) || null;
  const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Same fonts the Midnight Diwali theme uses (same <link id>, so it is only ever added once).
  function loadFonts() {
    if (!document.head || document.getElementById('nexora-diwali-fonts')) return;
    const l = document.createElement('link');
    l.id = 'nexora-diwali-fonts'; l.rel = 'stylesheet'; l.href = FONT_HREF;
    document.head.appendChild(l);
  }

  /* ---------- The festive bubble (used in chat AND in the preview) ---------- */
  function cardHTML(ext, sender, fresh) {
    const title = esc(clip(ext.title || 'Shubh Deepavali', TITLE_MAX));
    const text = esc(clip(ext.text || '', TEXT_MAX));
    return `<div class="diwali-wish${fresh ? ' diwali-fresh' : ''}" data-wish="${esc(ext.wishId || '')}">
      <span class="dw-wish-glow" aria-hidden="true"></span>
      <span class="dw-wish-spark dw-s1" aria-hidden="true">✦</span><span class="dw-wish-spark dw-s2" aria-hidden="true">✧</span><span class="dw-wish-spark dw-s3" aria-hidden="true">✦</span>
      <div class="dw-wish-head"><span aria-hidden="true">🪔</span><span class="dw-wish-title">${title}</span><span aria-hidden="true">🪔</span></div>
      <div class="dw-wish-text">${text}</div>
      <div class="dw-wish-foot">With love, <b>@${esc(sender || '')}</b></div>
    </div>`;
  }

  // The golden shimmer plays once, the first time a freshly sent wish is drawn — not on every re-render.
  const animated = new Set();
  function chatCardHTML(m) {
    const fresh = !animated.has(m.id) && Math.abs(Date.now() - Number(m.id)) < 4000;
    if (fresh) animated.add(m.id);
    loadFonts();
    return cardHTML(m.extension, m.sender, fresh);
  }

  // Hook into the existing special-message renderer (the same one Polls, Notes, Games… use).
  (function wrapExtensionHTML() {
    if (typeof extensionHTML !== 'function') return;
    const base = extensionHTML;
    extensionHTML = function (m) {
      if (m && m.extension && m.extension.type === 'diwali') return chatCardHTML(m);
      return base.apply(this, arguments);
    };
  })();

  /* ---------- Recipients (friend DMs + the Hubs you are in) ---------- */
  function myHubs() {
    let hubs = [];
    try { hubs = typeof getHubs === 'function' ? getHubs() : []; } catch (e) { hubs = []; }
    return hubs.filter((h) => h && Array.isArray(h.members) && h.members.includes(currentUser));
  }
  const hubLocked = (h) => !!(h.permissions && h.permissions.messaging === 'owner' && h.owner !== currentUser);
  function friendList() {
    const list = Array.isArray(window.firestoreFriendUsernames) ? window.firestoreFriendUsernames.slice() : [];
    if (typeof activeFriend !== 'undefined' && activeFriend && !list.includes(activeFriend)) list.unshift(activeFriend);
    return list.filter((f, i) => f && f !== currentUser && list.indexOf(f) === i);
  }
  function parseRecipient(value) {
    const i = String(value || '').indexOf(':');
    if (i < 0) return null;
    return { kind: value.slice(0, i), id: value.slice(i + 1) };
  }

  /* ---------- Delivery: the same message objects and save paths Nexora already uses ---------- */
  function check(r) {
    if (!r) return { ok: false, message: 'Choose who to send this to.' };
    if (r.kind === 'hub') {
      const hub = myHubs().find((h) => String(h.id) === r.id);
      if (!hub) return { ok: false, message: 'You can only send to Hubs you are a member of.' };
      if (hubLocked(hub)) return { ok: false, message: 'Only the Hub owner can send messages in this Hub.' };
      return { ok: true, label: hub.name || 'this Hub', hub };
    }
    if (r.kind === 'dm') {
      if (!friendList().includes(r.id)) return { ok: false, message: 'You can only send wishes to your friends.' };
      return { ok: true, label: '@' + r.id };
    }
    return { ok: false, message: 'Choose who to send this to.' };
  }

  function deliver(r, wish) {
    const c = check(r);
    if (!c.ok) return c;
    const extension = { type: 'diwali', wishId: wish.id, title: wish.title, text: wish.text };
    if (r.kind === 'hub') {
      const hubs = getHubs(), hub = hubs.find((h) => String(h.id) === r.id);
      if (!hub) return { ok: false, message: 'That Hub is no longer available.' };
      hub.messages = hub.messages || [];
      hub.messages.push({ id: Date.now(), sender: currentUser, text: '', attachment: null, timestamp: nowTime(), extension });
      saveHubs(hubs);
      if (typeof activeHub !== 'undefined' && String(activeHub) === r.id && typeof renderHubMessages === 'function') renderHubMessages(true);
    } else {
      const messages = DB.getMessages();
      messages.push({ id: Date.now(), sender: currentUser, receiver: r.id, text: '', attachment: null, reactions: {}, timestamp: nowTime(), extension });
      DB.saveMessages(messages);
      if (typeof activeHub !== 'undefined' && !activeHub && typeof activeFriend !== 'undefined' && activeFriend === r.id && typeof renderMessages === 'function') renderMessages(true);
    }
    return { ok: true, label: c.label };
  }

  /* ---------- The picker ---------- */
  let panel = null, btn = null, selected = WISHES[0].id, sending = false, closeTimer = 0;

  function recipientOptions() {
    const friends = friendList(), hubs = myHubs();
    let html = '';
    if (friends.length) html += `<optgroup label="Direct messages">${friends.map((f) => `<option value="dm:${esc(f)}">@${esc(f)}</option>`).join('')}</optgroup>`;
    if (hubs.length) html += `<optgroup label="Hubs">${hubs.map((h) => `<option value="hub:${esc(h.id)}"${hubLocked(h) ? ' disabled' : ''}>${esc(h.name || 'Untitled Hub')}${hubLocked(h) ? ' (owner only)' : ''}</option>`).join('')}</optgroup>`;
    return html;
  }
  function defaultRecipient() {
    if (typeof activeHub !== 'undefined' && activeHub) { const h = myHubs().find((x) => String(x.id) === String(activeHub)); if (h && !hubLocked(h)) return 'hub:' + h.id; }
    if (typeof activeFriend !== 'undefined' && activeFriend) return 'dm:' + activeFriend;
    return '';
  }

  function buildPanel() {
    const host = $('chat-input-container');
    if (!host) return null;
    const el = document.createElement('div');
    el.id = 'diwali-wish-panel';
    el.className = 'dw-panel hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Diwali Wishes');
    el.innerHTML = `
      <div class="dw-panel-head"><span class="dw-panel-title"><span aria-hidden="true">🪔</span> Diwali Wishes</span><button type="button" class="dw-close" id="dw-close" aria-label="Close Diwali Wishes">×</button></div>
      <div class="dw-label" id="dw-chips-label">Choose a greeting</div>
      <div class="dw-chips" id="dw-chips" role="radiogroup" aria-labelledby="dw-chips-label">${WISHES.map((w) => `<button type="button" class="dw-chip" role="radio" data-wish="${w.id}" aria-checked="false">${esc(w.label)}</button>`).join('')}</div>
      <label class="dw-label" for="dw-recipient">Send to</label>
      <select id="dw-recipient" class="dw-select"></select>
      <div class="dw-label">Preview</div>
      <div class="dw-preview" id="dw-preview" aria-live="polite"></div>
      <div class="dw-status" id="dw-status" role="status" aria-live="polite"></div>
      <button type="button" class="dw-send" id="dw-send">Send wishes <span aria-hidden="true">🪔</span></button>`;
    host.appendChild(el);
    el.addEventListener('click', onPanelClick);
    el.addEventListener('keydown', onPanelKey);
    $('dw-recipient').addEventListener('change', () => setStatus(''));
    return el;
  }

  function setStatus(text, kind) {
    const s = $('dw-status'); if (!s) return;
    s.textContent = text || '';
    s.className = 'dw-status' + (text ? ' show' : '') + (kind ? ' ' + kind : '');
  }

  function paintPreview() {
    const w = wishById(selected) || WISHES[0];
    $('dw-preview').innerHTML = cardHTML({ wishId: w.id, title: w.title, text: w.text }, currentUser, false);
    panel.querySelectorAll('.dw-chip').forEach((c) => {
      const on = c.getAttribute('data-wish') === selected;
      c.classList.toggle('selected', on); c.setAttribute('aria-checked', String(on)); c.tabIndex = on ? 0 : -1;
    });
  }

  function openPicker() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    if (!panel) panel = buildPanel();
    if (!panel) return;
    loadFonts();
    // one floating tray at a time
    ['emoji-picker', 'extension-menu'].forEach((id) => { const el = $(id); if (el) el.classList.add('hidden'); });
    clearTimeout(closeTimer); sending = false;
    const sel = $('dw-recipient'), prev = sel.value;
    sel.innerHTML = recipientOptions();
    const want = defaultRecipient() || prev;
    if (want && Array.from(sel.options).some((o) => o.value === want && !o.disabled)) sel.value = want;
    const none = !sel.options.length;
    $('dw-send').disabled = none;
    setStatus(none ? 'Add a friend or join a Hub to send Diwali wishes.' : '', none ? 'warn' : '');
    paintPreview();
    panel.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    const chip = panel.querySelector('.dw-chip.selected'); if (chip) chip.focus({ preventScroll: true });
  }
  function closePicker(returnFocus, force) {
    if (sending && !force) return;                 // let a send in progress finish its animation and delivery
    if (!panel || panel.classList.contains('hidden')) { sending = false; return; }
    clearTimeout(closeTimer); sending = false;
    panel.classList.add('hidden');
    const send = $('dw-send'); if (send) { send.disabled = false; send.classList.remove('sending'); }
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (returnFocus && btn) btn.focus({ preventScroll: true });
  }

  function onPanelClick(e) {
    const t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.id === 'dw-close') { closePicker(true); return; }
    if (t.classList.contains('dw-chip')) { selected = t.getAttribute('data-wish'); setStatus(''); paintPreview(); return; }
    if (t.id === 'dw-send') sendSelected();
  }
  function onPanelKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); closePicker(true); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target.classList && e.target.classList.contains('dw-chip')) {   // radiogroup arrows
      const chips = Array.from(panel.querySelectorAll('.dw-chip'));
      const i = chips.indexOf(e.target), n = chips[(i + (e.key === 'ArrowRight' ? 1 : chips.length - 1)) % chips.length];
      selected = n.getAttribute('data-wish'); paintPreview(); n.focus(); e.preventDefault();
    }
  }

  /* ---------- Send, with the golden shimmer ---------- */
  function burst(fromEl) {
    if (reduceMq.matches || !fromEl) return;
    const box = panel.getBoundingClientRect(), r = fromEl.getBoundingClientRect();
    const cx = r.left - box.left + r.width / 2, cy = r.top - box.top + r.height / 2;
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('i');
      p.className = 'dw-burst';
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.5, d = 38 + Math.random() * 46;
      p.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 14}px;animation-delay:${Math.random() * 90}ms`;
      panel.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  function sendSelected() {
    if (sending) return;
    const wish = wishById(selected), r = parseRecipient($('dw-recipient').value);
    const c = check(r);
    if (!wish || !c.ok) { setStatus((c && c.message) || 'Choose a greeting and a recipient.', 'warn'); return; }
    sending = true;
    const send = $('dw-send'); send.disabled = true; send.classList.add('sending');
    const pv = $('dw-preview').firstElementChild;
    if (pv && !reduceMq.matches) { pv.classList.remove('diwali-fresh'); void pv.offsetWidth; pv.classList.add('diwali-fresh'); }   // shimmer sweeps the preview
    burst(send);
    closeTimer = setTimeout(() => {
      const res = deliver(r, wish);
      if (!res.ok) { sending = false; send.disabled = false; send.classList.remove('sending'); setStatus(res.message, 'warn'); return; }
      setStatus(`Sent to ${res.label} 🪔`, 'ok');
      closeTimer = setTimeout(() => closePicker(false, true), reduceMq.matches ? 200 : 650);   // the new bubble shimmers in as the tray closes
    }, reduceMq.matches ? 0 : 520);
  }

  /* ---------- Composer shortcut + wiring ---------- */
  function ensureButton() {
    if ($('diwali-wish-btn')) { btn = $('diwali-wish-btn'); return; }
    const row = document.querySelector('#chat-input-container .input-row');
    if (!row) return;
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'diwali-wish-btn'; btn.className = 'icon-btn diwali-wish-btn';
    btn.title = 'Diwali Wishes'; btn.setAttribute('aria-label', 'Diwali Wishes'); btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '🪔';
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (panel && !panel.classList.contains('hidden')) closePicker(false); else openPicker(); });
    const plus = row.querySelector('button[onclick="toggleExtensionMenu()"]');
    if (plus) plus.insertAdjacentElement('afterend', btn); else row.insertBefore(btn, row.firstChild);
  }

  function wrap(name, before) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { if (before) { try { before(); } catch (err) { console.error(err); } } return orig.apply(this, arguments); };
  }

  ensureButton();
  // Tap anywhere outside the tray to dismiss it (the 🪔 button and the tray itself are exempt).
  document.addEventListener('click', (e) => {
    if (!panel || panel.classList.contains('hidden')) return;
    if (e.target.closest && (e.target.closest('#diwali-wish-panel') || e.target.closest('#diwali-wish-btn'))) return;
    closePicker(false);
  });
  const dismiss = () => closePicker(false);
  wrap('selectFriend', dismiss); wrap('selectHub', dismiss); wrap('goHome', dismiss); wrap('logout', dismiss);
  wrap('toggleEmojiPicker', dismiss); wrap('toggleExtensionMenu', dismiss);

  window.NexoraDiwaliWishes = { open: openPicker, close: () => closePicker(false), wishes: WISHES };
})();
