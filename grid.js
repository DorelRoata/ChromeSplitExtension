const MAX_PANES = 16;
const SPLIT_TAB_STATES_KEY = 'splitTabStates';
const PENDING_LAYOUT_STATE_KEY = 'pendingLayoutState';
let container = null;

const navHistory = {};
const panes = new Map();
const paneLayoutMap = new Map();

const urlParams = new URLSearchParams(window.location.search);
const MODE = urlParams.get('mode') || 'quad';
const requestedCount = Number.parseInt(urlParams.get('count') || '', 10);
const hasCustomCount = Number.isInteger(requestedCount) && requestedCount >= 1;
const defaultCount = MODE === 'dual' ? 2 : 4;
const count = Math.min(MAX_PANES, Math.max(1, hasCustomCount ? requestedCount : defaultCount));
const useDualLayout = MODE === 'dual' && !hasCustomCount;

const activePanes = new Set(Array.from({ length: count }, (_, i) => i));

let showNavSetting = true;
let darkModeSetting = true;
let closePackDirection = 'horizontal';
let packByAxis = false;
let currentCols = 1;
let currentRows = 1;
let colRatios = [1];
let rowRatios = [1];
let dragState = null;
let currentTabId = null;

const BACK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>';
const RELOAD_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>';
const CLOSE_H_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4.5 6.5 8.5 10.5M8.5 6.5 4.5 10.5"/><path d="M12 7h7M12 12h7M12 17h7"/></svg>';
const CLOSE_V_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4.5 6.5 8.5 10.5M8.5 6.5 4.5 10.5"/><path d="M13 5v14M17 5v14M21 5v14"/></svg>';

function ensureContainer() {
    if (container) return container;
    container = document.getElementById('main-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'main-container';
        container.className = 'main-container';
        document.body.appendChild(container);
    }
    return container;
}

