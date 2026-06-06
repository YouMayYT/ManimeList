const SUPABASE_URL = 'https://ccfgybmuamyygxybimdx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZmd5Ym11YW15eWd4eWJpbWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODA2NTksImV4cCI6MjA5NjI1NjY1OX0.yE7TMjS_82XoWEFwd9LcTEjQDiSmyDQ4IPDI2izwYBs';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentTab = 'home';
let favoriteAnimes = JSON.parse(localStorage.getItem('myCyberAnimeList')) || [];
let discoverSelections = JSON.parse(localStorage.getItem('myDiscoverSelections')) || [];
let searchTimeout = null;
let discoverResultsMode = 'search';
let activeSearchToken = 0;
let currentModalAnime = null;
let lastAutocompleteTitles = { main: [], recommend: [] };

const searchInput = document.getElementById('search-input');
const autocompleteBox = document.getElementById('autocomplete-box');
const clearSearchBtn = document.getElementById('clear-search');
const recInput = document.getElementById('recommend-input');
const recAutocompleteBox = document.getElementById('recommend-autocomplete-box');

document.addEventListener('DOMContentLoaded', async () => {
    enhanceAccountPanelUI();
    await initAuth();
    loadTabContent();
    initDiscoverSelectionUI();

    setupSearch(searchInput, autocompleteBox, (selectedItem) => {
        searchInput.value = selectedItem.title;
        autocompleteBox.style.display = 'none';
        loadGridSearch(selectedItem.title);
    });

    setupSearch(recInput, recAutocompleteBox, (selectedItem) => {
        recInput.value = selectedItem.title;
        recAutocompleteBox.style.display = 'none';
        discoverResultsMode = 'search';
        loadGridSearch(selectedItem.title);
    });

    recInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && recInput.value.trim()) {
            discoverResultsMode = 'search';
            recAutocompleteBox.style.display = 'none';
            clearTimeout(searchTimeout);
            loadGridSearch(recInput.value.trim());
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#main-search-wrapper')) autocompleteBox.style.display = 'none';
        if (!e.target.closest('#recommend-search-wrapper')) recAutocompleteBox.style.display = 'none';
    });

    const modalImg = document.getElementById('modal-img');
    if (modalImg) modalImg.onclick = () => openPreviewFromModal();
});

function setCookie(name, value, days = 30) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
function getCookie(name) {
    const key = `${name}=`;
    const parts = document.cookie.split(';');
    for (let p of parts) {
        p = p.trim();
        if (p.startsWith(key)) return decodeURIComponent(p.substring(key.length));
    }
    return '';
}
function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
}

function getProfileStore() { return JSON.parse(localStorage.getItem('cyberProfiles') || '{}'); }
function saveProfileStore(store) { localStorage.setItem('cyberProfiles', JSON.stringify(store)); }
function getDisplayNameForEmail(email) { return getProfileStore()[email] || ''; }
function saveDisplayName(email, name) {
    const store = getProfileStore();
    store[email] = name;
    saveProfileStore(store);
    setCookie('cyber_display_name', name, 180);
}
function getInitial(v) { const raw = (v || '').trim(); return raw ? raw[0].toUpperCase() : '?'; }

function getAccountsList() { return JSON.parse(localStorage.getItem('cyberAccounts') || '[]'); }
function saveAccountsList(list) { localStorage.setItem('cyberAccounts', JSON.stringify(list)); }
function addAccountToList(email) {
    if (!email) return;
    const list = getAccountsList().filter(e => e !== email);
    list.unshift(email);
    saveAccountsList(list);
    renderAccountsList();
}
function removeAccountFromList(email) {
    const list = getAccountsList().filter(e => e !== email);
    saveAccountsList(list);
    renderAccountsList();
    return list;
}

