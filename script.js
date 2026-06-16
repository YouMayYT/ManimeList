let currentUser = null;
let currentTab = 'home';
let showingCompletedOnly = false;
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
    try {
        console.log('App initializing...');
        enhanceAccountPanelUI();
        updateAuthStatus();
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
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

function getInitial(v) { 
    const raw = (v || '').trim(); 
    return raw ? raw[0].toUpperCase() : '?'; 
}

function getAnimeTitle(anime) {
    return anime.title_english || anime.title || 'Unknown';
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
            <button id="quick-logout-btn" class="auth-btn logout" style="flex:1;" onclick="signOutUser()">Logout</button>
        </div>
    `;
    panel.appendChild(profileBlock);
}

function updateAuthStatus() {
    const statusEl = document.getElementById('auth-status');
    const badge = document.getElementById('auth-badge');
    const form = document.getElementById('auth-form-container');
    const profile = document.getElementById('profile-block');
    
    if (!statusEl) return;

    if (currentUser) {
        const name = currentUser.name || 'User';
        statusEl.textContent = `Connected as: ${name}`;
        if (badge) { badge.textContent = 'ONLINE'; badge.classList.add('online'); }
        if (form) form.style.display = 'none';
        if (profile) profile.style.display = 'block';
        const pName = document.getElementById('profile-name');
        const pEmail = document.getElementById('profile-email');
        const pAvatar = document.getElementById('profile-avatar');
        if (pName) pName.textContent = name;
        if (pEmail) pEmail.textContent = currentUser.email || 'local user';
        if (pAvatar) pAvatar.textContent = getInitial(name);
    } else {
        statusEl.textContent = 'No active session. Please login or create an account.';
        if (badge) { badge.textContent = 'OFFLINE'; badge.classList.remove('online'); }
        if (form) form.style.display = 'flex';
        if (profile) profile.style.display = 'none';
    }
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
    
    currentUser = { email, name: displayName };
    updateAuthStatus();
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    notify('success', 'Account created', `Welcome ${displayName}! (Local storage only)`);
}

async function signIn() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!email || !password) return notify('error', 'Missing fields', 'Enter both email and password.');
    
    let displayName = window.prompt('Set your display name:', email.split('@')[0] || 'User') || '';
    displayName = displayName.trim() || email.split('@')[0] || 'User';
    
    currentUser = { email, name: displayName };
    updateAuthStatus();
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    notify('success', 'Login success', `Welcome back ${displayName}!`);
}

async function signOutUser() {
    if (!currentUser?.email) return;
    currentUser = null;
    updateAuthStatus();
    loadTabContent();
    notify('info', 'Logged out', 'You have been logged out.');
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
        const list = (data.data || []).map(i => getAnimeTitle(i) || '');
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
            div.innerHTML = `<img src="${item.images.jpg.small_image_url}" alt="${getAnimeTitle(item)}"> <span>${getAnimeTitle(item)}</span>`;
            div.onclick = () => onSelect({ id: item.mal_id, title: getAnimeTitle(item) });
            boxEl.appendChild(div);
        });
    } catch (error) {
        console.error('Autocomplete error:', error);
        boxEl.style.display = 'none';
        boxEl.innerHTML = '';
    }
}

function initDiscoverSelectionUI() {
    if (document.getElementById('discover-selection-btn')) return;
    const wrapper = document.getElementById('recommend-search-wrapper');
    if (!wrapper) return;
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
                <button onclick="runDiscoverSuggestions()" style="flex:1;background:#00f3ff;color:#000;border:none;padding:10px;cursor:pointer;font-weight:700;">Suggest Me</button>
                <button onclick="clearDiscoverSelections()" style="flex:1;background:#ff0055;color:#fff;border:none;padding:10px;cursor:pointer;font-weight:700;">Cancel All</button>
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
        row.innerHTML = `<span style="color:#e2e8f0;">${a.title}</span><button onclick="removeDiscoverSelection(${a.id})" style="background:#ff0055;color:#fff;border:none;padding:6px 10px;cursor:pointer;font-weight:700;">Remove</button>`;
        list.appendChild(row);
    });
    modal.style.display = 'flex';
}

function closeSelectionModal() { 
    const modal = document.getElementById('discover-selection-modal');
    if (modal) modal.style.display = 'none'; 
}

function removeDiscoverSelection(id) { 
    discoverSelections = discoverSelections.filter(a => a.id !== id); 
    localStorage.setItem('myDiscoverSelections', JSON.stringify(discoverSelections)); 
    openSelectionModal(); 
}

function clearDiscoverSelections() { 
    discoverSelections = []; 
    localStorage.setItem('myDiscoverSelections', JSON.stringify(discoverSelections)); 
    openSelectionModal(); 
    if (currentTab === 'recommend') loadTabContent(); 
}

/**
 * Unified suggestion algorithm using genre and theme tags
 */
async function generateSuggestionsFromAnimes(animeIds) {
    try {
        const fetched = await Promise.all(
            animeIds.slice(0, 4).map(id => 
                fetch(`https://api.jikan.moe/v4/anime/${id}/full`)
                    .then(r => r.json())
                    .catch(() => null)
            )
        );
        
        const tagSet = new Set();
        fetched.forEach(res => {
            const d = res?.data;
            if (!d) return;
            (d.genres || []).forEach(g => tagSet.add(g.name));
            (d.themes || []).forEach(g => tagSet.add(g.name));
            (d.demographics || []).forEach(g => tagSet.add(g.name));
        });
        
        const tags = [...tagSet].slice(0, 3);
        return tags.length > 0 ? tags.join(' ') : null;
    } catch (error) {
        console.error('Suggestion generation error:', error);
        return null;
    }
}

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
        const ids = discoverSelections.map(a => a.id);
        const query = await generateSuggestionsFromAnimes(ids);
        const fallback = discoverSelections.map(s => s.title).join(' ');
        const searchQuery = query || fallback;

        const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery)}&limit=24`);
        const data = await response.json();
        const blocked = new Set(discoverSelections.map(s => s.id));
        const list = (data.data || []).filter(x => !blocked.has(x.mal_id));
        processApiData(list);
    } catch (error) {
        console.error('Discover suggestions error:', error);
        grid.innerHTML = '<div class="msg-info">SUGGESTION FAILED.</div>';
    }
}

function switchTab(tabName) {
    currentTab = tabName;
    showingCompletedOnly = false;
    closeModal();
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = [...document.querySelectorAll('.nav-btn')].find(b => b.getAttribute('onclick')?.includes(`'${tabName}'`));
    if (activeBtn) activeBtn.classList.add('active');
    
    document.getElementById('account-panel').style.display = tabName === 'account' ? 'block' : 'none';
    const mainSearchWrapper = document.getElementById('main-search-wrapper');
    const recommendSearchWrapper = document.getElementById('recommend-search-wrapper');
    const mylistSearchWrapper = document.getElementById('mylist-search-wrapper');

    if (tabName === 'recommend') {
        discoverResultsMode = 'search';
        mainSearchWrapper.style.display = 'none';
        recommendSearchWrapper.style.display = 'block';
        mylistSearchWrapper.style.display = 'none';
        document.getElementById('anime-grid').innerHTML = '<div class="msg-info">SEARCH AN ANIME, SELECT FEW, THEN TAP SELECTION.</div>';
    } else if (tabName === 'mylist') {
        mainSearchWrapper.style.display = 'none';
        recommendSearchWrapper.style.display = 'none';
        mylistSearchWrapper.style.display = 'block';
        loadTabContent();
    } else if (tabName === 'account') {
        mainSearchWrapper.style.display = 'none';
        recommendSearchWrapper.style.display = 'none';
        mylistSearchWrapper.style.display = 'none';
        document.getElementById('anime-grid').innerHTML = '';
    } else {
        mainSearchWrapper.style.display = 'block';
        recommendSearchWrapper.style.display = 'none';
        mylistSearchWrapper.style.display = 'none';
        clearSearch();
    }
}

function toggleListView() {
    showingCompletedOnly = !showingCompletedOnly;
    const stateIn = document.querySelector('.toggle-state-in');
    const stateDone = document.querySelector('.toggle-state-done');
    if (showingCompletedOnly) {
        if (stateIn) stateIn.style.display = 'none';
        if (stateDone) stateDone.style.display = 'inline';
    } else {
        if (stateIn) stateIn.style.display = 'inline';
        if (stateDone) stateDone.style.display = 'none';
    }
    loadTabContent();
}

async function loadTabContent() {
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = '';
    
    if (currentTab === 'mylist') {
        const filtered = showingCompletedOnly 
            ? favoriteAnimes.filter(a => a.completed)
            : favoriteAnimes.filter(a => !a.completed);
        return renderGrid(filtered.slice().reverse(), true);
    }
    if (currentTab !== 'home') return;

    try {
        const response = await fetch('https://api.jikan.moe/v4/seasons/now?limit=24');
        const data = await response.json();
        processApiData(data.data);
    } catch (error) {
        console.error('Load tab content error:', error);
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
    } catch (error) {
        console.error('Search error:', error);
        grid.innerHTML = '<div class="msg-info">SEARCH FAILED.</div>';
    }
}

function processApiData(apiData) {
    if (apiData && apiData.length > 0) {
        const animes = apiData.map(item => ({
            id: item.mal_id,
            title: getAnimeTitle(item),
            image: item.images.jpg.large_image_url,
            synopsis: item.synopsis || 'No data.',
            type: item.type || 'N/A',
            status: item.status || 'Unknown',
            episodes: item.episodes || 'TBA',
            score: item.score || 'N/A',
            completed: false,
            imdb_id: item.external?.imdb || null,
            genres: item.genres || [],
            themes: item.themes || [],
            demographics: item.demographics || []
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
                    <img src="${anime.image}" loading="lazy" alt="${anime.title}">
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
    if (idx > -1) { 
        favoriteAnimes.splice(idx, 1); 
        event.currentTarget.classList.remove('favorited'); 
    }
    else { 
        favoriteAnimes.push(animeObj); 
        event.currentTarget.classList.add('favorited'); 
    }
    localStorage.setItem('myCyberAnimeList', JSON.stringify(favoriteAnimes));
    if (currentTab === 'mylist') loadTabContent();
}

async function toggleStatus(event, animeObj) {
    event.stopPropagation();
    const idx = favoriteAnimes.findIndex(item => item.id === animeObj.id);
    if (idx > -1) favoriteAnimes[idx].completed = !favoriteAnimes[idx].completed;
    else { animeObj.completed = true; favoriteAnimes.push(animeObj); }
    localStorage.setItem('myCyberAnimeList', JSON.stringify(favoriteAnimes));
    if (currentTab === 'mylist') loadTabContent();
}

function copyToClipboard(event, text) {
    event.stopPropagation();
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(showToast).catch(() => {});
}

async function openModal(anime) {
    currentModalAnime = anime;
    const modalImg = document.getElementById('modal-img');
    modalImg.src = anime.image;
    modalImg.alt = anime.title;
    modalImg.style.cursor = 'pointer';
    modalImg.title = 'Click to open preview stream';
    document.getElementById('modal-title').innerText = anime.title;
    document.getElementById('modal-meta-type').innerText = anime.type;
    document.getElementById('modal-meta-status').innerText = anime.status;
    document.getElementById('modal-meta-ep').innerText = anime.episodes;
    document.getElementById('modal-meta-score').innerText = anime.score;
    document.getElementById('modal-synopsis').innerText = anime.synopsis;
    document.getElementById('details-modal').classList.add('open');
    await loadRecommendations(anime);
}

async function loadRecommendations(anime) {
    const holder = document.getElementById('modal-recommendations');
    holder.innerHTML = '<p style="color:#94a3b8;">Loading...</p>';
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${anime.id}/recommendations`);
        const data = await response.json();
        const recs = (data.data || []).slice(0, 12);
        
        if (!recs.length || recs.length < 5) {
            // Fallback to discover algorithm
            console.log('Using discover fallback algorithm for recommendations');
            const query = await generateSuggestionsFromAnimes([anime.id]);
            if (query) {
                const response2 = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12`);
                const data2 = await response2.json();
                const fallbackRecs = (data2.data || []).filter(x => x.mal_id !== anime.id).slice(0, 12);
                if (fallbackRecs.length > 0) {
                    return displayRecommendations(fallbackRecs);
                }
            }
            holder.innerHTML = '<p style="color:#94a3b8;">No similar targets found.</p>';
            return;
        }
        displayRecommendations(recs.map(r => r.entry));
    } catch (error) {
        console.error('Load recommendations error:', error);
        holder.innerHTML = '<p style="color:#94a3b8;">Failed to load similar targets.</p>';
    }
}

function displayRecommendations(recData) {
    const holder = document.getElementById('modal-recommendations');
    holder.innerHTML = '';
    
    recData.forEach(e => {
        const anime = {
            id: e.mal_id,
            title: getAnimeTitle(e),
            image: e.images?.jpg?.large_image_url || e.images?.jpg?.image_url || e.images?.jpg?.small_image_url,
            synopsis: e.synopsis || 'Open details to fetch summary.',
            type: e.type || 'N/A',
            status: e.status || 'Unknown',
            episodes: e.episodes || 'TBA',
            score: e.score || 'N/A',
            completed: false,
            genres: e.genres || [],
            themes: e.themes || [],
            demographics: e.demographics || []
        };
        
        const div = document.createElement('div');
        div.className = 'mini-card';
        div.innerHTML = `<img src="${anime.image}" loading="lazy" alt="${anime.title}"><p>${anime.title}</p>`;
        div.onclick = async () => {
            try {
                const detailsResp = await fetch(`https://api.jikan.moe/v4/anime/${anime.id}/full`);
                const detailsData = await detailsResp.json();
                const d = detailsData.data;
                openModal({
                    id: d.mal_id,
                    title: getAnimeTitle(d),
                    image: d.images.jpg.large_image_url,
                    synopsis: d.synopsis || 'No data.',
                    type: d.type || 'N/A',
                    status: d.status || 'Unknown',
                    episodes: d.episodes || 'TBA',
                    score: d.score || 'N/A',
                    imdb_id: d.external?.imdb || null,
                    completed: false,
                    genres: d.genres || [],
                    themes: d.themes || [],
                    demographics: d.demographics || []
                });
            } catch (error) {
                console.error('Load recommendation detail error:', error);
            }
        };
        holder.appendChild(div);
    });
}

function openPreviewFromModal() {
    if (!currentModalAnime?.imdb_id) return notify('error', 'Preview unavailable', 'IMDb id not found for this anime.');
    const url = `https://streamimdb.ru/embed/tv/${currentModalAnime.imdb_id}`;
    window.open(url, '_blank');
}

function closeModal(event) {
    if (event && event.target.id !== 'details-modal') return;
    document.getElementById('details-modal').classList.remove('open');
    document.getElementById('modal-recommendations').innerHTML = '';
    currentModalAnime = null;
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
}