function normalizeUrl(input) {
    input = input.trim();
    if (!input) return 'about:blank';
    const tlds = ['.com', '.org', '.net', '.edu', '.gov', '.io', '.co', '.ai'];
    const isUrlLike = tlds.some((tld) => input.includes(tld)) || input.startsWith('http') || input.startsWith('www.');
    if (input.includes(' ') || !isUrlLike) {
        return `https://www.google.com/search?q=${encodeURIComponent(input)}&igu=1`;
    }
    if (!input.match(/^[a-zA-Z]+:\/\//)) return `https://${input}`;
    return input;
}

function persistPaneUrl(index, url) {
    chrome.storage.local.get(['splitUrls'], (result) => {
        const urls = result.splitUrls || [];
        urls[index] = url;
        chrome.storage.local.set({ splitUrls: urls });
    });
}

function getOrderedActivePaneIndices() {
    const ordered = Array.from(activePanes);
    ordered.sort((a, b) => {
        const posA = paneLayoutMap.get(a);
        const posB = paneLayoutMap.get(b);
        if (posA && posB) {
            if (posA.row !== posB.row) return posA.row - posB.row;
            if (posA.col !== posB.col) return posA.col - posB.col;
        } else if (posA) {
            return -1;
        } else if (posB) {
            return 1;
        }
        return a - b;
    });
    return ordered;
}

function normalizeRatios(values, expectedLength) {
    if (!Array.isArray(values) || values.length !== expectedLength || expectedLength < 1) return null;
    const cleaned = values.map((value) => Number(value));
    if (cleaned.some((value) => !Number.isFinite(value) || value <= 0)) return null;
    const total = cleaned.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return null;
    return cleaned.map((value) => value / total);
}

function persistCurrentTabState() {
    if (!Number.isInteger(currentTabId)) return;

    const ordered = getOrderedActivePaneIndices();
    const urls = ordered
        .map((index) => panes.get(index)?.frameEl?.src || '')
        .filter((url) => Boolean(url) && url !== 'about:blank');

    const state = {
        mode: useDualLayout ? 'dual' : 'quad',
        count: Math.max(1, ordered.length),
        urls,
        activePaneIndices: ordered,
        closePackDirection,
        packByAxis,
        grid: {
            cols: currentCols,
            rows: currentRows,
            colRatios: [...colRatios],
            rowRatios: [...rowRatios],
        },
        paneLayout: Object.fromEntries(Array.from(paneLayoutMap.entries()).map(([index, pos]) => [index, pos])),
        updatedAt: Date.now(),
    };

    chrome.storage.local.get([SPLIT_TAB_STATES_KEY], (result) => {
        const states = result[SPLIT_TAB_STATES_KEY] || {};
        states[currentTabId] = state;
        chrome.storage.local.set({ [SPLIT_TAB_STATES_KEY]: states });
    });
}

function applyPendingLayoutState(state) {
    if (!state || typeof state !== 'object') return false;

    const stateMode = state.mode === 'dual' ? 'dual' : 'quad';
    const currentMode = useDualLayout ? 'dual' : 'quad';
    if (stateMode !== currentMode) return false;

    const stateCount = Number.isInteger(state.count) ? state.count : 0;
    if (stateCount !== count) return false;

    const nextActive = Array.isArray(state.activePaneIndices)
        ? state.activePaneIndices.filter((index) => Number.isInteger(index) && index >= 0 && index < count)
        : Array.from({ length: count }, (_, i) => i);

    if (nextActive.length < 1) return false;

    activePanes.clear();
    nextActive.forEach((index) => activePanes.add(index));

    closePackDirection = state.closePackDirection === 'vertical' ? 'vertical' : 'horizontal';
    packByAxis = Boolean(state.packByAxis);

    paneLayoutMap.clear();
    const paneLayout = state.paneLayout && typeof state.paneLayout === 'object' ? state.paneLayout : {};
    Object.entries(paneLayout).forEach(([indexStr, pos]) => {
        const index = Number.parseInt(indexStr, 10);
        if (!Number.isInteger(index) || !activePanes.has(index)) return;
        const row = Number.isInteger(pos?.row) ? pos.row : 1;
        const col = Number.isInteger(pos?.col) ? pos.col : 1;
        paneLayoutMap.set(index, { row, col });
    });

    const grid = state.grid || {};
    const cols = Number.isInteger(grid.cols) ? grid.cols : 0;
    const rows = Number.isInteger(grid.rows) ? grid.rows : 0;
    if (cols < 1 || rows < 1) {
        updateLayout(true);
        return true;
    }

    const normalizedCols = normalizeRatios(grid.colRatios, cols);
    const normalizedRows = normalizeRatios(grid.rowRatios, rows);
    if (!normalizedCols || !normalizedRows) {
        updateLayout(true);
        return true;
    }

    currentCols = cols;
    currentRows = rows;
    colRatios = normalizedCols;
    rowRatios = normalizedRows;

    applyGridTemplate();
    renderPanes();
    renderSplitters();
    updateCloseButtons();

    return true;
}

function createIconButton(title, iconMarkup) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.type = 'button';
    btn.title = title;
    btn.innerHTML = iconMarkup;
    return btn;
}

function createPane(index, url) {
    const gridContainer = ensureContainer();
    navHistory[index] = [];

    const paneEl = document.createElement('div');
    paneEl.className = 'pane';
    paneEl.id = `pane-${index}`;

    const navEl = document.createElement('div');
    navEl.className = 'nav-bar';

    const backBtn = createIconButton('Back', BACK_ICON);
    const reloadBtn = createIconButton('Reload', RELOAD_ICON);
    const closeHorizontalBtn = createIconButton('Close pane (horizontal)', CLOSE_H_ICON);
    const closeVerticalBtn = createIconButton('Close pane (vertical)', CLOSE_V_ICON);

    const omniboxWrapper = document.createElement('div');
    omniboxWrapper.className = 'omnibox-wrapper';

    const inputEl = document.createElement('input');
    inputEl.className = 'url-input';
    inputEl.type = 'text';

    const frameWrapper = document.createElement('div');
    frameWrapper.className = 'frame-wrapper';

    const frameEl = document.createElement('iframe');
    frameEl.id = `frame-${index}`;
    frameEl.setAttribute('sandbox', 'allow-forms allow-scripts allow-popups allow-modals');

    omniboxWrapper.appendChild(inputEl);
    navEl.appendChild(backBtn);
    navEl.appendChild(reloadBtn);
    navEl.appendChild(omniboxWrapper);
    navEl.appendChild(closeHorizontalBtn);
    navEl.appendChild(closeVerticalBtn);

    frameWrapper.appendChild(frameEl);
    paneEl.appendChild(navEl);
    paneEl.appendChild(frameWrapper);
    gridContainer.appendChild(paneEl);

    panes.set(index, {
        paneEl,
        navEl,
        inputEl,
        frameEl,
        backBtn,
        reloadBtn,
        closeHorizontalBtn,
        closeVerticalBtn,
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            loadFrame(index, inputEl.value);
            inputEl.blur();
        }
    });
    inputEl.addEventListener('focus', () => setTimeout(() => inputEl.select(), 10));
    reloadBtn.addEventListener('click', () => reloadFrame(index));
    backBtn.addEventListener('click', () => goBack(index));
    closeHorizontalBtn.addEventListener('click', () => closePane(index, 'horizontal'));
    closeVerticalBtn.addEventListener('click', () => closePane(index, 'vertical'));

    loadFrame(index, url || 'about:blank', true);
}