function enhanceAccountPanelUI() {
    const panel = document.getElementById('account-panel');
    if (!panel || document.getElementById('profile-block')) return;
    const authForm = panel.querySelector('.auth-form');
    if (authForm) authForm.id = 'auth-form-container';

    const profileBlock = document.createElement('div');
    profileBlock.id = 'profile-block';
    profileBlock.style.display = 'none';
    profileBlock.style.marginTop = '10px';
    profileBlock.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #1e293b;background:rgba(15,23,42,.6);">
            <div id="profile-avatar" style="width:48px;height:48px;border-radius:999px;background:#00f3ff;color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">?</div>
            <div style="flex:1;">
                <div id="profile-name" style="font-weight:700;color:#e2e8f0;">User</div>
                <div id="profile-email" style="font-size:13px;color:#94a3b8;">-</div>
            </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;">
            <button id="quick-logout-btn" class="auth-btn logout" style="flex:1;" onclick="signOutAndRemoveCurrent()">Logout</button>
            <button id="more-actions-btn" class="auth-btn login" style="flex:1;background:#334155;" onclick="toggleMoreActions()">More</button>
        </div>
        <div id="more-actions-box" style="display:none;margin-top:8px;border:1px solid #1e293b;padding:10px;background:rgba(2,6,23,.55);">
            <button class="auth-btn" style="width:100%;background:#ef4444;color:#fff;margin-bottom:8px;" onclick="deleteCurrentAccountWithConfirm()">Delete Account</button>
            <button class="auth-btn" style="width:100%;background:#f59e0b;color:#000;" onclick="clearCurrentAccountSavesWithConfirm()">Clear Saves</button>
        </div>
    `;
    panel.appendChild(profileBlock);

    const switcher = document.createElement('div');
    switcher.id = 'accounts-switcher';
    switcher.style.marginTop = '12px';
    switcher.style.border = '1px solid #1e293b';
    switcher.style.padding = '10px';
    switcher.style.background = 'rgba(2,6,23,.35)';
    switcher.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-weight:700;color:#93c5fd;">Saved Accounts</div>
            <button onclick="openAddAccountFlow()" style="background:#00f3ff;color:#000;border:none;padding:6px 10px;cursor:pointer;font-weight:700;">+ Accounts</button>
        </div>
        <div id="accounts-list" style="display:flex;flex-direction:column;gap:6px;"></div>
    `;
    panel.appendChild(switcher);
    renderAccountsList();
}

function renderAccountsList() {
    const listEl = document.getElementById('accounts-list');
    if (!listEl) return;
    const list = getAccountsList();
    listEl.innerHTML = '';
    if (!list.length) {
        listEl.innerHTML = `<div style="color:#94a3b8;font-size:13px;">No accounts added yet.</div>`;
        return;
    }
    list.forEach(email => {
        const name = getDisplayNameForEmail(email) || email.split('@')[0] || 'User';
        const isCurrent = currentUser?.email === email;
        const row = document.createElement('button');
        row.style.textAlign = 'left';
        row.style.border = isCurrent ? '1px solid #00f3ff' : '1px solid #334155';
        row.style.background = isCurrent ? 'rgba(0,243,255,.08)' : 'rgba(15,23,42,.4)';
        row.style.color = '#e2e8f0';
        row.style.padding = '8px';
        row.style.cursor = 'pointer';
        row.innerHTML = `<div style="font-weight:700;">${name}</div><div style="font-size:12px;color:#94a3b8;">${email}</div>`;
        row.onclick = () => switchToAccount(email);
        listEl.appendChild(row);
    });
}

async function openAddAccountFlow() {
    const email = window.prompt('Enter account email to login:') || '';
    if (!email.trim()) return;
    const password = window.prompt('Enter password:') || '';
    if (!password.trim()) return;
    const { error } = await supabaseClient.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
    if (error) return notify('error', 'Login failed', error.message);
    addAccountToList(email.trim());
    await ensureDisplayNameFlow();
    await pullCloudList();
    updateAuthStatus();
    notify('success', 'Account added', `${email.trim()} is ready`);
}

async function switchToAccount(email) {
    if (!email || currentUser?.email === email) return;
    const password = window.prompt(`Enter password for ${email}`) || '';
    if (!password.trim()) return;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: password.trim() });
    if (error) return notify('error', 'Switch failed', error.message);
    addAccountToList(email);
    await ensureDisplayNameFlow();
    await pullCloudList();
    updateAuthStatus();
    loadTabContent();
    notify('success', 'Switched', `Now using ${email}`);
}

