// --- Settings & Init ---
const container = document.getElementById('main-container');
const navHistory = { 0: [], 1: [], 2: [], 3: [] };

// Get Mode from URL
const urlParams = new URLSearchParams(window.location.search);
const MODE = urlParams.get('mode') || 'quad'; // 'quad' or 'dual'

function applyLayoutMode() {
    if (MODE === 'dual') {
        // Hide bottom quadrants and horizontal splitters
        document.getElementById('split-h-left').style.display = 'none';
        document.getElementById('split-h-right').style.display = 'none';
        document.getElementById('quad-2').style.display = 'none';
        document.getElementById('quad-3').style.display = 'none';
        // Ensure top quadrants take full height
        document.getElementById('quad-0').style.flex = '1 0 100%';
        document.getElementById('quad-1').style.flex = '1 0 100%';
    }
}

function applySettings() {
    chrome.storage.local.get(['showNav', 'darkMode'], (res) => {
        const showNav = res.showNav !== false;
        const isDarkMode = res.darkMode !== false;

        // Toggle Nav Bars
        document.querySelectorAll('.nav-bar').forEach(nav => {
            nav.style.display = showNav ? 'flex' : 'none';
        });

        // Toggle Dark Mode
        if (isDarkMode) {
            document.body.style.background = '#202124';
            document.querySelectorAll('.quadrant').forEach(el => el.style.background = '#35363a');
            document.querySelectorAll('.nav-bar').forEach(el => el.style.background = '#35363a');
            document.querySelectorAll('.url-input').forEach(el => el.style.color = '#e8eaed');
            // Splitters
            document.querySelectorAll('.splitter-v, .splitter-h').forEach(el => el.style.background = '#202124');
        } else {
            document.body.style.background = '#f1f3f4';
            document.querySelectorAll('.quadrant').forEach(el => el.style.background = '#fff');
            document.querySelectorAll('.nav-bar').forEach(el => el.style.background = '#f1f3f4');
            document.querySelectorAll('.url-input').forEach(el => el.style.color = '#333');
            // Splitters
            document.querySelectorAll('.splitter-v, .splitter-h').forEach(el => el.style.background = '#dadce0');
        }
    });
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.showNav || changes.darkMode) applySettings();
    }
});

// --- URL Logic ---
function normalizeUrl(input) {
    input = input.trim();
    if (!input) return "about:blank";
    const tlds = ['.com', '.org', '.net', '.edu', '.gov', '.io', '.co', '.ai'];
    const isUrlLike = tlds.some(tld => input.includes(tld)) || input.startsWith('http') || input.startsWith('www.');
    if (input.includes(' ') || !isUrlLike) return `https://www.google.com/search?q=${encodeURIComponent(input)}&igu=1`;
    if (!input.match(/^[a-zA-Z]+:\/\//)) return "https://" + input;
    return input;
}

function updateBackBtn(index) {
    const btn = document.getElementById(`back-${index}`);
    if (btn) btn.disabled = navHistory[index].length === 0;
}

function loadFrame(index, url, isBackNav = false) {
    const frame = document.getElementById(`frame-${index}`);
    if (!frame) return; // Safety for dual mode or hidden elements

    const input = document.getElementById(`input-${index}`);
    const finalUrl = normalizeUrl(url);

    if (!isBackNav && frame.src && frame.src !== '' && frame.src !== 'about:blank') {
        navHistory[index].push(frame.src);
    }

    input.value = finalUrl;
    frame.src = finalUrl;
    updateBackBtn(index);

    chrome.storage.local.get(['splitUrls'], (result) => {
        const urls = result.splitUrls || [];
        urls[index] = finalUrl;
        chrome.storage.local.set({ splitUrls: urls });
    });
}

function goBack(index) {
    const history = navHistory[index];
    if (history.length > 0) {
        loadFrame(index, history.pop(), true);
    }
}

function reloadFrame(index) {
    const frame = document.getElementById(`frame-${index}`);
    if (frame) frame.src = frame.src;
}

// Initial Load
chrome.storage.local.get(['splitUrls'], (result) => {
    applyLayoutMode();
    applySettings();

    const urls = result.splitUrls || [];
    const count = MODE === 'dual' ? 2 : 4;

    for (let i = 0; i < count; i++) {
        const url = urls[i] || "about:blank";
        navHistory[i] = [];
        loadFrame(i, url);

        const input = document.getElementById(`input-${i}`);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                loadFrame(i, input.value);
                input.blur();
            }
        });
        document.getElementById(`reload-${i}`).addEventListener('click', () => reloadFrame(i));
        document.getElementById(`back-${i}`).addEventListener('click', () => goBack(i));
        input.addEventListener('focus', () => setTimeout(() => input.select(), 10));
    }
});

// --- Resizing ---
const splitV = document.getElementById('split-v-main');
const splitHLeft = document.getElementById('split-h-left');
const splitHRight = document.getElementById('split-h-right');
const colLeft = document.getElementById('col-left');
const colRight = document.getElementById('col-right');
const quad0 = document.getElementById('quad-0');
const quad2 = document.getElementById('quad-2');
const quad1 = document.getElementById('quad-1');
const quad3 = document.getElementById('quad-3');

function makeResizable(splitter, direction, firstEl, secondEl) {
    if (!splitter) return; // layout might lack splitters (dual mode potentially? no, vertical still exists)

    let isDragging = false;
    splitter.addEventListener('mousedown', () => { isDragging = true; document.body.classList.add('is-changing-layout'); });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        if (direction === 'horizontal') {
            const containerWidth = container.offsetWidth;
            let val = (e.clientX / containerWidth) * 100;
            if (val < 10) val = 10; if (val > 90) val = 90;
            firstEl.style.flex = `0 0 ${val}%`;
        } else {
            const col = firstEl.parentElement;
            let val = ((e.clientY - col.getBoundingClientRect().top) / col.offsetHeight) * 100;
            if (val < 10) val = 10; if (val > 90) val = 90;
            firstEl.style.flex = `0 0 ${val}%`;
        }
    });
    document.addEventListener('mouseup', () => { isDragging = false; document.body.classList.remove('is-changing-layout'); });
}

makeResizable(splitV, 'horizontal', colLeft, colRight);

// Only enable vertical resizing if NOT in dual mode (where H splitters are hidden)
if (MODE !== 'dual') {
    makeResizable(splitHLeft, 'vertical', quad0, quad2);
    makeResizable(splitHRight, 'vertical', quad1, quad3);
}
