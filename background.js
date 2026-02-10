async function launchSplitView() {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const urls = allTabs.slice(0, 4).map(t => t.url);
    await chrome.storage.local.set({ splitUrls: urls, pendingLayoutState: null });
    chrome.tabs.create({ url: 'grid.html?mode=quad' });
}

async function launchDualView() {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    // For dual view, just grab top 2?
    const urls = allTabs.slice(0, 2).map(t => t.url);
    await chrome.storage.local.set({ splitUrls: urls, pendingLayoutState: null });
    chrome.tabs.create({ url: 'grid.html?mode=dual' });
}

async function toggleNav() {
    const result = await chrome.storage.local.get(['showNav']);
    // Default to true if undefined, so !undefined -> !false -> true? No. 
    // showNav undefined = true. !true = false.
    // result.showNav !== false checks if it IS true.
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

chrome.tabs.onRemoved.addListener(async (tabId) => {
    const result = await chrome.storage.local.get(['splitTabStates']);
    const states = result.splitTabStates || {};
    if (!Object.prototype.hasOwnProperty.call(states, tabId)) return;
    delete states[tabId];
    await chrome.storage.local.set({ splitTabStates: states });
});
