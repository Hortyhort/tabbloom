// background.js (service worker)

// Enable the side panel to open when clicking the extension icon
chrome.sidePanel.setPanelBehavior({
  openPanelOnActionClick: true
}).catch((error) => {
  console.error("Failed to set openPanelOnActionClick:", error);
});

// Optional: Log when it's ready (for debugging)
console.log("Side panel behavior set: open on action click");

// Initialize tab tracking
chrome.tabs.onActivated.addListener((activeInfo) => {
    const timestamp = Date.now();
    chrome.storage.local.get(['tabActivity'], (result) => {
        const tabActivity = result.tabActivity || {};
        tabActivity[activeInfo.tabId] = timestamp;
        chrome.storage.local.set({ tabActivity });
    });
});