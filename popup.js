document.addEventListener('DOMContentLoaded', async () => {
  const SAVED_LAYOUTS_KEY = 'savedLayouts';
  const SPLIT_TAB_STATES_KEY = 'splitTabStates';
  const PENDING_LAYOUT_STATE_KEY = 'pendingLayoutState';
  const LAST_SESSION_KEY = 'lastSession';

  const splitBtn = document.getElementById('splitBtn');
  const dualBtn = document.getElementById('dualBtn');
  const customBtn = document.getElementById('customBtn');
  const customCountInput = document.getElementById('customCount');
  const resetSplitsBtn = document.getElementById('resetSplitsBtn');
  const resetHint = document.getElementById('resetHint');
  const toggleNav = document.getElementById('toggleNav');
  const darkMode = document.getElementById('darkMode');
  const restoreSessionBtn = document.getElementById('restoreSessionBtn');
  const sessionHint = document.getElementById('sessionHint');

  const layoutNameInput = document.getElementById('layoutNameInput');
  const saveLayoutBtn = document.getElementById('saveLayoutBtn');
  const savedLayoutsSelect = document.getElementById('savedLayoutsSelect');
  const loadLayoutBtn = document.getElementById('loadLayoutBtn');
  const deleteLayoutBtn = document.getElementById('deleteLayoutBtn');
  const layoutHint = document.getElementById('layoutHint');

  const splitPagePrefix = chrome.runtime.getURL('grid.html');

  const getActiveTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  };

  const isSplitViewTab = (tab) => {
    return Boolean(tab?.url && tab.url.startsWith(splitPagePrefix));
  };

  const getSavedLayouts = async () => {
    const result = await chrome.storage.local.get([SAVED_LAYOUTS_KEY]);
    const layouts = result[SAVED_LAYOUTS_KEY];
    return Array.isArray(layouts) ? layouts : [];
  };

  const setSavedLayouts = async (layouts) => {
    await chrome.storage.local.set({ [SAVED_LAYOUTS_KEY]: layouts });
  };

  const getAutoLayoutName = (layouts) => {
    const next = layouts.length + 1;
    return `Layout ${next}`;
  };

  const getLayoutUrlsFromTabState = async (tab) => {
    if (!tab?.id || !isSplitViewTab(tab)) return null;

    const result = await chrome.storage.local.get([SPLIT_TAB_STATES_KEY]);
    const states = result[SPLIT_TAB_STATES_KEY] || {};
    const state = states[tab.id] || states[String(tab.id)];

    if (!state || !Array.isArray(state.urls)) return null;

    const urls = state.urls.filter((url) => Boolean(url) && url !== 'about:blank').slice(0, 16);
    if (urls.length === 0) return null;

    const count = Number.isInteger(state.count) ? Math.min(16, Math.max(1, state.count)) : urls.length;
    const mode = state.mode === 'dual' && count === 2 ? 'dual' : 'quad';

    return {
      mode,
      count,
      urls,
      layoutState: {
        mode,
        count,
        activePaneIndices: Array.isArray(state.activePaneIndices) ? state.activePaneIndices : undefined,
        closePackDirection: state.closePackDirection,
        packByAxis: Boolean(state.packByAxis),
        grid: state.grid,
        paneLayout: state.paneLayout,
      },
    };
  };

  const getLayoutFromActiveContext = async () => {
    const tab = await getActiveTab();

    const fromSplit = await getLayoutUrlsFromTabState(tab);
    if (fromSplit) return fromSplit;

    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const urls = allTabs
      .map((t) => t.url)
      .filter((url) => Boolean(url))
      .slice(0, 16);

    if (urls.length === 0) {
      return null;
    }

    const count = urls.length;
    const mode = count === 2 ? 'dual' : 'quad';
    return { mode, count, urls, layoutState: null };
  };

  const renderSavedLayouts = async (selectedId = '') => {
    const layouts = await getSavedLayouts();

    savedLayoutsSelect.innerHTML = '';
    if (layouts.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No saved layouts';
      option.disabled = true;
      option.selected = true;
      savedLayoutsSelect.appendChild(option);
      savedLayoutsSelect.disabled = true;
      loadLayoutBtn.disabled = true;
      deleteLayoutBtn.disabled = true;
      return;
    }

    savedLayoutsSelect.disabled = false;
    loadLayoutBtn.disabled = false;
    deleteLayoutBtn.disabled = false;

    layouts.forEach((layout, index) => {
      const option = document.createElement('option');
      option.value = layout.id;
      const paneCount = Number.isInteger(layout.count) ? layout.count : (layout.urls?.length || 0);
      option.textContent = `${layout.name} (${paneCount})`;
      if (selectedId && selectedId === layout.id) {
        option.selected = true;
      } else if (!selectedId && index === 0) {
        option.selected = true;
      }
      savedLayoutsSelect.appendChild(option);
    });
  };

  const updateResetState = async () => {
    const tab = await getActiveTab();
    const canReset = isSplitViewTab(tab);
    resetSplitsBtn.disabled = !canReset;
    resetHint.textContent = canReset
      ? ''
      : 'Open and focus a Split View tab to use reset.';
  };

  const launch = async (mode, paneCount = null, urlsOverride = null, pendingLayoutState = null) => {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const defaultCount = mode === 'dual' ? 2 : 4;
    const count = Number.isInteger(paneCount)
      ? Math.min(16, Math.max(1, paneCount))
      : defaultCount;

    const urls = Array.isArray(urlsOverride)
      ? urlsOverride.slice(0, count)
      : allTabs.slice(0, count).map((t) => t.url);

    const params = new URLSearchParams({ mode });
    if (count !== defaultCount) {
      params.set('count', String(count));
    }

    await chrome.storage.local.set({
      splitUrls: urls,
      [PENDING_LAYOUT_STATE_KEY]: pendingLayoutState || null,
    });
    chrome.tabs.create({ url: `grid.html?${params.toString()}` });
  };

  const saveCurrentLayout = async () => {
    const layout = await getLayoutFromActiveContext();
    if (!layout) {
      layoutHint.textContent = 'Could not detect URLs to save in this window.';
      return;
    }

    const layouts = await getSavedLayouts();
    const name = layoutNameInput.value.trim() || getAutoLayoutName(layouts);

    const item = {
      id: `layout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      mode: layout.mode,
      count: layout.count,
      urls: layout.urls,
      layoutState: layout.layoutState || null,
      createdAt: Date.now(),
    };

    const nextLayouts = [item, ...layouts].slice(0, 100);
    await setSavedLayouts(nextLayouts);

    layoutNameInput.value = '';
    layoutHint.textContent = `Saved "${name}".`;
    await renderSavedLayouts(item.id);
  };

  const getSelectedLayout = async () => {
    const selectedId = savedLayoutsSelect.value;
    if (!selectedId) return null;

    const layouts = await getSavedLayouts();
    return layouts.find((layout) => layout.id === selectedId) || null;
  };

  const loadSelectedLayout = async () => {
    const layout = await getSelectedLayout();
    if (!layout) {
      layoutHint.textContent = 'Select a layout to load.';
      return;
    }

    const urls = Array.isArray(layout.urls)
      ? layout.urls.filter((url) => Boolean(url)).slice(0, 16)
      : [];

    if (urls.length === 0) {
      layoutHint.textContent = 'Saved layout has no valid URLs.';
      return;
    }

    const savedCount = Number.isInteger(layout.count) ? layout.count : urls.length;
    const count = Math.min(16, Math.max(1, savedCount, urls.length));
    const mode = layout.mode === 'dual' && count === 2 ? 'dual' : 'quad';

    await launch(mode, count, urls, layout.layoutState || null);
    window.close();
  };

  const deleteSelectedLayout = async () => {
    const selectedId = savedLayoutsSelect.value;
    if (!selectedId) {
      layoutHint.textContent = 'Select a layout to delete.';
      return;
    }

    const layouts = await getSavedLayouts();
    const selected = layouts.find((layout) => layout.id === selectedId);
    if (!selected) {
      layoutHint.textContent = 'Layout was already removed.';
      await renderSavedLayouts();
      return;
    }

    const nextLayouts = layouts.filter((layout) => layout.id !== selectedId);
    await setSavedLayouts(nextLayouts);
    layoutHint.textContent = `Deleted "${selected.name}".`;
    await renderSavedLayouts();
  };

  // Load saved settings
  const settings = await chrome.storage.local.get(['showNav', 'darkMode']);
  toggleNav.checked = settings.showNav !== false;
  darkMode.checked = settings.darkMode !== false;

  toggleNav.addEventListener('change', () => {
    chrome.storage.local.set({ showNav: toggleNav.checked });
  });

  darkMode.addEventListener('change', () => {
    chrome.storage.local.set({ darkMode: darkMode.checked });
  });

  splitBtn.addEventListener('click', () => launch('quad'));
  dualBtn.addEventListener('click', () => launch('dual'));

  customBtn.addEventListener('click', () => {
    const requestedCount = Number.parseInt(customCountInput.value, 10);
    const count = Number.isInteger(requestedCount)
      ? Math.min(16, Math.max(1, requestedCount))
      : 6;
    customCountInput.value = String(count);
    launch('quad', count);
  });

  resetSplitsBtn.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!isSplitViewTab(tab) || !tab?.id) {
      await updateResetState();
      return;
    }

    try {
      await chrome.storage.local.set({
        resetRequest: { tabId: tab.id, token: Date.now() },
      });
      window.close();
    } catch (err) {
      resetHint.textContent = 'Could not reach Split View tab. Reload it and try again.';
    }
  });

  saveLayoutBtn.addEventListener('click', saveCurrentLayout);
  loadLayoutBtn.addEventListener('click', loadSelectedLayout);
  deleteLayoutBtn.addEventListener('click', deleteSelectedLayout);

  // --- Session Restore ---
  const updateSessionState = async () => {
    const result = await chrome.storage.local.get([LAST_SESSION_KEY]);
    const lastSession = result[LAST_SESSION_KEY];

    if (!lastSession || !Array.isArray(lastSession.urls) || lastSession.urls.length === 0) {
      restoreSessionBtn.disabled = true;
      sessionHint.textContent = 'No previous session found.';
      return;
    }

    restoreSessionBtn.disabled = false;
    const paneCount = lastSession.count || lastSession.urls.length;
    const closedAt = lastSession.closedAt ? new Date(lastSession.closedAt) : null;
    const timeStr = closedAt
      ? closedAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Unknown';
    sessionHint.textContent = `${paneCount} panes · Closed ${timeStr}`;
  };

  restoreSessionBtn.addEventListener('click', async () => {
    const result = await chrome.storage.local.get([LAST_SESSION_KEY]);
    const lastSession = result[LAST_SESSION_KEY];

    if (!lastSession || !Array.isArray(lastSession.urls) || lastSession.urls.length === 0) {
      sessionHint.textContent = 'Session expired or empty.';
      restoreSessionBtn.disabled = true;
      return;
    }

    const urls = lastSession.urls.filter(url => Boolean(url) && url !== 'about:blank').slice(0, 16);
    if (urls.length === 0) {
      sessionHint.textContent = 'No valid URLs in last session.';
      return;
    }

    const savedCount = Number.isInteger(lastSession.count) ? lastSession.count : urls.length;
    const count = Math.min(16, Math.max(1, savedCount, urls.length));
    const mode = lastSession.mode === 'dual' && count === 2 ? 'dual' : 'quad';

    await launch(mode, count, urls, lastSession.grid ? {
      mode,
      count,
      activePaneIndices: lastSession.activePaneIndices,
      closePackDirection: lastSession.closePackDirection,
      packByAxis: Boolean(lastSession.packByAxis),
      grid: lastSession.grid,
      paneLayout: lastSession.paneLayout,
    } : null);
    window.close();
  });

  await renderSavedLayouts();
  await updateResetState();
  await updateSessionState();
});
