const SPLIT_TAB_STATES_KEY = 'splitTabStates';
const LAST_SESSION_KEY = 'lastSession';

async function launchSplitView() {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const urls = allTabs.slice(0, 4).map(t => t.url);
    await chrome.storage.local.set({ splitUrls: urls, pendingLayoutState: null });
    chrome.tabs.create({ url: 'grid.html?mode=quad' });
}

async function launchDualView() {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const urls = allTabs.slice(0, 2).map(t => t.url);
    await chrome.storage.local.set({ splitUrls: urls, pendingLayoutState: null });
    chrome.tabs.create({ url: 'grid.html?mode=dual' });
}

async function toggleNav() {
    const result = await chrome.storage.local.get(['showNav']);
    const current = result.showNav !== false;
    await chrome.storage.local.set({ showNav: !current });
}

chrome.commands.onCommand.addListener((command) => {
    if (command === 'launch-split-view') {
        launchSplitView();
    } else if (command === 'launch-dual-view') {
        launchDualView();
    } else if (command === 'toggle-nav') {
        toggleNav();
    }
});

// When a split-view tab is closed, preserve its state as "lastSession" before cleanup
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const result = await chrome.storage.local.get([SPLIT_TAB_STATES_KEY]);
    const states = result[SPLIT_TAB_STATES_KEY] || {};

    if (!Object.prototype.hasOwnProperty.call(states, tabId)) return;

    const closedState = states[tabId];

    // Only save as last session if it had valid URLs
    if (closedState && Array.isArray(closedState.urls) && closedState.urls.length > 0) {
        closedState.closedAt = Date.now();
        await chrome.storage.local.set({ [LAST_SESSION_KEY]: closedState });
    }

    // Clean up the tab-specific state
    delete states[tabId];
    await chrome.storage.local.set({ [SPLIT_TAB_STATES_KEY]: states });
});
