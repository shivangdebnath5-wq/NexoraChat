/* NexoraChat interaction upgrade. Existing inline functions remain the data layer. */

// Loads the real-time RTDB presence module (see presence.js). Dynamic
// import() works fine from this classic script; presence.js itself waits
// for the Firebase app to exist, so load order relative to index.html's
// <script type="module"> block doesn't matter. Entirely additive: if this
// fails for any reason, getUserPresence()'s existing fallback in index.html
// keeps the app working exactly as before.
import('./presence.js').catch(err => console.warn('Presence module failed to load:', err));

const baseExtensionHTML = extensionHTML;
const baseUpdateExtension = updateExtension;

function getPinnedChats() { return JSON.parse(localStorage.getItem(`pinned_chats_${currentUser}`) || '[]'); }
function savePinnedChats(pins) { localStorage.setItem(`pinned_chats_${currentUser}`, JSON.stringify(pins)); }
function togglePinnedChat(friend, event) {
  event?.stopPropagation();
  const pins = getPinnedChats(); const index = pins.indexOf(friend);
  if (index >= 0) pins.splice(index, 1); else pins.unshift(friend);
  savePinnedChats(pins); renderSidebar();
}
function showMobileSidebar() { document.getElementById('app-screen').classList.add('sidebar-open'); }

const baseSelectFriend = selectFriend;
selectFriend = function(friend) { baseSelectFriend(friend); document.getElementById('app-screen').classList.remove('sidebar-open'); };

const baseRenderSidebar = renderSidebar;
renderSidebar = function() {
  baseRenderSidebar();
  if (!currentUser) return;
  const pins = getPinnedChats(); const list = document.getElementById('friends-list');
  const rows = [...list.children];
  rows.sort((a,b) => pins.includes(b.querySelector('.user-profile-info > span')?.textContent.replace('@','')) - pins.includes(a.querySelector('.user-profile-info > span')?.textContent.replace('@','')));
  rows.forEach(row => {
    const friend = row.querySelector('.user-profile-info > span')?.textContent.replace('@',''); if (!friend) return;
    const pinned = pins.includes(friend); row.classList.toggle('pinned-chat', pinned);
    const button = document.createElement('button'); button.className = `pin-chat-btn ${pinned ? 'pinned' : ''}`; button.title = pinned ? 'Unpin chat' : 'Pin chat'; button.textContent = pinned ? '★' : '☆';
    button.onclick = event => togglePinnedChat(friend, event); row.appendChild(button);
  });
  rows.forEach(row => list.appendChild(row));
};

function gameState(e) {
  if (!e.game) e.game = { board: e.title === 'Chess' ? ['♜','♞','♝','♛','♚','♝','♞','♜','♟','♟','♟','♟','♟','♟','♟','♟','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','♙','♙','♙','♙','♙','♙','♙','♙','♖','♘','♗','♕','♔','♗','♘','♖'] : Array(9).fill(''), turn: e.mode === 'solo' ? currentUser : null, selected: null, log: [], started: Date.now(), prompt: '', score: {} };
  return e.game;
}
function canPlayGame(e) { return e.mode === 'solo' || (e.accepted && e.game?.turn === currentUser); }
function gameMessage(msgId, text) { const messages = DB.getMessages(); const m = messages.find(x => x.id === msgId); if (!m) return; const e = m.extension; const g = gameState(e); g.log.unshift(text); g.log = g.log.slice(0,8); DB.saveMessages(messages); renderMessages(false); }
function playGame(msgId, action, value) {
  const messages = DB.getMessages(); const m = messages.find(x => x.id === msgId); if (!m?.extension) return; const e = m.extension; const g = gameState(e);
  if (action === 'accept') { e.accepted = true; g.turn = m.sender; g.log.unshift(`${currentUser} accepted the challenge`); }
  else if (!canPlayGame(e)) return;
  else if (e.title === 'Tic-tac-toe' && action === 'cell') { if (g.board[value]) return; const mark = currentUser === m.sender ? 'X' : 'O'; g.board[value] = mark; if (win(g.board)) g.winner = currentUser; else if (g.board.every(Boolean)) g.winner = 'Draw'; else g.turn = otherPlayer(m, currentUser); }
  else if (e.title === 'Chess' && action === 'cell') { if (g.selected === null) { if (g.board[value]) g.selected = value; } else { const piece = g.board[g.selected]; if (piece) { g.board[value] = piece; g.board[g.selected] = ''; g.log.unshift(`${currentUser} moved ${piece}`); g.turn = e.mode === 'solo' ? currentUser : otherPlayer(m, currentUser); } g.selected = null; } }
  else if (e.title === 'Reaction speed' && action === 'start') { g.prompt = 'Now! Tap SCORE as quickly as you can.'; g.started = Date.now(); }
  else if (e.title === 'Reaction speed' && action === 'score' && g.prompt) { const time = Date.now() - g.started; g.score[currentUser] = time; g.prompt = `${currentUser}: ${time} ms`; g.turn = e.mode === 'solo' ? currentUser : otherPlayer(m, currentUser); }
  else if (action === 'submit') { const input = document.getElementById(`game-input-${msgId}`); const valueText = input?.value.trim(); if (!valueText) return; g.log.unshift(`${currentUser}: ${valueText}`); if (e.title === 'Guess the emoji' && /pizza/i.test(valueText)) g.winner = currentUser; g.turn = e.mode === 'solo' ? currentUser : otherPlayer(m, currentUser); }
  else if (e.title === 'Trivia' && action === 'answer') { g.winner = value === 'Pacific' ? currentUser : ''; g.prompt = value === 'Pacific' ? `${currentUser} got it right!` : 'Not quite — the answer was Pacific.'; }
  else if (e.title === 'Drawing challenge' && action === 'done') { g.log.unshift(`${currentUser} finished their drawing`); g.turn = e.mode === 'solo' ? currentUser : otherPlayer(m, currentUser); }
  DB.saveMessages(messages); renderMessages(false);
}
function otherPlayer(m, user) { return m.sender === user ? m.receiver : m.sender; }
function win(board) { return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(line => line.every(i => board[i] && board[i] === board[line[0]])); }
function gameInput(msgId, placeholder) { return `<div class="game-actions"><input id="game-input-${msgId}" placeholder="${placeholder}"><button onclick="playGame(${msgId},'submit')">Send</button></div>`; }
function gameHTML(m) {
  const e = m.extension, g = gameState(e); const locked = !canPlayGame(e); const title = escapeHTML(e.title);
  if (e.mode !== 'solo' && !e.accepted) return `<div class="extension-card game-card"><div class="extension-title">Game · ${title}</div><div class="game-status">Challenge waiting for acceptance.</div>${m.receiver === currentUser ? `<button class="poll-option" onclick="playGame(${m.id},'accept')">Accept & play</button>` : ''}</div>`;
  const status = g.winner ? (g.winner === 'Draw' ? 'It is a draw.' : `${g.winner} wins!`) : (locked ? `Waiting for @${g.turn}` : 'Your turn');
  let play = '';
  if (e.title === 'Tic-tac-toe') play = `<div class="game-board">${g.board.map((cell,i) => `<button ${locked||g.winner?'disabled':''} onclick="playGame(${m.id},'cell',${i})">${cell}</button>`).join('')}</div>`;
  else if (e.title === 'Chess') play = `<div class="game-board chess-board">${g.board.map((cell,i) => `<button class="${g.selected===i?'selected':''}" ${locked?'disabled':''} onclick="playGame(${m.id},'cell',${i})">${cell}</button>`).join('')}</div><div class="extension-meta">Tap a piece, then a square. This is a friendly free-move chess board.</div>`;
  else if (e.title === 'Guess the emoji') play = `<div class="game-prompt">🍕 Guess this emoji</div>${gameInput(m.id,'Your guess')}`;
  else if (e.title === 'Trivia') play = `<div class="game-prompt">Which is the largest ocean?</div><div class="game-actions"><button onclick="playGame(${m.id},'answer','Atlantic')">Atlantic</button><button onclick="playGame(${m.id},'answer','Pacific')">Pacific</button><button onclick="playGame(${m.id},'answer','Indian')">Indian</button></div>`;
  else if (e.title === 'Reaction speed') play = `<div class="game-prompt">${g.prompt || 'Test your speed.'}</div><div class="game-actions"><button onclick="playGame(${m.id},'start')">Start</button><button onclick="playGame(${m.id},'score')">Score!</button></div>`;
  else if (e.title === 'Drawing challenge') play = `<div class="game-prompt">Draw a rocket ship, then mark it done.</div><div class="game-actions"><button onclick="playGame(${m.id},'done')">I finished drawing</button></div>`;
  else if (e.title === 'Word battle') play = `<div class="game-prompt">Take turns with a word that starts with the last letter of the previous word.</div>${gameInput(m.id,'Type a word')}`;
  else play = `<div class="game-prompt">Ask a clever yes/no question. Take turns.</div>${gameInput(m.id,'Ask a question')}`;
  return `<div class="extension-card game-card"><div class="extension-title">Game · ${title}</div><div class="game-status">${status}</div>${play}<div class="game-log">${g.log.map(x => `<div>${escapeHTML(x)}</div>`).join('')}</div></div>`;
}

extensionHTML = function(message) { return message.extension?.type === 'game' ? gameHTML(message) : baseExtensionHTML(message); };
updateExtension = function(msgId, action, value) { if (action === 'accept') return playGame(msgId, action, value); return baseUpdateExtension(msgId, action, value); };

/* Reaction controls now require an intentional double-click. */
const originalRenderMessages = renderMessages;
renderMessages = function(forceScroll) {
  originalRenderMessages(forceScroll);
  document.querySelectorAll('.message').forEach(message => {
    const existing = message.onclick; message.onclick = null;
    message.ondblclick = event => { event.preventDefault(); const wrapper = message.closest('.message-wrapper'); const list = [...document.querySelectorAll('.message-wrapper')]; const index = list.indexOf(wrapper); const visible = DB.getMessages().filter(m => (m.sender === currentUser && m.receiver === activeFriend) || (m.sender === activeFriend && m.receiver === currentUser)); const msg = visible[index]; if (msg) toggleMsgPopover(event, msg.id); };
  });
};

/* Quest Crates: all progress and rewards remain local to the signed-in profile. */
const QUEST_DEFINITIONS = [
  { metric:'messages', target:5, gems:10, label:'Send 5 messages' }, { metric:'messages', target:20, gems:25, label:'Send 20 messages' }, { metric:'messages', target:50, gems:50, label:'Send 50 messages' },
  { metric:'images', target:1, gems:15, label:'Send 1 image' }, { metric:'images', target:5, gems:35, label:'Send 5 images' }, { metric:'images', target:15, gems:60, label:'Send 15 images' },
  { metric:'reactions', target:5, gems:10, label:'React 5 times' }, { metric:'reactions', target:25, gems:30, label:'React 25 times' }, { metric:'reactions', target:75, gems:75, label:'React 75 times' }
];
const FRAME_NAMES = { 'frame-gold':'Golden Halo', 'frame-neon':'Neon Cyan', 'frame-rose':'Rose Quartz', 'frame-void':'Void Purple', 'frame-sakura':'Sakura Bloom', 'frame-ocean':'Ocean Wave', 'frame-cosmic':'Cosmic Glow', 'frame-sunflower':'Sunflower Ring', 'frame-ice':'Ice Crown', 'frame-dragon':'Dragon Flame', 'frame-royal':'Royal Laurel' };
const CRATES = { common:{ cost:50, frames:['frame-sakura','frame-ocean','frame-sunflower'] }, rare:{ cost:120, frames:['frame-cosmic','frame-ice','frame-royal'] }, epic:{ cost:250, frames:['frame-dragon','frame-royal','frame-cosmic'] } };
function questKey() { return `quest_crates_${currentUser}`; }
function getQuestProfile() {
  const fallback = { gems:0, stats:{messages:0,images:0,reactions:0}, claimed:[], inventory:['frame-gold','frame-neon','frame-rose','frame-void'] };
  if (!currentUser) return fallback;
  const saved = JSON.parse(localStorage.getItem(questKey()) || 'null') || fallback;
  saved.stats = { ...fallback.stats, ...(saved.stats || {}) }; saved.claimed ||= []; saved.inventory ||= fallback.inventory;
  const currentFrame = DB.getUsers()[currentUser]?.frame; if (currentFrame && !saved.inventory.includes(currentFrame)) saved.inventory.push(currentFrame);
  return saved;
}
function saveQuestProfile(profile) { if (currentUser) localStorage.setItem(questKey(), JSON.stringify(profile)); }
function rewardQuestProgress(metric, amount=1) {
  if (!currentUser) return; const profile = getQuestProfile(); profile.stats[metric] += amount;
  QUEST_DEFINITIONS.forEach(quest => { const key = `${quest.metric}-${quest.target}`; if (quest.metric === metric && profile.stats[metric] >= quest.target && !profile.claimed.includes(key)) { profile.claimed.push(key); profile.gems += quest.gems; } });
  saveQuestProfile(profile); if (!document.getElementById('shop-modal').classList.contains('hidden')) renderQuestShop();
}
function openShop() { renderQuestShop(); document.getElementById('shop-modal').classList.remove('hidden'); }
function closeShop() { document.getElementById('shop-modal').classList.add('hidden'); }
function renderQuestShop() {
  const profile = getQuestProfile(); document.getElementById('gem-balance').textContent = profile.gems;
  const list = document.getElementById('quest-list'); list.innerHTML = '';
  QUEST_DEFINITIONS.forEach(quest => { const done = profile.stats[quest.metric] >= quest.target; const card = document.createElement('div'); card.className = 'quest-card'; card.innerHTML = `<strong>${escapeHTML(quest.label)}</strong><small>${Math.min(profile.stats[quest.metric],quest.target)} / ${quest.target}${done ? ' · complete' : ''}</small><div class="quest-progress"><i style="width:${Math.min(100, profile.stats[quest.metric] / quest.target * 100)}%"></i></div><div class="quest-reward">💎 ${quest.gems} gems</div>`; list.appendChild(card); });
  const inventory = document.getElementById('frame-inventory'); inventory.innerHTML = '';
  const current = DB.getUsers()[currentUser]?.frame || '';
  profile.inventory.forEach(frame => { const item = document.createElement('button'); item.className = `frame-choice ${current === frame ? 'active' : ''}`; item.textContent = FRAME_NAMES[frame] || frame; item.onclick = () => { changeProfileFrame(frame); renderQuestShop(); syncFrameSelect(); }; inventory.appendChild(item); });
}
function buyCrate(tier) {
  const crate = CRATES[tier]; const profile = getQuestProfile(); if (profile.gems < crate.cost) return alert(`You need ${crate.cost - profile.gems} more gems for this crate.`);
  profile.gems -= crate.cost; const available = crate.frames.filter(frame => !profile.inventory.includes(frame)); const duplicateReward = !available.length;
  const reward = (available.length ? available : crate.frames)[Math.floor(Math.random() * (available.length ? available.length : crate.frames.length))];
  if (!profile.inventory.includes(reward)) profile.inventory.push(reward); else profile.gems += Math.ceil(crate.cost * .2);
  saveQuestProfile(profile); const result = document.getElementById('crate-result'); result.innerHTML = duplicateReward ? `✨ Duplicate <strong>${FRAME_NAMES[reward]}</strong> converted to bonus gems.` : `✨ Crate opened! You unlocked <strong>${FRAME_NAMES[reward]}</strong>.`; result.classList.remove('hidden'); result.classList.add('show'); renderQuestShop(); syncFrameSelect();
}
function syncFrameSelect() {
  const select = document.getElementById('frame-select'); if (!select || !currentUser) return; const current = DB.getUsers()[currentUser]?.frame || ''; const profile = getQuestProfile();
  Object.entries(FRAME_NAMES).forEach(([frame,name]) => { let option = [...select.options].find(item => item.value === frame); if (!option && profile.inventory.includes(frame)) { option = document.createElement('option'); option.value = frame; option.textContent = name; select.appendChild(option); } if (option) option.disabled = !profile.inventory.includes(frame); });
  select.value = current;
}
const openSettingsWithFrames = openSettings;
openSettings = function() { openSettingsWithFrames(); syncFrameSelect(); };
const sendMessageWithQuests = sendMessage;
sendMessage = function() { const text = document.getElementById('message-input')?.value.trim(); const attachment = currentAttachment; const newMessage = !editingMsgId && activeFriend && (text || attachment); sendMessageWithQuests(); if (newMessage) { rewardQuestProgress('messages'); if (attachment?.type === 'image') rewardQuestProgress('images'); } };
const reactToMessageWithQuests = reactToMsg;
reactToMsg = function(messageId, emoji) { const message = DB.getMessages().find(m => m.id === messageId); const isNewReaction = message && !message.reactions?.[currentUser]; reactToMessageWithQuests(messageId, emoji); if (isNewReaction) rewardQuestProgress('reactions'); };

