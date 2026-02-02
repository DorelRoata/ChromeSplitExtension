// background.js

async function launchSplitView() {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const urls = allTabs.slice(0, 4).map(t => t.url);

    await chrome.storage.local.set({ splitUrls: urls });
    chrome.tabs.create({ url: 'grid.html' });
}

async function toggleNav() {
    // Toggle the setting in storage
    const result = await chrome.storage.local.get(['showNav']);
    const newState = !(result.showNav !== false); // Toggle
    await chrome.storage.local.set({ showNav: newState });
}

chrome.commands.onCommand.addListener((command) => {
    if (command === 'launch-split-view') {
        launchSplitView();
    } else if (command === 'toggle-nav') {
        toggleNav();
    }
});