function updateBackBtn(index) {
    const pane = panes.get(index);
    if (!pane) return;
    pane.backBtn.disabled = navHistory[index].length === 0 || !activePanes.has(index);
}

function updateCloseButtons() {
    panes.forEach((pane, index) => {
        const disabled = activePanes.size <= 1 || !activePanes.has(index);
        pane.closeHorizontalBtn.disabled = disabled;
        pane.closeVerticalBtn.disabled = disabled;
    });
}

function loadFrame(index, url, isBackNav = false) {
    if (!activePanes.has(index)) return;

    const pane = panes.get(index);
    if (!pane) return;

    const finalUrl = normalizeUrl(url);
    if (!isBackNav && pane.frameEl.src && pane.frameEl.src !== '' && pane.frameEl.src !== 'about:blank') {
        navHistory[index].push(pane.frameEl.src);
    }

    pane.inputEl.value = finalUrl;
    pane.frameEl.src = finalUrl;
    updateBackBtn(index);
    persistPaneUrl(index, finalUrl);
    persistCurrentTabState();
}

function goBack(index) {
    if (!activePanes.has(index)) return;
    const history = navHistory[index];
    if (history.length > 0) {
        loadFrame(index, history.pop(), true);
    }
}

function reloadFrame(index) {
    if (!activePanes.has(index)) return;
    const pane = panes.get(index);
    if (pane) pane.frameEl.src = pane.frameEl.src;
}

function closePane(index, direction = 'horizontal') {
    if (!activePanes.has(index) || activePanes.size <= 1) return;
    closePackDirection = direction === 'vertical' ? 'vertical' : 'horizontal';
    packByAxis = true;

    activePanes.delete(index);
    paneLayoutMap.delete(index);
    navHistory[index] = [];

    const pane = panes.get(index);
    if (pane) {
        pane.frameEl.src = 'about:blank';
        pane.inputEl.value = '';
    }

    persistPaneUrl(index, 'about:blank');
    updateLayout();
    persistCurrentTabState();
}