/* Keep Quests separate from the crate shop, with transparent crate rewards. */
Object.assign(FRAME_NAMES, { 'frame-rose-thorn':'Rose Thorn', 'frame-butterfly':'Butterfly Glow', 'frame-starlight':'Starlight Ring', 'frame-heart':'Heart Halo', 'frame-rainbow':'Rainbow Cloud', 'frame-pirate':'Pirate Wheel', 'frame-autumn':'Autumn Leaves', 'frame-moon':'Moonlit Sky', 'frame-cat':'Cat Paws', 'frame-candy':'Candy Pop', 'frame-holiday':'Holiday Wreath' });
CRATES.common.frames.push('frame-sakura','frame-sunflower','frame-heart','frame-autumn');
CRATES.rare.frames.push('frame-ocean','frame-butterfly','frame-ice','frame-rainbow','frame-cat');
CRATES.epic.frames.push('frame-cosmic','frame-dragon','frame-royal','frame-rose-thorn','frame-starlight','frame-pirate','frame-moon','frame-candy','frame-holiday');
const CRATE_PREVIEWS = { common:['Sakura Bloom','Sunflower Ring','Heart Halo','Autumn Leaves'], rare:['Ocean Wave','Butterfly Glow','Ice Crown','Rainbow Cloud','Cat Paws'], epic:['Cosmic Glow','Dragon Flame','Royal Laurel','Rose Thorn','Starlight Ring','Pirate Wheel','Moonlit Sky','Candy Pop','Holiday Wreath'] };
function buildQuestMenu() {
  if (document.getElementById('quest-modal')) return;
  document.body.insertAdjacentHTML('beforeend', '<div id="quest-modal" class="modal hidden"><div class="card quest-modal-card"><div class="shop-topline"><div><span class="shop-kicker">QUESTS</span><h2>Complete actions. Earn gems.</h2></div><button class="icon-btn" onclick="closeQuestMenu()" title="Close quests">×</button></div><div class="gem-wallet">💎 <strong id="quest-gem-balance">0</strong><span>Gems</span></div><div class="quest-area"><h3>Active quests</h3><div id="quest-list-standalone" class="quest-list"></div></div></div></div>');
  const toolbar = document.querySelector('.sidebar-header > div[style*="display:flex"]');
  if (toolbar) { const button = document.createElement('button'); button.className = 'icon-btn'; button.title = 'Quests'; button.textContent = '📋'; button.onclick = openQuestMenu; toolbar.insertBefore(button, toolbar.firstChild); }
  document.querySelectorAll('.crate-card').forEach(card => { const tier = [...card.classList].find(name => CRATE_PREVIEWS[name]); if (!tier || card.querySelector('.crate-info')) return; const info = document.createElement('span'); info.className = 'crate-info'; info.textContent = '?'; info.title = 'View possible rewards'; info.onclick = event => showCrateInfo(tier, event); card.appendChild(info); });
}
const renderQuestShopWithSeparateMenu = renderQuestShop;
renderQuestShop = function() { renderQuestShopWithSeparateMenu(); const standalone = document.getElementById('quest-list-standalone'); const original = document.getElementById('quest-list'); const gems = document.getElementById('quest-gem-balance'); if (standalone && original) standalone.innerHTML = original.innerHTML; if (gems) gems.textContent = getQuestProfile().gems; };
function openQuestMenu() { renderQuestShop(); document.getElementById('quest-modal').classList.remove('hidden'); }
function closeQuestMenu() { document.getElementById('quest-modal').classList.add('hidden'); }
function showCrateInfo(tier, event) { event.preventDefault(); event.stopPropagation(); document.querySelectorAll('.crate-info-popover').forEach(menu => menu.remove()); const menu = document.createElement('div'); menu.className = 'crate-info-popover'; menu.innerHTML = `<strong>Possible ${tier} rewards</strong>${CRATE_PREVIEWS[tier].map(name => `<span>✦ ${name}</span>`).join('')}`; event.currentTarget.parentElement.appendChild(menu); }
/* Quest Crates is paused. Its UI is not initialized. */
sendMessage = sendMessageWithQuests;
reactToMsg = reactToMessageWithQuests;
openSettings = openSettingsWithFrames;

/* Hubs: local group chats with invitations and member controls. */
let activeHub = null;
let hubCreationInProgress = false;
const directSendMessage = sendMessage;
function getHubs() { return JSON.parse(localStorage.getItem('hubs_data') || '[]'); }

// --- Firestore Hub sync bookkeeping -----------------------------------
// Same diff-and-mirror pattern used for DMs (see DB.saveMessages in
// index.html): lastSyncedHubs is the last array we mirrored to/from
// Firestore; applyingRemoteHubData guards against re-pushing a snapshot
// that just came FROM Firestore back into Firestore.
let lastSyncedHubs = [];
let applyingRemoteHubData = false;

function saveHubs(hubs) {
  localStorage.setItem('hubs_data', JSON.stringify(hubs));
  if (!applyingRemoteHubData && typeof window.syncHubsToFirestore === 'function') {
    window.syncHubsToFirestore(lastSyncedHubs, hubs);
  }
  lastSyncedHubs = hubs;
}

// Bridges the real-time Firestore Hub listener (see window.subscribeToHub
// in the Firebase module script) into the existing local `hubs_data` store,
// so renderHubMessages(), search, and everything else keep working
// unchanged — they just see other members' messages instantly.
window.mergeRemoteHubMessages = function (hubId, remoteMessages) {
  applyingRemoteHubData = true;
  try {
    const hubs = getHubs();
    const hub = hubs.find(h => h.id === hubId);
    if (hub) {
      hub.messages = remoteMessages.slice().sort((a, b) => a.id - b.id);
      saveHubs(hubs);
    }
  } finally {
    applyingRemoteHubData = false;
  }
  if (activeHub === hubId) renderHubMessages(false);
};

function hubById(id) { return getHubs().find(hub => hub.id === id); }
// Modular Smart Hub Feature check: works for any Hub type/category, since it
// only ever reads the same hub.features array the creation wizard already
// writes. Adding a new toggleable feature anywhere just means adding its
// label to that category's HUB_CATEGORY_FEATURES entry — no other code here
// needs to change to support it.
function hubHasFeature(hub, featureName) { return !!(hub && Array.isArray(hub.features) && hub.features.includes(featureName)); }
function safeHubText(value='') { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; }
function hubImageSource(value) {
  if (typeof value !== 'string') return '';
  const source = value.trim();
  return /^(?:data:image\/(?:png|jpe?g|webp|gif);base64,|https?:\/\/)/i.test(source) ? source : '';
}
/* Hub creation wizard: 7-step guided flow. Data lives in `hubWizard` until the
   final step commits a single Hub object — no partial/recommended Hubs are ever created. */
