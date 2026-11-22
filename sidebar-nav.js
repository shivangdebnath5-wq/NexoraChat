/* =========================================================================
   sidebar-nav.js — Nexora sidebar redesign: slim icon rail + wider contextual panel
   -------------------------------------------------------------------------
   Reorganises the EXISTING sidebar; nothing is rebuilt or duplicated:
     • the same elements (avatar + status menu, Add Friend, Requests, Conversations, Hubs, settings gear) are
       moved into the new layout, so every id, onclick, status flow and renderSidebar() wrapper keeps working;
     • navigation uses the app's own routes: goHome(), selectFriend(), selectHub(), openSavedMessages(),
       openHubCreator(), openSettings().
   Layout
     RAIL   Home · Messages · Hubs · Requests · Saved Messages  …  Create Hub (+)  ·  your avatar (bottom)
     PANEL  title + count, search, then the pane for the chosen section
            (Messages = conversations · Hubs = your hubs + Explore Hubs · Requests = friend requests)
   Notifications and Settings are intentionally NOT in the rail (settings stays in the panel header).
   Styles are injected by this file. Mobile: the rail + panel slide in together via the existing hamburger.
   ========================================================================= */
(function () {
  'use strict';
  if (window.NexoraSidebarNav) return;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const g = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>'),
    messages: svg('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.7-.8L3 20.5l1.5-4.6A8.4 8.4 0 1 1 21 11.5Z"/>'),
    hubs: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    requests: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M19 8v6M16 11h6"/>'),
    saved: svg('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1Z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/>'),
    back: svg('<path d="m15 18-6-6 6-6"/>'),
    compass: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>'),
    advent: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9.5H20"/><path d="M8 3.5V6.5M16 3.5V6.5" stroke-linecap="round"/><circle cx="9" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="17.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none"/>')
  };
  const NAV = [
    { id: 'home', label: 'Home', icon: ICON.home },
    { id: 'messages', label: 'Messages', icon: ICON.messages },
    { id: 'hubs', label: 'Hubs', icon: ICON.hubs },
    { id: 'requests', label: 'Requests', icon: ICON.requests },
    { id: 'saved', label: 'Saved Messages', icon: ICON.saved }
  ];
  const PANES = { messages: 'Messages', hubs: 'Hubs', requests: 'Requests' };

  const state = { active: 'home', pane: 'messages', query: '', explore: false };
  let built = false, sidebar = null;

  /* ---------------------------------------------------------------------
     1. BUILD — move the existing nodes into rail + panel (idempotent)
     --------------------------------------------------------------------- */
  function build() {
    sidebar = $('.sidebar'); if (!sidebar || built || sidebar.classList.contains('sb-modern')) { built = !!sidebar; return; }
    const header = $('.sidebar-header', sidebar), avatar = header && $('.avatar-container', header);
    const statusMenu = $('#status-menu', sidebar), quickPop = $('#quick-status-popover', sidebar);
    const addFriend = $('#add-friend-toggle', sidebar) && $('#add-friend-toggle', sidebar).closest('.section');
    const requests = $('#requests-section', sidebar), friends = $('.friends-section', sidebar);
    if (!header || !avatar || !requests || !friends) return;           // unknown layout: leave the sidebar exactly as it was

    const rail = document.createElement('nav'); rail.className = 'sb-rail'; rail.setAttribute('aria-label', 'Main navigation');
    rail.innerHTML = `<div class="sb-rail-top">${NAV.map((n) => `<button type="button" class="sb-nav" data-nav="${n.id}" data-tip="${n.label}" aria-label="${n.label}">${n.icon}<span class="sb-badge" aria-hidden="true"></span></button>`).join('')}</div>` +
      `<div class="sb-rail-bottom"><button type="button" class="sb-nav sb-create" data-nav="create" data-tip="Create Hub" aria-label="Create Hub">${ICON.plus}</button>` +
      `<button type="button" id="sb-advent-nav" class="sb-nav sb-advent" data-nav="advent" data-tip="Advent Calendar" aria-label="Winter Wonderland Advent Calendar" aria-expanded="false">${ICON.advent}</button>` +
      `<div class="sb-rail-user" data-tip="Your profile"></div></div>`;
    $('.sb-rail-user', rail).append(avatar, ...[statusMenu, quickPop].filter(Boolean));

    const panel = document.createElement('div'); panel.className = 'sb-panel';
    header.classList.add('sb-panel-head');
    const title = document.createElement('div'); title.className = 'sb-title'; title.innerHTML = '<h2 class="sb-title-text">Messages</h2><span class="sb-count hidden"></span>';
    header.insertBefore(title, header.firstChild);
    const search = document.createElement('label'); search.className = 'sb-search'; search.innerHTML = `${ICON.search}<input type="search" id="sb-search" placeholder="Search messages" autocomplete="off" aria-label="Search this list">`;
    const body = document.createElement('div'); body.className = 'sb-body';
    const paneMessages = pane('messages', [addFriend, friends]);
    const paneHubs = pane('hubs', []);
    paneHubs.innerHTML = `<div class="sb-hub-slot"></div><div class="sb-empty hidden" id="sb-hubs-empty">You’re not in any Hubs yet.</div>` +
      `<button type="button" class="sb-explore" id="sb-explore-btn">${ICON.compass}<span>Explore Hubs</span></button>` +
      `<div class="sb-explore-view hidden" id="sb-explore-view"></div>`;
    const paneRequests = pane('requests', [requests]);
    paneRequests.insertAdjacentHTML('beforeend', '<div class="sb-empty hidden" id="sb-requests-empty">No pending friend requests.</div>');
    body.append(paneMessages, paneHubs, paneRequests);
    panel.append(header, search, body);

    sidebar.classList.add('sb-modern'); sidebar.append(rail, panel);
    bind(rail, panel); built = true;
  }
  function pane(id, nodes) {
    const el = document.createElement('div'); el.className = 'sb-pane'; el.id = 'sb-pane-' + id; el.dataset.pane = id;
    nodes.filter(Boolean).forEach((n) => el.appendChild(n)); return el;
  }

  /* ---------------------------------------------------------------------
     2. INTERACTIONS — use the app's own routes
     --------------------------------------------------------------------- */
  function closeMobile() { const app = $('#app-screen'); if (app) app.classList.remove('sidebar-open'); }
  function bind(rail, panel) {
    rail.addEventListener('click', (e) => {
      const b = e.target.closest('.sb-nav'); if (!b) return; const id = b.dataset.nav;
      if (id === 'home') { setActive('home'); g(() => goHome()); closeMobile(); }
      else if (id === 'saved') { pulse(b); g(() => openSavedMessages()); }
      else if (id === 'create') { pulse(b); g(() => openHubCreator()); }
      else if (id === 'advent') { pulse(b); g(() => window.toggleAdventCalendar && window.toggleAdventCalendar()); }
      else { setActive(id); }
    });
    $('#sb-search', panel).addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); applyFilter(); });
    panel.addEventListener('click', (e) => {
      if (e.target.closest('#sb-explore-btn')) return toggleExplore(true);
      if (e.target.closest('[data-sb="explore-back"]')) return toggleExplore(false);
      if (e.target.closest('[data-sb="join"]')) return joinFromInput();
      if (e.target.closest('[data-sb="create"]')) return g(() => openHubCreator());
      const inv = e.target.closest('[data-sb-accept]'); if (inv) { g(() => acceptHubInvite(Number(inv.dataset.sbAccept))); }
    });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'sb-join-input') { e.preventDefault(); joinFromInput(); } });
  }
  const pulse = (b) => { b.classList.add('is-pressed'); setTimeout(() => b.classList.remove('is-pressed'), 260); };

  function setActive(nav) {
    state.active = nav; if (PANES[nav]) { if (state.pane !== nav) { state.query = ''; const s = $('#sb-search'); if (s) s.value = ''; } state.pane = nav; if (nav !== 'hubs') state.explore = false; }
    paint();
  }

  /* ---- Explore Hubs: there is no public hub directory in Nexora, so this reuses what exists —
          join through an invite link/ID (joinHubFromInvite), pending invitations (acceptHubInvite), create a Hub ---- */
  function toggleExplore(on) { state.explore = !!on; paint(); if (on) setTimeout(() => $('#sb-join-input')?.focus({ preventScroll: true }), 60); }
  function renderExplore() {
    const v = $('#sb-explore-view'); if (!v) return;
    const me = g(() => currentUser, null), invites = g(() => getHubs().filter((h) => h.invites && h.invites.includes(me)), []);
    v.innerHTML = `<button type="button" class="sb-link" data-sb="explore-back">${ICON.back}<span>Back to my Hubs</span></button>` +
      `<p class="sb-hint">Join a Hub with an invite link or ID, or start your own.</p>` +
      `<div class="sb-join"><input type="text" id="sb-join-input" placeholder="Paste invite link or Hub ID" autocomplete="off" aria-label="Invite link or Hub ID"><button type="button" class="sb-btn sb-btn-primary" data-sb="join">Join</button></div><div class="sb-status" id="sb-join-status" role="status" aria-live="polite"></div>` +
      (invites.length ? `<h3 class="sb-sub">Invitations</h3><ul class="sb-invites">${invites.map((h) => `<li><span>${esc(h.name)}</span><button type="button" class="sb-btn" data-sb-accept="${esc(h.id)}">Join</button></li>`).join('')}</ul>` : '') +
      `<button type="button" class="sb-btn sb-btn-wide" data-sb="create">${ICON.plus}<span>Create a Hub</span></button>`;
  }
  function joinFromInput() {
    const input = $('#sb-join-input'), status = $('#sb-join-status'); if (!input || !status) return;
    const raw = input.value.trim(), m = raw.match(/[?&]joinHub=(\d+)/) || raw.match(/^#?(\d{4,})$/);
    status.className = 'sb-status';
    if (!m) { status.textContent = 'That doesn’t look like a Nexora invite link or Hub ID.'; status.classList.add('bad'); return; }
    status.textContent = 'Joining…';
    Promise.resolve(g(() => joinHubFromInvite(Number(m[1])))).then(() => { status.textContent = ''; input.value = ''; }).catch(() => { status.textContent = 'Couldn’t join that Hub. Check the link and try again.'; status.classList.add('bad'); });
  }

  /* ---- search: filters the visible list rows only (no data is touched) ---- */
  function applyFilter() {
    const q = state.query, rows = state.pane === 'hubs' ? $$('#sb-pane-hubs .hub-row') : state.pane === 'messages' ? $$('#friends-list .friend-row') : [];
    rows.forEach((r) => { r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  }

  /* ---------------------------------------------------------------------
     3. STATE → UI (active item, badges, title, empty states)
     --------------------------------------------------------------------- */
  function paint() {
    if (!built) return;
    const unread = $$('#friends-list .unread-dot.show').length;
    const reqN = parseInt(($('#requests-count') || {}).textContent, 10) || 0;
    const me = g(() => currentUser, null), inviteN = g(() => getHubs().filter((h) => h.invites && h.invites.includes(me)).length, 0);
    const hubN = $$('#sb-pane-hubs .hub-row').length;
    $$('.sb-nav[data-nav]').forEach((b) => { const on = b.dataset.nav === state.active; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const badge = (nav, n) => { const el = $(`.sb-nav[data-nav="${nav}"] .sb-badge`); if (!el) return; el.textContent = n > 99 ? '99+' : (n > 0 ? String(n) : ''); el.classList.toggle('show', n > 0); };
    badge('messages', unread); badge('requests', reqN); badge('hubs', inviteN);
    $$('.sb-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === state.pane));
    const t = $('.sb-title-text'), c = $('.sb-count'); if (t) t.textContent = state.pane === 'hubs' && state.explore ? 'Explore Hubs' : PANES[state.pane];
    const n = state.pane === 'messages' ? unread : state.pane === 'requests' ? reqN : (state.explore ? 0 : hubN);
    if (c) { c.textContent = n ? String(n) : ''; c.classList.toggle('hidden', !n); c.classList.toggle('is-alert', state.pane !== 'hubs'); }
    const search = $('.sb-search'); if (search) { search.classList.toggle('hidden', state.pane === 'requests' || (state.pane === 'hubs' && state.explore)); $('#sb-search').placeholder = state.pane === 'hubs' ? 'Search hubs' : 'Search messages'; }
    const slot = $('#sb-pane-hubs .sb-hub-slot'), hubSection = $('#hub-sidebar-section');
    if (slot && hubSection && hubSection.parentElement !== slot) slot.appendChild(hubSection);     // renderSidebar() re-inserts it each time
    const hubsEmpty = $('#sb-hubs-empty'); if (hubsEmpty) hubsEmpty.classList.toggle('hidden', hubN > 0 || state.explore);
    const reqEmpty = $('#sb-requests-empty'); if (reqEmpty) reqEmpty.classList.toggle('hidden', reqN > 0);
    const pane = $('#sb-pane-hubs'); if (pane) pane.classList.toggle('exploring', state.explore);
    $('#sb-explore-view')?.classList.toggle('hidden', !state.explore); $('#sb-explore-btn')?.classList.toggle('hidden', state.explore);
    if (state.explore) renderExplore();
    const name = $('#user-display'), status = $('#quick-status-label'), user = $('.sb-rail-user');
    if (user) user.dataset.tip = [name && name.textContent.trim() ? '@' + name.textContent.trim().replace(/^@/, '') : 'Your profile', status && status.textContent.trim()].filter(Boolean).join(' · ');
    applyFilter();
  }

  /* ---------------------------------------------------------------------
     4. HOOKS (wrap, never replace) — keep the rail in step with the app's own navigation
     --------------------------------------------------------------------- */
  function hook() {
    if (typeof renderSidebar === 'function') { const _rs = renderSidebar; renderSidebar = function () { const r = _rs.apply(this, arguments); build(); paint(); return r; }; }
    if (typeof selectFriend === 'function') { const _sf = selectFriend; selectFriend = function () { const r = _sf.apply(this, arguments); state.active = 'messages'; state.pane = 'messages'; paint(); return r; }; }
    if (typeof selectHub === 'function') { const _sh = selectHub; selectHub = function () { const r = _sh.apply(this, arguments); state.active = 'hubs'; state.pane = 'hubs'; state.explore = false; paint(); return r; }; }
    if (typeof goHome === 'function') { const _gh = goHome; goHome = function () { const r = _gh.apply(this, arguments); state.active = 'home'; paint(); return r; }; }
    const name = $('#user-display'); if (name && window.MutationObserver) new MutationObserver(paint).observe(name, { childList: true, characterData: true, subtree: true });
    const status = $('#quick-status-label'); if (status && window.MutationObserver) new MutationObserver(paint).observe(status, { childList: true, characterData: true, subtree: true });
  }

  /* ---------------------------------------------------------------------
     5. STYLES
     --------------------------------------------------------------------- */
  const CSS = `
.sidebar.sb-modern { --sb-rail: 64px; flex-direction:row; min-width:340px; padding:0; overflow:hidden; background:transparent; border-right:0; }
.sb-rail { position:relative; z-index:4; flex:0 0 var(--sb-rail); width:var(--sb-rail); display:flex; flex-direction:column; justify-content:space-between; align-items:center; padding:14px 0; gap:10px;
  background:var(--bg-sidebar); border-right:1px solid var(--border); }
.sb-rail-top, .sb-rail-bottom { display:flex; flex-direction:column; align-items:center; gap:6px; }
.sb-rail-bottom { gap:12px; }
.sb-nav { position:relative; width:44px; height:44px; margin:0; padding:0; display:grid; place-items:center; cursor:pointer; color:var(--text-muted); background:transparent; border:0; border-radius:14px; transition:background .2s ease, color .2s ease, transform .2s ease; -webkit-tap-highlight-color:transparent; }
.sb-nav svg { width:22px; height:22px; transition:transform .2s ease; }
.sb-nav:hover { color:var(--text-main); background:color-mix(in srgb, var(--text-main) 8%, transparent); }
.sb-nav:hover svg { transform:scale(1.07); }
.sb-nav:active, .sb-nav.is-pressed { transform:scale(.94); }
.sb-nav:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
.sb-nav.active { color:var(--primary); background:color-mix(in srgb, var(--primary) 14%, transparent); }
.sb-nav.active::before { content:''; position:absolute; left:-10px; top:50%; width:4px; height:22px; margin-top:-11px; border-radius:0 4px 4px 0; background:var(--primary); animation:sbBar .25s ease both; }
@keyframes sbBar { from { height:6px; opacity:0; margin-top:-3px; } }
.sb-create { color:var(--primary); border:1.5px dashed color-mix(in srgb, var(--primary) 55%, transparent); border-radius:14px; width:40px; height:40px; }
.sb-create:hover { background:color-mix(in srgb, var(--primary) 14%, transparent); color:var(--primary); border-style:solid; }
.sb-advent { color:#D9B66F; border:1.5px solid rgba(217,182,111,.45); border-radius:14px; width:40px; height:40px; background:linear-gradient(160deg, rgba(168,40,50,.1), rgba(32,91,64,.1)); }
.sb-advent:hover { background:linear-gradient(160deg, rgba(168,40,50,.22), rgba(32,91,64,.22)); border-color:#D9B66F; color:#F4D98A; }
.sb-advent.active { color:#F4D98A; background:linear-gradient(160deg, rgba(168,40,50,.3), rgba(32,91,64,.3)); }
.sb-badge { position:absolute; top:3px; right:3px; min-width:17px; height:17px; padding:0 4px; display:none; place-items:center; border-radius:99px; font:700 10px/17px Inter,system-ui,sans-serif; text-align:center; color:#fff; background:var(--status-dnd,#ef4444); box-shadow:0 0 0 2px var(--bg-sidebar); pointer-events:none; }
.sb-badge.show { display:block; animation:sbPop .25s cubic-bezier(.2,1.4,.3,1) both; }
@keyframes sbPop { from { transform:scale(.4); opacity:0; } }
.sb-rail-user { position:relative; }
.sb-rail-user .avatar-container { display:block; }
.sb-rail-user .avatar { width:40px; height:40px; border-radius:50%; transition:box-shadow .2s ease, transform .2s ease; }
.sb-rail-user .avatar-container:hover .avatar { box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 35%, transparent); transform:scale(1.04); }
.sb-rail-user .status-menu, .sb-rail-user .quick-status-popover { position:fixed; top:auto; bottom:16px; left:calc(16px + var(--sb-rail) + 10px); right:auto; z-index:1200; }
/* tooltips (hover/keyboard only — hidden on touch) */
@media (hover:hover) {
  .sb-nav[data-tip]::after, .sb-rail-user[data-tip]::after { content:attr(data-tip); position:absolute; left:calc(100% + 14px); top:50%; transform:translate(-4px,-50%); padding:6px 10px; border-radius:9px; white-space:nowrap; pointer-events:none; opacity:0; z-index:30; font:600 12px Inter,system-ui,sans-serif; color:var(--text-main); background:var(--bg-card); border:1px solid var(--border); box-shadow:0 8px 22px var(--shadow); transition:opacity .15s ease .05s, transform .15s ease .05s; }
  .sb-nav:hover::after, .sb-nav:focus-visible::after, .sb-rail-user:hover::after { opacity:1; transform:translate(0,-50%); }
  .sb-nav.active::after { left:calc(100% + 14px); }
}
/* panel */
.sb-panel { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; background:linear-gradient(180deg, color-mix(in srgb, var(--bg-sidebar) 92%, var(--text-main) 3%), var(--bg-sidebar)); -webkit-backdrop-filter:blur(14px) saturate(120%); backdrop-filter:blur(14px) saturate(120%); }
.sidebar.sb-modern .sb-panel-head { position:relative; z-index:2; flex:0 0 auto; min-height:64px; padding:16px 16px 8px; border-bottom:0; background:transparent; justify-content:space-between; }
.sb-title { display:flex; align-items:baseline; gap:8px; min-width:0; }
.sb-title-text { margin:0; font-size:21px; font-weight:700; letter-spacing:-.01em; color:var(--text-main); text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sb-count { font-size:15px; font-weight:700; color:var(--text-muted); }
.sb-count.is-alert { color:var(--primary); }
.sb-count.hidden { display:none; }
.sb-panel-head .user-profile-info { display:none; }
.sb-panel-head .sidebar-header-actions { gap:4px; }
.sb-panel-head .sidebar-header-actions button[onclick="openHubCreator()"] { display:none; }
.sb-panel-head .icon-btn { width:36px; height:36px; border:0; background:transparent; color:var(--text-muted); border-radius:11px; transition:background .2s ease, color .2s ease, transform .2s ease; }
.sb-panel-head .icon-btn:hover { background:color-mix(in srgb, var(--text-main) 9%, transparent); color:var(--text-main); transform:rotate(18deg); }
.sb-search { position:relative; flex:0 0 auto; display:flex; align-items:center; gap:8px; margin:2px 14px 8px; padding:0 12px; height:40px; border-radius:13px; background:color-mix(in srgb, var(--input-bg) 85%, transparent); border:1px solid var(--border); color:var(--text-muted); transition:border-color .2s ease, box-shadow .2s ease; }
.sb-search:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent); }
.sb-search.hidden { display:none; }
.sb-search svg { width:17px; height:17px; flex:0 0 auto; }
.sb-search input { flex:1; min-width:0; width:auto; height:100%; margin:0; padding:0; border:0; background:transparent; box-shadow:none; color:var(--text-main); font-size:14px; outline:none; }
.sb-body { flex:1 1 auto; min-height:0; position:relative; }
.sb-pane { display:none; height:100%; overflow-y:auto; overscroll-behavior:contain; padding:2px 6px 14px; scrollbar-width:thin; }
.sb-pane.active { display:block; animation:sbPane .22s ease both; }
@keyframes sbPane { from { opacity:0; transform:translateY(4px); } }
.sb-pane .section { padding:6px 8px; border-bottom:0; }
.sb-pane .sidebar-section-head, #sb-pane-hubs .hub-list-title { display:none; }
.sb-pane .item-list { max-height:none; overflow:visible; }
.sb-pane .friend-row, .sb-pane .hub-row, .sb-pane .request-row { border-radius:14px; margin:2px 0; transition:background .18s ease, transform .18s ease; }
.sb-pane .friend-row:hover, .sb-pane .hub-row:hover { transform:translateX(2px); }
.sb-pane .add-friend-toggle-button { width:100%; border-radius:13px; }
.sb-empty { margin:22px 12px; padding:18px 14px; text-align:center; font-size:13px; line-height:1.5; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; }
.sb-empty.hidden { display:none; }
/* hubs pane: explore */
.sb-explore { width:calc(100% - 16px); margin:10px 8px 0; min-height:42px; display:flex; align-items:center; justify-content:center; gap:9px; cursor:pointer; font-size:13.5px; font-weight:600; color:var(--primary); background:color-mix(in srgb, var(--primary) 10%, transparent); border:1px solid color-mix(in srgb, var(--primary) 35%, transparent); border-radius:13px; transition:background .2s ease, transform .2s ease, border-color .2s ease; }
.sb-explore svg { width:18px; height:18px; }
.sb-explore:hover { background:color-mix(in srgb, var(--primary) 18%, transparent); border-color:var(--primary); transform:translateY(-1px); }
.sb-explore.hidden, .sb-explore-view.hidden { display:none; }
.sb-pane.exploring .sb-hub-slot, .sb-pane.exploring #sb-hubs-empty { display:none; }
.sb-explore-view { padding:6px 10px 12px; animation:sbPane .22s ease both; }
.sb-link { width:auto; margin:0 0 8px; padding:4px 6px 4px 0; display:inline-flex; align-items:center; gap:4px; cursor:pointer; font-size:13px; font-weight:600; color:var(--text-muted); background:none; border:0; }
.sb-link svg { width:16px; height:16px; } .sb-link:hover { color:var(--text-main); }
.sb-sub { margin:14px 0 4px; font-size:13px; font-weight:700; text-align:left; color:var(--text-main); }
.sb-hint { margin:0 0 10px; font-size:12.5px; line-height:1.5; color:var(--text-muted); }
.sb-join { display:flex; gap:8px; }
.sb-join input { flex:1; min-width:0; width:auto; height:40px; margin:0; padding:0 12px; font-size:13.5px; border-radius:12px; }
.sb-btn { width:auto; margin:0; min-height:40px; padding:0 16px; display:inline-flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; font-size:13px; font-weight:600; color:var(--text-main); background:var(--input-bg); border:1px solid var(--border); border-radius:12px; transition:background .2s ease, border-color .2s ease, transform .2s ease; }
.sb-btn:hover { border-color:var(--primary); transform:translateY(-1px); }
.sb-btn svg { width:16px; height:16px; }
.sb-btn-primary { color:#fff; background:var(--primary); border-color:var(--primary); }
.sb-btn-wide { width:100%; margin-top:16px; }
.sb-status { min-height:18px; margin-top:6px; font-size:12px; color:var(--text-muted); } .sb-status.bad { color:var(--status-dnd,#ef4444); }
.sb-invites { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.sb-invites li { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; font-size:13px; border:1px solid var(--border); border-radius:12px; }
.sb-invites li span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-invites .sb-btn { min-height:32px; padding:0 12px; }
/* the resize handle only makes sense on desktop */
@media (max-width:720px) {
  .sidebar.sb-modern { --sb-rail:56px; min-width:0; width:min(92vw,380px); height:var(--mobile-app-height,100dvh); overflow:hidden; padding-top:env(safe-area-inset-top); padding-bottom:env(safe-area-inset-bottom); }
  .sb-nav { width:42px; height:42px; } .sb-create { width:38px; height:38px; } .sb-advent { width:38px; height:38px; } .sb-nav.active::before { left:-7px; }
  .sb-rail-user .status-menu, .sb-rail-user .quick-status-popover { left:calc(var(--sb-rail) + 10px); bottom:calc(14px + env(safe-area-inset-bottom)); width:min(280px, calc(100vw - var(--sb-rail) - 24px)); }
  .sidebar.sb-modern .sb-panel-head { min-height:58px; padding:12px 12px 6px; position:relative; }
  .sb-title-text { font-size:19px; } .sb-search { margin:2px 12px 8px; height:42px; } .sb-search input { font-size:16px; }
  .sb-join input { font-size:16px; }
}
@media (max-width:380px) { .sidebar.sb-modern { --sb-rail:50px; } .sb-nav { width:38px; height:38px; } }
@media (prefers-reduced-motion: reduce) { .sb-nav, .sb-nav svg, .sb-badge.show, .sb-pane.active, .sb-nav.active::before, .sb-explore-view { animation:none !important; transition:none !important; } }
`;
  function injectCss() {
    if (document.getElementById('sidebar-nav-css')) return;
    const st = document.createElement('style'); st.id = 'sidebar-nav-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  }

  function init() { injectCss(); build(); hook(); paint(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.NexoraSidebarNav = { setActive, state, paint };
})();
