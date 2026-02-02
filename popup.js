document.addEventListener('DOMContentLoaded', async () => {
  const splitBtn = document.getElementById('splitBtn');
  const toggleNav = document.getElementById('toggleNav');
  const darkMode = document.getElementById('darkMode');

  // Load saved settings
  const result = await chrome.storage.local.get(['showNav', 'darkMode']);
  toggleNav.checked = result.showNav !== false; // Default true
  darkMode.checked = result.darkMode !== false; // Default true (implied by HTML checked)

  // Save settings on change
  toggleNav.addEventListener('change', () => {
    chrome.storage.local.set({ showNav: toggleNav.checked });
    // Optional: Send message to existing grid views to update instantly?
    // For now, simpler to just require reload or check on launch/load.
  });

  darkMode.addEventListener('change', () => {
    chrome.storage.local.set({ darkMode: darkMode.checked });
  });

  splitBtn.addEventListener('click', async () => {
    // Collect URLs
    const tabs = await chrome.tabs.query({ currentWindow: true, active: false });
    const allTabs = await chrome.tabs.query({ currentWindow: true });

    // Use logic: if we are in popup, active tab is the page user is ON. 
    // We probably want to include it? Or exclude browser ui?

    const urls = allTabs.slice(0, 4).map(t => t.url);

    await chrome.storage.local.set({ splitUrls: urls }); // Settings are already saved above

    chrome.tabs.create({ url: 'grid.html' });
  });
});