function toggleMoreActions() {
    const box = document.getElementById('more-actions-box');
    if (!box) return;
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function deleteCurrentAccountWithConfirm() {
    if (!currentUser?.email) return;
    const typed = window.prompt('Type "I agree" to delete account and all data:') || '';
    if (typed !== 'I agree') return notify('error', 'Cancelled', 'Confirmation text mismatch.');
    await clearCurrentAccountSavesRaw();
    removeAccountFromList(currentUser.email);
    await supabaseClient.auth.signOut();
    currentUser = null;
    favoriteAnimes = [];
    localStorage.removeItem('myCyberAnimeList');
    updateAuthStatus();
    const top = getAccountsList()[0];
    if (top) notify('info', 'Deleted locally', `Account removed from list. Select ${top} to login.`);
    else notify('info', 'Deleted locally', 'Account removed from list.');
}

async function clearCurrentAccountSavesRaw() {
    if (!currentUser) return;
    await supabaseClient.from('user_anime_list').delete().eq('user_id', currentUser.id);
    favoriteAnimes = [];
    localStorage.setItem('myCyberAnimeList', JSON.stringify(favoriteAnimes));
    if (currentTab === 'mylist' || currentTab === 'done' || currentTab === 'home') loadTabContent();
}

async function clearCurrentAccountSavesWithConfirm() {
    if (!currentUser) return;
    const typed = window.prompt('Type "I agree" to clear saved anime:') || '';
    if (typed !== 'I agree') return notify('error', 'Cancelled', 'Confirmation text mismatch.');
    await clearCurrentAccountSavesRaw();
    notify('success', 'Cleared', 'All saved anime removed for this account.');
}

async function initAuth() {
    const { data } = await supabaseClient.auth.getSession();
    currentUser = data.session?.user || null;
    if (!currentUser) {
        favoriteAnimes = [];
        localStorage.removeItem('myCyberAnimeList');
    }
    updateAuthStatus();
    if (currentUser) {
        addAccountToList(currentUser.email);
        await ensureDisplayNameFlow();
        await pullCloudList();
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
            addAccountToList(currentUser.email);
            await ensureDisplayNameFlow();
            await pullCloudList();
            updateAuthStatus();
            loadTabContent();
        } else {
            favoriteAnimes = [];
            localStorage.removeItem('myCyberAnimeList');
            updateAuthStatus();
            loadTabContent();
            const top = getAccountsList()[0];
            if (top) notify('info', 'Select account', `Top account available: ${top}`);
        }
    });
}

async function ensureDisplayNameFlow() {
    if (!currentUser?.email) return;
    let name = getDisplayNameForEmail(currentUser.email) || getCookie('cyber_display_name');
    if (!name) {
        const suggested = currentUser.email.split('@')[0];
        name = window.prompt('Set your display name:', suggested) || '';
        name = name.trim();
        if (!name) name = suggested || 'User';
        saveDisplayName(currentUser.email, name);
    }
    setCookie('cyber_last_email', currentUser.email, 180);
    setCookie('cyber_display_name', name, 180);
    setCookie('cyber_logged_in', '1', 7);
}

function updateAuthStatus() {
    const statusEl = document.getElementById('auth-status');
    const badge = document.getElementById('auth-badge');
    const form = document.getElementById('auth-form-container');
    const profile = document.getElementById('profile-block');
    const pName = document.getElementById('profile-name');
    const pEmail = document.getElementById('profile-email');
    const pAvatar = document.getElementById('profile-avatar');
    if (!statusEl) return;

    if (currentUser) {
        const name = getDisplayNameForEmail(currentUser.email) || getCookie('cyber_display_name') || 'User';
        statusEl.textContent = `Connected as: ${name}`;
        if (badge) { badge.textContent = 'ONLINE'; badge.classList.add('online'); }
        if (form) form.style.display = 'none';
        if (profile) profile.style.display = 'block';
        if (pName) pName.textContent = name;
        if (pEmail) pEmail.textContent = currentUser.email;
        if (pAvatar) pAvatar.textContent = getInitial(name);
    } else {
        statusEl.textContent = 'No active session. Please login or create an account.';
        if (badge) { badge.textContent = 'OFFLINE'; badge.classList.remove('online'); }
        if (form) form.style.display = 'flex';
        if (profile) profile.style.display = 'none';
    }
    renderAccountsList();
}

