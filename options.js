// ============================================
// TabBloom Options Page
// ============================================

// Default settings
const defaultSettings = {
    soundEnabled: true,
    masterVolume: 70,
    ambientEnabled: true,
    wiltSpeed: 'normal',
    harvestCoins: 10,
    animationsEnabled: true,
    seasonMode: 'auto',
    particlesEnabled: true,
    gardenName: 'My Digital Sanctuary',
    confettiEnabled: true,
    blurTitles: false,
    // Performance settings
    performanceMode: 'full',
    maxVisiblePlants: 50,
    targetFps: 60
};

// Current settings
let settings = { ...defaultSettings };

// DOM Elements
const elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    await loadSettings();
    bindEvents();
    updateUI();
});

// Cache DOM elements
function cacheElements() {
    elements.soundEnabled = document.getElementById('soundEnabled');
    elements.masterVolume = document.getElementById('masterVolume');
    elements.volumeValue = document.getElementById('volumeValue');
    elements.ambientEnabled = document.getElementById('ambientEnabled');
    elements.wiltSpeed = document.getElementById('wiltSpeed');
    elements.harvestCoins = document.getElementById('harvestCoins');
    elements.animationsEnabled = document.getElementById('animationsEnabled');
    elements.seasonMode = document.getElementById('seasonMode');
    elements.particlesEnabled = document.getElementById('particlesEnabled');
    elements.gardenName = document.getElementById('gardenName');
    elements.confettiEnabled = document.getElementById('confettiEnabled');
    elements.blurTitles = document.getElementById('blurTitles');
    elements.resetStats = document.getElementById('resetStats');
    elements.exportData = document.getElementById('exportData');
    elements.saveStatus = document.getElementById('saveStatus');
    // Performance elements
    elements.performanceMode = document.getElementById('performanceMode');
    elements.maxVisiblePlants = document.getElementById('maxVisiblePlants');
    elements.targetFps = document.getElementById('targetFps');
}

// Load settings from storage (sync for cross-device persistence)
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['tabbloomSettings']);
        if (result.tabbloomSettings) {
            settings = { ...defaultSettings, ...result.tabbloomSettings };
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

// Save settings to storage (sync for cross-device persistence)
async function saveSettings() {
    try {
        await chrome.storage.sync.set({ tabbloomSettings: settings });
        showSaveStatus();
    } catch (err) {
        console.error('Failed to save settings:', err);
    }
}

// Show save status indicator
function showSaveStatus() {
    elements.saveStatus.classList.add('visible');
    setTimeout(() => {
        elements.saveStatus.classList.remove('visible');
    }, 2000);
}

// Update UI to reflect current settings
function updateUI() {
    elements.soundEnabled.checked = settings.soundEnabled;
    elements.masterVolume.value = settings.masterVolume;
    elements.volumeValue.textContent = `${settings.masterVolume}%`;
    elements.ambientEnabled.checked = settings.ambientEnabled;
    elements.wiltSpeed.value = settings.wiltSpeed;
    elements.harvestCoins.value = settings.harvestCoins;
    elements.animationsEnabled.checked = settings.animationsEnabled;
    elements.seasonMode.value = settings.seasonMode;
    elements.particlesEnabled.checked = settings.particlesEnabled;
    elements.gardenName.value = settings.gardenName;
    elements.confettiEnabled.checked = settings.confettiEnabled;
    elements.blurTitles.checked = settings.blurTitles;
    // Performance settings
    elements.performanceMode.value = settings.performanceMode;
    elements.maxVisiblePlants.value = settings.maxVisiblePlants;
    elements.targetFps.value = settings.targetFps;
}

// Bind event listeners
function bindEvents() {
    // Toggle switches
    elements.soundEnabled.addEventListener('change', (e) => {
        settings.soundEnabled = e.target.checked;
        saveSettings();
    });

    elements.ambientEnabled.addEventListener('change', (e) => {
        settings.ambientEnabled = e.target.checked;
        saveSettings();
    });

    elements.animationsEnabled.addEventListener('change', (e) => {
        settings.animationsEnabled = e.target.checked;
        saveSettings();
    });

    elements.particlesEnabled.addEventListener('change', (e) => {
        settings.particlesEnabled = e.target.checked;
        saveSettings();
    });

    elements.confettiEnabled.addEventListener('change', (e) => {
        settings.confettiEnabled = e.target.checked;
        saveSettings();
    });

    elements.blurTitles.addEventListener('change', (e) => {
        settings.blurTitles = e.target.checked;
        saveSettings();
    });

    // Volume slider
    elements.masterVolume.addEventListener('input', (e) => {
        const value = e.target.value;
        settings.masterVolume = parseInt(value);
        elements.volumeValue.textContent = `${value}%`;
    });

    elements.masterVolume.addEventListener('change', () => {
        saveSettings();
    });

    // Select dropdowns
    elements.wiltSpeed.addEventListener('change', (e) => {
        settings.wiltSpeed = e.target.value;
        saveSettings();
    });

    elements.harvestCoins.addEventListener('change', (e) => {
        settings.harvestCoins = parseInt(e.target.value);
        saveSettings();
    });

    elements.seasonMode.addEventListener('change', (e) => {
        settings.seasonMode = e.target.value;
        saveSettings();
    });

    // Performance settings
    elements.performanceMode.addEventListener('change', (e) => {
        settings.performanceMode = e.target.value;
        saveSettings();
    });

    elements.maxVisiblePlants.addEventListener('change', (e) => {
        settings.maxVisiblePlants = parseInt(e.target.value);
        saveSettings();
    });

    elements.targetFps.addEventListener('change', (e) => {
        settings.targetFps = parseInt(e.target.value);
        saveSettings();
    });

    // Text input (debounced)
    let gardenNameTimeout;
    elements.gardenName.addEventListener('input', (e) => {
        settings.gardenName = e.target.value || defaultSettings.gardenName;
        clearTimeout(gardenNameTimeout);
        gardenNameTimeout = setTimeout(saveSettings, 500);
    });

    // Reset stats button
    elements.resetStats.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all garden statistics? This cannot be undone.')) {
            try {
                await chrome.storage.local.remove(['gardenStats']);
                alert('Garden statistics have been reset.');
            } catch (err) {
                console.error('Failed to reset stats:', err);
                alert('Failed to reset statistics. Please try again.');
            }
        }
    });

    // Export data button
    elements.exportData.addEventListener('click', async () => {
        try {
            const allData = await chrome.storage.local.get(null);
            const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tabbloom-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export data:', err);
            alert('Failed to export data. Please try again.');
        }
    });
}