function getAxisGroups(direction) {
    const isVertical = direction === 'vertical';
    const active = Array.from(activePanes).sort((a, b) => a - b);
    if (active.length === 0) return [];

    let fallbackKey = 100000;
    const items = active.map((index) => {
        const pos = paneLayoutMap.get(index);
        if (!pos) {
            const key = fallbackKey++;
            return { index, primary: key, secondary: key };
        }
        return {
            index,
            primary: isVertical ? pos.col : pos.row,
            secondary: isVertical ? pos.row : pos.col,
        };
    });

    items.sort((a, b) => {
        if (a.primary !== b.primary) return a.primary - b.primary;
        if (a.secondary !== b.secondary) return a.secondary - b.secondary;
        return a.index - b.index;
    });

    const groups = [];
    for (const item of items) {
        const last = groups[groups.length - 1];
        if (!last || last.primary !== item.primary) {
            groups.push({ primary: item.primary, indices: [item.index] });
        } else {
            last.indices.push(item.index);
        }
    }

    return groups.map((g) => g.indices);
}

function getLayoutDimensions(activeCount) {
    if (activeCount <= 1) return { cols: 1, rows: 1 };

    if (useDualLayout && activeCount <= 2) {
        return { cols: activeCount, rows: 1 };
    }

    if (MODE === 'quad' && !hasCustomCount && activeCount === 4) {
        return { cols: 2, rows: 2 };
    }

    if (packByAxis) {
        const groups = getAxisGroups(closePackDirection);
        if (groups.length > 0) {
            if (closePackDirection === 'vertical') {
                const cols = groups.length;
                const rows = Math.max(1, ...groups.map((g) => g.length));
                return { cols, rows };
            }
            const rows = groups.length;
            const cols = Math.max(1, ...groups.map((g) => g.length));
            return { cols, rows };
        }
    }

    const rows = Math.max(1, Math.floor(Math.sqrt(activeCount)));
    const cols = Math.ceil(activeCount / rows);
    return { cols, rows };
}

function resetRatios(cols, rows) {
    colRatios = Array.from({ length: cols }, () => 1 / cols);
    rowRatios = Array.from({ length: rows }, () => 1 / rows);
}

function ensureRatios(cols, rows, forceReset = false) {
    const shapeChanged = cols !== currentCols || rows !== currentRows;
    if (forceReset || shapeChanged || colRatios.length !== cols || rowRatios.length !== rows) {
        resetRatios(cols, rows);
    }
    currentCols = cols;
    currentRows = rows;
}

function applyGridTemplate() {
    ensureContainer();
    container.style.gridTemplateColumns = colRatios.map((r) => `${r}fr`).join(' ');
    container.style.gridTemplateRows = rowRatios.map((r) => `${r}fr`).join(' ');
}

function applyNavVisibility() {
    panes.forEach((pane, index) => {
        const isActive = activePanes.has(index);
        pane.navEl.style.display = showNavSetting && isActive ? 'flex' : 'none';
    });
}