function notify(type, title, text, timeout = 3200) {
    const wrap = document.getElementById('notify-wrap');
    if (!wrap) return;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
    const div = document.createElement('div');
    div.className = `notify ${type}`;
    div.innerHTML = `<i class="fa-solid ${icon}"></i><div><div class="notify-title">${title}</div><div class="notify-text">${text}</div></div>`;
    wrap.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transform = 'translateX(10px)';
        div.style.transition = 'all .2s ease';
        setTimeout(() => div.remove(), 220);
    }, timeout);
}

async function signUp() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!email || !password) return notify('error', 'Missing fields', 'Enter both email and password.');
    let displayName = window.prompt('Choose a username:', email.split('@')[0] || 'User') || '';
    displayName = displayName.trim() || email.split('@')[0] || 'User';
    saveDisplayName(email, displayName);

    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) return notify('error', 'Sign up failed', error.message);

    setCookie('cyber_last_email', email, 180);
    setCookie('cyber_display_name', displayName, 180);
    notify('success', 'Account created', 'Sign up successful. Check your email if confirmation is enabled.');
}

async function signIn() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!email || !password) return notify('error', 'Missing fields', 'Enter both email and password.');
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return notify('error', 'Login failed', error.message);

    if (!getDisplayNameForEmail(email)) {
        let name = window.prompt('Set your display name:', email.split('@')[0] || 'User') || '';
        name = name.trim() || email.split('@')[0] || 'User';
        saveDisplayName(email, name);
    }

    addAccountToList(email);
    setCookie('cyber_last_email', email, 180);
    setCookie('cyber_logged_in', '1', 7);
    await pullCloudList();
    updateAuthStatus();
    notify('success', 'Login success', `Welcome back ${getDisplayNameForEmail(email) || email}`);
}

async function signOutAndRemoveCurrent() {
    if (!currentUser?.email) return;
    const removed = currentUser.email;
    await supabaseClient.auth.signOut();
    currentUser = null;
    favoriteAnimes = [];
    localStorage.removeItem('myCyberAnimeList');
    const list = removeAccountFromList(removed);
    deleteCookie('cyber_logged_in');
    updateAuthStatus();
    loadTabContent();
    if (list.length) notify('info', 'Account removed', `Top account is ${list[0]}. Tap to login.`);
    else notify('info', 'Logged out', 'No accounts left in list.');
}

function setupSearch(inputEl, boxEl, onSelect) {
    inputEl.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        activeSearchToken++;
        if (inputEl.id === 'search-input') {
            clearSearchBtn.style.display = query.length > 0 ? 'block' : 'none';
            if (query.length === 0) {
                clearTimeout(searchTimeout);
                boxEl.style.display = 'none';
                boxEl.innerHTML = '';
                loadTabContent();
                return;
            }
        } else if (query.length === 0) {
            clearTimeout(searchTimeout);
            boxEl.style.display = 'none';
            boxEl.innerHTML = '';
            if (currentTab === 'recommend') document.getElementById('anime-grid').innerHTML = '<div class="msg-info">SEARCH AN ANIME, SELECT FEW, THEN TAP SELECTION.</div>';
            return;
        }

        const mode = inputEl.id === 'search-input' ? 'main' : 'recommend';
        const hide = shouldHideSuggestions(query, lastAutocompleteTitles[mode] || []);
        if (hide) {
            boxEl.style.display = 'none';
            boxEl.innerHTML = '';
        }

        const token = activeSearchToken;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchAutocomplete(query, boxEl, onSelect, inputEl, token), 300);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = inputEl.value.trim();
            if (!query) return;
            e.preventDefault();
            activeSearchToken++;
            clearTimeout(searchTimeout);
            boxEl.style.display = 'none';
            boxEl.innerHTML = '';
            if (inputEl.id === 'recommend-input') discoverResultsMode = 'search';
            loadGridSearch(query);
        }
    });
}
function clearSearch() {
    activeSearchToken++;
    clearTimeout(searchTimeout);
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    autocompleteBox.style.display = 'none';
    autocompleteBox.innerHTML = '';
    loadTabContent();
}

