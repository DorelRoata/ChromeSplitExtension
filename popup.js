document.addEventListener('DOMContentLoaded', async () => {
  const splitBtn = document.getElementById('splitBtn');
  const dualBtn = document.getElementById('dualBtn');
  const toggleNav = document.getElementById('toggleNav');
  const darkMode = document.getElementById('darkMode');

  // Load saved settings
  const result = await chrome.storage.local.get(['showNav', 'darkMode']);
  toggleNav.checked = result.showNav !== false;
  darkMode.checked = result.darkMode !== false;

  toggleNav.addEventListener('change', () => {
    chrome.storage.local.set({ showNav: toggleNav.checked });
  });

  darkMode.addEventListener('change', () => {
    chrome.storage.local.set({ darkMode: darkMode.checked });
  });

  // Helper to launch
  const launch = async (mode) => {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const count = mode === 'dual' ? 2 : 4;
    const urls = allTabs.slice(0, count).map(t => t.url);

    await chrome.storage.local.set({ splitUrls: urls });
    chrome.tabs.create({ url: `grid.html?mode=${mode}` });
  };

  splitBtn.addEventListener('click', () => launch('quad'));
  dualBtn.addEventListener('click', () => launch('dual'));
});
