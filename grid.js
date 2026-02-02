// --- Settings & Init ---
const container = document.getElementById('main-container');

// State for back button history: index -> array of urls
const navHistory = {
    0: [], 1: [], 2: [], 3: []
};

function applySettings() {
    chrome.storage.local.get(['showNav', 'darkMode'], (res) => {
        const showNav = res.showNav !== false; // Default True
        const isDarkMode = res.darkMode !== false;

        // Toggle Nav Bars
        const navBars = document.querySelectorAll('.nav-bar');
        navBars.forEach(nav => {
            nav.style.display = showNav ? 'flex' : 'none';
        });

        // Toggle Dark Mode
        if (isDarkMode) {
            document.body.style.background = '#202124';
            document.querySelectorAll('.quadrant').forEach(el => el.style.background = '#35363a');
            document.querySelectorAll('.nav-bar').forEach(el => el.style.background = '#35363a');
            document.querySelectorAll('.splitter-v, .splitter-h').forEach(el => {
                el.style.background = '#202124';
            });
            document.querySelectorAll('.url-input').forEach(el => el.style.color = '#e8eaed');
        } else {
            document.body.style.background = '#f1f3f4';
            document.querySelectorAll('.quadrant').forEach(el => el.style.background = '#fff');
            document.querySelectorAll('.nav-bar').forEach(el => el.style.background = '#f1f3f4');
            document.querySelectorAll('.splitter-v, .splitter-h').forEach(el => {
                el.style.background = '#dadce0';
            });
            document.querySelectorAll('.url-input').forEach(el => el.style.color = '#333');
        }
    });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.showNav || changes.darkMode) {
            applySettings();
        }
    }
});


// --- URL & Initialization Logic ---
function normalizeUrl(input) {
    input = input.trim();
    if (!input) return "about:blank";

    // TLD Guessing
    const tlds = ['.com', '.org', '.net', '.edu', '.gov', '.io', '.co', '.ai'];
    const isUrlLike = tlds.some(tld => input.includes(tld)) ||
        input.startsWith('http://') ||
        input.startsWith('https://') ||
        input.startsWith('www.');

    if (input.includes(' ') || !isUrlLike) {
        return `https://www.google.com/search?q=${encodeURIComponent(input)}&igu=1`;
    }

    if (!input.match(/^[a-zA-Z]+:\/\//)) {
        return "https://" + input;
    }
    return input;
}

function updateBackBtn(index) {
    const btn = document.getElementById(`back-${index}`);
    // Enable if history has more than 1 item (current + at least one prev)
    // Actually, history stores PREVIOUS pages. Current page is in iframe.
    // So if history.length > 0, we can go back.
    btn.disabled = navHistory[index].length === 0;
}

function loadFrame(index, url, isBackNav = false) {
    const frame = document.getElementById(`frame-${index}`);
    const input = document.getElementById(`input-${index}`);
    const finalUrl = normalizeUrl(url);

    // If THIS load is NOT a back navigation, push the CURRENT url to history before loading new one
    if (!isBackNav) {
        // Only push if there IS a current src (and it's not empty/initial)
        if (frame.src && frame.src !== '' && frame.src !== 'about:blank') {
            navHistory[index].push(frame.src);
        }
    }

    input.value = finalUrl;
    frame.src = finalUrl;

    updateBackBtn(index);

    // Update storage
    chrome.storage.local.get(['splitUrls'], (result) => {
        const urls = result.splitUrls || [];
        urls[index] = finalUrl;
        chrome.storage.local.set({ splitUrls: urls });
    });
}

function goBack(index) {
    const history = navHistory[index];
    if (history.length > 0) {
        const prevUrl = history.pop();
        loadFrame(index, prevUrl, true); // true = don't push current to history again
    }
}

function reloadFrame(index) {
    const frame = document.getElementById(`frame-${index}`);
    frame.src = frame.src;
}

// Initial Load
chrome.storage.local.get(['splitUrls'], (result) => {
    applySettings();

    const urls = result.splitUrls || [];

    for (let i = 0; i < 4; i++) {
        const url = urls[i] || "about:blank";
        // Reset history on fresh load
        navHistory[i] = [];
        loadFrame(i, url);

        // Listeners
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


// --- Resizing Logic (Copied from before) ---

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
    let isDragging = false;

    splitter.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.classList.add('is-changing-layout');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        if (direction === 'horizontal') {
            const containerWidth = container.offsetWidth;
            let newLeftWidth = (e.clientX / containerWidth) * 100;
            if (newLeftWidth < 10) newLeftWidth = 10;
            if (newLeftWidth > 90) newLeftWidth = 90;
            firstEl.style.flex = `0 0 ${newLeftWidth}%`;
        } else {
            const col = firstEl.parentElement;
            const colHeight = col.offsetHeight;
            const colTop = col.getBoundingClientRect().top;
            let relativeY = e.clientY - colTop;
            let newTopHeightPct = (relativeY / colHeight) * 100;
            if (newTopHeightPct < 10) newTopHeightPct = 10;
            if (newTopHeightPct > 90) newTopHeightPct = 90;
            firstEl.style.flex = `0 0 ${newTopHeightPct}%`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.classList.remove('is-changing-layout');
        }
    });
}

makeResizable(splitV, 'horizontal', colLeft, colRight);
makeResizable(splitHLeft, 'vertical', quad0, quad2);
makeResizable(splitHRight, 'vertical', quad1, quad3);