function shouldHideSuggestions(query, titles) {
    if (!query || !titles.length) return false;
    const q = query.toLowerCase().trim();
    if (!q.includes(' ')) {
        return titles.some(t => (t.split(' ')[0] || '').toLowerCase() === q);
    }
    const firstToken = q.split(' ')[0];
    return titles.some(t => (t.split(' ')[0] || '').toLowerCase() === firstToken);
}

async function fetchAutocomplete(query, boxEl, onSelect, inputEl, token) {
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();
        if (token !== activeSearchToken) return;
        if ((inputEl?.value || '').trim() !== query) return;
        const list = (data.data || []).map(i => i.title || '');
        const mode = inputEl.id === 'search-input' ? 'main' : 'recommend';
        lastAutocompleteTitles[mode] = list;

        const hide = shouldHideSuggestions(query, list);
        if (hide || !data.data || data.data.length === 0) {
            boxEl.style.display = 'none';
            boxEl.innerHTML = '';
            return;
        }

        boxEl.innerHTML = '';
        boxEl.style.display = 'flex';
        data.data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<img src="${item.images.jpg.small_image_url}"> <span>${item.title}</span>`;
            div.onclick = () => onSelect({ id: item.mal_id, title: item.title });
            boxEl.appendChild(div);
        });
    } catch {
        boxEl.style.display = 'none';
        boxEl.innerHTML = '';
    }
}

function initDiscoverSelectionUI() {
    if (document.getElementById('discover-selection-btn')) return;
    const wrapper = document.getElementById('recommend-search-wrapper');
    const btn = document.createElement('button');
    btn.id = 'discover-selection-btn';
    btn.innerHTML = '<i class="fa-solid fa-list-check"></i>';
    btn.title = 'Selections';
    btn.style.position = 'absolute';
    btn.style.right = '10px';
    btn.style.top = '50%';
    btn.style.transform = 'translateY(-50%)';
    btn.style.height = '36px';
    btn.style.width = '36px';
    btn.style.border = '1px solid #1e293b';
    btn.style.background = '#11141e';
    btn.style.color = '#00f3ff';
    btn.style.cursor = 'pointer';
    btn.style.zIndex = '60';
    btn.onclick = openSelectionModal;
    wrapper.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'discover-selection-modal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '200';
    modal.innerHTML = `
        <div style="background:#11141e;border:1px solid #00f3ff;padding:15px;max-width:500px;width:90%;max-height:80vh;overflow:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h3 style="color:#00f3ff;">Selected Anime</h3>
                <button onclick="closeSelectionModal()" style="background:none;border:none;color:#ff0055;font-size:20px;cursor:pointer;">&times;</button>
            </div>
            <div id="discover-selection-list"></div>
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button onclick="runDiscoverSuggestions()" style="flex:1;background:#00f3ff;color:#000;border:none;padding:10px;cursor:pointer;">Suggest Me</button>
                <button onclick="clearDiscoverSelections()" style="flex:1;background:#ff0055;color:#fff;border:none;padding:10px;cursor:pointer;">Cancel All</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target.id === 'discover-selection-modal') closeSelectionModal(); });
    document.body.appendChild(modal);
}
function openSelectionModal() {
    const modal = document.getElementById('discover-selection-modal');
    const list = document.getElementById('discover-selection-list');
    list.innerHTML = '';
    if (!discoverSelections.length) list.innerHTML = '<p style="color:#94a3b8;">No selected anime yet.</p>';
    else discoverSelections.forEach(a => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid #1e293b';
        row.innerHTML = `<span style="color:#e2e8f0;">${a.title}</span><button onclick="removeDiscoverSelection(${a.id})" style="background:#ff0055;color:#fff;border:none;padding:6px 10px;cursor:pointer;">Remove</button>`;
        list.appendChild(row);
    });
    modal.style.display = 'flex';
}
function closeSelectionModal() { document.getElementById('discover-selection-modal').style.display = 'none'; }
function removeDiscoverSelection(id) { discoverSelections = discoverSelections.filter(a => a.id !== id); localStorage.setItem('myDiscoverSelections', JSON.stringify(discoverSelections)); openSelectionModal(); if (currentTab === 'recommend') loadGridSearch(recInput.value.trim() || ''); }
function clearDiscoverSelections() { discoverSelections = []; localStorage.setItem('myDiscoverSelections', JSON.stringify(discoverSelections)); openSelectionModal(); if (currentTab === 'recommend') loadGridSearch(recInput.value.trim() || ''); }