function renderPanes() {
    panes.forEach((pane, index) => {
        if (!activePanes.has(index)) {
            pane.paneEl.style.display = 'none';
            return;
        }
        pane.paneEl.style.display = 'flex';
    });

    if (packByAxis) {
        const groups = getAxisGroups(closePackDirection);
        if (closePackDirection === 'vertical') {
            groups.forEach((group, colIndex) => {
                const size = group.length;
                group.forEach((paneIndex, position) => {
                    const pane = panes.get(paneIndex);
                    if (!pane) return;

                    const rowStart = Math.floor((position * currentRows) / size) + 1;
                    const rowEnd = Math.floor(((position + 1) * currentRows) / size) + 1;
                    const colStart = colIndex + 1;
                    const colEnd = colStart + 1;

                    pane.paneEl.style.gridRow = `${rowStart} / ${rowEnd}`;
                    pane.paneEl.style.gridColumn = `${colStart} / ${colEnd}`;
                    paneLayoutMap.set(paneIndex, { row: position + 1, col: colStart });
                    updateBackBtn(paneIndex);
                });
            });
        } else {
            groups.forEach((group, rowIndex) => {
                const size = group.length;
                group.forEach((paneIndex, position) => {
                    const pane = panes.get(paneIndex);
                    if (!pane) return;

                    const colStart = Math.floor((position * currentCols) / size) + 1;
                    const colEnd = Math.floor(((position + 1) * currentCols) / size) + 1;
                    const rowStart = rowIndex + 1;
                    const rowEnd = rowStart + 1;

                    pane.paneEl.style.gridRow = `${rowStart} / ${rowEnd}`;
                    pane.paneEl.style.gridColumn = `${colStart} / ${colEnd}`;
                    paneLayoutMap.set(paneIndex, { row: rowStart, col: position + 1 });
                    updateBackBtn(paneIndex);
                });
            });
        }

        applyNavVisibility();
        return;
    }

    const orderedActive = Array.from(activePanes).sort((a, b) => a - b);
    const activeCount = orderedActive.length;
    const filledRows = Math.floor(activeCount / currentCols);
    const lastRowCount = activeCount - (filledRows * currentCols);
    const hasPartialLastRow = lastRowCount > 0 && lastRowCount < currentCols;

    orderedActive.forEach((paneIndex, position) => {
        const pane = panes.get(paneIndex);
        if (!pane) return;
        const row = Math.floor(position / currentCols) + 1;
        const col = (position % currentCols) + 1;
        let rowStart = row;
        let rowEnd = row + 1;
        let colStart = col;
        let colEnd = col + 1;

        if (hasPartialLastRow && row === currentRows) {
            const indexInLastRow = position - (filledRows * currentCols);
            colStart = Math.floor((indexInLastRow * currentCols) / lastRowCount) + 1;
            colEnd = Math.floor(((indexInLastRow + 1) * currentCols) / lastRowCount) + 1;
        }

        pane.paneEl.style.gridRow = `${rowStart} / ${rowEnd}`;
        pane.paneEl.style.gridColumn = `${colStart} / ${colEnd}`;
        paneLayoutMap.set(paneIndex, { row, col });
        updateBackBtn(paneIndex);
    });

    applyNavVisibility();
}

function clearSplitters() {
    ensureContainer().querySelectorAll('.grid-splitter').forEach((el) => el.remove());
}

function sumRatios(ratios, endExclusive) {
    let total = 0;
    for (let i = 0; i < endExclusive; i++) total += ratios[i];
    return total;
}

function startDrag(type, boundary, event) {
    event.preventDefault();
    dragState = { type, boundary };
    document.body.classList.add('is-changing-layout');
}

function createSplitter(type, boundary, positionPx) {
    const splitter = document.createElement('div');
    splitter.className = `grid-splitter ${type === 'col' ? 'grid-splitter-v' : 'grid-splitter-h'}`;
    if (type === 'col') {
        splitter.style.left = `${positionPx}px`;
    } else {
        splitter.style.top = `${positionPx}px`;
    }
    splitter.addEventListener('mousedown', (event) => startDrag(type, boundary, event));
    return splitter;
}

function renderSplitters() {
    const gridContainer = ensureContainer();
    clearSplitters();

    if (activePanes.size <= 1) return;

    const rect = gridContainer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    let xAcc = 0;
    for (let i = 1; i < currentCols; i++) {
        xAcc += colRatios[i - 1];
        gridContainer.appendChild(createSplitter('col', i, xAcc * rect.width));
    }

    let yAcc = 0;
    for (let i = 1; i < currentRows; i++) {
        yAcc += rowRatios[i - 1];
        gridContainer.appendChild(createSplitter('row', i, yAcc * rect.height));
    }
}

function clampRatioWithinPair(value, pairSize) {
    const minValue = Math.min(0.2, pairSize / 4);
    const maxValue = pairSize - minValue;
    if (maxValue <= minValue) return pairSize / 2;
    return Math.min(maxValue, Math.max(minValue, value));
}