const HUB_CATEGORIES = [
  { id:'gaming', label:'Gaming', emoji:'🎮' },
  { id:'study', label:'Study/Productivity', emoji:'📚' },
  { id:'creator', label:'Creator', emoji:'🎨' },
  { id:'coding', label:'Coding/Tech', emoji:'💻' },
  { id:'music', label:'Music', emoji:'🎵' },
  { id:'sports', label:'Sports', emoji:'🏆' },
  { id:'community', label:'Community', emoji:'🌐' },
  { id:'other', label:'Other', emoji:'✨' }
];
const HUB_CATEGORY_FEATURES = {
  gaming: ['LFG board', 'Match schedule', 'Voice hangout callouts', 'Leaderboard'],
  study: ['Study sessions', 'Shared resources', 'Assignment tracker', 'Focus timer', '📝 Quiz Maker', '📅 Events', '🖊️ Whiteboard'],
  creator: ['Showcase feed', 'Feedback threads', 'Collab board', 'Release calendar'],
  coding: ['Code snippet sharing', 'Bug tracker', 'Pair programming board', 'Changelog'],
  music: ['Now playing', 'Setlist board', 'Jam session planner', 'Release drops'],
  sports: ['Match schedule', 'Score tracker', 'Team roster', 'Fan chat'],
  community: ['Announcements', 'Events calendar', 'Welcome board', 'Polls & feedback'],
  other: ['Announcements', 'Shared resources', 'Events calendar', 'General chat']
};
const HUB_ACCENTS = ['#2563eb', '#8b5cf6', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#ec4899', '#64748b'];
const HUB_WIZARD_STEP_NAMES = ['Identity', 'Category', 'Experience', 'Permissions', 'Appearance', 'Hub Context', 'Review'];
let hubWizard = null;
let hubWizardStep = 1;
function hubWizardEsc(value = '') { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function freshHubWizard() { return { icon:'', banner:'', background:'', name:'', description:'', category:'', features:[], permissions:{ messaging:'everyone', invites:'owner', activities:true, management:'owner' }, accent:'', primaryContext:'' }; }
function addHubModals() {
  if (document.getElementById('hub-create-modal')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="hub-create-modal" class="modal hidden hub-modal"><div class="card hub-wizard-card"><div class="hub-wizard-head"><div><div class="hub-wizard-kicker" id="hub-wizard-kicker">Step 1 of 7</div><h3 id="hub-wizard-title">Identity</h3></div><button type="button" class="icon-btn hub-wizard-close" onclick="closeHubModal('hub-create-modal')" title="Cancel" aria-label="Cancel">×</button></div><div class="hub-wizard-progress" id="hub-wizard-progress" role="list" aria-label="Hub creation steps"></div><div class="hub-wizard-body" id="hub-wizard-body"></div><div class="hub-wizard-footer" id="hub-wizard-footer"></div></div></div><div id="hub-settings-modal" class="modal hidden hub-modal"><div class="card"><h3>Hub settings</h3><label class="hub-form-label">Name</label><input id="hub-edit-name"><label class="hub-form-label">Description</label><textarea id="hub-edit-description"></textarea><label class="hub-form-label">Invite member</label><div class="input-row"><input id="hub-add-member" placeholder="Username"><button onclick="inviteToHub()">Invite</button></div><button type="button" class="secondary" onclick="copyHubInviteLink(activeHub)">Copy invite link</button><label class="hub-form-label">Members</label><div id="hub-members" class="hub-member-list"></div><button onclick="saveHubSettings()">Save changes</button><button class="secondary" onclick="closeHubModal('hub-settings-modal')">Close</button></div></div>`);
}
function closeHubModal(id) { document.getElementById(id).classList.add('hidden'); }
function fileAsData(inputId, done) { const file = document.getElementById(inputId)?.files[0]; if (!file) return done(''); if (!file.type.startsWith('image/') || file.size > 900 * 1024) { alert('Use a PNG, JPG, or WebP image under 900 KB for Hub images.'); hubCreationInProgress = false; return; } const reader = new FileReader(); reader.onerror = () => { hubCreationInProgress = false; alert('That image could not be read.'); }; reader.onload = e => done(e.target.result); reader.readAsDataURL(file); }
function openHubCreator() {
  addHubModals();
  const modal = document.getElementById('hub-create-modal');
  if (!modal) return alert('Hub creator could not load. Please refresh the page once.');
  hubWizard = freshHubWizard();
  hubWizardStep = 1;
  hubWizardRender();
  modal.classList.remove('hidden');
}
function hubWizardImagePreview(value, kind) {
  if (!value) return `<span class="hub-image-preview-empty">${kind === 'round' ? 'No icon' : 'No image'}</span>`;
  return `<img src="${value}" alt="">`;
}
function hubWizardRenderProgress() {
  const bar = document.getElementById('hub-wizard-progress');
  if (!bar) return;
  bar.innerHTML = HUB_WIZARD_STEP_NAMES.map((label, index) => {
    const num = index + 1, state = num < hubWizardStep ? 'done' : (num === hubWizardStep ? 'active' : '');
    return `<div class="hub-wizard-dot ${state}" role="listitem" aria-current="${num === hubWizardStep}" title="${hubWizardEsc(label)}"><span>${num < hubWizardStep ? '✓' : num}</span></div>`;
  }).join('<div class="hub-wizard-line"></div>');
}
function hubWizardStepHTML(step) {
  const w = hubWizard;
  if (step === 1) {
    return `<div class="hub-wizard-avatar-row"><div class="hub-image-preview hub-image-preview-round">${hubWizardImagePreview(w.icon, 'round')}</div><div class="hub-wizard-avatar-field"><label class="hub-form-label">Hub icon (optional)</label><input id="hub-icon-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="hubWizardReadImage(this,'icon')"></div></div><label class="hub-form-label">Hub name</label><input id="hub-name" placeholder="Study Squad" value="${hubWizardEsc(w.name)}" oninput="hubWizard.name=this.value"><label class="hub-form-label">Description</label><textarea id="hub-description" placeholder="What is this hub for?" oninput="hubWizard.description=this.value">${hubWizardEsc(w.description)}</textarea><label class="hub-form-label">Header banner (optional)</label><div class="hub-image-preview hub-image-preview-banner">${hubWizardImagePreview(w.banner, 'banner')}</div><input id="hub-banner-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="hubWizardReadImage(this,'banner')">`;
  }
  if (step === 2) {
    return `<p class="hub-wizard-help">Pick the category that best fits this Hub — it shapes which features we suggest next.</p><div class="hub-category-grid">${HUB_CATEGORIES.map(c => `<button type="button" class="hub-category-card${w.category === c.id ? ' selected' : ''}" onclick="hubWizardSelectCategory('${c.id}')"><span class="hub-category-emoji">${c.emoji}</span><span>${hubWizardEsc(c.label)}</span></button>`).join('')}</div>`;
  }
  if (step === 3) {
    const options = HUB_CATEGORY_FEATURES[w.category] || HUB_CATEGORY_FEATURES.other;
    const label = HUB_CATEGORIES.find(c => c.id === w.category)?.label || 'this';
    const smartBanner = w.category === 'study' ? `<div class="smart-hub-banner"><span class="smart-hub-corner-icon" aria-hidden="true">✦</span><strong class="smart-hub-title">Looks like a Study Hub ✦</strong><p class="smart-hub-sub">We've suggested a few features to help shape your Hub. You're in control.</p></div>` : '';
    return `${smartBanner}<p class="hub-wizard-help">Turn on the Hub features that fit a ${hubWizardEsc(label)} community. You can change these later in Hub settings.</p><div class="hub-feature-list">${options.map(f => `<label class="hub-feature-chip"><span class="hub-feature-chip-label">${hubWizardEsc(f)}</span><span class="hub-toggle"><input type="checkbox" ${w.features.includes(f) ? 'checked' : ''} onchange="hubWizardToggleFeature('${hubWizardEsc(f)}', this.checked)"><span class="hub-toggle-track"><span class="hub-toggle-thumb"></span></span></span></label>`).join('')}</div>`;
  }
  if (step === 4) {
    const p = w.permissions;
    return `<div class="hub-permission-group"><div class="hub-permission-title">Who can send messages?</div><label class="hub-permission-option"><input type="radio" name="hw-msg" ${p.messaging === 'everyone' ? 'checked' : ''} onchange="hubWizardSetPermission('messaging','everyone')"><span>Everyone in the Hub</span></label><label class="hub-permission-option"><input type="radio" name="hw-msg" ${p.messaging === 'owner' ? 'checked' : ''} onchange="hubWizardSetPermission('messaging','owner')"><span>Only the owner (announcements)</span></label></div><div class="hub-permission-group"><div class="hub-permission-title">Who can invite members?</div><label class="hub-permission-option"><input type="radio" name="hw-invite" ${p.invites === 'owner' ? 'checked' : ''} onchange="hubWizardSetPermission('invites','owner')"><span>Only the owner</span></label><label class="hub-permission-option"><input type="radio" name="hw-invite" ${p.invites === 'members' ? 'checked' : ''} onchange="hubWizardSetPermission('invites','members')"><span>Any member</span></label></div><div class="hub-permission-group"><div class="hub-permission-title">Activities</div><label class="hub-permission-option"><input type="checkbox" ${p.activities ? 'checked' : ''} onchange="hubWizardSetPermission('activities', this.checked)"><span>Allow games &amp; activities in this Hub</span></label></div><div class="hub-permission-group"><div class="hub-permission-title">Who can manage this Hub?</div><label class="hub-permission-option"><input type="radio" name="hw-manage" ${p.management === 'owner' ? 'checked' : ''} onchange="hubWizardSetPermission('management','owner')"><span>Only the owner</span></label><label class="hub-permission-option"><input type="radio" name="hw-manage" ${p.management === 'members' ? 'checked' : ''} onchange="hubWizardSetPermission('management','members')"><span>All members</span></label></div>`;
  }
  if (step === 5) {
    return `<label class="hub-form-label">Icon</label><div class="hub-image-preview hub-image-preview-round">${hubWizardImagePreview(w.icon, 'round')}</div><input id="hub-icon-file-2" type="file" accept="image/png,image/jpeg,image/webp" onchange="hubWizardReadImage(this,'icon')"><label class="hub-form-label">Header banner</label><div class="hub-image-preview hub-image-preview-banner">${hubWizardImagePreview(w.banner, 'banner')}</div><input id="hub-banner-file-2" type="file" accept="image/png,image/jpeg,image/webp" onchange="hubWizardReadImage(this,'banner')"><label class="hub-form-label">Chat background</label><div class="hub-image-preview hub-image-preview-banner">${hubWizardImagePreview(w.background, 'banner')}</div><input id="hub-bg-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="hubWizardReadImage(this,'background')"><label class="hub-form-label">Hub accent theme</label><div class="hub-accent-grid">${HUB_ACCENTS.map(hex => `<button type="button" class="hub-accent-swatch${w.accent === hex ? ' selected' : ''}" style="--accent-color:${hex}" onclick="hubWizardSelectAccent('${hex}')" aria-label="Accent ${hex}"></button>`).join('')}</div>`;
  }
  if (step === 6) {
    return `<p class="hub-wizard-help">Optional. Give members quick context — goals, rules, or what belongs here.</p><label class="hub-form-label">Primary Context</label><textarea id="hub-context" placeholder="e.g. This Hub is for our Calc II study group. Share notes, ask questions, keep it kind." oninput="hubWizard.primaryContext=this.value">${hubWizardEsc(w.primaryContext)}</textarea>`;
  }
  const category = HUB_CATEGORIES.find(c => c.id === w.category);
  const p = w.permissions;
  return `<div class="hub-review-block"><div class="hub-review-heading">Identity</div><div class="hub-review-identity"><div class="hub-image-preview hub-image-preview-round hub-image-preview-small">${hubWizardImagePreview(w.icon, 'round')}</div><div><strong>${hubWizardEsc(w.name || 'Untitled Hub')}</strong><p>${hubWizardEsc(w.description || 'No description yet.')}</p></div></div></div><div class="hub-review-block"><div class="hub-review-heading">Category</div><div>${category ? `${category.emoji} ${hubWizardEsc(category.label)}` : 'Not set'}</div></div><div class="hub-review-block"><div class="hub-review-heading">Experience</div><div class="hub-review-chips">${w.features.length ? w.features.map(f => `<span class="hub-review-chip">${hubWizardEsc(f)}</span>`).join('') : '<span class="hub-wizard-help">No features selected.</span>'}</div></div><div class="hub-review-block"><div class="hub-review-heading">Permissions</div><ul class="hub-review-list"><li>Messaging: ${p.messaging === 'owner' ? 'Owner only' : 'Everyone'}</li><li>Invites: ${p.invites === 'members' ? 'Any member' : 'Owner only'}</li><li>Activities: ${p.activities ? 'Enabled' : 'Disabled'}</li><li>Management: ${p.management === 'members' ? 'All members' : 'Owner only'}</li></ul></div><div class="hub-review-block"><div class="hub-review-heading">Appearance</div><div class="hub-review-appearance"><div class="hub-image-preview hub-image-preview-round hub-image-preview-small">${hubWizardImagePreview(w.icon, 'round')}</div><div class="hub-image-preview hub-image-preview-banner hub-image-preview-small">${hubWizardImagePreview(w.banner, 'banner')}</div><div class="hub-image-preview hub-image-preview-banner hub-image-preview-small">${hubWizardImagePreview(w.background, 'banner')}</div><span class="hub-accent-swatch small" style="--accent-color:${w.accent || 'var(--primary)'}"></span></div></div><div class="hub-review-block"><div class="hub-review-heading">Hub Context</div><p>${hubWizardEsc(w.primaryContext || 'No additional context added.')}</p></div>`;
}
function hubWizardRenderFooter() {
  const footer = document.getElementById('hub-wizard-footer');
  if (!footer) return;
  const back = hubWizardStep > 1 ? `<button type="button" class="secondary" onclick="hubWizardBack()">Back</button>` : `<button type="button" class="secondary" onclick="closeHubModal('hub-create-modal')">Cancel</button>`;
  const forward = hubWizardStep < HUB_WIZARD_STEP_NAMES.length ? `<button type="button" onclick="hubWizardNext()">Continue</button>` : `<button type="button" onclick="hubWizardFinish()">Create Hub</button>`;
  footer.innerHTML = `<div class="hub-wizard-footer-inner">${back}${forward}</div>`;
}
function hubWizardRender() {
  hubWizardRenderProgress();
  const kicker = document.getElementById('hub-wizard-kicker'), title = document.getElementById('hub-wizard-title'), body = document.getElementById('hub-wizard-body');
  if (kicker) kicker.textContent = `Step ${hubWizardStep} of ${HUB_WIZARD_STEP_NAMES.length}`;
  if (title) title.textContent = HUB_WIZARD_STEP_NAMES[hubWizardStep - 1];
  if (body) body.innerHTML = hubWizardStepHTML(hubWizardStep);
  hubWizardRenderFooter();
}
function hubWizardReadImage(inputEl, key) {
  const file = inputEl.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 900 * 1024) { alert('Use a PNG, JPG, or WebP image under 900 KB for Hub images.'); inputEl.value = ''; return; }
  const reader = new FileReader();
  reader.onerror = () => alert('That image could not be read.');
  reader.onload = e => { hubWizard[key] = e.target.result; hubWizardRender(); };
  reader.readAsDataURL(file);
}
function hubWizardSelectCategory(id) { hubWizard.category = id; hubWizard.features = (HUB_CATEGORY_FEATURES[id] || []).slice(0, 2); hubWizardRender(); }
function hubWizardToggleFeature(name, checked) { const set = new Set(hubWizard.features); if (checked) set.add(name); else set.delete(name); hubWizard.features = Array.from(set); }
function hubWizardSetPermission(key, value) { hubWizard.permissions[key] = value; }
function hubWizardSelectAccent(hex) { hubWizard.accent = hubWizard.accent === hex ? '' : hex; hubWizardRender(); }
function hubWizardGoTo(step) { hubWizardStep = step; hubWizardRender(); }
function hubWizardNext() {
  if (hubWizardStep === 1 && !hubWizard.name.trim()) return alert('Give your Hub a name.');
  if (hubWizardStep === 2 && !hubWizard.category) return alert('Choose a category for your Hub.');
  if (hubWizardStep < HUB_WIZARD_STEP_NAMES.length) { hubWizardStep += 1; hubWizardRender(); }
}
function hubWizardBack() { if (hubWizardStep > 1) { hubWizardStep -= 1; hubWizardRender(); } }
function hubWizardFinish() {
  if (hubCreationInProgress) return;
  if (!hubWizard.name.trim()) { hubWizardGoTo(1); return alert('Give your Hub a name.'); }
  if (!hubWizard.category) { hubWizardGoTo(2); return alert('Choose a category for your Hub.'); }
  hubCreationInProgress = true;
  const hubs = getHubs();
  const category = HUB_CATEGORIES.find(c => c.id === hubWizard.category);
  const hub = {
    id: Date.now(), name: hubWizard.name.trim(), description: hubWizard.description.trim(),
    type: category ? category.label : 'Other', category: hubWizard.category,
    owner: currentUser, members: [currentUser], invites: [],
    icon: hubWizard.icon, background: hubWizard.background, banner: hubWizard.banner, accent: hubWizard.accent,
    features: hubWizard.features.slice(), permissions: { ...hubWizard.permissions },
    primaryContext: hubWizard.primaryContext.trim(), messages: []
  };
  hubs.push(hub);
  try { saveHubs(hubs); } catch (error) { hubCreationInProgress = false; return alert('Hub storage is full. Choose smaller images or remove an old Hub.'); }
  hubCreationInProgress = false;
  closeHubModal('hub-create-modal');
  selectHub(hub.id);
}
const createHub = hubWizardFinish;
function selectHub(id) {
  const hub = hubById(id); if (!hub || !hub.members.includes(currentUser)) return;
  const icon = hubImageSource(hub.icon), headerImage = hubImageSource(hub.banner), chatImage = hubImageSource(hub.background);
  activeHub = id; activeFriend = null; ensureHubBanner(); const accentStyle = hub.accent ? ` style="--hub-accent:${hub.accent}"` : ''; const banner = document.getElementById('hub-banner-info'); const image = icon ? `<img class="hub-banner-icon" src="${icon}" alt="${safeHubText(hub.name)} icon"${accentStyle}>` : `<div class="hub-banner-icon fallback"${accentStyle}>${safeHubText(hub.name).charAt(0).toUpperCase()}</div>`; banner.innerHTML = `${image}<div class="hub-banner-copy"><div class="hub-banner-name" title="${safeHubText(hub.primaryContext || '')}">${safeHubText(hub.name)}</div><span class="hub-banner-meta">${safeHubText(hub.type)} · ${hub.members.length} member${hub.members.length === 1 ? '' : 's'}</span></div>`; banner.classList.add('visible'); const header=document.getElementById('chat-header'); header.style.backgroundImage = headerImage ? `linear-gradient(rgba(15,23,42,.58),rgba(15,23,42,.58)),url('${headerImage}')` : ''; header.style.backgroundSize = headerImage ? 'cover' : ''; header.style.backgroundPosition = headerImage ? 'center' : ''; document.querySelector('.main-chat').classList.add('hub-active'); document.getElementById('chat-header-avatar-container').classList.add('hidden'); document.getElementById('chat-title').innerHTML = '';
  document.getElementById('chat-input-container').classList.remove('hidden'); document.getElementById('hub-settings-btn').classList.remove('hidden'); document.getElementById('hub-invite-btn').classList.remove('hidden'); document.getElementById('hub-pinned-messages-btn')?.classList.remove('hidden'); document.getElementById('hub-search-btn').classList.remove('hidden'); document.getElementById('pinned-messages-btn').classList.add('hidden'); const messages = document.getElementById('messages-list'); messages.classList.toggle('hub-chat-bg', !!chatImage); messages.style.backgroundImage = chatImage ? `url('${chatImage}')` : '';
  renderHubMessages(true); renderSidebar(); document.getElementById('app-screen').classList.remove('sidebar-open');
  if (typeof window.subscribeToHub === 'function') window.subscribeToHub(id);
}
function ensureHubBanner() { if (document.getElementById('hub-banner-info')) return; const banner=document.createElement('div'); banner.id='hub-banner-info'; banner.className='hub-banner-info'; document.getElementById('mobile-conversations').insertAdjacentElement('afterend', banner); }
const selectFriendWithHubBanner = selectFriend;
selectFriend = function(friend) { if (typeof window.unsubscribeFromHub === 'function') window.unsubscribeFromHub(); activeHub = null; const banner = document.getElementById('hub-banner-info'); if (banner) banner.classList.remove('visible'); document.querySelector('.main-chat').classList.remove('hub-active'); const header = document.getElementById('chat-header'); header.style.backgroundImage = ''; header.style.backgroundSize = ''; header.style.backgroundPosition = ''; const messages = document.getElementById('messages-list'); messages.classList.remove('hub-chat-bg'); applyWallpaper(localStorage.getItem('wallpaper') || ''); document.getElementById('hub-settings-btn').classList.add('hidden'); document.getElementById('hub-invite-btn').classList.add('hidden'); document.getElementById('hub-pinned-messages-btn')?.classList.add('hidden'); document.getElementById('hub-pinned-messages-menu')?.classList.add('hidden'); document.getElementById('hub-search-btn').classList.add('hidden'); closeHubSearch(); document.getElementById('pinned-messages-btn').classList.remove('hidden'); selectFriendWithHubBanner(friend); };
function renderHubMessages(scroll) {
  const hub = hubById(activeHub); if (!hub) return; const list = document.getElementById('messages-list'); const query = document.getElementById('hub-message-search')?.value.trim().toLowerCase() || ''; if (typeof trackNewMessages === 'function') trackNewMessages('hub:' + activeHub, hub.messages, list, scroll); list.innerHTML = '';
  const visibleMessages = hub.messages.filter(message => !query || `${message.sender} ${message.text || ''}`.toLowerCase().includes(query));
  if (!visibleMessages.length && query) list.innerHTML = '<div class="hub-search-empty">No Hub messages match your search.</div>';
  let lastDateKey = null;
  visibleMessages.forEach(message => {
    const msgDateKey = new Date(message.id).toDateString();
    if (msgDateKey !== lastDateKey) {
      list.appendChild(buildDateSeparatorElement(message.id));
      lastDateKey = msgDateKey;
    }
    const newMsgDivider = typeof newMessagesDividerFor === 'function' ? newMessagesDividerFor(message.id) : null;
    if (newMsgDivider) list.appendChild(newMsgDivider);
    const sent = message.sender === currentUser; const row = document.createElement('div'); row.className = `message-wrapper ${sent ? 'sent' : 'received'}${scroll ? ' message-arrive' : ''}`; row.dataset.messageId = message.id; row.classList.toggle('message-pinned', !!message.pinned); const structuredContent = (message.extension && typeof extensionHTML === 'function') ? extensionHTML(message) : ''; const locationCard = (typeof locationCardHTML === 'function') ? locationCardHTML(message.text) : null; const pinterestCard = (typeof pinterestCardSlotHTML === 'function') ? pinterestCardSlotHTML(message.text, message.id) : ''; row.innerHTML = `<div class="message-body-row"><img class="avatar" src="${(DB.getUsers()[message.sender]?.pfp) || DEFAULT_AVATAR}" style="width:26px;height:26px;"><div class="message ${sent ? 'sent' : 'received'}${isStickerAttachment(message.attachment) && !message.text ? ' sticker-only' : ''}"><div class="hub-message-name">@${safeHubText(message.sender)}</div>${typeof replyChipHTML === 'function' ? replyChipHTML(message) : ''}${message.attachment?.type === 'image' ? `<img src="${message.attachment.data}" class="attachment-img${isStickerAttachment(message.attachment) ? ' sticker-img' : ''}">` : ''}${structuredContent}${locationCard || (message.text ? `<div>${parseTextLinks(message.text)}</div>` : '')}${pinterestCard}<div style="font-size:10px;opacity:.7;text-align:right;">${message.timestamp}</div></div></div>`;

    // Reactions + pin: same popover UI/behaviour as Direct Chat
    // (buildMsgPopoverElement / buildReactionBadgeElement in index.html —
    // shared, not duplicated). The pin button itself is Hub-specific
    // (togglePinnedHubMessage), kept entirely separate from Direct Chat's
    // togglePinnedMessage/pinned-messages-btn/-menu, which are untouched.
    const msgEl = row.querySelector('.message');
    if (msgEl) msgEl.onclick = (e) => toggleMsgPopover(e, message.id);
    if (activePopoverMsgId === message.id && typeof buildMsgPopoverElement === 'function') {
      const bodyRow = row.querySelector('.message-body-row');
      if (bodyRow) {
        const popoverEl = buildMsgPopoverElement(message.id, sent);
        bodyRow.appendChild(popoverEl);
        if (!popoverEl.querySelector('.pin-message-popover')) {
          const pin = document.createElement('button'); pin.className = `pin-message-popover ${message.pinned ? 'is-pinned' : ''}`;
          pin.title = message.pinned ? 'Unpin message' : 'Pin message'; pin.textContent = '📌';
          pin.onclick = event => togglePinnedHubMessage(message.id, event);
          popoverEl.appendChild(pin);
        }
      }
    } else if (typeof buildMsgHoverBarElement === 'function') {
      const bodyRow = row.querySelector('.message-body-row');
      if (bodyRow) bodyRow.appendChild(buildMsgHoverBarElement(message.id));
    }
    if (typeof buildReactionBadgeElement === 'function') {
      const badge = buildReactionBadgeElement(message.id, message.reactions);
      if (badge) row.appendChild(badge);
    }

    list.appendChild(row);
  });
  if (scroll) list.scrollTop = list.scrollHeight;
  if (typeof updateJumpToLatestVisibility === 'function') updateJumpToLatestVisibility();
  if (activePopoverMsgId !== null && typeof positionMsgPopoverMobile === 'function') positionMsgPopoverMobile();
  const hubPinnedMenu = document.getElementById('hub-pinned-messages-menu');
  if (hubPinnedMenu && !hubPinnedMenu.classList.contains('hidden')) renderHubPinnedMessagesMenu();
}
function togglePinnedHubMessage(msgId, event) {
  event?.stopPropagation();
  const hubs = getHubs(), hub = hubs.find(h => h.id === activeHub); if (!hub) return;
  const msg = hub.messages.find(m => m.id === msgId); if (!msg) return;
  msg.pinned = !msg.pinned;
  saveHubs(hubs);
  activePopoverMsgId = null; activeMoreMenuMsgId = null;
  renderHubMessages(false);
}
function hubPinnedPreview(message) {
  if (message.text) return message.text;
  if (message.extension?.type === 'note') return message.extension.title;
  if (message.extension) return `${message.extension.type}: ${message.extension.title || ''}`;
  if (message.attachment) return `Attachment: ${message.attachment.name || 'file'}`;
  return 'Message';
}
function renderHubPinnedMessagesMenu() {
  const menu = document.getElementById('hub-pinned-messages-menu'); if (!menu) return;
  const hub = hubById(activeHub); if (!hub) return;
  const pinned = (hub.messages || []).filter(m => m.pinned);
  menu.innerHTML = `<div class="pinned-menu-title"><span>Pinned messages</span><span>${pinned.length}</span></div>`;
  if (!pinned.length) { menu.innerHTML += '<div class="pinned-message-empty">No pinned messages yet</div>'; return; }
  pinned.forEach(message => {
    const item = document.createElement('button'); item.className = 'pinned-message-item';
    item.innerHTML = `📌 <small>@${escapeHTML(message.sender)}: ${escapeHTML(hubPinnedPreview(message))}</small>`;
    item.onclick = () => jumpToHubPinnedMessage(message.id);
    menu.appendChild(item);
  });
}
function toggleHubPinnedMessages() {
  if (!activeHub) return;
  const menu = document.getElementById('hub-pinned-messages-menu');
  renderHubPinnedMessagesMenu(); menu.classList.toggle('hidden');
}
function jumpToHubPinnedMessage(messageId) {
  document.getElementById('hub-pinned-messages-menu').classList.add('hidden');
  const target = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.remove('pin-jump'); void target.offsetWidth; target.classList.add('pin-jump');
}
sendMessage = function() { if (!activeHub) return directSendMessage(); const input = document.getElementById('message-input'), text = input.value.trim(); if (!text && !currentAttachment) return; const hubs = getHubs(), hub = hubs.find(item => item.id === activeHub); if (!hub) return; if (hub.permissions?.messaging === 'owner' && hub.owner !== currentUser) return alert('Only the Hub owner can send messages in this Hub.'); hub.messages.push({id:Date.now(),sender:currentUser,text,attachment:currentAttachment,replyTo:replyingToMessage?{...replyingToMessage}:null,timestamp:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}); saveHubs(hubs); input.value=''; removeAttachment(); cancelReply(); renderHubMessages(true); };
function hubCanManage(hub) { return !!hub && (hub.owner === currentUser || hub.permissions?.management === 'members'); }
function openHubSettings() { const hub = hubById(activeHub); if (!hub) return; addHubModals(); ensureHubAppearanceSettings(); if (!hubCanManage(hub)) return alert('Only the Hub owner can change settings or manage members.'); document.getElementById('hub-edit-name').value = hub.name; document.getElementById('hub-edit-description').value = hub.description; document.getElementById('hub-edit-context').value = hub.primaryContext || ''; hubEditSelectAccent(hub.accent || ''); renderHubMembers(hub); document.getElementById('hub-settings-modal').classList.remove('hidden'); }
// Small, focused "Invite to Hub" menu — opened by the people-plus icon
// beside the Hub search icon. Shows the current user's real Firestore
// friends (window.firestoreFriendUsernames) with a one-tap Invite button
// each, plus the "Copy invite link" option. Inviting from this list can
// never hit "User not found": these usernames already came from a real,
// Firestore-verified friendship, unlike a freshly-typed username which may
// belong to an account this browser has never mirrored locally.
function ensureHubInviteModal() {
  if (document.getElementById('hub-invite-modal')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="hub-invite-modal" class="modal hidden hub-modal"><div class="card hub-invite-card"><h3>Invite to Hub</h3><label class="hub-form-label">Friends</label><div id="hub-invite-friends-list" class="hub-invite-friends-list"></div><label class="hub-form-label">Or share a link</label><button type="button" class="secondary" onclick="copyHubInviteLink(activeHub)">Copy invite link</button><button type="button" class="secondary" onclick="closeHubModal('hub-invite-modal')">Close</button></div></div>`);
}

function renderHubInviteFriends(hub) {
  const container = document.getElementById('hub-invite-friends-list');
  if (!container) return;
  const friends = window.firestoreFriendUsernames || [];
  const users = DB.getUsers();
  container.innerHTML = '';
  if (!friends.length) {
    container.innerHTML = '<div class="hub-invite-empty">No friends yet — add some first, or share the invite link below.</div>';
    return;
  }
  friends.forEach(friend => {
    const isMember = hub.members.includes(friend);
    const isInvited = hub.invites.includes(friend);
    const pfp = (users[friend] && users[friend].pfp) ? users[friend].pfp : DEFAULT_AVATAR;
    const row = document.createElement('div');
    row.className = 'hub-invite-friend-row';
    row.innerHTML = `<div class="user-profile-info"><img class="avatar" src="${pfp}" style="width:28px;height:28px;"><span>@${safeHubText(friend)}</span></div>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'poll-option';
    btn.textContent = isMember ? 'Member' : (isInvited ? 'Invited' : 'Invite');
    btn.disabled = isMember || isInvited;
    if (!btn.disabled) btn.onclick = () => inviteFriendToHub(hub.id, friend, btn);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

function inviteFriendToHub(hubId, friend, btnEl) {
  const hubs = getHubs(), hub = hubs.find(item => item.id === hubId); if (!hub) return;
  if (hub.members.includes(friend) || hub.invites.includes(friend)) return;
  hub.invites.push(friend); saveHubs(hubs);
  sendHubInviteMessage(hub, friend);
  if (btnEl) { btnEl.textContent = 'Invited'; btnEl.disabled = true; }
}

function openHubInvitePanel() {
  const hub = hubById(activeHub); if (!hub) return;
  if (hub.permissions?.invites !== 'members' && !hubCanManage(hub)) return alert('Only the Hub owner can invite new members.');
  ensureHubInviteModal();
  renderHubInviteFriends(hub);
  document.getElementById('hub-invite-modal').classList.remove('hidden');
}
// Drops a hub_invite card into the existing DM thread with `toUsername` —
// reuses the exact same DB.getMessages()/DB.saveMessages() path every other
// DM already goes through (already Firestore-synced), so no new sync code
// is needed for the invite message itself.
function sendHubInviteMessage(hub, toUsername) {
  const messages = DB.getMessages();
  messages.push({
    id: Date.now(), sender: currentUser, receiver: toUsername,
    text: '', attachment: null, reactions: {},
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    extension: { type: 'hub_invite', hubId: hub.id, hubName: hub.name }
  });
  DB.saveMessages(messages);
}

// Falls back to the public usernames/{username} Firestore lookup — the same
// one requestFriendship() (index.html) already uses — when a username isn't
// in this browser's local mirror yet, e.g. the account was created on a
// different device. Mirrors it locally via ensureLocalMirror() on success,
// so the rest of the Hub invite flow (hub.invites, member lists) is
// unchanged from here on.
async function resolveHubInviteTarget(name) {
  name = (name || '').trim();
  if (!name) return null;
  const users = DB.getUsers();
  let actual = Object.keys(users).find(user => user.toLowerCase() === name.toLowerCase());
  if (!actual && typeof window.lookupUsername === 'function') {
    const resolved = await window.lookupUsername(name);
    if (resolved) {
      ensureLocalMirror(resolved.username, resolved.photoURL);
      actual = resolved.username;
    }
  }
  return actual || null;
}

async function quickInviteToHub(hubId, name) {
  name = (name || '').trim(); if (!name) return;
  const actual = await resolveHubInviteTarget(name);
  const hubs = getHubs(), hub = hubs.find(item => item.id === hubId); if (!hub) return;
  if (!actual) return alert('User not found.');
  if (hub.members.includes(actual) || hub.invites.includes(actual)) return alert('That user is already in this Hub or has an invite.');
  hub.invites.push(actual); saveHubs(hubs);
  sendHubInviteMessage(hub, actual);
  alert(`Invite sent to @${actual}.`);
}
function toggleHubSearch() { if (!activeHub) return; const panel = document.getElementById('hub-search-panel'); panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) document.getElementById('hub-message-search').focus(); }
function closeHubSearch() { const panel = document.getElementById('hub-search-panel'); if (!panel) return; panel.classList.add('hidden'); const input = document.getElementById('hub-message-search'); if (input?.value) { input.value = ''; if (activeHub) renderHubMessages(false); } }
function filterHubMessages() { if (activeHub) renderHubMessages(false); }
function ensureHubAppearanceSettings() { if (document.getElementById('hub-edit-icon')) return; document.getElementById('hub-members').insertAdjacentHTML('afterend', `<label class="hub-form-label">Change Hub icon</label><input id="hub-edit-icon" type="file" accept="image/png,image/jpeg,image/webp"><label class="hub-form-label">Change chat background</label><input id="hub-edit-background" type="file" accept="image/png,image/jpeg,image/webp"><label class="hub-form-label">Change header banner</label><input id="hub-edit-banner" type="file" accept="image/png,image/jpeg,image/webp"><label class="hub-form-label">Hub accent theme</label><div class="hub-accent-grid" id="hub-edit-accent-grid">${HUB_ACCENTS.map(hex => `<button type="button" class="hub-accent-swatch" style="--accent-color:${hex}" onclick="hubEditSelectAccent('${hex}')" aria-label="Accent ${hex}"></button>`).join('')}</div><input type="hidden" id="hub-edit-accent-value"><label class="hub-form-label">Primary Context (optional)</label><textarea id="hub-edit-context" placeholder="Goals, rules, or what belongs here"></textarea>`); }
function hubEditSelectAccent(hex) { const field = document.getElementById('hub-edit-accent-value'); if (field) field.value = hex; document.querySelectorAll('#hub-edit-accent-grid .hub-accent-swatch').forEach(btn => btn.classList.toggle('selected', hex && btn.style.getPropertyValue('--accent-color') === hex)); }
function renderHubMembers(hub) { const target = document.getElementById('hub-members'); target.innerHTML = ''; hub.members.forEach(member => { const chip = document.createElement('div'); chip.className='hub-member-chip'; chip.innerHTML = `@${safeHubText(member)}${member !== hub.owner ? `<button title="Remove member" onclick="removeHubMember('${member}')">×</button>` : ' · Owner'}`; target.appendChild(chip); }); }
async function inviteToHub() { const name = document.getElementById('hub-add-member').value.trim(); const actual = await resolveHubInviteTarget(name); const hubs=getHubs(), hub=hubs.find(item=>item.id===activeHub); if (!actual) return alert('User not found.'); if (hub.members.includes(actual) || hub.invites.includes(actual)) return alert('That user is already in this Hub or has an invite.'); hub.invites.push(actual); saveHubs(hubs); sendHubInviteMessage(hub, actual); document.getElementById('hub-add-member').value=''; alert(`Invite sent to @${actual}.`); }
function removeHubMember(member) { const hubs=getHubs(), hub=hubs.find(item=>item.id===activeHub); if (!hub || member===hub.owner) return; hub.members=hub.members.filter(user=>user!==member); saveHubs(hubs); renderHubMembers(hub); renderSidebar(); }

// Shareable "join this Hub" link — anyone signed in to Nexora who opens it
// joins the Hub automatically (see the ?joinHub= handling in loadApp(),
// index.html), same underlying join as joinHubFromInvite() above. Useful
// for invites outside of DMs (e.g. pasted into a group chat elsewhere).
function copyHubInviteLink(hubId) {
  const hub = hubById(hubId); if (!hub) return;
  const url = `${location.origin}${location.pathname}?joinHub=${hub.id}`;
  const done = () => alert(`Invite link copied!\n\n${url}\n\nAnyone signed in to Nexora who opens it will join "${hub.name}".`);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => prompt('Copy this invite link:', url));
  } else {
    prompt('Copy this invite link:', url);
  }
}
window.copyHubInviteLink = copyHubInviteLink;
function saveHubSettings() {
  const hubs=getHubs(), hub=hubs.find(item=>item.id===activeHub); if (!hub) return;
  hub.name=document.getElementById('hub-edit-name').value.trim() || hub.name;
  hub.description=document.getElementById('hub-edit-description').value.trim();
  const contextField = document.getElementById('hub-edit-context'); if (contextField) hub.primaryContext = contextField.value.trim();
  const accentField = document.getElementById('hub-edit-accent-value'); if (accentField) hub.accent = accentField.value || '';
  const updateAppearance = (inputId, property, done) => {
    const file=document.getElementById(inputId)?.files[0];
    if (!file) return done();
    if (!file.type.startsWith('image/') || file.size > 900 * 1024) return alert('Use a PNG, JPG, or WebP image under 900 KB.');
    const reader=new FileReader(); reader.onload=e=>{hub[property]=e.target.result; done();}; reader.readAsDataURL(file);
  };
  updateAppearance('hub-edit-icon','icon', () => {
    updateAppearance('hub-edit-background','background', () => {
      updateAppearance('hub-edit-banner','banner', () => {
        try { saveHubs(hubs); } catch (error) { return alert('Hub storage is full. Choose smaller images.'); }
        closeHubModal('hub-settings-modal'); selectHub(hub.id);
      });
    });
  });
}
const sidebarWithHubs = renderSidebar;
renderSidebar = function() {
  document.getElementById('hub-sidebar-section')?.remove(); sidebarWithHubs(); if (!currentUser) return;
  const list = document.getElementById('friends-list'), hubs = getHubs();
  const visible = hubs.filter(hub => hub.members.includes(currentUser)).filter((hub,index,all) => all.findIndex(item => item.owner === hub.owner && item.name === hub.name && item.type === hub.type) === index);
  const invites = hubs.filter(hub => hub.invites.includes(currentUser));
  if (visible.length || invites.length) {
    const section=document.createElement('div'); section.id='hub-sidebar-section'; section.className='section'; section.innerHTML='<div class="hub-list-title">Hubs</div><ul class="item-list hub-list"></ul>'; const hubList=section.querySelector('.hub-list'); list.parentElement.parentElement.insertBefore(section,list.parentElement);
    visible.forEach(hub => { const row=document.createElement('li'); const icon = hubImageSource(hub.icon); const accentStyle = hub.accent ? ` style="--hub-accent:${hub.accent}"` : ''; row.className=`hub-row ${activeHub===hub.id?'active-friend':''}`; row.innerHTML=`<div class="user-profile-info">${icon ? `<img class="hub-icon" src="${icon}" alt="">` : `<div class="hub-icon"${accentStyle}>#</div>`}<div><span>${safeHubText(hub.name)}</span><small>${safeHubText(hub.type)} · ${hub.members.length} member${hub.members.length === 1 ? '' : 's'}</small></div></div>`; row.onclick=()=>selectHub(hub.id); hubList.appendChild(row); });
    invites.forEach(hub => { const row=document.createElement('li'); row.innerHTML=`<span>Invite: ${safeHubText(hub.name)}</span><button>Join</button>`; row.querySelector('button').onclick=event=>{event.stopPropagation(); acceptHubInvite(hub.id);}; hubList.appendChild(row); });
  }
};
function acceptHubInvite(id) { const hubs=getHubs(), hub=hubs.find(item=>item.id===id); if (!hub) return; hub.invites=hub.invites.filter(user=>user!==currentUser); if (!hub.members.includes(currentUser)) hub.members.push(currentUser); saveHubs(hubs); selectHub(id); }

// Called from the "Join Hub" button on a hub_invite DM card (see the
// hub_invite case in extensionHTML, index.html). Unlike acceptHubInvite
// above, this doesn't assume the Hub already exists in this browser's
// local `hubs_data` — the invite may have come from a friend on a
// different device — so it fetches the Hub's Firestore mirror first and
// creates a local copy if needed. Icon/banner/background aren't part of
// that mirror (see window.syncHubsToFirestore), so a Hub joined this way
// starts with no custom images until someone uploads them on this device.
async function joinHubFromInvite(hubId) {
  if (typeof window.joinFirestoreHub !== 'function') return alert('Hub sync is not available right now.');
  const result = await window.joinFirestoreHub(hubId, currentUser);
  if (!result.ok) return alert(result.message || 'Could not join this Hub.');

  const hubs = getHubs();
  let hub = hubs.find(h => h.id === hubId);
  if (!hub) {
    hub = {
      id: hubId, name: result.hub.name || 'Hub', description: result.hub.description || '',
      type: result.hub.type || 'Other', category: result.hub.category || '',
      owner: result.hub.owner, members: result.hub.members || [currentUser], invites: [],
      icon: '', background: '', banner: '', accent: '', features: [],
      permissions: { messaging: 'everyone', invites: 'owner', activities: true, management: 'owner' },
      primaryContext: '', messages: []
    };
    hubs.push(hub);
  } else if (!hub.members.includes(currentUser)) {
    hub.members.push(currentUser);
  }
  hub.invites = (hub.invites || []).filter(u => u !== currentUser);
  saveHubs(hubs);
  selectHub(hubId);
}
window.joinHubFromInvite = joinHubFromInvite;
addHubModals();
if (currentUser) renderSidebar();
window.openHubCreator = openHubCreator;
window.createHub = createHub;
window.closeHubModal = closeHubModal;
window.openHubSettings = openHubSettings;
window.openHubInvitePanel = openHubInvitePanel;
window.toggleHubSearch = toggleHubSearch;
window.closeHubSearch = closeHubSearch;
window.filterHubMessages = filterHubMessages;

/* Mobile interaction polish: use the existing drawer control, respect keyboards and safe viewport height. */
function updateMobileViewport() {
  const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--mobile-app-height', `${Math.round(height)}px`);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateMobileViewport);
  window.visualViewport.addEventListener('scroll', updateMobileViewport);
}
window.addEventListener('resize', updateMobileViewport);
updateMobileViewport();
document.addEventListener('focusin', event => {
  if (event.target.id === 'message-input') setTimeout(() => document.getElementById('messages-list')?.scrollTo({ top: document.getElementById('messages-list').scrollHeight, behavior:'smooth' }), 120);
});
document.addEventListener('click', event => {
  const app = document.getElementById('app-screen');
  if (!app?.classList.contains('sidebar-open')) return;
  if (event.target.closest('.sidebar') || event.target.closest('#mobile-conversations')) return;
  app.classList.remove('sidebar-open');
});

/* Add Friend writes to Firebase Firestore (friendRequests collection) — see
   window.sendFirestoreFriendRequest in the Firebase module script in
   index.html. No local storage is used for sending requests. */
sendFriendRequest = function() {
  const field = document.getElementById('search-username');
  const identifier = field.value.trim();
  if (!identifier) return alert('Enter a username or email.');
  window.sendFirestoreFriendRequest(identifier).then(result => {
    if (result.ok) { alert('Friend request sent!'); field.value = ''; }
    else alert(result.message || 'Could not send friend request.');
  });
};

/* Pin individual messages and make them easy to find again. */
function conversationMessages() {
  return activeFriend ? DB.getMessages().filter(m => (m.sender === currentUser && m.receiver === activeFriend) || (m.sender === activeFriend && m.receiver === currentUser)) : [];
}
function pinnedPreview(message) {
  if (message.text) return message.text;
  if (message.extension?.type === 'note') return message.extension.title;
  if (message.extension) return `${message.extension.type}: ${message.extension.title || ''}`;
  if (message.attachment) return `Attachment: ${message.attachment.name || 'file'}`;
  return 'Message';
}
function togglePinnedMessage(messageId, event) {
  event?.stopPropagation();
  const messages = DB.getMessages(); const message = messages.find(m => m.id === messageId); if (!message) return;
  message.pinned = !message.pinned;
  DB.saveMessages(messages);
  activePopoverMsgId = null; activeMoreMenuMsgId = null;
  renderMessages(false);
}
function renderPinnedMessagesMenu() {
  const menu = document.getElementById('pinned-messages-menu'); if (!menu) return;
  const pinned = conversationMessages().filter(m => m.pinned);
  menu.innerHTML = `<div class="pinned-menu-title"><span>Pinned messages</span><span>${pinned.length}</span></div>`;
  if (!pinned.length) { menu.innerHTML += '<div class="pinned-message-empty">No pinned messages yet</div>'; return; }
  pinned.forEach(message => {
    const item = document.createElement('button'); item.className = 'pinned-message-item';
    item.innerHTML = `📌 <small>${escapeHTML(pinnedPreview(message))}</small>`;
    item.onclick = () => jumpToPinnedMessage(message.id);
    menu.appendChild(item);
  });
}
function togglePinnedMessages() {
  if (!activeFriend) return;
  const menu = document.getElementById('pinned-messages-menu');
  renderPinnedMessagesMenu(); menu.classList.toggle('hidden');
}
function jumpToPinnedMessage(messageId) {
  document.getElementById('pinned-messages-menu')?.classList.add('hidden');
  const target = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior:'smooth', block:'center' });
  target.classList.remove('pin-jump'); void target.offsetWidth; target.classList.add('pin-jump');
}

