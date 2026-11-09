/* =========================================================================
   deepak.js — the hidden "Deepak" Easter egg  🪔
   -------------------------------------------------------------------------
   Type  D-E-E-P-A-K  (any case) anywhere in Nexora while NOT typing in a text field and a hidden diya
   glows into view. Click it 5 times: golden sparkles, and the exclusive "Secret Lightkeeper" profile badge
   is unlocked — once per account.

   Safe by design:
     • Keys are only watched when focus is NOT in an input / textarea / select / contenteditable, so
       messages, search boxes and every other field behave exactly as before (nothing is blocked or changed).
     • No preventDefault / stopPropagation — it only listens.
     • The badge uses profile.js's existing badge system (NexoraProfile.registerBadge / awardBadge) and is
       stored the same way as the other badges. Image: easter-eggs/deepak-diya.png
   ========================================================================= */
(function () {
  'use strict';
  if (window.NexoraDeepak) return;

  const WORD = 'deepak', CLICKS = 5, BADGE_ID = 'secret-lightkeeper', IMG = 'easter-eggs/deepak-diya.png';
  const BUFFER_RESET_MS = 2000, DIYA_LIFETIME_MS = 25000;
  const g = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const me = () => g(() => currentUser, null);
  const store = { get: (k) => g(() => localStorage.getItem(k), null), set: (k, v) => g(() => localStorage.setItem(k, v)) };
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------------------
     1. SECRET BADGE (registered with profile.js once it has loaded; it is an ES module, so it loads late)
     --------------------------------------------------------------------- */
  const flagKey = (u) => 'nexora_deepak_' + String(u).toLowerCase();
  const pendingKey = (u) => 'nexora_deepak_pending_' + String(u).toLowerCase();
  const badgeKey = (u) => 'nexora_badges_' + String(u).toLowerCase();   // the key profile.js uses for awarded badges
  function registerBadge() {
    const P = window.NexoraProfile; if (!(P && P.registerBadge)) return false;
    P.registerBadge({ id: BADGE_ID, name: 'Secret Lightkeeper', icon: '🪔', image: IMG, type: 'secret', secret: true, hint: 'Hidden — find the secret diya', test: () => false });
    return true;
  }
  const alreadyUnlocked = (u) => !!store.get(flagKey(u)) || g(() => JSON.parse(store.get(badgeKey(u)) || '[]').includes(BADGE_ID), false);
  // returns 'unlocked' | 'already' | 'pending' | 'nouser'
  function unlock() {
    const u = me(); if (!u) return 'nouser';
    if (alreadyUnlocked(u)) return 'already';
    const P = window.NexoraProfile;
    if (P && P.awardBadge && registerBadge() && P.awardBadge(BADGE_ID)) { store.set(flagKey(u), '1'); return 'unlocked'; }
    store.set(pendingKey(u), '1'); return 'pending';                  // profile.js not ready yet: finish the award as soon as it is
  }
  let tries = 0;
  const bootTimer = setInterval(() => {
    const ready = registerBadge(), u = me();
    if (ready && u && store.get(pendingKey(u)) && !alreadyUnlocked(u)) { if (window.NexoraProfile.awardBadge(BADGE_ID)) { store.set(flagKey(u), '1'); g(() => localStorage.removeItem(pendingKey(u))); } }
    if ((ready && !u ? ++tries > 600 : ++tries > 100) || (ready && u && !store.get(pendingKey(u)))) clearInterval(bootTimer);
  }, 250);

  /* ---------------------------------------------------------------------
     2. WATCHING THE KEYBOARD (never while typing in a field)
     --------------------------------------------------------------------- */
  const isField = (el) => !!(el && (el.isContentEditable || (el.closest && el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))));
  let buf = '', bufTimer = null;
  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isField(e.target) || isField(document.activeElement)) { buf = ''; return; }
    if (e.key === 'Shift') return;
    if (!/^[a-z]$/i.test(e.key)) { buf = ''; return; }
    buf = (buf + e.key.toLowerCase()).slice(-WORD.length);
    clearTimeout(bufTimer); bufTimer = setTimeout(() => { buf = ''; }, BUFFER_RESET_MS);
    if (buf === WORD) { buf = ''; summon(); }
  });

  /* ---------------------------------------------------------------------
     3. SPARKLES — one tiny canvas particle system, created on demand and removed when it settles
     --------------------------------------------------------------------- */
  let cv = null, cx = null, parts = [], raf = 0;
  const COLORS = ['#FFF3B0', '#F5D98A', '#FFD166', '#FFB347', '#FF9A3D', '#FFFFFF'];
  function ensureCanvas() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.className = 'dk-canvas'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv); cx = cv.getContext('2d'); sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
  }
  function sizeCanvas() { if (!cv) return; const d = Math.min(window.devicePixelRatio || 1, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; cx.setTransform(d, 0, 0, d, 0, 0); }
  function sparkles(x, y, n, power) {
    if (reduceMotion()) return;
    ensureCanvas();
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.3, 1) * power;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - power * 0.25, life: 0, max: rand(60, 130), size: rand(1.6, 4.4), star: Math.random() < 0.4, c: COLORS[(Math.random() * COLORS.length) | 0], rot: rand(0, 6.28) });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function drawStar(c, x, y, r, rot) { c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r, a = rot + i * Math.PI / 4; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
  function tick() {
    raf = 0; if (!cx) return; cx.clearRect(0, 0, innerWidth, innerHeight); cx.globalCompositeOperation = 'lighter';
    parts = parts.filter((p) => p.life < p.max);
    parts.forEach((p) => {
      p.life++; p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.05; p.x += p.vx; p.y += p.vy; p.rot += 0.06;
      const k = 1 - p.life / p.max, tw = 0.6 + 0.4 * Math.sin(p.life * 0.5 + p.rot);
      cx.globalAlpha = Math.max(0, k) * tw; cx.fillStyle = p.c; cx.shadowColor = p.c; cx.shadowBlur = 8;
      if (p.star) drawStar(cx, p.x, p.y, p.size * 2.4 * (0.5 + k * 0.5), p.rot); else { cx.beginPath(); cx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.283); cx.fill(); }
    });
    cx.globalAlpha = 1; cx.shadowBlur = 0;
    if (parts.length) raf = requestAnimationFrame(tick); else { cv.remove(); cv = cx = null; window.removeEventListener('resize', sizeCanvas); }
  }

  /* ---------------------------------------------------------------------
     4. THE HIDDEN DIYA
     --------------------------------------------------------------------- */
  let wrap = null, count = 0, lifeTimer = null, finished = false;
  const WHISPERS = ['', 'It’s warm…', 'Something stirs…', 'Almost there…'];
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  function summon() {
    if (!me() || document.hidden) return;
    if (wrap) { wrap.classList.remove('dk-in'); void wrap.offsetWidth; wrap.classList.add('dk-in'); return; }   // already visible: just re-announce it
    count = 0; finished = false;
    wrap = document.createElement('div'); wrap.className = 'dk-wrap dk-in';
    wrap.style.left = rand(14, 86).toFixed(1) + '%'; wrap.style.top = rand(24, 76).toFixed(1) + '%';
    wrap.innerHTML = `<button type="button" class="dk-diya" aria-label="A hidden glowing diya. Click it to light it (0 of ${CLICKS})"><span class="dk-aura" aria-hidden="true"></span><img src="${IMG}" alt="" draggable="false"></button>` +
      `<span class="dk-dots" aria-hidden="true">${'<i></i>'.repeat(CLICKS)}</span><span class="dk-whisper" aria-live="polite"></span>`;
    document.body.appendChild(wrap); wrap.style.setProperty('--lvl', 0);
    $btn().addEventListener('click', onHit);
    const [x, y] = centerOf($btn()); sparkles(x, y, 18, 3);
    lifeTimer = setTimeout(() => dismiss(true), DIYA_LIFETIME_MS);
  }
  const $btn = () => wrap && wrap.querySelector('.dk-diya');
  function dismiss(fade) {
    clearTimeout(lifeTimer); const w = wrap; wrap = null; if (!w) return;
    if (fade) { w.classList.add('dk-out'); setTimeout(() => w.remove(), 600); } else w.remove();
  }
  function onHit() {
    if (!wrap || finished) return;
    count++; wrap.style.setProperty('--lvl', count);
    const b = $btn(); b.setAttribute('aria-label', `A glowing diya (${count} of ${CLICKS})`);
    wrap.querySelectorAll('.dk-dots i').forEach((d, i) => d.classList.toggle('on', i < count));
    const w = wrap.querySelector('.dk-whisper'); w.textContent = WHISPERS[count] || ''; w.classList.remove('show'); void w.offsetWidth; if (w.textContent) w.classList.add('show');
    b.classList.remove('dk-hit'); void b.offsetWidth; b.classList.add('dk-hit');
    const [x, y] = centerOf(b); sparkles(x, y, count < CLICKS ? 10 + count * 4 : 0, 2.4 + count * 0.5);
    clearTimeout(lifeTimer); lifeTimer = setTimeout(() => dismiss(true), DIYA_LIFETIME_MS);       // keep it alive while you're clicking
    if (count >= CLICKS) finish();
  }
  function finish() {
    finished = true; clearTimeout(lifeTimer);
    const b = $btn(), [x, y] = centerOf(b), result = unlock();
    sparkles(x, y, 150, 7.5); setTimeout(() => sparkles(innerWidth / 2, innerHeight / 2.4, 90, 8), 260); setTimeout(() => sparkles(x, y, 60, 5), 560);
    wrap.classList.add('dk-finale'); const w = wrap; setTimeout(() => { if (wrap === w) dismiss(false); }, 1100);
    setTimeout(() => (result === 'unlocked' || result === 'pending' ? showCard() : toast(result === 'already' ? 'The diya glows for you again ✨ — Secret Lightkeeper is already yours.' : 'The diya glows warmly…')), 1150);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('.dk-card')) closeCard(); else if (wrap && !finished) dismiss(true); } });
  const $ = (s) => document.querySelector(s);

  /* ---------------------------------------------------------------------
     5. REWARD CARD + TOAST
     --------------------------------------------------------------------- */
  let lastFocus = null;
  function showCard() {
    closeCard(); lastFocus = document.activeElement;
    const c = document.createElement('div'); c.className = 'dk-card-backdrop'; c.innerHTML =
      `<div class="dk-card" role="dialog" aria-modal="true" aria-labelledby="dk-card-title"><div class="dk-card-glow" aria-hidden="true"></div><img src="${IMG}" alt="" draggable="false">` +
      `<span class="dk-card-tag">SECRET UNLOCKED</span><h3 id="dk-card-title">Secret Lightkeeper</h3><p>You found the hidden diya and lit it. This exclusive badge is now glowing on your profile.</p>` +
      `<div class="dk-card-actions"><button type="button" class="dk-btn dk-btn-gold" data-dk="profile">View on my profile</button><button type="button" class="dk-btn" data-dk="close">Close</button></div></div>`;
    c.addEventListener('click', (e) => { const a = e.target.closest('[data-dk]'); if (a && a.dataset.dk === 'profile') { closeCard(); g(() => window.NexoraProfile.open(me())); } else if (a || e.target === c) closeCard(); });
    document.body.appendChild(c); setTimeout(() => $('.dk-btn-gold')?.focus({ preventScroll: true }), 60);
  }
  function closeCard() { const c = $('.dk-card-backdrop'); if (!c) return; c.classList.add('dk-card-out'); setTimeout(() => c.remove(), 220); if (lastFocus && lastFocus.focus) g(() => lastFocus.focus({ preventScroll: true })); }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'dk-toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 20); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3600);
  }

  /* ---------------------------------------------------------------------
     6. STYLES (injected, so this file is self-contained) — plus the profile badge image tile
     --------------------------------------------------------------------- */
  if (!document.getElementById('deepak-egg-css')) {
    const st = document.createElement('style'); st.id = 'deepak-egg-css'; st.textContent = `
.dk-wrap { position:fixed; z-index:9500; width:112px; transform:translate(-50%,-50%); pointer-events:none; --lvl:0; }
.dk-wrap.dk-in { animation:dkIn .9s cubic-bezier(.2,1.2,.3,1) both; }
.dk-wrap.dk-out { animation:dkOut .6s ease forwards; }
.dk-diya { position:relative; display:block; width:100%; padding:0; margin:0; background:none; border:0; border-radius:50%; cursor:pointer; pointer-events:auto; animation:dkFloat 3.6s ease-in-out infinite; -webkit-tap-highlight-color:transparent; }
.dk-diya:focus-visible { outline:2px solid #F5D98A; outline-offset:6px; }
.dk-diya img { position:relative; display:block; width:100%; height:auto; pointer-events:none; user-select:none; filter:drop-shadow(0 0 calc(10px + var(--lvl) * 5px) rgba(255,170,50,calc(.55 + var(--lvl) * .08))); transition:filter .35s ease; }
.dk-aura { position:absolute; left:50%; top:46%; width:calc(190% + var(--lvl) * 18%); aspect-ratio:1; transform:translate(-50%,-50%); border-radius:50%; pointer-events:none; background:radial-gradient(circle, rgba(255,196,80,calc(.42 + var(--lvl) * .1)), rgba(255,140,40,.16) 42%, transparent 68%); animation:dkPulse 2.6s ease-in-out infinite; transition:width .4s ease; }
.dk-diya.dk-hit { animation:dkHit .45s cubic-bezier(.2,1.4,.3,1); }
.dk-dots { display:flex; justify-content:center; gap:7px; margin-top:8px; }
.dk-dots i { width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,.28); transition:all .3s ease; }
.dk-dots i.on { background:#FFD166; box-shadow:0 0 9px 2px rgba(255,190,70,.85); transform:scale(1.25); }
.dk-whisper { display:block; height:16px; margin-top:5px; text-align:center; font:italic 600 12px Inter,system-ui,sans-serif; color:#F5D98A; text-shadow:0 0 8px rgba(0,0,0,.7); opacity:0; }
.dk-whisper.show { animation:dkWhisper 1.8s ease both; }
.dk-wrap.dk-finale .dk-diya { animation:dkFinale 1.1s cubic-bezier(.3,.1,.2,1) forwards; }
.dk-wrap.dk-finale .dk-dots, .dk-wrap.dk-finale .dk-whisper { opacity:0; }
.dk-canvas { position:fixed; inset:0; z-index:9550; pointer-events:none; }
@keyframes dkIn { 0% { opacity:0; transform:translate(-50%,-30%) scale(.3) rotate(-14deg); filter:blur(6px); } 60% { opacity:1; transform:translate(-50%,-52%) scale(1.12) rotate(3deg); filter:none; } 100% { opacity:1; transform:translate(-50%,-50%) scale(1); } }
@keyframes dkOut { to { opacity:0; transform:translate(-50%,-62%) scale(.7); } }
@keyframes dkFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
@keyframes dkPulse { 0%,100% { opacity:.7; } 50% { opacity:1; } }
@keyframes dkHit { 0% { transform:scale(1); } 35% { transform:scale(.88) rotate(-4deg); } 70% { transform:scale(1.16) rotate(3deg); } 100% { transform:scale(1); } }
@keyframes dkWhisper { 0% { opacity:0; transform:translateY(4px); } 20%,70% { opacity:1; transform:none; } 100% { opacity:0; } }
@keyframes dkFinale { 0% { transform:scale(1); filter:brightness(1); } 40% { transform:scale(1.5) translateY(-10px); filter:brightness(1.5); } 100% { transform:scale(2.2) translateY(-60px); opacity:0; filter:brightness(2); } }
.dk-card-backdrop { position:fixed; inset:0; z-index:9600; display:grid; place-items:center; padding:20px; background:rgba(4,6,18,.62); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); animation:dkFade .3s ease both; }
.dk-card-backdrop.dk-card-out { animation:dkFadeOut .22s ease forwards; }
.dk-card { position:relative; width:min(380px,100%); padding:26px 24px 22px; text-align:center; border-radius:22px; color:#EEEAF7; overflow:hidden; font-family:Inter,system-ui,sans-serif; background:linear-gradient(160deg,rgba(34,38,92,.94),rgba(10,13,32,.97)); border:1px solid rgba(214,168,75,.55); box-shadow:0 28px 70px rgba(2,4,14,.75), 0 0 50px rgba(214,168,75,.18); animation:dkRise .5s cubic-bezier(.2,1.1,.3,1) both; }
.dk-card-glow { position:absolute; left:50%; top:-40px; width:300px; height:300px; transform:translateX(-50%); background:radial-gradient(circle, rgba(255,190,80,.38), transparent 65%); animation:dkPulse 3s ease-in-out infinite; pointer-events:none; }
.dk-card img { position:relative; width:128px; height:auto; margin:0 auto 6px; display:block; filter:drop-shadow(0 0 16px rgba(255,170,50,.8)); animation:dkFloat 3.6s ease-in-out infinite; }
.dk-card-tag { position:relative; display:inline-block; margin-bottom:4px; font-size:10.5px; font-weight:700; letter-spacing:.2em; color:#D6A84B; }
.dk-card h3 { position:relative; margin:0 0 8px; font:600 28px 'Cormorant Garamond','Playfair Display',Georgia,serif; color:#F5D98A; text-align:center; }
.dk-card p { position:relative; margin:0 0 18px; font-size:13.5px; line-height:1.55; color:#CFCBE6; }
.dk-card-actions { position:relative; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.dk-btn { width:auto; min-height:40px; margin:0; padding:9px 18px; font:600 13px Inter,system-ui,sans-serif; cursor:pointer; color:#EEEAF7; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); border-radius:12px; transition:transform .18s ease, background .18s ease, border-color .18s ease; }
.dk-btn:hover { transform:translateY(-1px); background:rgba(255,255,255,.14); border-color:rgba(214,168,75,.6); }
.dk-btn:focus-visible { outline:2px solid #F5D98A; outline-offset:2px; }
.dk-btn-gold { color:#090D20; border-color:transparent; background:linear-gradient(110deg,#F5D98A,#D6A84B 55%,#B8862F); box-shadow:0 6px 18px rgba(214,168,75,.4); }
.dk-btn-gold:hover { background:linear-gradient(110deg,#F5D98A,#D6A84B 55%,#B8862F); filter:brightness(1.07); }
.dk-toast { position:fixed; left:50%; bottom:28px; z-index:9650; max-width:min(440px,calc(100% - 32px)); padding:11px 18px; border-radius:99px; font:500 13px Inter,system-ui,sans-serif; color:#EEEAF7; background:rgba(12,15,38,.94); border:1px solid rgba(214,168,75,.55); box-shadow:0 14px 34px rgba(0,0,0,.5); transform:translate(-50%,18px); opacity:0; transition:opacity .3s ease, transform .3s ease; }
.dk-toast.show { opacity:1; transform:translate(-50%,0); }
@keyframes dkFade { from { opacity:0; } to { opacity:1; } }
@keyframes dkFadeOut { to { opacity:0; } }
@keyframes dkRise { from { opacity:0; transform:translateY(20px) scale(.94); } to { opacity:1; transform:none; } }
@media (max-width:720px) { .dk-wrap { width:92px; } }
@media (prefers-reduced-motion: reduce) { .dk-wrap, .dk-wrap *, .dk-card, .dk-card *, .dk-card-backdrop { animation:none !important; transition:none !important; } }
/* the badge on a profile (image version of a compact badge tile) */
.profile-badge-img { display:block; width:78%; height:78%; object-fit:contain; filter:drop-shadow(0 0 4px rgba(255,170,50,.6)); }`;
    (document.head || document.documentElement).appendChild(st);
  }

  window.NexoraDeepak = { summon, _state: () => ({ visible: !!wrap, count, unlocked: !!(me() && alreadyUnlocked(me())) }) };
})();