function onDragMove(event) {
    if (!dragState) return;

    const rect = ensureContainer().getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (dragState.type === 'col' && currentCols > 1) {
        const boundary = dragState.boundary;
        const leftIndex = boundary - 1;
        const rightIndex = boundary;
        if (leftIndex < 0 || rightIndex >= colRatios.length) return;

        const prefix = sumRatios(colRatios, leftIndex);
        const pair = colRatios[leftIndex] + colRatios[rightIndex];
        const normalized = (event.clientX - rect.left) / rect.width;
        const nextLeft = clampRatioWithinPair(normalized - prefix, pair);

        colRatios[leftIndex] = nextLeft;
        colRatios[rightIndex] = pair - nextLeft;
    }

    if (dragState.type === 'row' && currentRows > 1) {
        const boundary = dragState.boundary;
        const topIndex = boundary - 1;
        const bottomIndex = boundary;
        if (topIndex < 0 || bottomIndex >= rowRatios.length) return;

        const prefix = sumRatios(rowRatios, topIndex);
        const pair = rowRatios[topIndex] + rowRatios[bottomIndex];
        const normalized = (event.clientY - rect.top) / rect.height;
        const nextTop = clampRatioWithinPair(normalized - prefix, pair);

        rowRatios[topIndex] = nextTop;
        rowRatios[bottomIndex] = pair - nextTop;
    }

    applyGridTemplate();
    renderSplitters();
}

function stopDrag() {
    dragState = null;
    document.body.classList.remove('is-changing-layout');
}

function resetSplitSizes() {
    resetRatios(currentCols, currentRows);
    applyGridTemplate();
    renderSplitters();
    persistCurrentTabState();
}

function updateLayout(forceResetRatios = false) {
    const activeCount = activePanes.size;
    const { cols, rows } = getLayoutDimensions(activeCount);
    ensureRatios(cols, rows, forceResetRatios);

    applyGridTemplate();
    renderPanes();
    renderSplitters();
    updateCloseButtons();
}

function applySettings() {
    chrome.storage.local.get(['showNav', 'darkMode'], (res) => {
        showNavSetting = res.showNav !== false;
        darkModeSetting = res.darkMode !== false;
        document.body.classList.toggle('light-mode', !darkModeSetting);
        applyNavVisibility();
    });
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (Object.prototype.hasOwnProperty.call(changes, 'showNav')) {
        showNavSetting = changes.showNav.newValue !== false;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'darkMode')) {
        darkModeSetting = changes.darkMode.newValue !== false;
    }

    document.body.classList.toggle('light-mode', !darkModeSetting);
    applyNavVisibility();

    if (Object.prototype.hasOwnProperty.call(changes, 'resetRequest')) {
        const request = changes.resetRequest.newValue;
        if (request && Number.isInteger(request.tabId) && request.tabId === currentTabId) {
            resetSplitSizes();
        }
    }
});

document.addEventListener('mousemove', onDragMove);
document.addEventListener('mouseup', stopDrag);
window.addEventListener('resize', () => renderSplitters());

chrome.tabs.getCurrent((tab) => {
    if (tab?.id) {
        currentTabId = tab.id;
        persistCurrentTabState();
    }
});

ensureContainer();

chrome.storage.local.get(['splitUrls', PENDING_LAYOUT_STATE_KEY], (result) => {
    const urls = result.splitUrls || [];
    const pendingLayoutState = result[PENDING_LAYOUT_STATE_KEY];

    for (let i = 0; i < count; i++) {
        createPane(i, urls[i] || 'about:blank');
    }

    const appliedPendingState = applyPendingLayoutState(pendingLayoutState);
    if (!appliedPendingState) {
        updateLayout(true);
    }

    if (pendingLayoutState) {
        chrome.storage.local.remove(PENDING_LAYOUT_STATE_KEY);
    }

    applySettings();
    persistCurrentTabState();
});