async function runDiscoverSuggestions() {
    if (!discoverSelections.length) {
        notify('error', 'No selections', 'Pick at least one anime using blue heart first.');
        return;
    }
    closeSelectionModal();
    discoverResultsMode = 'suggested';
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = '<div class="msg-info"><i class="fa-solid fa-circle-notch fa-spin"></i> ANALYZING TAGS...</div>';

    try {
        const ids = discoverSelections.slice(0, 4).map(a => a.id);
        const fetched = await Promise.all(ids.map(id => fetch(`https://api.jikan.moe/v4/anime/${id}/full`).then(r => r.json()).catch(() => null)));
        const genreSet = new Set();
        fetched.forEach(res => {
            const d = res?.data;
            (d?.genres || []).forEach(g => genreSet.add(g.name));
            (d?.themes || []).forEach(g => genreSet.add(g.name));
            (d?.demographics || []).forEach(g => genreSet.add(g.name));
        });
        const seed = [...genreSet].slice(0, 3).join(' ');
        const fallback = discoverSelections.map(s => s.title).join(' ');
        const query = seed || fallback;

        const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=24`);
        const data = await response.json();
        const blocked = new Set(discoverSelections.map(s => s.id));
        const list = (data.data || []).filter(x => !blocked.has(x.mal_id));
        processApiData(list);
    } catch {
        grid.innerHTML = '<div class="msg-info">SUGGESTION FAILED.</div>';
    }
}

async function pullCloudList() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient.from('user_anime_list').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false });
    if (error) return;
    favoriteAnimes = (data || []).map(r => ({ id: r.anime_id, title: r.title, image: r.image, synopsis: r.synopsis, type: r.type, status: r.status, episodes: r.episodes, score: r.score, completed: !!r.completed }));
    localStorage.setItem('myCyberAnimeList', JSON.stringify(favoriteAnimes));
}
async function pushAnimeToCloud(animeObj) {
    if (!currentUser) return;
    await supabaseClient.from('user_anime_list').upsert({ user_id: currentUser.id, anime_id: animeObj.id, title: animeObj.title, image: animeObj.image, synopsis: animeObj.synopsis, type: animeObj.type, status: animeObj.status, episodes: animeObj.episodes, score: animeObj.score, completed: !!animeObj.completed }, { onConflict: 'user_id,anime_id' });
}
async function deleteAnimeFromCloud(animeId) {
    if (!currentUser) return;
    await supabaseClient.from('user_anime_list').delete().eq('user_id', currentUser.id).eq('anime_id', animeId);
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = [...document.querySelectorAll('.nav-btn')].find(b => b.getAttribute('onclick')?.includes(`'${tabName}'`));
    if (activeBtn) activeBtn.classList.add('active');
    document.getElementById('account-panel').style.display = tabName === 'account' ? 'block' : 'none';

    if (tabName === 'recommend') {
        discoverResultsMode = 'search';
        document.getElementById('main-search-wrapper').style.display = 'none';
        document.getElementById('recommend-search-wrapper').style.display = 'block';
        document.getElementById('anime-grid').innerHTML = '<div class="msg-info">SEARCH AN ANIME, SELECT FEW, THEN TAP SELECTION.</div>';
    } else if (tabName === 'account') {
        document.getElementById('main-search-wrapper').style.display = 'none';
        document.getElementById('recommend-search-wrapper').style.display = 'none';
        document.getElementById('anime-grid').innerHTML = '';
    } else {
        document.getElementById('main-search-wrapper').style.display = 'block';
        document.getElementById('recommend-search-wrapper').style.display = 'none';
        clearSearch();
    }
}

async function loadTabContent() {
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = '';
    if (currentTab === 'mylist') return renderGrid(favoriteAnimes.filter(a => !a.completed).slice().reverse(), true);
    if (currentTab === 'done') return renderGrid(favoriteAnimes.filter(a => a.completed), true);
    if (currentTab !== 'home') return;

    try {
        const response = await fetch('https://api.jikan.moe/v4/seasons/now?limit=24');
        const data = await response.json();
        processApiData(data.data);
    } catch {
        grid.innerHTML = '<div class="msg-info">CONNECTION FAILED.</div>';
    }
}

async function loadGridSearch(query) {
    const grid = document.getElementById('anime-grid');
    if (!query) return grid.innerHTML = '<div class="msg-info">TYPE TO SEARCH.</div>';
    grid.innerHTML = '<div class="msg-info"><i class="fa-solid fa-circle-notch fa-spin"></i> SEARCHING...</div>';
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=24`);
        const data = await response.json();
        processApiData(data.data);
    } catch { grid.innerHTML = '<div class="msg-info">SEARCH FAILED.</div>'; }
}

