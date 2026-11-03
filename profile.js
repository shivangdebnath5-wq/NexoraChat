/* =========================================================================
   Nexora — User Profile
   -------------------------------------------------------------------------
   A self-contained module. It does NOT change how DMs, Hubs or the sidebar
   render; it only
     1. listens (one delegated, capture-phase click handler) for clicks on the
        avatars / usernames Nexora already draws, and opens that user's profile;
     2. shows the profile in a panel laid over the chat pane (so the DM / Hub
        underneath keeps its state, scroll position and live listeners);
     3. lets you edit only YOUR OWN profile (display name, bio, interests).

   Reuses existing systems instead of adding new ones:
     - identity/session ........ currentUser, DB (local user mirror)
     - presence/status badge ... getBadgeStatusForUser, updateStatusBadgeUI,
                                 onPresenceChange, QUICK_STATUS
     - avatar/frames ........... users[u].pfp / .frame, handlePfpChange
     - friends ................. window.firestoreFriendUsernames,
                                 window.sendFirestoreFriendRequest, selectFriend
     - Hubs .................... getHubs()
     - Firestore ............... the same users/{uid} + usernames/{name} docs
                                 written by saveNexoraProfile
   New optional fields on users/{uid}: profileName, bio, updatedAt
   (interests already existed). Email is never shown to other users.
   ========================================================================= */