/* Saved Messages (private bookmarks) — Direct Chat only.
   A DM message can be privately "bookmarked" by the signed-in user. Stored
   locally per-account (bookmarks_<username> in localStorage) and NEVER
   synced to Firestore, so the other participant in the DM never sees it —
   unlike the old shared `message.pinned` field above, which is visible to
   both sides. This is what the DM "Pin message" action/label now does.
   Hub pinning (togglePinnedHubMessage, hub-pinned-messages-btn/-menu,
   hub.messages[].pinned) is a separate, shared, permission-gated feature
   and is completely untouched by this. */
function getBookmarks() {
  if (!currentUser) return [];
  return JSON.parse(localStorage.getItem(`bookmarks_${currentUser}`) || '[]');
}
function saveBookmarksList(list) {
  if (!currentUser) return;
  localStorage.setItem(`bookmarks_${currentUser}`, JSON.stringify(list));
}
function isMessageBookmarked(messageId) {
  return getBookmarks().some(b => b.messageId === messageId);
}
function toggleBookmarkMessage(messageId, event) {
  event?.stopPropagation();
  const messages = DB.getMessages(); const message = messages.find(m => m.id === messageId); if (!message) return;
  const bookmarks = getBookmarks();
  const existingIndex = bookmarks.findIndex(b => b.messageId === messageId);
  if (existingIndex !== -1) {
    bookmarks.splice(existingIndex, 1);
  } else {
    bookmarks.unshift({
      messageId: message.id,
      type: 'dm',
      withUser: message.sender === currentUser ? message.receiver : message.sender,
      sender: message.sender,
      text: pinnedPreview(message),
      originalTimestamp: message.id,
      savedAt: Date.now()
    });
  }
  saveBookmarksList(bookmarks);
  activePopoverMsgId = null; activeMoreMenuMsgId = null;
  renderMessages(false);
  const modal = document.getElementById('saved-messages-modal');
  if (modal && !modal.classList.contains('hidden') && typeof renderSavedMessages === 'function') renderSavedMessages();
}
function removeBookmark(messageId) {
  saveBookmarksList(getBookmarks().filter(b => b.messageId !== messageId));
  renderMessages(false);
  if (typeof renderSavedMessages === 'function') renderSavedMessages();
}
function formatBookmarkTimestamp(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function renderSavedMessages() {
  const list = document.getElementById('saved-messages-list'); if (!list) return;
  const bookmarks = getBookmarks();
  if (!bookmarks.length) { list.innerHTML = '<div class="saved-message-empty">No saved messages yet. Bookmark a Direct Message to see it here.</div>'; return; }
  list.innerHTML = '';
  bookmarks.forEach(b => {
    const item = document.createElement('div'); item.className = 'saved-message-item';
    const locationLabel = b.type === 'hub' ? `Hub · ${escapeHTML(b.hubName || '')}` : `DM · @${escapeHTML(b.withUser || '')}`;
    item.innerHTML = `
      <div class="saved-message-top">
        <span class="saved-message-sender">@${escapeHTML(b.sender)}</span>
        <span class="saved-message-location">${locationLabel}</span>
      </div>
      <div class="saved-message-text">${escapeHTML(b.text || '(no text)')}</div>
      <div class="saved-message-meta">
        <span>Sent ${formatBookmarkTimestamp(b.originalTimestamp)}</span>
        <span>Saved ${formatBookmarkTimestamp(b.savedAt)}</span>
      </div>
      <div class="saved-message-actions">
        <button type="button" class="secondary saved-message-open-btn">Open</button>
        <button type="button" class="saved-message-remove-btn">Remove</button>
      </div>`;
    item.querySelector('.saved-message-open-btn').onclick = () => openBookmarkedMessage(b);
    item.querySelector('.saved-message-remove-btn').onclick = () => removeBookmark(b.messageId);
    list.appendChild(item);
  });
}
function openBookmarkedMessage(bookmark) {
  closeSavedMessages();
  if (bookmark.type === 'dm' && bookmark.withUser) {
    selectFriend(bookmark.withUser);
    setTimeout(() => jumpToPinnedMessage(bookmark.messageId), 150);
  }
}
function openSavedMessages() {
  document.getElementById('saved-messages-modal')?.classList.remove('hidden');
  renderSavedMessages();
}
function closeSavedMessages() {
  document.getElementById('saved-messages-modal')?.classList.add('hidden');
}

const renderMessagesWithDoubleClick = renderMessages;
renderMessages = function(forceScroll) {
  renderMessagesWithDoubleClick(forceScroll);
  const shown = conversationMessages();
  document.querySelectorAll('.message-wrapper').forEach((wrapper, index) => {
    const message = shown[index]; if (!message) return;
    wrapper.dataset.messageId = message.id;
    wrapper.classList.toggle('message-pinned', !!message.pinned);
  });
  if (activePopoverMsgId) {
    const active = shown.find(m => m.id === activePopoverMsgId);
    const popover = document.querySelector('.msg-popover');
    if (active && popover && !popover.querySelector('.pin-message-popover')) {
      const bookmarked = isMessageBookmarked(active.id);
      const pin = document.createElement('button'); pin.className = `pin-message-popover ${bookmarked ? 'is-pinned' : ''}`;
      pin.title = bookmarked ? 'Remove bookmark' : 'Bookmark message'; pin.textContent = '🔖';
      pin.onclick = event => toggleBookmarkMessage(active.id, event);
      popover.appendChild(pin);
    }
  }
  const menu = document.getElementById('pinned-messages-menu'); if (menu && !menu.classList.contains('hidden')) renderPinnedMessagesMenu();
  // Re-run mobile popover positioning now that the pin button above may have
  // widened it — otherwise the earlier positioning pass (inside the original
  // renderMessages, before this pin button existed) could clamp using a
  // stale, narrower width and let the wider final popover overflow again.
  if (typeof positionMsgPopoverMobile === 'function') positionMsgPopoverMobile();
};

/* Smart Context: high-confidence suggestions only; every action remains opt-in. */
function smartContextFor(message) {
  if (!message?.text || message.contextDismissed) return null;
  const text = message.text.trim().toLowerCase();
  const locationRequest = /\b(where are you|where r u|where you at|share (your )?location|send (your )?location)\b/.test(text);
  const outside = /\b(i['’]?m|i am|im)\s+(already\s+)?outside\b/.test(text);
  const reminder = /\b(remind me|reminder|don't let me forget|do not let me forget|google calendar|calendar reminder|let'?s meet|meeting)\b/.test(text) && /\b(today|tomorrow|tonight|next |at \d|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(text);
  const task = /\b(google tasks?|add (?:this|it) to (?:my )?tasks?|make (?:this|it) a task|to[- ]do)\b/.test(text);
  if (locationRequest || outside) return { type:'location', text: outside ? 'Looks like they have arrived. Choose a quick reply?' : 'They are asking for your location.', actions: outside ? [['coming','🚪 Coming'],['five','⏳ 5 min'],['location','📍 Share location']] : [['location','📍 Share location']] };
  if (task) return { type:'task', text:'This sounds like a task. Add it to a shared to-do list?', actions:[['task','✓ Create task']] };
  if (reminder) return { type:'reminder', text:'This mentions a time or meeting. Create a reminder card?', actions:[['calendar','☆ Create reminder']] };
  return null;
}
function dismissSmartContext(messageId) {
  const messages = DB.getMessages(); const message = messages.find(m => m.id === messageId); if (!message) return;
  message.contextDismissed = true; DB.saveMessages(messages); renderMessages(false);
}
function smartCalendarDefault() {
  const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(17,0,0,0);
  const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0,16);
}
function smartContextAction(messageId, action) {
  const message = DB.getMessages().find(m => m.id === messageId); if (!message) return;
  if (action === 'location') { dismissSmartContext(messageId); shareLocation(); return; }
  if (action === 'coming' || action === 'five') {
    const input = document.getElementById('message-input'); input.value = action === 'coming' ? "I'm coming now." : "I'll be there in 5 minutes."; dismissSmartContext(messageId); sendMessage(); return;
  }
  if (action === 'calendar') {
    dismissSmartContext(messageId); openExtension('calendar');
    document.getElementById('ext-title').value = message.text.slice(0,80);
    document.getElementById('ext-date').value = smartCalendarDefault();
    return;
  }
  if (action === 'task') {
    dismissSmartContext(messageId); openExtension('todo');
    document.getElementById('ext-title').value = 'New task';
    document.getElementById('ext-items').value = message.text.slice(0,120);
  }
}
function smartContextCard(message, context) {
  const actions = context.actions.map(([action,label]) => `<button onclick="smartContextAction(${message.id},'${action}')">${label}</button>`).join('');
  return `<div class="smart-context-card"><div class="smart-context-heading"><span>✦ Smart Context</span><button title="Dismiss suggestion" onclick="dismissSmartContext(${message.id})">×</button></div><div class="smart-context-text">${context.text}</div><div class="smart-context-actions">${actions}</div></div>`;
}
const renderMessagesWithPins = renderMessages;
renderMessages = function(forceScroll) {
  renderMessagesWithPins(forceScroll);
  const shown = conversationMessages();
  document.querySelectorAll('.message-wrapper').forEach((wrapper, index) => {
    const message = shown[index], context = smartContextFor(message);
    if (message && context && !wrapper.querySelector('.smart-context-card')) wrapper.insertAdjacentHTML('beforeend', smartContextCard(message, context));
  });
};

/* Swipe right to reply and left to forward. Horizontal drags must be deliberate,
   so scrolling and the existing message popovers continue to work normally. */
let swipeStart = null;
function messageById(id) {
  if (activeHub) return hubById(activeHub)?.messages.find(message => String(message.id) === String(id));
  return DB.getMessages().find(message => String(message.id) === String(id));
}
let replyingToMessage = null; // { id, sender, text } while a reply draft is active, else null
function replyToMessage(message) {
  const input = document.getElementById('message-input'); if (!input || !message) return;
  const text = message.text || pinnedPreview(message);
  replyingToMessage = { id: message.id, sender: message.sender, text: (text || '').slice(0, 140) };
  const bar = document.getElementById('reply-preview-bar');
  if (bar) {
    document.getElementById('reply-preview-bar-sender').textContent = `@${replyingToMessage.sender}`;
    document.getElementById('reply-preview-bar-snippet').textContent = replyingToMessage.text;
    bar.classList.remove('hidden');
  }
  input.focus();
}
function cancelReply() {
  replyingToMessage = null;
  document.getElementById('reply-preview-bar')?.classList.add('hidden');
}
function jumpToRepliedMessage(messageId) {
  const target = document.querySelector(`.message-wrapper[data-message-id="${messageId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.remove('pin-jump'); void target.offsetWidth; target.classList.add('pin-jump');
}
function openForwardSheet(message) {
  if (!message || document.getElementById('forward-message-sheet')) return;
  const friends = (window.firestoreFriendUsernames || []).filter(friend => friend !== activeFriend);
  const hubs = getHubs().filter(hub => hub.members.includes(currentUser) && hub.id !== activeHub);
  const options = [...friends.map(friend => `<button onclick="forwardMessageTo('${safeHubText(friend)}','direct')">@${safeHubText(friend)}</button>`), ...hubs.map(hub => `<button onclick="forwardMessageTo('${hub.id}','hub')"># ${safeHubText(hub.name)}</button>`)].join('') || '<p class="forward-empty">No other conversations available.</p>';
  document.body.insertAdjacentHTML('beforeend', `<div id="forward-message-sheet" class="forward-sheet"><div class="forward-card"><div class="forward-sheet-title"><span>Forward message</span><button class="icon-btn" onclick="closeForwardSheet()" aria-label="Close">×</button></div><p class="forward-preview">${safeHubText(pinnedPreview(message)).slice(0, 140)}</p><div class="forward-destinations">${options}</div></div></div>`);
  document.getElementById('forward-message-sheet').dataset.messageId = message.id;
}
function closeForwardSheet() { document.getElementById('forward-message-sheet')?.remove(); }
function forwardMessageTo(destination, type) {
  const sheet = document.getElementById('forward-message-sheet'); const message = messageById(sheet?.dataset.messageId); if (!message) return closeForwardSheet();
  const timestamp = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); const text = `↪ ${message.text || pinnedPreview(message)}`;
  if (type === 'hub') { const hubs = getHubs(); const hub = hubs.find(item => String(item.id) === String(destination)); if (hub) { hub.messages.push({id:Date.now(),sender:currentUser,text,attachment:null,timestamp}); saveHubs(hubs); } }
  else { const messages = DB.getMessages(); messages.push({id:Date.now(),sender:currentUser,receiver:destination,text,attachment:null,reactions:{},timestamp}); DB.saveMessages(messages); }
  closeForwardSheet();
}
document.addEventListener('pointerdown', event => { const wrapper = event.target.closest('.message-wrapper[data-message-id]'); if (!wrapper || event.pointerType === 'mouse') return; swipeStart = { wrapper, x:event.clientX, y:event.clientY, moved:false }; });
document.addEventListener('pointermove', event => { if (!swipeStart) return; const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y; if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 8) return; swipeStart.moved = true; const shift = Math.max(-68, Math.min(68, dx)); swipeStart.wrapper.style.setProperty('--swipe-x', `${shift}px`); swipeStart.wrapper.classList.add('swiping'); swipeStart.wrapper.classList.toggle('swipe-reply', shift > 20); swipeStart.wrapper.classList.toggle('swipe-forward', shift < -20); });
document.addEventListener('pointerup', event => { if (!swipeStart) return; const { wrapper, x, y, moved } = swipeStart; const dx = event.clientX - x, dy = event.clientY - y; swipeStart = null; wrapper.style.removeProperty('--swipe-x'); wrapper.classList.remove('swiping','swipe-reply','swipe-forward'); if (!moved || Math.abs(dy) > 56 || Math.abs(dx) < 58) return; const message = messageById(wrapper.dataset.messageId); if (dx > 0) replyToMessage(message); else openForwardSheet(message); });
document.addEventListener('pointercancel', () => { if (!swipeStart) return; swipeStart.wrapper.style.removeProperty('--swipe-x'); swipeStart.wrapper.classList.remove('swiping','swipe-reply','swipe-forward'); swipeStart = null; });
window.closeForwardSheet = closeForwardSheet;
window.forwardMessageTo = forwardMessageTo;

/* Mobile long-press on a message opens the same reaction/action popover a
   normal tap already opens (toggleMsgPopover in index.html) — normal tap
   itself is completely untouched. Entirely separate tracking from the
   swipe-to-reply/forward listeners above; only clears swipeStart (so the
   same press can't also fire a swipe) and never reads/depends on it. */
let longPressTimer = null;
let longPressTarget = null;
let suppressNextMsgClick = false;
document.addEventListener('pointerdown', event => { const wrapper = event.target.closest('.message-wrapper[data-message-id]'); if (!wrapper || event.pointerType === 'mouse' || event.target.closest('.msg-popover')) return; longPressTarget = { wrapper, x: event.clientX, y: event.clientY }; longPressTimer = setTimeout(() => { longPressTimer = null; if (!longPressTarget) return; longPressTarget = null; swipeStart = null; suppressNextMsgClick = true; activePopoverMsgId = wrapper.dataset.messageId; activeMoreMenuMsgId = null; if (activeHub) renderHubMessages(false); else renderMessages(false); }, 500); });
document.addEventListener('pointermove', event => { if (!longPressTimer || !longPressTarget) return; if (Math.abs(event.clientX - longPressTarget.x) > 10 || Math.abs(event.clientY - longPressTarget.y) > 10) { clearTimeout(longPressTimer); longPressTimer = null; longPressTarget = null; } });
document.addEventListener('pointerup', () => { clearTimeout(longPressTimer); longPressTimer = null; longPressTarget = null; });
document.addEventListener('pointercancel', () => { clearTimeout(longPressTimer); longPressTimer = null; longPressTarget = null; });
document.addEventListener('click', event => { if (!suppressNextMsgClick) return; suppressNextMsgClick = false; if (event.target.closest('.message-wrapper[data-message-id]')) { event.stopPropagation(); event.preventDefault(); } }, true);

const renderMessagesWithMotion = renderMessages;
renderMessages = function(forceScroll) {
  const list = document.getElementById('messages-list');
  const prevTop = list ? list.scrollTop : 0;
  renderMessagesWithMotion(forceScroll);
  if (forceScroll) document.querySelector('.message-wrapper:last-of-type')?.classList.add('message-arrive');
  if (!list) return;
  // Everything that changes the list's height (messages, pins, Smart Context
  // cards, motion) has now run. A forced render scrolls to the latest message
  // only now, and keeps it there while attachments load (settleDmScroll in
  // index.html). A plain re-render (Firestore snapshot, 3s poll, reaction...)
  // puts the reading position back. That has to wait for the message-grouping
  // observer below, which tightens message spacing in a microtask AFTER this
  // render; when the list shrinks, scroll anchoring drags scrollTop up and the
  // view ends up short of where it was. A microtask queued now runs after the
  // observer's, so it sees the final layout.
  if (forceScroll) { settleDmScroll(false); return; }
  queueMicrotask(() => {
    if (Math.abs(list.scrollTop - prevTop) > 1) { list.scrollTop = prevTop; updateJumpToLatestVisibility(); }
  });
};

/* Chat Extensions: /whiteboard slash command. Hub-only, and only opens
   anything when that Hub actually has the Whiteboard Smart Hub Feature
   enabled (same hubHasFeature gate as the extension-menu button) — typing
   it anywhere else just sends as ordinary text, same as any other message. */
const beforeWhiteboardSlashCommand = sendMessage;
sendMessage = function() {
  const input = document.getElementById('message-input');
  const text = input ? input.value.trim() : '';
  if (activeHub && /^\/whiteboard$/i.test(text)) {
    const hub = hubById(activeHub);
    if (hub && hubHasFeature(hub, '🖊️ Whiteboard')) {
      input.value = '';
      openWhiteboard();
      return;
    }
  }
  return beforeWhiteboardSlashCommand();
};
/* Message grouping — consecutive messages from the same sender collapse
   under one avatar/name with tighter spacing (the CSS for .msg-grouped is
   in style.css). Purely a class toggle on the wrappers the DM and Hub
   renderers already create, so nothing that indexes into
   .message-wrapper (pin/reply/swipe handlers) is affected. An observer on
   the list re-runs it after every render, whichever renderer produced it. */
function applyMessageGrouping() {
  const list = document.getElementById('messages-list'); if (!list) return;
  let prevEl = null, prevKey = null;
  Array.from(list.children).forEach(el => {
    if (!el.classList.contains('message-wrapper')) { prevEl = null; return; }
    // Direct chats: sent/received identifies the sender. Hubs: received
    // messages also carry the sender's name.
    const key = el.classList.contains('sent') ? '__me__' : (el.querySelector('.hub-message-name')?.textContent || '__them__');
    el.classList.toggle('msg-grouped', !!prevEl && key === prevKey);
    prevEl = el; prevKey = key;
  });
}
(function () {
  const list = document.getElementById('messages-list');
  if (list) new MutationObserver(applyMessageGrouping).observe(list, { childList: true });
})();
/* ---- Home header: time-based greeting + live clock, and the header ⋯ menu ----
   The greeting/clock only show while no chat and no Hub is open (the old
   "Select a friend to message" state). Visibility is a single `is-home` class
   on #chat-header, kept in sync by a MutationObserver on the elements the
   existing selectFriend()/selectHub() already toggle, so none of that code
   needed to change. The ⋯ button reuses the original #pinned-messages-btn id
   (selectFriend/selectHub already show/hide it by id) and now hosts the
   Saved Messages entry (openSavedMessagesFromMenu) as a menu item. */
(function initHomeHeader() {
  const header = document.getElementById('chat-header');
  if (!header) return;
  const helloEl = document.getElementById('home-greeting-hello');
  const nameEl = document.getElementById('home-greeting-name');
  const subEl = document.getElementById('home-greeting-sub');
  const timeEl = document.getElementById('home-clock-time');
  const dateEl = document.getElementById('home-clock-date');

  function greetingFor(now) {
    const hour = now.getHours();
    if (hour >= 5 && hour < 12) return ['Good morning', 'Pick a chat to say hi.'];
    if (hour >= 12 && hour < 17) return ['Good afternoon', 'Pick a chat to continue.'];
    return ['Good evening', 'Pick a chat to catch up.'];
  }
  // Only touch the DOM when the text actually changed (no needless repaints).
  function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }

  function refreshHomeHeader() {
    const isHome = !activeFriend && !activeHub;
    header.classList.toggle('is-home', isHome);
    if (!isHome) return;
    const now = new Date();
    const [hello, sub] = greetingFor(now);
    setText(helloEl, hello);
    setText(nameEl, currentUser ? `, ${currentUser}` : '');
    setText(subEl, sub);
    setText(timeEl, now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    setText(dateEl, now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));
  }

  // Instant sync with the existing navigation code, without editing it:
  // selectFriend() un-hides the avatar container, selectHub() toggles
  // .hub-active on .main-chat, and login/logout toggles #app-screen.
  const observer = new MutationObserver(refreshHomeHeader);
  [document.querySelector('.main-chat'), document.getElementById('chat-header-avatar-container'), document.getElementById('app-screen')]
    .forEach(node => { if (node) observer.observe(node, { attributes: true, attributeFilter: ['class'] }); });

  // Clock: tick on the minute boundary (the display has no seconds), and
  // catch up immediately when the tab/window comes back to the foreground.
  (function scheduleTick() {
    setTimeout(() => { refreshHomeHeader(); scheduleTick(); }, 60000 - (Date.now() % 60000) + 50);
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshHomeHeader(); });
  window.addEventListener('focus', refreshHomeHeader);

  refreshHomeHeader();
})();

/* Back arrow in the chat header (DMs and Hubs): returns to the home state, i.e.
   no chat and no Hub open. It is the inverse of selectFriend()/selectHub(): drop
   the live Firestore stream, clear the active chat, and undo every piece of
   header/chat chrome those two switched on. The greeting, clock and the arrow's
   own visibility then follow automatically from the .is-home sync in
   initHomeHeader(). Works the same on desktop and mobile; on mobile the home
   screen keeps its existing ☰ button for opening the conversations drawer. */
function goHome() {
  if (!activeFriend && !activeHub) return;
  if (typeof window.unsubscribeFromConversation === 'function') window.unsubscribeFromConversation();
  if (typeof window.unsubscribeFromHub === 'function') window.unsubscribeFromHub();
  activeFriend = null; activeHub = null;
  knownMsgCount = 0; activePopoverMsgId = null; activeMoreMenuMsgId = null;
  // Anything anchored to the message input goes away with it.
  document.getElementById('emoji-picker')?.classList.add('hidden');
  document.getElementById('extension-menu')?.classList.add('hidden');
  // Hub chrome (same resets selectFriend() applies when leaving a Hub).
  document.getElementById('hub-banner-info')?.classList.remove('visible');
  const header = document.getElementById('chat-header');
  header.style.backgroundImage = ''; header.style.backgroundSize = ''; header.style.backgroundPosition = '';
  const messages = document.getElementById('messages-list');
  messages.classList.remove('hub-chat-bg');
  applyWallpaper(localStorage.getItem('wallpaper') || '');
  ['hub-settings-btn', 'hub-invite-btn', 'hub-pinned-messages-btn', 'hub-search-btn'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('hub-pinned-messages-menu')?.classList.add('hidden');
  closeHubSearch();
  document.getElementById('pinned-messages-btn')?.classList.remove('hidden'); // home hosts the ⋯ Saved Messages menu
  // DM chrome.
  document.getElementById('chat-header-avatar-container').classList.add('hidden');
  document.getElementById('chat-title').innerText = 'Select a friend to message';
  document.getElementById('chat-input-container').classList.add('hidden');
  messages.innerHTML = '';
  document.querySelector('.main-chat').classList.remove('hub-active');
  renderSidebar();
  updateJumpToLatestVisibility();
}
window.goHome = goHome;

function closeHeaderMoreMenu() {
  document.getElementById('header-more-menu')?.classList.add('hidden');
  document.getElementById('pinned-messages-btn')?.setAttribute('aria-expanded', 'false');
}
function toggleHeaderMoreMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('header-more-menu'); if (!menu) return;
  // The pinned list used to be toggled by this very button, so if it's open,
  // the button keeps acting as its close control.
  const pinnedList = document.getElementById('pinned-messages-menu');
  if (pinnedList && !pinnedList.classList.contains('hidden')) { pinnedList.classList.add('hidden'); closeHeaderMoreMenu(); return; }
  const willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
  document.getElementById('pinned-messages-btn')?.setAttribute('aria-expanded', String(willOpen));
}
// Saved Messages is a home-menu entry (private bookmarks across every DM,
// not tied to whichever conversation happens to be open), so unlike the old
// per-conversation pinned list it never needs activeFriend to be set.
function openSavedMessagesFromMenu() {
  closeHeaderMoreMenu();
  if (typeof openSavedMessages === 'function') openSavedMessages();
}
document.addEventListener('click', event => {
  if (event.target.closest('.header-actions')) return;
  closeHeaderMoreMenu();
  document.getElementById('pinned-messages-menu')?.classList.add('hidden');
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menu = document.getElementById('header-more-menu');
  const wasOpen = menu && !menu.classList.contains('hidden');
  closeHeaderMoreMenu();
  document.getElementById('pinned-messages-menu')?.classList.add('hidden');
  if (wasOpen) document.getElementById('pinned-messages-btn')?.focus();
});
window.toggleHeaderMoreMenu = toggleHeaderMoreMenu;
window.openSavedMessagesFromMenu = openSavedMessagesFromMenu;

/* Hub header ⋮ menu — Invite member and Pinned messages moved off the header
   into this dropdown. Same open/close conventions as the header "More"
   menu above (outside click, Escape, aria-expanded). Each item still runs
   its original handler, so permissions are unchanged. */
function closeHubMoreMenu() {
  document.getElementById('hub-more-menu')?.classList.add('hidden');
  document.getElementById('hub-settings-btn')?.setAttribute('aria-expanded', 'false');
}
function toggleHubMoreMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('hub-more-menu'); if (!menu) return;
  // If the pinned list is open, the ⋮ acts as its close control instead of
  // stacking the menu on top of it (both open from the same corner).
  const pinnedList = document.getElementById('hub-pinned-messages-menu');
  if (pinnedList && !pinnedList.classList.contains('hidden')) { pinnedList.classList.add('hidden'); closeHubMoreMenu(); return; }
  const willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
  document.getElementById('hub-settings-btn')?.setAttribute('aria-expanded', String(willOpen));
}
document.getElementById('hub-more-menu')?.addEventListener('click', event => {
  if (event.target.closest('button')) closeHubMoreMenu();   // runs after the item's own handler
});
document.addEventListener('click', event => {
  if (event.target.closest('.header-actions')) return;
  closeHubMoreMenu();
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menu = document.getElementById('hub-more-menu');
  const wasOpen = menu && !menu.classList.contains('hidden');
  closeHubMoreMenu();
  if (wasOpen) document.getElementById('hub-settings-btn')?.focus();
});
window.toggleHubMoreMenu = toggleHubMoreMenu;