function processApiData(apiData) {
    if (apiData && apiData.length > 0) {
        const animes = apiData.map(item => ({
            id: item.mal_id,
            title: item.title,
            image: item.images.jpg.large_image_url,
            synopsis: item.synopsis || 'No data.',
            type: item.type || 'N/A',
            status: item.status || 'Unknown',
            episodes: item.episodes || 'TBA',
            score: item.score || 'N/A',
            completed: false,
            imdb_id: item.external?.imdb || null
        }));
        renderGrid(animes, false);
    } else document.getElementById('anime-grid').innerHTML = '<div class="msg-info">0 MATCHES FOUND.</div>';
}

function renderGrid(animeArray, isLocalTab) {
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = '';
    if (animeArray.length === 0) return grid.innerHTML = '<div class="msg-info">DATABANK EMPTY.</div>';

    animeArray.forEach(anime => {
        const localData = favoriteAnimes.find(fav => fav.id === anime.id);
        const isFav = !!localData;
        const isCompleted = localData ? localData.completed : anime.completed;
        const isSelected = discoverSelections.some(s => s.id === anime.id);
        const safeJson = JSON.stringify(anime).replace(/"/g, '&quot;');
        const checkboxHtml = isLocalTab ? `<button class="action-btn check ${isCompleted ? 'completed' : ''}" onclick="toggleStatus(event, ${safeJson})"><i class="fa-solid fa-check-double"></i></button>` : '';
        const statusTag = anime.status === "Currently Airing" ? "AIRING" : anime.type;
        const discoverSelectMode = currentTab === 'recommend' && discoverResultsMode === 'search';
        const heartClass = discoverSelectMode ? (isSelected ? 'selected' : '') : (isFav ? 'favorited' : '');
        const heartStyle = discoverSelectMode && isSelected ? 'style="color:#00f3ff;border-color:#00f3ff;"' : '';
        const heartClick = discoverSelectMode ? `toggleDiscoverSelection(event, ${safeJson})` : `toggleFavorite(event, ${safeJson})`;

        grid.innerHTML += `
            <div class="anime-card">
                <div class="img-container" onclick="openModal(${safeJson})">
                    <img src="${anime.image}" loading="lazy">
                    <div class="card-tags"><span class="tag">${statusTag}</span></div>
                    <div class="card-actions">
                        <button class="action-btn heart ${heartClass}" ${heartStyle} onclick="${heartClick}">
                            <i class="fa-solid fa-heart"></i>
                        </button>
                        ${checkboxHtml}
                    </div>
                </div>
                <div class="card-info">
                    <div class="anime-title" onclick="copyToClipboard(event, '${anime.title.replace(/'/g, "\\'")}')">${anime.title}</div>
                </div>
            </div>`;
    });
}

function toggleDiscoverSelection(event, animeObj) {
    event.stopPropagation();
    const idx = discoverSelections.findIndex(item => item.id === animeObj.id);
    if (idx > -1) {
        discoverSelections.splice(idx, 1);
        event.currentTarget.style.color = '';
        event.currentTarget.style.borderColor = '';
    } else {
        discoverSelections.push(animeObj);
        event.currentTarget.style.color = '#00f3ff';
        event.currentTarget.style.borderColor = '#00f3ff';
    }
    localStorage.setItem('myDiscoverSelections', JSON.stringify(discoverSelections));
}

async function toggleFavorite(event, animeObj) {
    event.stopPropagation();
    const idx = favoriteAnimes.findIndex(item => item.id === animeObj.id);
    if (idx > -1) { favoriteAnimes.splice(idx, 1); event.currentTarget.classList.remove('favorited'); await deleteAnimeFromCloud(animeObj.id); }
    else { favoriteAnimes.push(animeObj); event.currentTarget.classList.add('favorited'); await pushAnimeToCloud(animeObj); }
    localStorage.setItem('myCyberAnimeList', JSON.stringify(favoriteAnimes));
    if (currentTab === 'mylist' || currentTab === 'done') loadTabContent();
}

async function toggleStatus(event, animeObj) {
    event.stopPropagation();
    const idx = favoriteAnimes.findIndex(item => item.id === animeObj.id);
    if (idx > -1) favoriteAnimes[idx].completed = !favoriteAnimes[idx].completed;
    else { animeObj.completed = true; favoriteAnimes.push(animeObj); }
    localStorage.setItem('myCyberAnimeList', JSON.stringify(favoriteAnimes));
    const target = favoriteAnimes.find(a => a.id === animeObj.id);
    if (target) await pushAnimeToCloud(target);
    if (currentTab === 'mylist' || currentTab === 'done') loadTabContent();
}

function copyToClipboard(event, text) {
    event.stopPropagation();
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(showToast).catch(() => {});
}

async function openModal(anime) {
    currentModalAnime = anime;
    const modalImg = document.getElementById('modal-img');
    modalImg.src = anime.image;
    modalImg.style.cursor = 'pointer';
    modalImg.title = 'Click to open preview stream';
    document.getElementById('modal-title').innerText = anime.title;
    document.getElementById('modal-meta-type').innerText = anime.type;
    document.getElementById('modal-meta-status').innerText = anime.status;
    document.getElementById('modal-meta-ep').innerText = anime.episodes;
    document.getElementById('modal-meta-score').innerText = anime.score;
    document.getElementById('modal-synopsis').innerText = anime.synopsis;
    document.getElementById('details-modal').classList.add('open');
    await loadRecommendations(anime.id);
}

async function loadRecommendations(malId) {
    const holder = document.getElementById('modal-recommendations');
    holder.innerHTML = '<p style="color:#94a3b8;">Loading...</p>';
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/recommendations`);
        const data = await response.json();
        const recs = (data.data || []).slice(0, 12);
        if (!recs.length) {
            holder.innerHTML = '<p style="color:#94a3b8;">No similar targets found.</p>';
            return;
        }
        holder.innerHTML = '';
        recs.forEach(r => {
            const e = r.entry;
            const anime = {
                id: e.mal_id,
                title: e.title,
                image: e.images.jpg.large_image_url || e.images.jpg.image_url,
                synopsis: 'Open details to fetch summary.',
                type: 'N/A',
                status: 'Unknown',
                episodes: 'TBA',
                score: 'N/A',
                completed: false
            };
            const div = document.createElement('div');
            div.className = 'mini-card';
            div.innerHTML = `<img src="${anime.image}" loading="lazy"><p>${anime.title}</p>`;
            div.onclick = async () => {
                try {
                    const detailsResp = await fetch(`https://api.jikan.moe/v4/anime/${anime.id}/full`);
                    const detailsData = await detailsResp.json();
                    const d = detailsData.data;
                    openModal({
                        id: d.mal_id,
                        title: d.title,
                        image: d.images.jpg.large_image_url,
                        synopsis: d.synopsis || 'No data.',
                        type: d.type || 'N/A',
                        status: d.status || 'Unknown',
                        episodes: d.episodes || 'TBA',
                        score: d.score || 'N/A',
                        imdb_id: d.external?.imdb || null,
                        completed: false
                    });
                } catch {}
            };
            holder.appendChild(div);
        });
    } catch {
        holder.innerHTML = '<p style="color:#94a3b8;">Failed to load similar targets.</p>';
    }
}

function openPreviewFromModal() {
    if (!currentModalAnime?.imdb_id) return notify('error', 'Preview unavailable', 'IMDb id not found for this anime.');
    const url = `https://streamimdb.ru/embed/tv/${currentModalAnime.imdb_id}`;
    window.open(url, '_blank');
}

function closeModal() {
    document.getElementById('details-modal').classList.remove('open');
    document.getElementById('modal-recommendations').innerHTML = '';
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
}