import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(function nexoraProfile() {
  'use strict';

  /* ---------- Firebase (same app instance created by index.html) ---------- */
  let fb = null;
  try { const app = getApp(); fb = { auth: getAuth(app), db: getFirestore(app) }; }
  catch (err) { console.warn('[profile] Firebase unavailable — using local profile data only.', err); }

  /* ---------- Constants ---------- */
  const BIO_MAX = 160, NAME_MAX = 32, INTEREST_MAX = 12;
  const FALLBACK_INTERESTS = ['Gaming', 'Study', 'Coding', 'Creative', 'Music', 'Sports', 'Friends', 'Communities'];
  const STATUS_TEXT = { online: 'Online', free: 'Online', idle: 'Idle', dnd: 'Do not disturb', offline: 'Offline',
    busy: 'Busy', studying: 'Studying', gaming: 'Gaming', class: 'In class', sleeping: 'Sleeping' };
  const STATUS_VAR = { online: 'online', free: 'online', idle: 'idle', dnd: 'dnd', busy: 'dnd', offline: 'offline',
    studying: 'studying', gaming: 'gaming', class: 'class', sleeping: 'sleeping' };
  const BACK_SVG = '<svg class="chat-back-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CACHE_MS = 60000;

  /* ---------- State ---------- */
  let view = null, scrollEl = null, photoInput = null;
  let isOpen = false, pushed = false, editing = false;
  let viewing = null, renderToken = 0, lastModel = null, noteText = '';
  const cache = new Map();

  /* ---------- Small helpers ---------- */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cleanName = (s) => String(s || '').replace(/^\s*@/, '').split(/[\s·]/)[0].trim();
  const sameUser = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();
  const $ = (id) => document.getElementById(id);
  const mainChat = () => document.querySelector('.main-chat');
  const defaultAvatar = () => (typeof DEFAULT_AVATAR !== 'undefined' ? DEFAULT_AVATAR : '');
  const allInterests = () => (typeof WIZARD_INTERESTS !== 'undefined' && Array.isArray(WIZARD_INTERESTS) ? WIZARD_INTERESTS : FALLBACK_INTERESTS);

  function localUser(username) {
    try { return (DB.getUsers() || {})[username] || null; } catch (e) { return null; }
  }
  function friendUsernames() { return Array.isArray(window.firestoreFriendUsernames) ? window.firestoreFriendUsernames : []; }

  function sanitizeProfileInput({ profileName, bio, interests }) {
    const cleanText = (t, max, multiline) => {
      let s = String(t || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
      s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
      return s.trim().slice(0, max);
    };
    const tags = Array.from(new Set((interests || []).map((t) => cleanText(t, 24, false)).filter(Boolean))).slice(0, INTEREST_MAX);
    return { profileName: cleanText(profileName, NAME_MAX, false), bio: cleanText(bio, BIO_MAX, true), interests: tags };
  }

  /* ---------- Data: remote (Firestore) + local mirror ---------- */
  async function fetchRemote(username) {
    if (!fb || !username) return null;
    const key = username.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_MS) return hit.data;
    try {
      const nameSnap = await getDoc(doc(fb.db, 'usernames', key));
      if (!nameSnap.exists()) return null;
      const uid = nameSnap.data().uid;
      const snap = await getDoc(doc(fb.db, 'users', uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      // Deliberately a whitelist: email and other private fields are never copied.
      const data = {
        uid,
        username: d.username || username,
        photoURL: typeof d.photoURL === 'string' ? d.photoURL : '',
        profileName: typeof d.profileName === 'string' ? d.profileName : '',
        bio: typeof d.bio === 'string' ? d.bio : '',
        interests: Array.isArray(d.interests) ? d.interests.filter((t) => typeof t === 'string') : [],
        privacy: d.privacy && typeof d.privacy === 'object' ? d.privacy : {},
        createdAt: d.createdAt && typeof d.createdAt.toMillis === 'function' ? d.createdAt.toMillis() : null
      };
      cache.set(key, { t: Date.now(), data });
      return data;
    } catch (err) {
      console.warn('[profile] Could not load profile for', username, err);
      return null;
    }
  }

  // Only ever writes the signed-in user's own document.
  async function saveOwnProfile(fields) {
    const clean = sanitizeProfileInput(fields);
    // 1) local mirror first, so the profile always reflects the edit on this device
    try {
      const users = DB.getUsers();
      users[currentUser] = users[currentUser] || {};
      Object.assign(users[currentUser], { profileName: clean.profileName, bio: clean.bio, interests: clean.interests });
      DB.saveUsers(users);
    } catch (e) { /* storage may be unavailable */ }
    // 2) sync to Firestore users/{uid}
    const uid = fb && fb.auth.currentUser ? fb.auth.currentUser.uid : null;
    let remote = 'skipped', code = '';
    if (uid) {
      try {
        await updateDoc(doc(fb.db, 'users', uid), { profileName: clean.profileName, bio: clean.bio, interests: clean.interests, updatedAt: serverTimestamp() });
        remote = 'ok';
      } catch (err) { remote = 'failed'; code = err && err.code ? err.code : ''; console.warn('[profile] Firestore update failed', err); }
    }
    cache.delete(String(currentUser).toLowerCase());
    return { remote, code, clean };
  }

  /* ---------- Model ---------- */
  function statusFor(username, isMe, privacy) {
    if (isMe) { const b = $('sidebar-status-badge'); return { key: (b && b.dataset.status) || 'online', visible: true }; }
    if (privacy && privacy.showOnlineStatus === false) return { key: 'offline', visible: false };
    let key = 'offline';
    try { key = getBadgeStatusForUser(username) || 'offline'; } catch (e) { /* presence not ready */ }
    return { key, visible: true };
  }

  function sharedHubsFor(username, isMe) {
    let hubs = [];
    try { hubs = typeof getHubs === 'function' ? getHubs() : []; } catch (e) { hubs = []; }
    const mine = hubs.filter((h) => h && Array.isArray(h.members) && h.members.includes(currentUser));
    if (isMe) return { names: [], count: mine.length };
    const shared = mine.filter((h) => h.members.some((m) => sameUser(m, username)));
    return { names: shared.map((h) => String(h.name || 'Untitled Hub')), count: shared.length };
  }

  function buildModel(username, remote, loading) {
    const isMe = sameUser(username, currentUser);
    const local = localUser(username) || {};
    const privacy = (remote && remote.privacy) || {};
    const interests = remote ? remote.interests : (Array.isArray(local.interests) ? local.interests : []);
    const hubs = sharedHubsFor(username, isMe);
    const frame = typeof local.frame === 'string' ? local.frame : '';
    return {
      username, isMe, loading: !!loading,
      known: !!(remote || localUser(username) || isMe),
      avatar: local.pfp || (remote && remote.photoURL) || defaultAvatar(),
      frame: /^[\w-]*$/.test(frame) ? frame : '',
      profileName: (remote && remote.profileName) || local.profileName || '',
      bio: (remote && remote.bio) || local.bio || '',
      interests,
      createdAt: remote ? remote.createdAt : null,
      privacy,
      status: statusFor(username, isMe, privacy),
      relationship: isMe ? 'self' : (friendUsernames().some((f) => sameUser(f, username)) ? 'friend' : 'none'),
      sharedHubs: hubs.names, hubCount: hubs.count,
      email: isMe ? (typeof currentUserEmail !== 'undefined' ? currentUserEmail : '') : '',
      dob: isMe ? (local.dob || '') : '',
      canRequest: !(privacy && privacy.allowFriendRequests === false)
    };
  }

  /* ---------- Rendering ---------- */
  function statusLabel(key) { return STATUS_TEXT[key] || 'Online'; }
  function fmtMonth(ms) { try { return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }); } catch (e) { return ''; } }
  function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
  const chips = (list) => list.map((t) => `<span class="profile-chip">${esc(t)}</span>`).join('');

  function actionsHTML(m) {
    if (m.loading || !m.known) return '';
    if (m.isMe) return '<button type="button" class="profile-btn" id="profile-edit-btn">Edit profile</button><button type="button" class="profile-btn secondary" id="profile-settings-btn">Settings</button>';
    if (m.relationship === 'friend') return '<button type="button" class="profile-btn" id="profile-message-btn">Message</button>';
    return m.canRequest
      ? '<button type="button" class="profile-btn" id="profile-add-btn">Add friend</button>'
      : '<button type="button" class="profile-btn secondary" disabled>Not accepting requests</button>';
  }

  function detailsHTML(m) {
    const rows = [];
    if (m.createdAt) rows.push(['Member since', esc(fmtMonth(m.createdAt))]);
    if (m.relationship === 'friend') rows.push(['Relationship', 'Friend']);
    if (m.isMe) {
      rows.push(['Hubs', m.hubCount ? `${m.hubCount} Hub${m.hubCount === 1 ? '' : 's'}` : 'None yet']);
      if (m.email) rows.push(['Email <span class="profile-private">Only you can see this</span>', esc(m.email)]);
      if (m.dob && fmtDate(m.dob)) rows.push(['Birthday <span class="profile-private">Only you can see this</span>', esc(fmtDate(m.dob))]);
    } else {
      rows.push(['Shared Hubs', m.sharedHubs.length ? `<span class="profile-chips">${chips(m.sharedHubs.slice(0, 6))}${m.sharedHubs.length > 6 ? `<span class="profile-chip">+${m.sharedHubs.length - 6}</span>` : ''}</span>` : '<span class="profile-muted">None in common</span>']);
    }
    if (!rows.length) return '';
    return `<section class="profile-section"><h3>Details</h3><dl class="profile-details">${rows.map(([k, v]) => `<div class="profile-detail"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>`;
  }

  function editFormHTML(m) {
    const selected = new Set(m.interests);
    const pool = Array.from(new Set([...allInterests(), ...m.interests]));
    return `<form class="profile-edit" id="profile-edit-form" novalidate>
      <label for="pe-name">Display name <span class="profile-hint">optional · shown above your @username</span></label>
      <input id="pe-name" type="text" maxlength="${NAME_MAX}" autocomplete="off" value="${esc(m.profileName)}" placeholder="${esc(m.username)}">
      <label for="pe-bio">Bio</label>
      <textarea id="pe-bio" class="profile-textarea" maxlength="${BIO_MAX}" rows="4" placeholder="Tell people a little about you…">${esc(m.bio)}</textarea>
      <div class="profile-counter"><span id="pe-count">${m.bio.length}</span>/${BIO_MAX}</div>
      <div class="profile-label" id="pe-int-label">Interests</div>
      <div class="profile-chips" id="pe-interests" role="group" aria-labelledby="pe-int-label">${pool.map((t) => `<span class="profile-chip selectable${selected.has(t) ? ' selected' : ''}" role="button" tabindex="0" aria-pressed="${selected.has(t)}" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>
      <div class="profile-edit-actions"><button type="submit" class="profile-btn" id="pe-save">Save changes</button><button type="button" class="profile-btn secondary" id="pe-cancel">Cancel</button></div>
    </form>`;
  }

  /* Hall of Victories — trophies will be added later.
     Pass an array of { name, image } as `m.trophies` to show them; with none, a friendly empty state is shown. */
  const TROPHY_ICON = '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a2 2 0 0 0 0 4h3M16 6h3a2 2 0 0 1 0 4h-3"/><path d="M12 13v4M10 17h4M9 20h6"/></svg>';
  function trophiesHTML(m) {
    const items = Array.isArray(m.trophies) ? m.trophies : [];
    if (!items.length) {
      return `<div class="profile-trophies-empty">${TROPHY_ICON}<strong>No trophies yet</strong><span>${m.isMe ? 'Trophies you earn will be displayed here.' : 'Trophies they earn will be displayed here.'}</span></div>`;
    }
    return `<div class="profile-trophies">${items.map((t) => `<div class="profile-trophy" title="${esc(t.name)}"><img src="${esc(t.image)}" alt="${esc(t.name)}" loading="lazy"><span>${esc(t.name)}</span></div>`).join('')}</div>`;
  }

  function bodyHTML(m) {
    if (m.loading && !m.known) return '<div class="profile-empty">Loading profile…</div>';
    if (!m.known) return '<div class="profile-empty"><strong>Profile unavailable</strong><span>We couldn\'t find or load this profile.</span></div>';
    if (editing && m.isMe) return editFormHTML(m);
    const bio = m.bio
      ? `<p class="profile-bio">${esc(m.bio)}</p>`
      : `<p class="profile-bio profile-muted">${m.isMe ? 'You haven\'t added a bio yet. Use “Edit profile” to tell people about yourself.' : 'This user hasn\'t written a bio yet.'}</p>`;
    const interests = m.interests.length
      ? `<div class="profile-chips">${chips(m.interests)}</div>`
      : `<p class="profile-muted">${m.isMe ? 'No interests selected yet.' : 'No interests shared.'}</p>`;
    return `<section class="profile-section"><h3>About</h3>${bio}</section>
      <section class="profile-section"><h3>Interests</h3>${interests}</section>
      <section class="profile-section profile-victories"><h3>Hall of Victories</h3>${trophiesHTML(m)}</section>
      ${detailsHTML(m)}`;
  }

  function profileHTML(m) {
    const title = m.profileName || `@${m.username}`;
    const badge = m.isMe ? '<span class="profile-badge">You</span>' : (m.relationship === 'friend' ? '<span class="profile-badge">Friend</span>' : '');
    const statusRow = m.status.visible
      ? `<div class="profile-status" id="profile-status-row"><span class="profile-status-dot" style="background:var(--status-${STATUS_VAR[m.status.key] || 'offline'})"></span><span id="profile-status-text">${esc(statusLabel(m.status.key))}</span></div>`
      : '<div class="profile-status"><span class="profile-status-dot" style="background:var(--status-offline)"></span><span>Status hidden</span></div>';
    return `<div class="profile-card">
      <div class="profile-banner" aria-hidden="true"></div>
      <div class="profile-head">
        <div class="profile-avatar-wrap">
          <img class="avatar-large profile-avatar ${esc(m.frame)}" src="${esc(m.avatar)}" alt="${esc(m.username)}'s profile photo">
          ${m.status.visible ? '<span id="profile-status-badge" class="status-badge"></span>' : ''}
          ${m.isMe && !m.loading ? '<button type="button" class="profile-avatar-edit" id="profile-photo-btn" title="Change photo" aria-label="Change profile photo">✎</button>' : ''}
        </div>
        <div class="profile-ident">
          <h2 class="profile-name" tabindex="-1">${esc(title)}</h2>
          <div class="profile-handle">${m.profileName ? '@' + esc(m.username) : ''}${badge}</div>
          ${m.known ? statusRow : ''}
        </div>
        <div class="profile-actions">${actionsHTML(m)}</div>
      </div>
      <div class="profile-note" id="profile-note" role="status" aria-live="polite"></div>
      <div class="profile-body">${bodyHTML(m)}</div>
    </div>`;
  }

  function paint(m) {
    lastModel = m;
    scrollEl.innerHTML = profileHTML(m);
    if (m.status.visible && typeof updateStatusBadgeUI === 'function') updateStatusBadgeUI('profile-status-badge', m.status.key);
    setNote(noteText);
  }

  function setNote(text, kind) {
    noteText = text || '';
    const n = $('profile-note');
    if (!n) return;
    n.textContent = noteText;
    n.className = 'profile-note' + (noteText ? ' show' : '') + (kind ? ' ' + kind : '');
  }

  async function renderProfile(username) {
    const token = ++renderToken;
    viewing = username;
    const local = localUser(username);
    paint(buildModel(username, null, !(local || sameUser(username, currentUser))));   // instant paint from local data
    const remote = await fetchRemote(username);
    if (token !== renderToken || !isOpen) return;
    paint(buildModel(username, remote, false));
  }

  /* Live status refresh (no re-render) when presence changes. */
  function refreshStatusOnly() {
    if (!isOpen || !lastModel || !lastModel.status.visible) return;
    const st = statusFor(lastModel.username, lastModel.isMe, lastModel.privacy);
    lastModel.status = st;
    if (typeof updateStatusBadgeUI === 'function') updateStatusBadgeUI('profile-status-badge', st.key);
    const t = $('profile-status-text'); if (t) t.textContent = statusLabel(st.key);
    const dot = view.querySelector('.profile-status-dot'); if (dot) dot.style.background = `var(--status-${STATUS_VAR[st.key] || 'offline'})`;
  }

  /* ---------- View lifecycle ---------- */
  function ensureView() {
    if (view && document.body.contains(view)) return;
    const host = mainChat();
    if (!host) return;
    view = document.createElement('section');
    view.id = 'profile-view';
    view.className = 'profile-view hidden';
    view.setAttribute('aria-label', 'User profile');
    view.innerHTML = `<header class="profile-topbar"><button type="button" class="icon-btn profile-back-btn" id="profile-back-btn" title="Back" aria-label="Back to previous screen">${BACK_SVG}</button><span class="profile-topbar-title">Profile</span></header><div class="profile-scroll" id="profile-scroll"></div><input type="file" id="profile-photo-input" accept="image/*" hidden>`;
    host.appendChild(view);
    scrollEl = view.querySelector('#profile-scroll');
    photoInput = view.querySelector('#profile-photo-input');
    view.addEventListener('click', onViewClick);
    view.addEventListener('submit', onViewSubmit);
    view.addEventListener('input', onViewInput);
    view.addEventListener('keydown', onViewKey);
    photoInput.addEventListener('change', onPhotoChosen);
  }

  function openProfile(rawName) {
    const username = cleanName(rawName);
    if (!username || typeof currentUser === 'undefined' || !currentUser) return;
    ensureView();
    if (!view) return;
    const wasOpen = isOpen;
    if (wasOpen && sameUser(viewing, username)) { scrollEl.scrollTop = 0; return; }
    editing = false; noteText = '';
    if (!wasOpen) {
      isOpen = true;
      view.classList.remove('hidden');
      mainChat().classList.add('profile-open');
      const app = $('app-screen'); if (app) app.classList.remove('sidebar-open');          // close the mobile drawer
      ['emoji-picker', 'extension-menu', 'status-menu'].forEach((id) => { const el = $(id); if (el) el.classList.add('hidden'); });
      try { history.pushState({ nexoraProfile: true }, ''); pushed = true; } catch (e) { pushed = false; }
    }
    scrollEl.scrollTop = 0;
    renderProfile(username).then(() => { const h = scrollEl.querySelector('.profile-name'); if (h && !editing) h.focus({ preventScroll: true }); });
  }

  function hideView() {
    isOpen = false; editing = false; viewing = null; noteText = ''; renderToken++;
    if (view) view.classList.add('hidden');
    const mc = mainChat(); if (mc) mc.classList.remove('profile-open');
  }

  function closeProfile() {
    if (!isOpen) return;
    hideView();
    if (pushed) {
      pushed = false;
      try { if (history.state && history.state.nexoraProfile) history.back(); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- Events inside the profile view ---------- */
  function onViewClick(e) {
    const t = e.target.closest ? e.target.closest('button, .profile-chip.selectable') : null;
    if (!t) return;
    if (t.classList.contains('selectable')) { toggleChip(t); return; }
    switch (t.id) {
      case 'profile-back-btn': closeProfile(); break;
      case 'profile-edit-btn': startEdit(); break;
      case 'pe-cancel': cancelEdit(); break;
      case 'profile-settings-btn': if (typeof openSettings === 'function') openSettings(); break;
      case 'profile-message-btn': if (typeof selectFriend === 'function') selectFriend(viewing); break;   // wrapper below closes the panel
      case 'profile-add-btn': addFriend(t); break;
      case 'profile-photo-btn': photoInput.click(); break;
      default: break;
    }
  }
  function toggleChip(chip) {
    const on = !chip.classList.contains('selected');
    if (on && view.querySelectorAll('#pe-interests .selected').length >= INTEREST_MAX) { setNote(`You can pick up to ${INTEREST_MAX} interests.`, 'warn'); return; }
    chip.classList.toggle('selected', on);
    chip.setAttribute('aria-pressed', String(on));
  }
  function onViewKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('selectable')) { e.preventDefault(); toggleChip(e.target); }
  }
  function onViewInput(e) {
    if (e.target && e.target.id === 'pe-bio') { const c = $('pe-count'); if (c) c.textContent = String(e.target.value.length); }
  }

  function startEdit() { if (!lastModel || !lastModel.isMe) return; editing = true; setNote(''); paint(lastModel); const n = $('pe-name'); if (n) n.focus(); }
  function cancelEdit() { editing = false; noteText = ''; if (lastModel) paint(lastModel); }

  async function onViewSubmit(e) {
    if (!e.target || e.target.id !== 'profile-edit-form') return;
    e.preventDefault();
    if (!lastModel || !lastModel.isMe || !sameUser(viewing, currentUser)) return;     // can only ever edit your own profile
    const btn = $('pe-save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    const interests = Array.from(view.querySelectorAll('#pe-interests .selected')).map((c) => c.getAttribute('data-tag'));
    const res = await saveOwnProfile({ profileName: $('pe-name').value, bio: $('pe-bio').value, interests });
    editing = false;
    if (res.remote === 'ok') noteText = 'Profile saved.';
    else if (res.remote === 'failed') noteText = res.code === 'permission-denied'
      ? 'Saved on this device, but it couldn\'t sync online: Firestore rules need to let you update your own “users” document.'
      : 'Saved on this device, but it couldn\'t sync online right now. Please try again later.';
    else noteText = 'Saved on this device. Sign in with your Nexora account to sync your profile online.';
    await renderProfile(currentUser);
    setNote(noteText, res.remote === 'ok' ? 'ok' : 'warn');
  }

  async function addFriend(btn) {
    if (typeof window.sendFirestoreFriendRequest !== 'function') { setNote('Friend requests are unavailable right now.', 'warn'); return; }
    btn.disabled = true;
    const res = await window.sendFirestoreFriendRequest(viewing);
    if (res && res.ok) { btn.textContent = 'Request sent'; setNote(`Friend request sent to @${viewing}.`, 'ok'); }
    else { btn.disabled = false; setNote((res && res.message) || 'Could not send the request.', 'warn'); }
  }

  // Profile photo: reuse the existing Settings uploader (validates size, saves, updates sidebar/messages).
  function onPhotoChosen(e) {
    const before = (localUser(currentUser) || {}).pfp;
    if (typeof handlePfpChange === 'function') handlePfpChange(e);
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const now = (localUser(currentUser) || {}).pfp;
      if (now !== before || tries > 15) {
        clearInterval(timer);
        if (isOpen && sameUser(viewing, currentUser)) renderProfile(currentUser);
        if (photoInput) photoInput.value = '';
      }
    }, 150);
  }

  /* ---------- Finding "whose avatar/username is this?" in Nexora's existing UI ---------- */
  function userFromElement(el) {
    if (!el || !el.closest || typeof currentUser === 'undefined' || !currentUser) return null;
    const tagged = el.closest('[data-profile-user]');                      // opt-in hook for any future UI
    if (tagged) { const v = tagged.getAttribute('data-profile-user'); return v === '@me' ? currentUser : (cleanName(v) || null); }
    if (el.closest('.sidebar-header .user-name-block')) return currentUser;                      // my name in the sidebar
    const fa = el.closest('#friends-list li .avatar-container');                                  // a friend's avatar (their name still opens the DM)
    if (fa) { const img = fa.querySelector('img'); const n = cleanName(img && img.getAttribute('alt')); if (n) return n; }
    const rq = el.closest('#requests-list li > span:first-child');                                // @name in friend requests
    if (rq) return cleanName(rq.textContent) || null;
    if (typeof activeFriend !== 'undefined' && activeFriend && !(typeof activeHub !== 'undefined' && activeHub) &&
        (el.closest('#chat-header-avatar-container') || el.closest('#chat-header #chat-title'))) return activeFriend;   // DM header
    const av = el.closest('.message-body-row > img.avatar');                                      // message avatars (DM + Hub)
    if (av) {
      const w = av.closest('.message-wrapper'); if (!w) return null;
      const hn = w.querySelector('.hub-message-name'); if (hn) return cleanName(hn.textContent) || null;
      if (w.classList.contains('sent')) return currentUser;
      return (typeof activeHub !== 'undefined' && activeHub) ? null : (activeFriend || null);
    }
    const hubName = el.closest('.hub-message-name'); if (hubName) return cleanName(hubName.textContent) || null;
    const chip = el.closest('.hub-member-chip');                                                  // Hub member chips (not the remove ×)
    if (chip && !el.closest('button')) return cleanName(chip.firstChild ? chip.firstChild.textContent : chip.textContent) || null;
    return null;
  }

  function onDocumentClick(e) {
    if (!(e.target instanceof Element) || e.target.closest('#profile-view')) return;
    const username = userFromElement(e.target);
    if (!username) return;
    e.preventDefault();
    e.stopPropagation();                      // capture phase: stops the row's DM-open / popover handlers for this click only
    const modal = e.target.closest('.modal');   // e.g. Hub member chips inside Hub settings: close that dialog the same way its Close button does
    if (modal) modal.classList.add('hidden');
    openProfile(username);
  }

  /* ---------- Wiring ---------- */
  function wrap(name, before, after) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      if (before) { try { before(); } catch (err) { console.error(err); } }
      const out = orig.apply(this, arguments);
      if (after) { try { after(); } catch (err) { console.error(err); } }
      return out;
    };
  }
  function syncHeaderLink() {
    const h = $('chat-header');
    if (h) h.classList.toggle('has-profile-link', typeof activeFriend !== 'undefined' && !!activeFriend && !(typeof activeHub !== 'undefined' && activeHub));
  }

  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen && !document.querySelector('.modal:not(.hidden)')) closeProfile();
  });
  window.addEventListener('popstate', () => { if (isOpen) { pushed = false; hideView(); } });

  // Navigating anywhere else (DM, Hub, home, sign-out) simply closes the panel first.
  wrap('selectFriend', closeProfile, syncHeaderLink);
  wrap('selectHub', closeProfile, syncHeaderLink);
  wrap('goHome', closeProfile, syncHeaderLink);
  wrap('logout', closeProfile);
  wrap('onPresenceChange', null, refreshStatusOnly);

  window.NexoraProfile = { open: openProfile, close: closeProfile, _userFromElement: userFromElement, _sanitize: sanitizeProfileInput };
})();