/* =========================================================================
   MOONLIGHT SPARKLE — ambient effects (animated starfield, lunar ambience,
   interactive glow). Runs ONLY while data-theme="moonlight-sparkle"; it is
   created when the theme is selected and fully removed when it is changed.
   Respects prefers-reduced-motion and pauses while the tab is hidden.
   ========================================================================= */
(function moonlightSparkleFx() {
  const THEME = 'moonlight-sparkle';
  const GLOW_SEL = '.icon-btn, .settings-tab, .wizard-chip, .item-list li, button, .emoji-picker button, .status-option';
  const PAL = [[245,213,224],[255,255,255],[226,195,217],[133,134,201]];   // moon rose, white, muted rose, periwinkle
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches:false };

  let fx = null, cv = null, ctx = null, orbCursor = null;
  let raf = 0, active = false, w = 0, h = 0, dpr = 1;
  let stars = [], shoots = [], sprites = [], nextShoot = 0;
  let px = -9999, py = -9999;                 // pointer in CSS px
  let tx = .5, ty = .5, sx = .5, sy = .5;     // pointer target / smoothed (0..1) for parallax
  let cx = 0, cy = 0;                         // smoothed cursor-glow position
  let lastTarget = null, pending = false, resizeT = 0;

  function makeSprites() {
    sprites = PAL.map(([r, g, b]) => {
      const o = document.createElement('canvas'); o.width = o.height = 64;
      const c = o.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gr.addColorStop(.22, `rgba(${r},${g},${b},.45)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      return o;
    });
  }

  function seed() {
    const n = Math.round(Math.min(240, Math.max(90, (w * h) / 9500)));
    stars = [];
    for (let i = 0; i < n; i++) {
      const z = Math.pow(Math.random(), 1.8) * 1.1 + .25;        // depth: mostly small, a few large
      stars.push({ x:Math.random(), y:Math.random(), z, ph:Math.random() * 6.283, sp:.5 + Math.random() * 1.8,
                   c:(Math.random() * PAL.length) | 0, big:z > 1.05 && Math.random() < .7 });
    }
  }

  function resize() {
    if (!cv) return;
    w = window.innerWidth; h = window.innerHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
    if (reduceMq.matches) frame(0);        // static sky when motion is reduced
  }

  function frame(t) {
    const sec = t / 1000;
    sx += (tx - sx) * .05; sy += (ty - sy) * .05;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i], pal = PAL[s.c];
      let x = (((s.x + sec * .0015 * s.z) % 1) * w) - (sx - .5) * 30 * s.z;
      let y = s.y * h - (sy - .5) * 20 * s.z;
      const tw = .5 + .5 * Math.sin(sec * s.sp + s.ph);
      let a = .22 + .78 * tw, r = .5 + s.z * .9;
      const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;     // stars flare near the pointer
      if (d2 < 22500) { const k = 1 - Math.sqrt(d2) / 150; a += k * .65; r *= 1 + k * .9; }
      ctx.globalAlpha = Math.min(1, a);
      if (s.big || r > 1.9) {
        const size = r * 9; ctx.drawImage(sprites[s.c], x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = `rgb(${pal[0]},${pal[1]},${pal[2]})`;                  // 4-point sparkle
        const L = r * 4.2 * (.6 + tw * .6);
        ctx.fillRect(x - L, y - .45, L * 2, .9); ctx.fillRect(x - .45, y - L, .9, L * 2);
      } else {
        ctx.fillStyle = `rgb(${pal[0]},${pal[1]},${pal[2]})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (!reduceMq.matches) {                                           // shooting stars
      if (t > nextShoot) {
        nextShoot = t + 4500 + Math.random() * 6500;
        shoots.push({ x:w * (.35 + Math.random() * .65), y:Math.random() * h * .4, vx:-(7 + Math.random() * 4), vy:3 + Math.random() * 2.5, life:0 });
      }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const m = shoots[i]; m.x += m.vx; m.y += m.vy; m.life++;
        const al = Math.max(0, 1 - m.life / 70), tx2 = m.x - m.vx * 9, ty2 = m.y - m.vy * 9;
        const g = ctx.createLinearGradient(m.x, m.y, tx2, ty2);
        g.addColorStop(0, `rgba(245,213,224,${.95 * al})`); g.addColorStop(1, 'rgba(133,134,201,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx2, ty2); ctx.stroke();
        if (m.life > 70 || m.x < -50 || m.y > h + 50) shoots.splice(i, 1);
      }
    }
    if (orbCursor && px > -999) {                                      // soft light following the pointer
      cx += (px - cx) * .12; cy += (py - cy) * .12;
      orbCursor.style.transform = `translate3d(${cx - 260}px,${cy - 260}px,0)`;
    }
  }

  function loop(t) { if (!active) return; frame(t); raf = requestAnimationFrame(loop); }
  function start() { if (!raf && active && !reduceMq.matches && !document.hidden) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function flushGlow() {                                               // per-element glow position
    pending = false;
    const el = lastTarget && lastTarget.closest ? lastTarget.closest(GLOW_SEL) : null;
    if (el) { const r = el.getBoundingClientRect(); el.style.setProperty('--gx', (px - r.left) + 'px'); el.style.setProperty('--gy', (py - r.top) + 'px'); }
    if (reduceMq.matches && orbCursor) { cx = px; cy = py; orbCursor.style.transform = `translate3d(${cx - 260}px,${cy - 260}px,0)`; }
  }
  function onMove(e) {
    if (!active || e.pointerType === 'touch') return;
    px = e.clientX; py = e.clientY; tx = px / (w || 1); ty = py / (h || 1); lastTarget = e.target;
    if (orbCursor && !orbCursor.classList.contains('on')) { cx = px; cy = py; orbCursor.classList.add('on'); }
    if (!pending) { pending = true; requestAnimationFrame(flushGlow); }
  }
  function onDown(e) {                                                 // tap / click sparkle pulse
    if (!active || reduceMq.matches) return;
    const d = document.createElement('div'); d.className = 'moon-tap';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 800);
    if (e.pointerType === 'touch') { px = e.clientX; py = e.clientY; setTimeout(() => { px = py = -9999; }, 900); }
  }
  function onLeave() { px = py = -9999; if (orbCursor) orbCursor.classList.remove('on'); }
  function onResize() { clearTimeout(resizeT); resizeT = setTimeout(resize, 150); }
  function onVis() { if (document.hidden) stop(); else start(); }
  function onMotionChange() { stop(); if (active) { if (reduceMq.matches) frame(0); else start(); } }

  function activate() {
    if (active || !document.body) return;
    active = true;
    fx = document.createElement('div'); fx.id = 'moon-fx'; fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<canvas class="moon-stars"></canvas><div class="moon-mist moon-mist-a"></div><div class="moon-mist moon-mist-b"></div><div class="moon-orb"></div><div class="moon-cursor"></div>';
    document.body.insertBefore(fx, document.body.firstChild);
    cv = fx.querySelector('canvas'); ctx = cv.getContext('2d'); orbCursor = fx.querySelector('.moon-cursor');
    makeSprites(); resize(); nextShoot = 2500;
    document.addEventListener('pointermove', onMove, { passive:true });
    document.addEventListener('pointerdown', onDown, { passive:true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    if (reduceMq.addEventListener) reduceMq.addEventListener('change', onMotionChange);
    start();
  }
  function deactivate() {
    if (!active) return;
    active = false; stop(); clearTimeout(resizeT);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerdown', onDown);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    if (reduceMq.removeEventListener) reduceMq.removeEventListener('change', onMotionChange);
    if (fx) fx.remove();
    fx = cv = ctx = orbCursor = null; stars = []; shoots = [];
    document.querySelectorAll('.moon-tap').forEach(n => n.remove());
  }
  function sync() { (document.documentElement.getAttribute('data-theme') === THEME) ? activate() : deactivate(); }

  new MutationObserver(sync).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
  if (document.body) sync(); else document.addEventListener('DOMContentLoaded', sync);
})();

/* ===== Hollow Night reward: beating The Hollow (level 15) unlocks the exclusive Spectral Flame frame =====
   The game sets localStorage 'nexora_spectral_flame' = '1'. Here we add the frame to the signed-in user's
   inventory (once), make it selectable in Settings, and show an "Equip" notice. */
FRAME_NAMES['frame-spectral'] = 'Spectral Flame';
function ensureSpectralOption() {
  const select = document.getElementById('frame-select');
  if (!select || [...select.options].some(option => option.value === 'frame-spectral')) return;
  const option = document.createElement('option'); option.value = 'frame-spectral'; option.textContent = '✦ Spectral Flame (Exclusive)'; select.appendChild(option);
}
function showSpectralToast() {
  document.querySelectorAll('.spectral-toast').forEach(node => node.remove());
  const toast = document.createElement('div'); toast.className = 'spectral-toast';
  toast.innerHTML = '<img src="spectral-flame-frame.png?v=2" alt=""><div><strong>Exclusive reward unlocked!</strong><span>Spectral Flame profile frame — for beating The Hollow.</span></div><button type="button">Equip</button>';
  toast.querySelector('button').onclick = () => { changeProfileFrame('frame-spectral'); ensureSpectralOption(); const select = document.getElementById('frame-select'); if (select) select.value = 'frame-spectral'; toast.remove(); };
  document.body.appendChild(toast); setTimeout(() => toast.remove(), 12000);
}
function grantSpectralFlame(announce) {
  let earned = false; try { earned = localStorage.getItem('nexora_spectral_flame') === '1'; } catch (e) {}
  if (!currentUser || !earned) return;
  const profile = getQuestProfile();
  if (!profile.inventory.includes('frame-spectral')) { profile.inventory.push('frame-spectral'); saveQuestProfile(profile); if (announce) showSpectralToast(); }
  ensureSpectralOption();
}
const loadAppWithSpectral = loadApp;
loadApp = function() { loadAppWithSpectral.apply(this, arguments); grantSpectralFlame(true); };
const openSettingsWithSpectral = openSettings;
openSettings = function() { ensureSpectralOption(); openSettingsWithSpectral.apply(this, arguments); };
window.addEventListener('storage', event => { if (event.key === 'nexora_spectral_flame') grantSpectralFlame(true); });


/* Spectral Flame: wrap framed avatars so the ring art can sit around the (still round) photo. */
(function () {
  let queued = false;
  function sync() {
    queued = false;
    document.querySelectorAll('img.frame-spectral').forEach(img => {
      if (img.parentElement && img.parentElement.classList.contains('spectral-wrap')) return;
      const wrap = document.createElement('span'); wrap.className = 'spectral-wrap' + (img.classList.contains('avatar-large') ? ' spectral-lg' : '');
      img.parentNode.insertBefore(wrap, img); wrap.appendChild(img); wrap.insertAdjacentHTML('beforeend', '<i class="volt v1"></i><i class="volt v2"></i><i class="volt sp"></i>');
    });
    document.querySelectorAll('.spectral-wrap').forEach(wrap => {
      const img = wrap.querySelector(':scope > img');
      if (!img || !img.classList.contains('frame-spectral')) { if (img) wrap.replaceWith(img); else wrap.remove(); }
    });
  }
  if (!document.getElementById('spectral-volt-defs')) document.body.insertAdjacentHTML('beforeend', '<svg id="spectral-volt-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="spectral-volt" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="n"><animate attributeName="seed" values="1;5;2;8;4;7" dur="0.6s" repeatCount="indefinite" calcMode="discrete"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter></svg>');
  function queue() { if (!queued) { queued = true; requestAnimationFrame(sync); } }
  new MutationObserver(queue).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  queue();
})();
/* ---- Diwali countdown strip (home view only) ----
   Shows from 30 days before Diwali, switches to "Happy Diwali!" on the day, then hides. Dates are local calendar
   days; add future years to DIWALI_DATES. "Explore Goodies" opens the existing shop (openShop). */
(function initDiwaliStrip() {
  const strip = document.getElementById('diwali-strip');
  if (!strip) return;
  const mainEl = document.getElementById('diwali-main');
  const subEl = document.getElementById('diwali-sub');
  const DIWALI_DATES = ['2026-11-08', '2027-10-29', '2028-10-17'];
  const WINDOW_DAYS = 30;
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function daysUntil(iso, now) { const [y, m, d] = iso.split('-').map(Number); return Math.round((new Date(y, m - 1, d) - dayStart(now)) / 86400000); }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function refresh() {
    const now = new Date();
    const left = DIWALI_DATES.map((iso) => daysUntil(iso, now)).filter((n) => n >= 0).sort((a, b) => a - b)[0];
    const show = left !== undefined && left <= WINDOW_DAYS;
    strip.classList.toggle('show', show);
    strip.classList.toggle('is-today', show && left === 0);
    if (!show) return;
    if (left === 0) { setText(mainEl, 'Happy Diwali!'); setText(subEl, 'May your day glow with light.'); }
    else { setText(mainEl, `${left} ${left === 1 ? 'day' : 'days'}`); setText(subEl, left === 1 ? 'to Diwali — tomorrow!' : 'to Diwali'); }
  }
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  refresh();
})();

/* ===== Midnight Diwali theme FX (limited-time Special theme) =====
   Same lifecycle as Moonlight Sparkle: the #diwali-fx layer exists only while data-theme="midnight-diwali".
   ~26 tiny gold particles (2-4px, 8-18s loops) float up and shimmer/fade, plus a few diya sparks and two
   breathing gold glows. Pure CSS animation (transform/opacity) - no per-frame JS. Skipped for reduced motion.

   Dynamic Ambient — Light & Glow (still the same theme, no new theme/option added):
   - A `data-diwali-ambient` attribute ("day" | "night") is set on <html> only while this theme is active,
     based on local wall-clock time (06:00-18:00 = day). style.css keys the cream/marigold day palette and
     the indigo/violet night palette + bottom-of-chat gold glow off that attribute. Rechecked every minute
     (cheap: one Date() read + one attribute write) plus on visibility/focus, same pattern as the Diwali
     countdown refresh above.
   - Ember particles stay exactly as built below; a single capturing `scroll` listener on #messages-list
     (passive, feature-detected once) toggles a `.dw-scroll-boost` class on #diwali-fx that only nudges
     opacity/brightness via CSS transitions - no per-frame JS, nothing added/removed from the DOM on scroll. */
(function initMidnightDiwaliFx() {
  const THEME = 'midnight-diwali';
  const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches:false };
  let fx = null;
  let ambientTimer = null;
  let scrollBoostTimer = null;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function loadFonts() {
    if (document.getElementById('nexora-diwali-fonts') || !document.head) return;
    const l = document.createElement('link');
    l.id = 'nexora-diwali-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Dr+Sugiyama&family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(l);
  }
  function build() {
    const small = window.innerWidth < 640;
    const nP = small ? 16 : 26, nS = small ? 4 : 7;
    let h = '<div class="dw-glow dw-glow-a"></div><div class="dw-glow dw-glow-b"></div>';
    for (let i = 0; i < nP; i++) {
      const d = rnd(8, 18);
      h += `<span class="dw-p" style="--x:${rnd(1, 99).toFixed(1)}%;--s:${rnd(2, 4).toFixed(1)}px;--d:${d.toFixed(1)}s;--dl:-${rnd(0, d).toFixed(1)}s;--dx:${rnd(-36, 36).toFixed(0)}px;--o:${rnd(.45, .9).toFixed(2)};--sh:${rnd(1.6, 3.4).toFixed(1)}s"><i></i></span>`;
    }
    // Diya sparks: short bursts from two "lamp" spots low in the chat area
    for (let i = 0; i < nS; i++) {
      const d = rnd(5, 9), spot = i % 2 ? 84 : 52;
      h += `<span class="dw-spark" style="--x:${(spot + rnd(-3, 3)).toFixed(1)}%;--b:${rnd(70, 96).toFixed(0)}px;--d:${d.toFixed(1)}s;--dl:-${rnd(0, d).toFixed(1)}s;--dx:${rnd(-26, 26).toFixed(0)}px;--dy:-${rnd(40, 110).toFixed(0)}px"></span>`;
    }
    return h;
  }

  // Day = 06:00-18:00 local time, Night/Puja = the rest. Re-applied, never re-created.
  function isDayNow() { const h = new Date().getHours(); return h >= 6 && h < 18; }
  function applyAmbientMode() {
    if (document.documentElement.getAttribute('data-theme') !== THEME) return;
    document.documentElement.setAttribute('data-diwali-ambient', isDayNow() ? 'day' : 'night');
  }
  function startAmbientClock() {
    applyAmbientMode();
    if (ambientTimer) return;
    ambientTimer = setInterval(applyAmbientMode, 60000);
    document.addEventListener('visibilitychange', onAmbientWake);
    window.addEventListener('focus', onAmbientWake);
  }
  function stopAmbientClock() {
    if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = null; }
    document.removeEventListener('visibilitychange', onAmbientWake);
    window.removeEventListener('focus', onAmbientWake);
    document.documentElement.removeAttribute('data-diwali-ambient');
  }
  function onAmbientWake() { if (!document.hidden) applyAmbientMode(); }

  // Ember particles "subtly respond to message scrolling": one capturing, passive listener (scroll doesn't
  // reliably bubble), checked against the live chat's id so it keeps working across chat/Hub switches.
  function onAnyScroll(e) {
    if (reduceMq.matches || !fx || !e.target || e.target.id !== 'messages-list') return;
    fx.classList.add('dw-scroll-boost');
    clearTimeout(scrollBoostTimer);
    scrollBoostTimer = setTimeout(() => { if (fx) fx.classList.remove('dw-scroll-boost'); }, 900);
  }
  document.addEventListener('scroll', onAnyScroll, { capture: true, passive: true });

  // ---- Festive decorations: carved diyas, rangoli, marigold garland + bells, floral corner carvings,
  // a firework hotspot, and (day mode only) an ornamental gold peacock. Static artwork + CSS animation;
  // layered once per activate(), on top of the existing glow/particle system (left untouched). ----
  function decorMarkup() {
    return `<svg class="dw-defs" aria-hidden="true"><defs>
<linearGradient id="dwGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6C667"/><stop offset="1" stop-color="#C9972E"/></linearGradient>
<linearGradient id="dwClay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D6A84B"/><stop offset="1" stop-color="#7A4A17"/></linearGradient>
<radialGradient id="dwFlameG" cx=".5" cy=".2" r=".9"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".55" stop-color="#FFA726"/><stop offset="1" stop-color="#E8572A"/></radialGradient>
<symbol id="dwDiya" viewBox="0 0 60 50">
<path d="M4 28c7 4 17 6 26 6s19-2 26-6c-3 10-14 17-26 17S7 38 4 28z" fill="url(#dwClay)"/>
<ellipse cx="30" cy="27" rx="25" ry="5.5" fill="url(#dwGold)" opacity=".85"/>
<path class="dw-flame" d="M30 6c3.5 5.5 7.5 9.5 7.5 14.5a7.5 7.5 0 1 1-15 0C22.5 15.5 26.5 11.5 30 6z" fill="url(#dwFlameG)"/>
</symbol>
<symbol id="dwPetal" viewBox="-6 -22 12 22"><path d="M0 0C-5 -6 -5 -16 0 -22C5 -16 5 -6 0 0Z"/></symbol>
<symbol id="dwRangoli" viewBox="-40 -40 80 80">
<circle r="38" fill="none" stroke="url(#dwGold)" stroke-width="1.4" opacity=".55"/>
<use href="#dwPetal" fill="#E2A33D" transform="rotate(0)"/><use href="#dwPetal" fill="#7A1F3D" transform="rotate(30)"/><use href="#dwPetal" fill="#FFF3DC" transform="rotate(60)"/><use href="#dwPetal" fill="#E2A33D" transform="rotate(90)"/><use href="#dwPetal" fill="#7A1F3D" transform="rotate(120)"/><use href="#dwPetal" fill="#FFF3DC" transform="rotate(150)"/><use href="#dwPetal" fill="#E2A33D" transform="rotate(180)"/><use href="#dwPetal" fill="#7A1F3D" transform="rotate(210)"/><use href="#dwPetal" fill="#FFF3DC" transform="rotate(240)"/><use href="#dwPetal" fill="#E2A33D" transform="rotate(270)"/><use href="#dwPetal" fill="#7A1F3D" transform="rotate(300)"/><use href="#dwPetal" fill="#FFF3DC" transform="rotate(330)"/>
<circle r="7" fill="url(#dwGold)"/><circle r="3" fill="#7A1F3D"/>
</symbol>
<symbol id="dwBell" viewBox="0 0 34 40">
<path d="M17 2a3 3 0 0 1 3 3v2c6 2 9 8 9 15v3H5v-3c0-7 3-13 9-15V5a3 3 0 0 1 3-3z" fill="url(#dwGold)"/>
<rect x="5" y="25" width="24" height="4" rx="2" fill="#7A4A17"/><circle cx="17" cy="34" r="3" fill="#7A4A17"/>
</symbol>
<symbol id="dwFloral" viewBox="0 0 60 60"><g fill="url(#dwGold)" opacity=".8">
<path d="M4 4C20 4 34 10 34 26c0 6-4 10-10 10S14 32 14 26C14 16 8 8 4 4Z"/><circle cx="30" cy="30" r="5"/>
</g></symbol>
<symbol id="dwGarland" viewBox="0 0 1200 40" preserveAspectRatio="none">
<path d="M0 8 Q60 32 120 8 T240 8 T360 8 T480 8 T600 8 T720 8 T840 8 T960 8 T1080 8 T1200 8" fill="none" stroke="#5B3A12" stroke-width="2" opacity=".5"/>
<g fill="#E2A33D"><circle cx="60" cy="24" r="6"/><circle cx="180" cy="24" r="6"/><circle cx="300" cy="24" r="6"/><circle cx="420" cy="24" r="6"/><circle cx="540" cy="24" r="6"/><circle cx="660" cy="24" r="6"/><circle cx="780" cy="24" r="6"/><circle cx="900" cy="24" r="6"/><circle cx="1020" cy="24" r="6"/><circle cx="1140" cy="24" r="6"/></g>
<g fill="#C97F1F"><circle cx="60" cy="24" r="2.4"/><circle cx="180" cy="24" r="2.4"/><circle cx="300" cy="24" r="2.4"/><circle cx="420" cy="24" r="2.4"/><circle cx="540" cy="24" r="2.4"/><circle cx="660" cy="24" r="2.4"/><circle cx="780" cy="24" r="2.4"/><circle cx="900" cy="24" r="2.4"/><circle cx="1020" cy="24" r="2.4"/><circle cx="1140" cy="24" r="2.4"/></g>
</symbol>
</defs></svg>
<div class="dw-decor">
<div class="dw-garland-wrap"><svg viewBox="0 0 1200 40" preserveAspectRatio="none"><use href="#dwGarland"/></svg></div>
<svg class="dw-bell dw-bell-1" viewBox="0 0 34 40"><use href="#dwBell"/></svg>
<svg class="dw-bell dw-bell-2" viewBox="0 0 34 40"><use href="#dwBell"/></svg>
<svg class="dw-bell dw-bell-3" viewBox="0 0 34 40"><use href="#dwBell"/></svg>
<svg class="dw-floral dw-floral-tl" viewBox="0 0 60 60"><use href="#dwFloral"/></svg>
<svg class="dw-floral dw-floral-br" viewBox="0 0 60 60" style="transform:rotate(180deg)"><use href="#dwFloral"/></svg>
<svg class="dw-diya dw-diya-1" viewBox="0 0 60 50" aria-hidden="true"><use href="#dwDiya"/></svg>
<svg class="dw-diya dw-diya-2" viewBox="0 0 60 50" aria-hidden="true"><use href="#dwDiya"/></svg>
<div class="dw-rangoli" aria-hidden="true"><svg viewBox="-40 -40 80 80"><use href="#dwRangoli"/></svg></div>
</div>`;
  }
  // Peacock + firework hotspot live in their own layer ABOVE the app: the main fx layer sits behind the
  // frosted/blurred panels, which smeared them and blocked clicks.
  let fxTop = null;
  function topMarkup() {
    return `<img class="dw-peacock" src="diwali-peacock.png" alt="" aria-hidden="true" draggable="false"><div class="dw-firework-trigger" aria-hidden="true"></div>`;
  }
  // Faint glow while the pointer is over the peacock (Day mode only). The artwork ignores pointer events so the
  // UI underneath stays clickable; hover is detected against its bounding box instead.
  let peacockRaf = 0;
  function onPeacockMove(e) {
    if (!fxTop || peacockRaf) return;
    const x = e.clientX, y = e.clientY;
    peacockRaf = requestAnimationFrame(() => {
      peacockRaf = 0;
      const img = fxTop && fxTop.querySelector('.dw-peacock');
      if (!img) return;
      const day = document.documentElement.getAttribute('data-diwali-ambient') === 'day';
      const r = img.getBoundingClientRect();
      img.classList.toggle('dw-peacock-glow', day && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
    });
  }
  document.addEventListener('mousemove', onPeacockMove, { passive: true });
  function spawnFirework(anchor) {
    if (reduceMq.matches || !fx) return;
    const r = anchor.getBoundingClientRect();
    const burst = document.createElement('span');
    burst.className = 'dw-burst';
    const host = fxTop || fx;
    burst.style.left = (r.left + r.width / 2) + 'px';
    burst.style.top = (r.top + r.height / 2) + 'px';
    let s = '';
    for (let i = 0; i < 10; i++) s += `<i style="--a:${i * 36}deg;--c:${i % 2 ? '#F6C667' : '#E85A3C'}"></i>`;
    burst.innerHTML = s;
    host.appendChild(burst);
    setTimeout(() => burst.remove(), 900);
  }
  function onDecorClick(e) {
    if (!fx) return;
    const diya = e.target.closest ? e.target.closest('.dw-diya') : null;
    if (diya) { diya.classList.remove('dw-lit'); void diya.offsetWidth; diya.classList.add('dw-lit'); setTimeout(() => diya.classList.remove('dw-lit'), 1100); return; }
    const rangoli = e.target.closest ? e.target.closest('.dw-rangoli') : null;
    if (rangoli) { rangoli.classList.remove('dw-spin'); void rangoli.offsetWidth; rangoli.classList.add('dw-spin'); return; }
    const fw = e.target.closest ? e.target.closest('.dw-firework-trigger') : null;
    if (fw) { spawnFirework(fw); return; }
  }
  document.addEventListener('click', onDecorClick);

  function activate() {
    if (fx || !document.body) return;
    loadFonts();
    fx = document.createElement('div'); fx.id = 'diwali-fx'; fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = decorMarkup() + (reduceMq.matches ? '<div class="dw-glow dw-glow-a"></div><div class="dw-glow dw-glow-b"></div>' : build());
    document.body.insertBefore(fx, document.body.firstChild);
    fxTop = document.createElement('div'); fxTop.id = 'diwali-fx-top'; fxTop.setAttribute('aria-hidden', 'true'); fxTop.innerHTML = topMarkup();
    document.body.appendChild(fxTop);
    startAmbientClock();
  }
  function deactivate() {
    if (fx) { fx.remove(); fx = null; }
    if (fxTop) { fxTop.remove(); fxTop = null; }
    stopAmbientClock();
    clearTimeout(scrollBoostTimer);
  }
  function sync() { (document.documentElement.getAttribute('data-theme') === THEME) ? activate() : deactivate(); }

  new MutationObserver(sync).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
  if (document.body) sync(); else document.addEventListener('DOMContentLoaded', sync);
})();

/* ===== Rangoli Diwali: exclusive limited-time profile frame =====
   Added to every signed-in user's frame inventory (like the Spectral Flame reward) and listed in Settings. */
FRAME_NAMES['frame-rangoli'] = 'Rangoli Diwali';
FRAME_NAMES['frame-diya'] = 'Diya Glow';
FRAME_NAMES['frame-celestial'] = 'Celestial Night';
const EXCLUSIVE_DIWALI_FRAMES = [['frame-rangoli', '⭐ Rangoli Diwali (Exclusive)'], ['frame-diya', '⭐ Diya Glow (Exclusive)'], ['frame-celestial', '⭐ Celestial Night (Exclusive)']];
function ensureRangoliOption() {
  const select = document.getElementById('frame-select'); if (!select) return;
  EXCLUSIVE_DIWALI_FRAMES.forEach(([value, label]) => {
    if ([...select.options].some(option => option.value === value)) return;
    const option = document.createElement('option'); option.value = value; option.textContent = label; select.appendChild(option);
  });
}
function grantRangoliDiwali() {
  if (typeof currentUser === 'undefined' || !currentUser) return;
  const profile = getQuestProfile(); let changed = false;
  EXCLUSIVE_DIWALI_FRAMES.forEach(([value]) => { if (!profile.inventory.includes(value)) { profile.inventory.push(value); changed = true; } });
  if (changed) saveQuestProfile(profile);
  ensureRangoliOption();
}
const loadAppWithRangoli = loadApp;
loadApp = function() { loadAppWithRangoli.apply(this, arguments); grantRangoliDiwali(); };
const openSettingsWithRangoli = openSettings;
openSettings = function() { grantRangoliDiwali(); openSettingsWithRangoli.apply(this, arguments); };

/* Rangoli Diwali: wrap framed avatars so the ring art sits around the (still round, fully visible) photo. */
(function () {
  let queued = false;
  function sync() {
    queued = false;
    document.querySelectorAll('img.frame-rangoli').forEach(img => {
      if (img.parentElement && img.parentElement.classList.contains('rangoli-wrap')) return;
      const wrap = document.createElement('span'); wrap.className = 'rangoli-wrap' + (img.classList.contains('avatar-large') ? ' rangoli-lg' : '');
      img.parentNode.insertBefore(wrap, img); wrap.appendChild(img); wrap.insertAdjacentHTML('beforeend', '<i class="rg-shine"><b></b></i><i class="rg-glint"></i>');
    });
    document.querySelectorAll('.rangoli-wrap').forEach(wrap => {
      const img = wrap.querySelector(':scope > img');
      if (!img || !img.classList.contains('frame-rangoli')) { if (img) wrap.replaceWith(img); else wrap.remove(); }
    });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(sync); } }
  new MutationObserver(queue).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  queue();
})();

/* Diya Glow: wrap framed avatars so the lamp ring sits around the (still round, fully visible) photo. */
(function () {
  let queued = false;
  function sync() {
    queued = false;
    document.querySelectorAll('img.frame-diya').forEach(img => {
      if (img.parentElement && img.parentElement.classList.contains('diya-wrap')) return;
      const wrap = document.createElement('span'); wrap.className = 'diya-wrap' + (img.classList.contains('avatar-large') ? ' diya-lg' : '');
      img.parentNode.insertBefore(wrap, img); wrap.appendChild(img); wrap.insertAdjacentHTML('beforeend', '<i class="dg-flame"></i>');
    });
    document.querySelectorAll('.diya-wrap').forEach(wrap => {
      const img = wrap.querySelector(':scope > img');
      if (!img || !img.classList.contains('frame-diya')) { if (img) wrap.replaceWith(img); else wrap.remove(); }
    });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(sync); } }
  new MutationObserver(queue).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  queue();
})();

/* Celestial Night: wrap framed avatars so the starry ring sits around the (still round, fully visible) photo. */
(function () {
  let queued = false;
  function sync() {
    queued = false;
    document.querySelectorAll('img.frame-celestial').forEach(img => {
      if (img.parentElement && img.parentElement.classList.contains('celestial-wrap')) return;
      const wrap = document.createElement('span'); wrap.className = 'celestial-wrap' + (img.classList.contains('avatar-large') ? ' celestial-lg' : '');
      img.parentNode.insertBefore(wrap, img); wrap.appendChild(img); wrap.insertAdjacentHTML('beforeend', '<i class="cn-shine"><b></b></i>');
    });
    document.querySelectorAll('.celestial-wrap').forEach(wrap => {
      const img = wrap.querySelector(':scope > img');
      if (!img || !img.classList.contains('frame-celestial')) { if (img) wrap.replaceWith(img); else wrap.remove(); }
    });
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(sync); } }
  new MutationObserver(queue).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  queue();
})();

