// background.js (service worker)

// Enable the side panel to open when clicking the extension icon
chrome.sidePanel.setPanelBehavior({
  openPanelOnActionClick: true
}).catch((error) => {
  console.error("Failed to set openPanelOnActionClick:", error);
});

console.log("TabBloom background service started");

// Track tab activity timestamps
async function updateTabActivity(tabId) {
  const timestamp = Date.now();
  const result = await chrome.storage.local.get(['tabActivity']);
  const tabActivity = result.tabActivity || {};
  tabActivity[tabId] = timestamp;
  await chrome.storage.local.set({ tabActivity });
}

// When a tab is activated (switched to)
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateTabActivity(activeInfo.tabId);
});

// When a tab is updated (URL change, reload, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateTabActivity(tabId);
  }
});

// When a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  updateTabActivity(tab.id);
});

// Clean up closed tabs from storage
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const result = await chrome.storage.local.get(['tabActivity']);
  const tabActivity = result.tabActivity || {};
  delete tabActivity[tabId];
  await chrome.storage.local.set({ tabActivity });
});

// Initialize all current tabs on startup
async function initializeTabActivity() {
  const tabs = await chrome.tabs.query({});
  const result = await chrome.storage.local.get(['tabActivity']);
  const tabActivity = result.tabActivity || {};
  const now = Date.now();

  tabs.forEach(tab => {
    // Only set timestamp if tab doesn't already have one
    if (!tabActivity[tab.id]) {
      tabActivity[tab.id] = now;
    }
  });

  // Clean up tabs that no longer exist
  const currentTabIds = new Set(tabs.map(t => t.id));
  Object.keys(tabActivity).forEach(id => {
    if (!currentTabIds.has(parseInt(id))) {
      delete tabActivity[id];
    }
  });

  await chrome.storage.local.set({ tabActivity });
  console.log(`TabBloom tracking ${Object.keys(tabActivity).length} tabs`);
}

// Run initialization
initializeTabActivity();