/* Greeting Studio (Greeting Wisher) now lives in wishing.js */

/* ===== Sticker packs (picker "Stickers" tab) =====
   Packs are plain folders in the repo, so the app can load them straight from GitHub Pages:
     stickers/packs.json                 -> list of packs (id, name, icon)
     stickers/<pack-id>/manifest.json    -> { "name": "...", "stickers": [ { "file": "x.png", "name": "X" } ] }
     stickers/<pack-id>/x.png            -> the sticker images
   Add a sticker = drop the image in the pack folder + add one line to its manifest.json.
   Sending reuses the GIF path: the sticker becomes an image attachment on a normal message, so DMs and
   Hubs, syncing and notifications all work unchanged (only a small path string is stored, not image data). */
const STICKER_ROOT = 'stickers/';
let stickerPacks = null, activeStickerPackId = null;
const stickerPackCache = {};

function isStickerAttachment(a) {
  return !!(a && a.type === 'image' && (a.sticker === true || a.name === 'Sticker'));
}
function stickerStatus(msg, retry) {
  const grid = document.getElementById('sticker-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="gif-picker-status">${msg}${retry ? '<br><button type="button" class="sticker-retry">Try again</button>' : ''}</div>`;
  const btn = grid.querySelector('.sticker-retry');
  if (btn) btn.onclick = retry;
}
const stickerEsc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function fetchStickerJSON(path) {
  const res = await fetch(STICKER_ROOT + path, { cache: 'no-cache' });   // revalidate so new stickers appear after a deploy
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${STICKER_ROOT + path})`);
  return res.json();
}
async function loadStickerPacks() {
  if (stickerPacks) return;                                              // already loaded this session
  stickerStatus('Loading stickers…');
  try {
    const data = await fetchStickerJSON('packs.json');
    stickerPacks = (data.packs || []).filter(p => p && p.id && p.name);
    if (!stickerPacks.length) return stickerStatus('No sticker packs yet.');
    renderStickerPackTabs();
    selectStickerPack(activeStickerPackId || stickerPacks[0].id);
  } catch (error) {
    console.error('Sticker packs failed to load:', error);
    stickerPacks = null;
    stickerStatus(`Could not load stickers.<br><small>${stickerEsc(error.message || error)}</small>`, loadStickerPacks);
  }
}
function renderStickerPackTabs() {
  const bar = document.getElementById('sticker-packs'); if (!bar) return;
  bar.innerHTML = '';
  stickerPacks.forEach(pack => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sticker-pack-tab'; b.dataset.packId = pack.id; b.setAttribute('role', 'tab');
    b.textContent = `${pack.icon ? pack.icon + ' ' : ''}${pack.name}`;
    b.onclick = () => selectStickerPack(pack.id);
    bar.appendChild(b);
  });
}
async function selectStickerPack(id) {
  activeStickerPackId = id;
  const stPane = document.getElementById('stickers-pane'); if (stPane) stPane.dataset.pack = id;
  document.querySelectorAll('.sticker-pack-tab').forEach(b => { const on = b.dataset.packId === id; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
  stickerStatus('Loading stickers…');
  try {
    if (!stickerPackCache[id]) stickerPackCache[id] = await fetchStickerJSON(`${id}/manifest.json`);
    if (activeStickerPackId !== id) return;                              // user switched packs while loading
    renderStickerGrid(id, stickerPackCache[id]);
  } catch (error) {
    console.error('Sticker pack failed to load:', error);
    delete stickerPackCache[id];
    stickerStatus(`Could not load this pack.<br><small>${stickerEsc(error.message || error)}</small>`, () => selectStickerPack(id));
  }
}
function renderStickerGrid(packId, manifest) {
  const grid = document.getElementById('sticker-grid'); if (!grid) return;
  const items = (manifest.stickers || []).filter(s => s && s.file);
  if (!items.length) return stickerStatus('This pack has no stickers yet.');
  grid.innerHTML = ''; grid.dataset.pack = packId;
  items.forEach((sticker, index) => {
    const path = `${STICKER_ROOT}${packId}/${sticker.file}`;
    const label = sticker.name || sticker.file.replace(/\.[^.]+$/, '');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sticker-item'; btn.dataset.label = label; btn.style.setProperty('--i', Math.min(index, 14)); btn.setAttribute('aria-label', `Send sticker: ${label}`);
    const img = document.createElement('img');
    img.src = path; img.alt = label; img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
    img.onerror = () => { btn.classList.add('is-broken'); btn.disabled = true; btn.title = `${label} (could not load)`; console.warn('Sticker failed to load:', path); };
    btn.appendChild(img);
    btn.onclick = () => sendSticker(path, label);
    grid.appendChild(btn);
  });
}
function sendSticker(path, label) {
  if (!path || !(activeFriend || activeHub)) return;
  closeGifPicker();                                                      // same shell close as GIFs
  currentAttachment = { name: 'Sticker', type: 'image', sticker: true, data: path, alt: label || 'Sticker' };
  sendMessage();
}


/* ===== Sticker picker polish: shared tooltip + arrow-key navigation =====
   Purely presentational. It never touches sending (sendSticker / sendMessage are unchanged):
   the tooltip replaces the browser's native one (which landed on top of neighbouring stickers), and
   the arrow keys just move focus between tiles. */
(function stickerPickerPolish() {
  const pane = document.getElementById('stickers-pane'), grid = document.getElementById('sticker-grid');
  if (!pane || !grid) return;
  let tip = null;
  const getTip = () => {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'sticker-tip'; tip.id = 'sticker-tip'; tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    return tip;
  };
  const hideTip = () => { if (tip) tip.classList.remove('show'); };
  function showTip(btn) {
    const label = btn && btn.dataset ? btn.dataset.label : '';
    if (!label) { hideTip(); return; }
    const t = getTip();
    t.textContent = label; t.classList.remove('below'); t.style.left = '0px'; t.style.top = '0px';
    const r = btn.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight, cx = r.left + r.width / 2;
    const left = Math.max(8, Math.min(cx - w / 2, window.innerWidth - w - 8));
    let top = r.top - h - 10;
    if (top < 8) { top = r.bottom + 10; t.classList.add('below'); }      // no room above → show underneath
    t.style.left = left + 'px'; t.style.top = top + 'px';
    t.style.setProperty('--tip-ax', Math.max(12, Math.min(cx - left, w - 12)) + 'px');   // arrow keeps pointing at the tile
    t.classList.add('show');
  }
  grid.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const b = e.target.closest && e.target.closest('.sticker-item');
    if (b && !b.disabled) showTip(b); else hideTip();
  });
  grid.addEventListener('pointerleave', hideTip);
  grid.addEventListener('focusin', (e) => { const b = e.target.closest && e.target.closest('.sticker-item'); if (b && e.target.matches(':focus-visible')) showTip(b); });
  grid.addEventListener('focusout', hideTip);
  grid.addEventListener('click', hideTip);
  pane.addEventListener('scroll', hideTip, { passive: true });
  window.addEventListener('resize', hideTip);
  document.addEventListener('pointerdown', (e) => { if (!(e.target.closest && e.target.closest('.sticker-item'))) hideTip(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });

  grid.addEventListener('keydown', (e) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const items = Array.from(grid.querySelectorAll('.sticker-item:not(:disabled)'));
    const i = items.indexOf(document.activeElement); if (i < 0) return;
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowDown' ? i + cols : e.key === 'ArrowUp' ? i - cols : e.key === 'Home' ? 0 : items.length - 1;
    if (next < 0 || next >= items.length) return;
    e.preventDefault(); items[next].focus();
  });
})();
