// garden.js - The TabBloom Rendering Engine
// Version 0.4.0 - Sprint 6: Polish & Store Readiness

const canvas = document.getElementById('garden-canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

let plants = [];
let particles = [];
let ambientParticles = []; // Fireflies/sparkles
let butterflies = []; // Floating butterflies
let clouds = []; // Soft drifting clouds
let width, height;
let hoveredPlant = null;
let currentCoins = 120; // Starting coins
let frameCount = 0; // For animations
let isInitialized = false; // Track initialization state
let initializationError = null; // Store any init errors

// Global settings (loaded from options)
let gardenSettings = {
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
    minimalMode: false,
    performanceMode: 'full',
    maxVisiblePlants: 50,
    targetFps: 60
};

// FPS throttling
let lastFrameTime = 0;
const getFrameInterval = () => 1000 / gardenSettings.targetFps;

// Interval/animation cleanup
let healthCheckInterval = null;
let animationFrameId = null;

// ============================================
// Performance Utilities (Sprint 6)
// ============================================

// Debounce utility - delay execution until after wait ms
function debounce(func, wait = 100) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle utility - limit execution to once per limit ms
function throttle(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Request Idle Callback polyfill for low-priority tasks
const requestIdleCallback = window.requestIdleCallback || function(cb) {
    const start = Date.now();
    return setTimeout(() => {
        cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
        });
    }, 1);
};

const cancelIdleCallback = window.cancelIdleCallback || clearTimeout;

// Cleanup manager for memory management
const CleanupManager = {
    callbacks: [],

    register(callback) {
        this.callbacks.push(callback);
    },

    runAll() {
        this.callbacks.forEach(cb => {
            try {
                cb();
            } catch (e) {
                console.warn('Cleanup callback failed:', e);
            }
        });
        this.callbacks = [];
    },

    // Clean up stale particles to prevent memory leaks
    cleanupParticles() {
        const maxParticles = 100;
        if (particles.length > maxParticles) {
            particles = particles.slice(-maxParticles);
        }
    },

    // Clear favicon cache entries older than 30 minutes
    cleanupFaviconCache() {
        if (faviconCache.size > 100) {
            const entries = Array.from(faviconCache.entries());
            const toDelete = entries.slice(0, entries.length - 50);
            toDelete.forEach(([key]) => faviconCache.delete(key));
        }
    }
};

// Schedule periodic cleanup during idle time
let cleanupScheduled = false;
function scheduleCleanup() {
    if (cleanupScheduled) return;
    cleanupScheduled = true;

    requestIdleCallback(() => {
        CleanupManager.cleanupParticles();
        CleanupManager.cleanupFaviconCache();
        cleanupScheduled = false;
    }, { timeout: 5000 });
}

// ============================================
// Error Boundary & Recovery (Sprint 6)
// ============================================

// Safe execution wrapper for async operations
async function safeAsync(fn, fallback = null, context = 'operation') {
    try {
        return await fn();
    } catch (error) {
        console.error(`TabBloom ${context} failed:`, error);
        if (typeof Toast !== 'undefined') {
            Toast.error(`Unable to complete ${context}`);
        }
        return fallback;
    }
}

// Safe DOM operation wrapper
function safeDOM(fn, context = 'DOM operation') {
    try {
        return fn();
    } catch (error) {
        console.warn(`TabBloom ${context} failed:`, error);
        return null;
    }
}

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
    console.error('TabBloom uncaught error:', event.error);
    // Don't crash the whole extension - try to recover
    if (!isInitialized && initializationError === null) {
        initializationError = event.error;
        showErrorState('Unable to load garden. Please try refreshing.');
    }
});

// Global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('TabBloom unhandled rejection:', event.reason);
    event.preventDefault(); // Prevent console error spam
});

// Show error state in the garden container
function showErrorState(message) {
    const container = document.getElementById('garden-container');
    if (!container) return;

    container.innerHTML = `
        <div class="error-state" role="alert" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 24px;
            text-align: center;
            color: var(--text-secondary, #666);
        ">
            <div style="font-size: 48px; margin-bottom: 16px;" aria-hidden="true">🥀</div>
            <h3 style="margin: 0 0 8px; color: var(--text-primary, #333);">Something went wrong</h3>
            <p style="margin: 0 0 16px; max-width: 240px;">${message}</p>
            <button onclick="location.reload()" style="
                background: var(--logo-green, #00B894);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">Refresh Garden</button>
        </div>
    `;
}

// ============================================
// Loading State Management (Sprint 6)
// ============================================

function showLoadingState() {
    const container = document.getElementById('garden-container');
    if (!container) return;

    // Check if loading state already exists
    if (container.querySelector('.loading-state')) return;

    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-state';
    loadingEl.setAttribute('role', 'status');
    loadingEl.setAttribute('aria-live', 'polite');
    loadingEl.innerHTML = `
        <div class="loading-spinner" aria-hidden="true"></div>
        <p class="loading-text">Growing your garden...</p>
    `;

    // Add inline styles for loading state
    loadingEl.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--bg-secondary, #FEFBF6);
        z-index: 100;
    `;

    // Add spinner animation
    const spinner = loadingEl.querySelector('.loading-spinner');
    if (spinner) {
        spinner.style.cssText = `
            width: 40px;
            height: 40px;
            border: 3px solid var(--border-subtle, #E8E4DF);
            border-top-color: var(--logo-green, #00B894);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 12px;
        `;
    }

    const text = loadingEl.querySelector('.loading-text');
    if (text) {
        text.style.cssText = `
            margin: 0;
            color: var(--text-secondary, #666);
            font-size: 14px;
        `;
    }

    container.appendChild(loadingEl);

    // Add spin animation if not already in document
    if (!document.getElementById('tabbloom-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'tabbloom-loading-styles';
        style.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideLoadingState() {
    const loadingEl = document.querySelector('.loading-state');
    if (loadingEl) {
        loadingEl.style.opacity = '0';
        loadingEl.style.transition = 'opacity 0.3s ease';
        setTimeout(() => loadingEl.remove(), 300);
    }
}

// Wilt speed multipliers (hours until fully wilted)
const WILT_SPEEDS = {
    slow: 24,
    normal: 12,
    fast: 6,
    rapid: 2
};

// Favicon cache for flower center rendering
const faviconCache = new Map();

// Load and cache a favicon image
function loadFavicon(url) {
    if (!url) return null;
    if (faviconCache.has(url)) {
        return faviconCache.get(url);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        faviconCache.set(url, img);
    };
    img.onerror = () => {
        faviconCache.set(url, null); // Mark as failed
    };
    img.src = url;

    // Return null while loading (will draw on next frame after load)
    faviconCache.set(url, null);
    return null;
}

// ============================================
// Toast Notification System
// ============================================
const Toast = {
    container: null,

    init() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(this.container);
    },

    show(message, type = 'info', duration = 3000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');

        const iconName = {
            success: 'check',
            warning: 'info',
            error: 'close',
            info: 'info'
        }[type] || 'info';

        toast.innerHTML = `
            <span class="toast-icon toast-icon--${type}" aria-hidden="true">
                ${Icons.get(iconName, 18)}
            </span>
            <span class="toast-message">${message}</span>
        `;

        this.container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);

        return toast;
    },

    success(message, duration) {
        return this.show(message, 'success', duration);
    },

    error(message, duration) {
        return this.show(message, 'error', duration);
    },

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
};

// ============================================
// Empty State Handler
// ============================================
function showEmptyState() {
    const container = document.getElementById('garden-container');
    if (!container) return;

    // Remove existing empty state
    const existing = container.querySelector('.empty-state');
    if (existing) existing.remove();

    // Check if user is brand new or just harvested all
    const hasHarvested = gardenStats.totalHarvested > 0;

    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    if (hasHarvested) {
        // User has history - they just cleared their garden
        emptyState.innerHTML = `
            <div class="empty-state-icon empty-state-icon--success" aria-hidden="true">
                ${Icons.get('check', 48)}
            </div>
            <h3 class="empty-state-title">Garden cleared!</h3>
            <p class="empty-state-description">
                All tabs harvested. Open new tabs to grow more flowers.
            </p>
            <div class="empty-state-stats">
                <span class="empty-state-stat">${gardenStats.totalHarvested} tabs harvested</span>
                <span class="empty-state-stat">${gardenStats.coinsEarned} coins earned</span>
            </div>
        `;
    } else {
        // Brand new user - more welcoming
        emptyState.innerHTML = `
            <div class="empty-state-icon empty-state-icon--animated" aria-hidden="true">
                ${Icons.get('seedling', 48)}
            </div>
            <h3 class="empty-state-title">Plant your first flower</h3>
            <p class="empty-state-description">
                Every tab you open becomes a flower in your garden. Watch them grow!
            </p>
            <div class="empty-state-tips">
                <div class="empty-state-tip">
                    ${Icons.get('flower', 16)}
                    <span>Active tabs bloom beautifully</span>
                </div>
                <div class="empty-state-tip">
                    ${Icons.get('leafDroop', 16)}
                    <span>Unused tabs slowly wilt</span>
                </div>
                <div class="empty-state-tip">
                    ${Icons.get('coin', 16)}
                    <span>Harvest wilted tabs to earn coins</span>
                </div>
            </div>
        `;
    }

    container.appendChild(emptyState);
}

function hideEmptyState() {
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
}

// ============================================
// Plant Detail Modal
// ============================================
let plantDetailOverlay = null;
let currentDetailPlant = null;

function showPlantDetail(plant) {
    if (!plant || !plant.tab) return;

    currentDetailPlant = plant;

    // Create overlay if it doesn't exist
    if (!plantDetailOverlay) {
        plantDetailOverlay = document.createElement('div');
        plantDetailOverlay.className = 'plant-detail-overlay';
        plantDetailOverlay.setAttribute('role', 'dialog');
        plantDetailOverlay.setAttribute('aria-modal', 'true');
        plantDetailOverlay.setAttribute('aria-labelledby', 'plant-detail-title');
        document.body.appendChild(plantDetailOverlay);

        // Close on backdrop click
        plantDetailOverlay.addEventListener('click', (e) => {
            if (e.target === plantDetailOverlay) {
                hidePlantDetail();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && plantDetailOverlay.classList.contains('visible')) {
                hidePlantDetail();
            }
        });
    }

    const tab = plant.tab;
    const friendlyName = plant.getFriendlyName();
    const healthPercent = Math.round((1 - plant.age) * 100);
    const healthStatus = plant.age < 0.3 ? 'Healthy' : plant.age < 0.7 ? 'Wilting' : 'Dormant';
    const plantedTime = getTimeAgo(plant.lastActiveTime);

    plantDetailOverlay.innerHTML = `
        <div class="plant-detail-card">
            <div class="plant-detail-header">
                <div class="plant-detail-icon">
                    ${tab.favIconUrl ? `<img src="${tab.favIconUrl}" alt="" onerror="this.style.display='none'">` : Icons.get('flower', 24)}
                </div>
                <div class="plant-detail-info">
                    <h3 id="plant-detail-title" class="plant-detail-title">${tab.title || 'Untitled'}</h3>
                    <p class="plant-detail-url">${friendlyName}</p>
                </div>
            </div>
            <div class="plant-detail-stats">
                <div class="plant-detail-stat">
                    <div class="plant-detail-stat-value">${healthPercent}%</div>
                    <div class="plant-detail-stat-label">${healthStatus}</div>
                </div>
                <div class="plant-detail-stat">
                    <div class="plant-detail-stat-value">${plantedTime}</div>
                    <div class="plant-detail-stat-label">Last active</div>
                </div>
            </div>
            <div class="plant-detail-actions">
                <button class="btn-primary" id="detail-go-to-tab" aria-label="Go to this tab">
                    Go to Tab
                </button>
                <button class="btn-icon" id="detail-close-tab" aria-label="Close this tab" title="Close Tab">
                    ${Icons.get('close', 20)}
                </button>
                <button class="btn-icon" id="detail-harvest" aria-label="Harvest this plant" title="Harvest (+${gardenSettings.harvestCoins} coins)">
                    ${Icons.get('harvest', 20)}
                </button>
            </div>
        </div>
    `;

    // Set up action handlers
    document.getElementById('detail-go-to-tab').addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        hidePlantDetail();
    });

    document.getElementById('detail-close-tab').addEventListener('click', async () => {
        await closeSingleTab(plant);
        hidePlantDetail();
    });

    document.getElementById('detail-harvest').addEventListener('click', async () => {
        await harvestSinglePlant(plant);
        hidePlantDetail();
    });

    // Show overlay
    plantDetailOverlay.classList.add('visible');
}

function hidePlantDetail() {
    if (plantDetailOverlay) {
        plantDetailOverlay.classList.remove('visible');
    }
    currentDetailPlant = null;
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

async function harvestSinglePlant(plant) {
    if (!plant) return;

    // Store for undo
    const harvestedTab = {
        url: plant.tab.url,
        title: plant.tab.title,
        favIconUrl: plant.tab.favIconUrl
    };

    bloomParticles(plant.x, plant.y, 30);
    AudioSystem.playHarvestChime();

    try {
        await chrome.tabs.remove(plant.tab.id);
        if (plant.element) plant.element.remove();
        plants = plants.filter(p => p !== plant);
        layoutPlants();
        updateCoins(gardenSettings.harvestCoins);
        recordHarvest(1, gardenSettings.harvestCoins);
        updateStatsDisplay();
        updateFilterCounts();

        // Show undo toast
        showUndoToast([harvestedTab], gardenSettings.harvestCoins);

        // Show empty state if no plants left
        if (plants.length === 0) {
            showEmptyState();
        }
    } catch (err) {
        Toast.error("Couldn't close tab");
    }
}

async function closeSingleTab(plant) {
    if (!plant) return;

    try {
        await chrome.tabs.remove(plant.tab.id);
        if (plant.element) plant.element.remove();
        plants = plants.filter(p => p !== plant);
        layoutPlants();
        updateStatsDisplay();
        updateFilterCounts();

        Toast.show('Tab closed', 'info', 2000);

        // Show empty state if no plants left
        if (plants.length === 0) {
            showEmptyState();
        }
    } catch (err) {
        Toast.error("Couldn't close tab");
    }
}

// ============================================
// Undo Harvest System
// ============================================
let undoTimeout = null;
let pendingUndo = null;

function showUndoToast(harvestedTabs, coinsEarned) {
    // Clear any existing undo
    if (undoTimeout) {
        clearTimeout(undoTimeout);
    }

    pendingUndo = { tabs: harvestedTabs, coins: coinsEarned };

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="toast-undo">
            <span class="toast-message">Harvested ${harvestedTabs.length} tab${harvestedTabs.length > 1 ? 's' : ''}</span>
            <button class="toast-undo-btn" id="undoHarvestBtn">Undo</button>
        </div>
        <div class="toast-timer"><div class="toast-timer-bar"></div></div>
    `;

    Toast.init();
    Toast.container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    // Set up undo button
    const undoBtn = toast.querySelector('#undoHarvestBtn');
    undoBtn.addEventListener('click', async () => {
        if (pendingUndo) {
            await undoHarvest();
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }
    });

    // Auto-dismiss after 5 seconds
    undoTimeout = setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
        pendingUndo = null;
    }, 5000);
}

async function undoHarvest() {
    if (!pendingUndo) return;

    const { tabs, coins } = pendingUndo;

    // Deduct the coins
    updateCoins(-coins);

    // Reopen tabs
    for (const tab of tabs) {
        try {
            await chrome.tabs.create({ url: tab.url, active: false });
        } catch (err) {
            console.error("Failed to restore tab:", err);
        }
    }

    Toast.success(`Restored ${tabs.length} tab${tabs.length > 1 ? 's' : ''}`);
    pendingUndo = null;

    if (undoTimeout) {
        clearTimeout(undoTimeout);
        undoTimeout = null;
    }

    // Refresh garden after a short delay to let tabs load
    setTimeout(async () => {
        const activityResult = await chrome.storage.local.get(['tabActivity']);
        const tabActivity = activityResult.tabActivity || {};
        const allTabs = await chrome.tabs.query({});

        plants.forEach(p => { if (p.element) p.element.remove(); });

        plants = allTabs.map(tab => {
            const lastActiveTime = tabActivity[tab.id] || Date.now();
            return new Plant(tab, lastActiveTime);
        });

        layoutPlants();
        plants.forEach((plant, index) => {
            plant.element = createPlantElement(plant.tab, plant.x, plant.y, index);
        });

        updateStatsDisplay();
        updateFilterCounts();
    }, 500);
}

// ============================================
// Filter System
// ============================================
let currentFilter = 'all';
let currentCategoryFilter = 'all';
let searchQuery = '';

function setupFilterSystem() {
    // Support both new segmented control and legacy chips
    const filterSegments = document.querySelectorAll('.filter-segment[data-filter]');
    const filterChips = document.querySelectorAll('.filter-chip[data-filter]');
    const filterElements = filterSegments.length > 0 ? filterSegments : filterChips;
    const searchInput = document.getElementById('filterSearch');

    filterElements.forEach(el => {
        el.addEventListener('click', () => {
            filterElements.forEach(c => {
                c.classList.remove('active');
                c.setAttribute('aria-pressed', 'false');
            });
            el.classList.add('active');
            el.setAttribute('aria-pressed', 'true');

            currentFilter = el.dataset.filter;
            applyFilters();
            updateDynamicCTA();
            AudioSystem.playHoverSoft();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    updateFilterCounts();
}

function getPlantStatus(plant) {
    if (plant.age < 0.3) return 'healthy';
    if (plant.age < 0.7) return 'wilting';
    return 'dormant';
}

function applyFilters() {
    let visibleCount = 0;
    let matchingPlants = [];

    plants.forEach(plant => {
        if (!plant.element) return;

        const status = getPlantStatus(plant);
        const matchesFilter = currentFilter === 'all' || status === currentFilter;

        // Category filter
        let matchesCategory = true;
        if (currentCategoryFilter !== 'all') {
            const plantCategory = plant.flowerType?.category || 'other';
            matchesCategory = plantCategory === currentCategoryFilter;
        }

        let matchesSearch = true;
        if (searchQuery) {
            const title = (plant.tab.title || '').toLowerCase();
            const url = (plant.tab.url || '').toLowerCase();
            matchesSearch = title.includes(searchQuery) || url.includes(searchQuery);
        }

        const isVisible = matchesFilter && matchesCategory && matchesSearch;
        plant.element.style.display = isVisible ? '' : 'none';
        plant.filtered = !isVisible;

        if (isVisible) {
            visibleCount++;
            matchingPlants.push(plant);
        }

        // Highlight matching plants during search
        if (searchQuery && matchesSearch) {
            plant.element.classList.add('search-match');
        } else {
            plant.element.classList.remove('search-match');
        }
    });

    // Update search feedback
    updateSearchFeedback(visibleCount, matchingPlants);

    // Show/hide empty state
    updateEmptyState(visibleCount);
}

// Set category filter (called from UI)
function setCategoryFilter(category) {
    currentCategoryFilter = category;
    applyFilters();
    updateDynamicCTA();
}

// Update category counts in dropdown
function updateCategoryCounts() {
    const counts = {
        all: plants.length,
        social: 0,
        dev: 0,
        ai: 0,
        google: 0,
        media: 0,
        shopping: 0,
        work: 0,
        other: 0
    };

    plants.forEach(plant => {
        const category = plant.flowerType?.category || 'other';
        if (counts[category] !== undefined) {
            counts[category]++;
        }
    });

    // Update count elements
    const countEls = {
        all: document.getElementById('catCountAll'),
        social: document.getElementById('catCountSocial'),
        dev: document.getElementById('catCountDev'),
        ai: document.getElementById('catCountAi'),
        google: document.getElementById('catCountGoogle'),
        media: document.getElementById('catCountMedia'),
        shopping: document.getElementById('catCountShopping'),
        work: document.getElementById('catCountWork'),
        other: document.getElementById('catCountOther')
    };

    Object.entries(countEls).forEach(([key, el]) => {
        if (el) el.textContent = counts[key];
    });

    // Hide categories with 0 plants (except 'all' and 'other')
    document.querySelectorAll('.category-item').forEach(item => {
        const cat = item.dataset.category;
        if (cat && cat !== 'all' && cat !== 'other') {
            item.style.display = counts[cat] === 0 ? 'none' : '';
        }
    });
}

// Search feedback overlay
function updateSearchFeedback(visibleCount, matchingPlants) {
    let feedback = document.getElementById('searchFeedback');

    if (!searchQuery) {
        if (feedback) feedback.classList.add('hidden');
        return;
    }

    // Create feedback element if needed
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'searchFeedback';
        feedback.className = 'search-feedback';
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
        document.querySelector('.filter-bar')?.appendChild(feedback);
    }

    if (visibleCount === 0) {
        feedback.innerHTML = `<span class="search-feedback-icon">${Icons.get('search', 14)}</span> No results for "${escapeHtml(searchQuery)}"`;
        feedback.classList.remove('hidden');
        feedback.classList.add('no-results');
    } else {
        feedback.innerHTML = `<span class="search-feedback-count">${visibleCount}</span> ${visibleCount === 1 ? 'match' : 'matches'}`;
        feedback.classList.remove('hidden', 'no-results');
    }
}

// Empty state for garden
function updateEmptyState(visibleCount) {
    let emptyState = document.getElementById('gardenEmptyState');
    const gardenContainer = document.getElementById('garden-container');

    if (visibleCount > 0 || plants.length === 0) {
        if (emptyState) emptyState.classList.add('hidden');
        return;
    }

    // Create empty state if it doesn't exist
    if (!emptyState && gardenContainer) {
        emptyState = document.createElement('div');
        emptyState.id = 'gardenEmptyState';
        emptyState.className = 'garden-empty-state';
        emptyState.setAttribute('role', 'status');
        gardenContainer.appendChild(emptyState);
    }

    if (!emptyState) return;

    // Customize message based on filter state
    let icon, title, subtitle;

    if (searchQuery) {
        icon = 'search';
        title = 'No matching tabs';
        subtitle = `Try a different search term`;
    } else if (currentFilter === 'healthy') {
        icon = 'leaf';
        title = 'No healthy tabs';
        subtitle = 'Visit some tabs to help them bloom';
    } else if (currentFilter === 'wilting') {
        icon = 'leafDroop';
        title = 'No wilting tabs';
        subtitle = 'Your garden is thriving!';
    } else {
        icon = 'flower';
        title = 'Garden is empty';
        subtitle = 'Open some tabs to start growing';
    }

    emptyState.innerHTML = `
        <div class="empty-state-icon">${Icons.get(icon, 32)}</div>
        <h3 class="empty-state-title">${title}</h3>
        <p class="empty-state-subtitle">${subtitle}</p>
    `;
    emptyState.classList.remove('hidden');
}

// Helper to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateFilterCounts() {
    const counts = {
        all: plants.length,
        healthy: plants.filter(p => p.age < 0.3).length,
        wilting: plants.filter(p => p.age >= 0.3 && p.age < 0.7).length,
        dormant: plants.filter(p => p.age >= 0.7).length
    };

    // Update filter counts (supports both segment and chip variants)
    const allEl = document.getElementById('filterCountAll');
    const healthyEl = document.getElementById('filterCountHealthy');
    const wiltingEl = document.getElementById('filterCountWilting');
    const dormantEl = document.getElementById('filterCountDormant');

    if (allEl) allEl.textContent = counts.all;
    if (healthyEl) healthyEl.textContent = counts.healthy;
    if (wiltingEl) wiltingEl.textContent = counts.wilting;
    if (dormantEl) dormantEl.textContent = counts.dormant;

    // Update dynamic CTA
    updateDynamicCTA();
}

// ============================================
// Dynamic CTA Button
// ============================================
function updateDynamicCTA() {
    const harvestBtn = document.getElementById('harvestAll');
    const btnText = harvestBtn?.querySelector('.harvest-btn-text');
    const rewardEl = document.getElementById('harvestReward');

    if (!harvestBtn) return;

    const wiltingCount = plants.filter(p => p.age >= 0.3 && p.age < 0.7).length;
    const dormantCount = plants.filter(p => p.age >= 0.7).length;
    const harvestableCount = wiltingCount + dormantCount;
    const potentialCoins = harvestableCount * gardenSettings.harvestCoins;

    // Remove existing state classes
    harvestBtn.classList.remove('state-healthy', 'state-wilting');

    if (harvestableCount === 0) {
        // All healthy state
        harvestBtn.classList.add('state-healthy');
        if (btnText) btnText.textContent = 'Garden Thriving';
        if (rewardEl) rewardEl.textContent = '';
        harvestBtn.disabled = true;
        harvestBtn.title = 'All tabs are healthy';
    } else {
        // Has harvestable tabs
        harvestBtn.classList.add('state-wilting');
        if (btnText) btnText.textContent = `Harvest ${harvestableCount} Tab${harvestableCount !== 1 ? 's' : ''}`;
        if (rewardEl) rewardEl.textContent = `+${potentialCoins}`;
        harvestBtn.disabled = false;
        harvestBtn.title = `Close ${harvestableCount} wilting tabs and earn ${potentialCoins} coins`;
    }
}

// ============================================
// Batch Selection System
// ============================================
let selectionMode = false;
let selectedPlants = new Set();

function setupBatchSelection() {
    const selectModeToggle = document.getElementById('selectModeToggle');
    const batchActionBar = document.getElementById('batchActionBar');
    const batchSelectAll = document.getElementById('batchSelectAll');
    const batchCancel = document.getElementById('batchCancel');
    const batchHarvest = document.getElementById('batchHarvest');
    const gardenContainer = document.getElementById('garden-container');

    if (selectModeToggle) {
        selectModeToggle.addEventListener('click', () => {
            selectionMode = !selectionMode;
            selectModeToggle.classList.toggle('active', selectionMode);
            selectModeToggle.setAttribute('aria-pressed', String(selectionMode));
            gardenContainer?.classList.toggle('selection-mode', selectionMode);

            if (!selectionMode) {
                clearSelection();
            }

            updateBatchActionBar();
            AudioSystem.playHoverSoft();
        });
    }

    if (batchSelectAll) {
        batchSelectAll.addEventListener('click', () => {
            plants.forEach(plant => {
                if (!plant.filtered && plant.element) {
                    selectedPlants.add(plant);
                    plant.element.classList.add('selected');
                }
            });
            updateBatchActionBar();
        });
    }

    if (batchCancel) {
        batchCancel.addEventListener('click', () => {
            exitSelectionMode();
        });
    }

    if (batchHarvest) {
        batchHarvest.addEventListener('click', async () => {
            if (selectedPlants.size === 0) return;
            await harvestSelectedPlants();
        });
    }
}

async function harvestSelectedPlants() {
    const plantsToHarvest = Array.from(selectedPlants);
    const harvestedTabs = [];
    let harvestedCount = 0;

    AudioSystem.playHarvestChime();

    for (const plant of plantsToHarvest) {
        try {
            harvestedTabs.push({
                url: plant.tab.url,
                title: plant.tab.title,
                favIconUrl: plant.tab.favIconUrl
            });
            await chrome.tabs.remove(plant.tab.id);
            bloomParticles(plant.x, plant.y);
            if (plant.element) plant.element.remove();
            harvestedCount++;
            await new Promise(r => setTimeout(r, 80));
        } catch (err) {
            console.error("Failed to close tab:", err);
        }
    }

    plants = plants.filter(p => !selectedPlants.has(p));
    layoutPlants();

    const coinsEarned = harvestedCount * gardenSettings.harvestCoins;
    updateCoins(coinsEarned);
    recordHarvest(harvestedCount, coinsEarned);
    updateStatsDisplay();
    updateFilterCounts();

    showUndoToast(harvestedTabs, coinsEarned);

    exitSelectionMode();

    if (harvestedCount > 2 && gardenSettings.confettiEnabled && typeof confetti === 'function') {
        AudioSystem.playHarvestAllCelebration();
        confetti({
            particleCount: 60 + harvestedCount * 8,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#00B894', '#FFD60A', '#007AFF', '#5856D6', '#FF9500']
        });
    }
}

function exitSelectionMode() {
    selectionMode = false;
    const selectModeToggle = document.getElementById('selectModeToggle');
    const gardenContainer = document.getElementById('garden-container');

    selectModeToggle?.classList.remove('active');
    selectModeToggle?.setAttribute('aria-pressed', 'false');
    gardenContainer?.classList.remove('selection-mode');
    clearSelection();
    updateBatchActionBar();
}

function togglePlantSelection(plant) {
    if (!selectionMode || !plant.element) return;

    if (selectedPlants.has(plant)) {
        selectedPlants.delete(plant);
        plant.element.classList.remove('selected');
        AudioSystem.playHoverSoft(); // Deselect sound
    } else {
        selectedPlants.add(plant);
        plant.element.classList.add('selected');
        AudioSystem.playGrowthRustle(); // Select sound
    }

    updateBatchActionBar();
}

function clearSelection() {
    selectedPlants.forEach(plant => {
        if (plant.element) {
            plant.element.classList.remove('selected');
        }
    });
    selectedPlants.clear();
}

let lastBatchCount = 0;

function updateBatchActionBar() {
    const batchActionBar = document.getElementById('batchActionBar');
    const batchCount = document.getElementById('batchCount');

    if (batchCount) {
        const newCount = selectedPlants.size;
        batchCount.textContent = newCount;

        // Animate count changes
        if (newCount !== lastBatchCount && newCount > 0) {
            batchCount.classList.remove('bump');
            // Trigger reflow for animation restart
            void batchCount.offsetWidth;
            batchCount.classList.add('bump');
            lastBatchCount = newCount;
        }
    }

    if (batchActionBar) {
        batchActionBar.classList.toggle('visible', selectionMode && selectedPlants.size > 0);
    }
}

// ============================================
// Soft Drifting Clouds
// ============================================
class Cloud {
    constructor() {
        this.reset(true);
    }

    reset(initial = false) {
        this.y = Math.random() * height * 0.4;
        this.x = initial ? Math.random() * width : -200;
        this.speed = 0.1 + Math.random() * 0.2;
        this.width = 80 + Math.random() * 120;
        this.height = 30 + Math.random() * 40;
        this.alpha = 0.15 + Math.random() * 0.2;
        this.wobble = Math.random() * Math.PI * 2;
        this.wobbleSpeed = 0.01 + Math.random() * 0.01;
    }

    update() {
        this.x += this.speed;
        this.wobble += this.wobbleSpeed;

        if (this.x > width + 200) {
            this.reset();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;

        const wobbleY = Math.sin(this.wobble) * 5;

        // Draw soft cloud using multiple overlapping ellipses
        const gradient = ctx.createRadialGradient(
            this.x, this.y + wobbleY,
            0,
            this.x, this.y + wobbleY,
            this.width * 0.6
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 250, 245, 0.5)');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;

        // Main cloud body
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + wobbleY, this.width * 0.5, this.height * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cloud puffs
        ctx.beginPath();
        ctx.ellipse(this.x - this.width * 0.3, this.y + wobbleY + 5, this.width * 0.35, this.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(this.x + this.width * 0.25, this.y + wobbleY + 3, this.width * 0.4, this.height * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ============================================
// Ambient Floating Particles (Fireflies/Sparkles)
// ============================================
class AmbientParticle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = 1.5 + Math.random() * 3;
        this.baseAlpha = 0.3 + Math.random() * 0.5;
        this.alpha = this.baseAlpha;
        this.pulseSpeed = 0.02 + Math.random() * 0.03;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.driftX = (Math.random() - 0.5) * 0.3;
        this.driftY = (Math.random() - 0.5) * 0.2 - 0.1; // Slight upward drift
        this.color = this.getRandomWarmColor();
        this.twinkleRate = 0.05 + Math.random() * 0.1;
    }

    getRandomWarmColor() {
        const colors = [
            '#FFE4B5', // Moccasin
            '#FFD700', // Gold
            '#FFECD2', // Warm cream
            '#FFF8DC', // Cornsilk
            '#FFB7C5', // Pink
            '#FFFACD', // Lemon chiffon
            '#FFC9A8', // Peach
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.pulsePhase += this.pulseSpeed;
        this.alpha = this.baseAlpha * (0.5 + Math.sin(this.pulsePhase) * 0.5);

        this.x += this.driftX;
        this.y += this.driftY;

        // Wrap around screen
        if (this.x < -10) this.x = width + 10;
        if (this.x > width + 10) this.x = -10;
        if (this.y < -10) this.y = height + 10;
        if (this.y > height + 10) this.y = -10;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;

        // Outer glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(0.4, this.color + '80');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ============================================
// Butterflies
// ============================================
class Butterfly {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height * 0.7;
        this.targetX = Math.random() * width;
        this.targetY = Math.random() * height * 0.7;
        this.speed = 0.5 + Math.random() * 1;
        this.wingPhase = Math.random() * Math.PI * 2;
        this.wingSpeed = 0.3 + Math.random() * 0.2;
        this.size = this.getSeasonalSize();
        this.color = this.getRandomColor();
        this.accentColor = this.getAccentColor();
        this.restTimer = 0;
        this.isResting = false;
        this.wobble = Math.random() * Math.PI * 2;
    }

    getRandomColor() {
        // Seasonal butterfly colors
        const season = typeof getCurrentSeason === 'function' ? getCurrentSeason() : 'spring';
        const seasonalColors = {
            spring: ['#FFD4E5', '#E5D4FF', '#D4F0FF', '#FFFFD4', '#D4FFE5', '#FFE4F0'], // Soft pastels
            summer: ['#FFB7C5', '#FFC9A8', '#B7D4FF', '#D4B7FF', '#FFE4B5', '#98D8AA'], // Vibrant
            autumn: ['#DEB887', '#D2691E', '#CD853F', '#B8860B', '#DAA520', '#CC7A4A'], // Warm earth tones
            winter: ['#E8E8FF', '#D4E8FF', '#FFE8F0', '#F0F0FF', '#E8F4FF', '#FFF0F8'], // Icy pastels
        };
        const colors = seasonalColors[season] || seasonalColors.spring;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getAccentColor() {
        const season = typeof getCurrentSeason === 'function' ? getCurrentSeason() : 'spring';
        const seasonalAccents = {
            spring: ['#FFB8D0', '#D0B8FF', '#B8E0FF', '#FFFFA0', '#B8FFD0', '#FFD0E8'], // Soft accent
            summer: ['#FF8FAB', '#FFB088', '#88B4FF', '#B488FF', '#FFD488', '#78C890'], // Bold accent
            autumn: ['#C4762D', '#A0522D', '#8B4513', '#996515', '#B8860B', '#AA6030'], // Rich earth
            winter: ['#C8C8FF', '#A8D0FF', '#FFD0E0', '#D8D8FF', '#C8E8FF', '#FFE0F0'], // Cool accent
        };
        const colors = seasonalAccents[season] || seasonalAccents.spring;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Seasonal size variation
    getSeasonalSize() {
        const season = typeof getCurrentSeason === 'function' ? getCurrentSeason() : 'spring';
        const baseSizes = { spring: 5, summer: 6, autumn: 5, winter: 4 };
        const variations = { spring: 4, summer: 5, autumn: 3, winter: 3 };
        return (baseSizes[season] || 5) + Math.random() * (variations[season] || 4);
    }

    update() {
        this.wingPhase += this.wingSpeed;
        this.wobble += 0.05;

        if (this.isResting) {
            this.restTimer--;
            if (this.restTimer <= 0) {
                this.isResting = false;
                this.targetX = Math.random() * width;
                this.targetY = Math.random() * height * 0.7;
            }
            return;
        }

        // Move toward target with wobble
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
            // Occasionally rest on a flower
            if (Math.random() < 0.3 && plants.length > 0) {
                const randomPlant = plants[Math.floor(Math.random() * plants.length)];
                this.x = randomPlant.x + (Math.random() - 0.5) * 20;
                this.y = randomPlant.y - 30;
                this.isResting = true;
                this.restTimer = 60 + Math.random() * 120;
                AudioSystem.playButterflyFlutter(); // Soft landing sound
            } else {
                this.targetX = Math.random() * width;
                this.targetY = Math.random() * height * 0.7;
            }
        } else {
            this.x += (dx / dist) * this.speed + Math.sin(this.wobble) * 0.5;
            this.y += (dy / dist) * this.speed + Math.cos(this.wobble * 1.3) * 0.3;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const wingFlap = this.isResting ? 0.1 : Math.sin(this.wingPhase) * 0.8;
        const direction = this.targetX > this.x ? 1 : -1;

        ctx.scale(direction, 1);

        // Wing shadow
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000';
        this.drawWings(ctx, wingFlap, 2, 2);

        // Main wings
        ctx.globalAlpha = 0.85;
        this.drawWings(ctx, wingFlap, 0, 0);

        // Body
        ctx.fillStyle = '#4A3728';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.15, this.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Antennae
        ctx.strokeStyle = '#4A3728';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -this.size * 0.4);
        ctx.quadraticCurveTo(-this.size * 0.2, -this.size * 0.8, -this.size * 0.15, -this.size * 0.9);
        ctx.moveTo(0, -this.size * 0.4);
        ctx.quadraticCurveTo(this.size * 0.2, -this.size * 0.8, this.size * 0.15, -this.size * 0.9);
        ctx.stroke();

        ctx.restore();
    }

    drawWings(ctx, wingFlap, offsetX, offsetY) {
        ctx.save();
        ctx.translate(offsetX, offsetY);

        // Upper wings
        ctx.save();
        ctx.scale(1, 0.3 + wingFlap * 0.7);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.4, -this.size * 0.2, this.size * 0.6, this.size * 0.8, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.accentColor;
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.35, -this.size * 0.15, this.size * 0.3, this.size * 0.4, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(this.size * 0.4, -this.size * 0.2, this.size * 0.6, this.size * 0.8, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.accentColor;
        ctx.beginPath();
        ctx.ellipse(this.size * 0.35, -this.size * 0.15, this.size * 0.3, this.size * 0.4, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Lower wings
        ctx.save();
        ctx.scale(1, 0.4 + wingFlap * 0.6);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.3, this.size * 0.3, this.size * 0.4, this.size * 0.5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(this.size * 0.3, this.size * 0.3, this.size * 0.4, this.size * 0.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }
}

// ============================================
// Autumn Falling Leaves
// ============================================
class AutumnLeaf {
    constructor() {
        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : -20;
        this.size = 6 + Math.random() * 8;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.08;
        this.fallSpeed = 0.3 + Math.random() * 0.5;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed = 0.02 + Math.random() * 0.02;
        this.swayAmount = 1 + Math.random() * 2;
        this.color = ['#D2691E', '#CD853F', '#B8860B', '#DAA520', '#FF8C00', '#A0522D'][Math.floor(Math.random() * 6)];
        this.alpha = 0.7 + Math.random() * 0.3;
    }

    update() {
        this.y += this.fallSpeed;
        this.swayPhase += this.swaySpeed;
        this.x += Math.sin(this.swayPhase) * this.swayAmount * 0.1;
        this.rotation += this.rotationSpeed;

        if (this.y > height + 20) {
            this.reset();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.alpha;

        // Draw leaf shape
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.4, this.size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Leaf vein
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(0, this.size);
        ctx.stroke();

        ctx.restore();
    }
}

// ============================================
// Winter Snowflakes
// ============================================
class Snowflake {
    constructor() {
        this.reset(true);
    }

    reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : -10;
        this.size = 2 + Math.random() * 4;
        this.fallSpeed = 0.2 + Math.random() * 0.4;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed = 0.01 + Math.random() * 0.02;
        this.alpha = 0.5 + Math.random() * 0.5;
        this.twinklePhase = Math.random() * Math.PI * 2;
    }

    update() {
        this.y += this.fallSpeed;
        this.swayPhase += this.swaySpeed;
        this.x += Math.sin(this.swayPhase) * 0.5;
        this.twinklePhase += 0.05;

        if (this.y > height + 10) {
            this.reset();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha * (0.7 + Math.sin(this.twinklePhase) * 0.3);

        // Soft glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.4)');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ============================================
// Summer Sun Rays
// ============================================
let sunRayPhase = 0;
function drawSunRays(ctx) {
    sunRayPhase += 0.01;
    const pulseIntensity = 0.5 + Math.sin(sunRayPhase) * 0.3;

    ctx.save();

    const sunX = width * 0.75;
    const sunY = height * 0.1;

    // Draw pulsing rays
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + sunRayPhase * 0.2;
        const rayLength = height * 0.6 * pulseIntensity;

        const gradient = ctx.createLinearGradient(
            sunX, sunY,
            sunX + Math.cos(angle) * rayLength,
            sunY + Math.sin(angle) * rayLength
        );
        gradient.addColorStop(0, `rgba(255, 220, 100, ${0.15 * pulseIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 200, 80, ${0.08 * pulseIntensity})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(
            sunX + Math.cos(angle - 0.1) * rayLength,
            sunY + Math.sin(angle - 0.1) * rayLength
        );
        ctx.lineTo(
            sunX + Math.cos(angle + 0.1) * rayLength,
            sunY + Math.sin(angle + 0.1) * rayLength
        );
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

// Seasonal particles storage
let seasonalParticles = [];

// ============================================
// Web Audio API Sound System (Professional ASMR)
// ============================================
const AudioSystem = {
    ctx: null,
    masterGain: null,
    reverbNode: null,
    samples: {},
    samplesLoaded: false,

    // Initialize the audio context and effects chain
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Master gain for global volume
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        // Create lush reverb
        this.createLushReverb();

        // Try to load audio samples
        this.loadSamples();
    },

    ensureContext() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    isEnabled() {
        return gardenSettings.soundEnabled && !gardenSettings.minimalMode;
    },

    getVolume() {
        return gardenSettings.masterVolume / 100;
    },

    // Create a beautiful, lush reverb using algorithmic approach
    createLushReverb() {
        if (!this.ctx) return;

        // Create a longer, more realistic reverb impulse
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * 2.5; // 2.5 second reverb tail
        const buffer = this.ctx.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);

            // Early reflections (first 50ms)
            const earlyLength = sampleRate * 0.05;
            for (let i = 0; i < earlyLength; i++) {
                // Sparse early reflections
                if (Math.random() > 0.97) {
                    const amplitude = 0.3 * (1 - i / earlyLength);
                    data[i] = (Math.random() * 2 - 1) * amplitude;
                }
            }

            // Diffuse tail with multiple decay rates
            for (let i = earlyLength; i < length; i++) {
                const t = i / length;
                // Combine fast and slow decay for natural sound
                const fastDecay = Math.exp(-5 * t);
                const slowDecay = Math.exp(-2 * t);
                const decay = fastDecay * 0.3 + slowDecay * 0.7;

                // Add some modulation for richness
                const mod = 1 + 0.1 * Math.sin(i * 0.001);

                // Slight stereo decorrelation
                const stereoOffset = channel === 0 ? 0 : Math.PI * 0.3;
                const stereoMod = 1 + 0.05 * Math.sin(i * 0.0003 + stereoOffset);

                data[i] = (Math.random() * 2 - 1) * decay * mod * stereoMod * 0.4;
            }

            // Apply lowpass smoothing to avoid harshness
            let prev = 0;
            for (let i = 0; i < length; i++) {
                data[i] = prev * 0.3 + data[i] * 0.7;
                prev = data[i];
            }
        }

        this.reverbBuffer = buffer;
    },

    // Create reverb send with wet/dry mix
    createReverbSend(wetAmount = 0.4) {
        const convolver = this.ctx.createConvolver();
        convolver.buffer = this.reverbBuffer;

        const wetGain = this.ctx.createGain();
        const dryGain = this.ctx.createGain();
        const merger = this.ctx.createGain();

        wetGain.gain.value = wetAmount;
        dryGain.gain.value = 1 - wetAmount * 0.5; // Keep dry louder

        convolver.connect(wetGain);
        wetGain.connect(merger);
        dryGain.connect(merger);
        merger.connect(this.masterGain);

        return { input: dryGain, reverb: convolver, output: merger };
    },

    // Try to load audio sample files (graceful fallback to synthesis)
    async loadSamples() {
        const sampleFiles = {
            chime: 'sounds/chime.mp3',
            celebration: 'sounds/chime-celebration.mp3',
            rustle: 'sounds/rustle.mp3',
            droop: 'sounds/droop.mp3',
            hover: 'sounds/hover.mp3',
            flutter: 'sounds/flutter.mp3'
        };

        for (const [name, path] of Object.entries(sampleFiles)) {
            try {
                const response = await fetch(chrome.runtime.getURL(path));
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    this.samples[name] = await this.ctx.decodeAudioData(arrayBuffer);
                }
            } catch (e) {
                // Sample not available, will use synthesis fallback
            }
        }
        this.samplesLoaded = true;
    },

    // Play a loaded sample with optional pitch shift
    playSample(name, volume = 1, playbackRate = 1) {
        if (!this.samples[name]) return false;

        const source = this.ctx.createBufferSource();
        source.buffer = this.samples[name];
        source.playbackRate.value = playbackRate;

        const gain = this.ctx.createGain();
        gain.gain.value = volume * this.getVolume();

        source.connect(gain);
        gain.connect(this.masterGain);
        source.start();

        return true;
    },

    // ==========================================
    // KARPLUS-STRONG SYNTHESIS (Plucked strings)
    // ==========================================
    // Creates beautiful kalimba/music box tones

    createKarplusStrong(freq, duration, brightness = 0.5) {
        const sampleRate = this.ctx.sampleRate;
        const samples = Math.ceil(sampleRate * duration);
        const delayLength = Math.round(sampleRate / freq);
        const buffer = this.ctx.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);

        // Initialize delay line with filtered noise (the "pluck")
        const delayLine = new Float32Array(delayLength);
        for (let i = 0; i < delayLength; i++) {
            // Shaped initial excitation - softer attack
            const pos = i / delayLength;
            const shape = Math.sin(pos * Math.PI); // Smooth shape
            delayLine[i] = (Math.random() * 2 - 1) * shape * 0.8;
        }

        // Pre-filter the excitation for warmth
        for (let pass = 0; pass < 2; pass++) {
            let prev = delayLine[0];
            for (let i = 1; i < delayLength; i++) {
                delayLine[i] = prev * 0.4 + delayLine[i] * 0.6;
                prev = delayLine[i];
            }
        }

        // Karplus-Strong algorithm with enhanced filtering
        let writeIndex = 0;
        const dampening = 0.996 - (1 - brightness) * 0.01; // Brightness control

        for (let i = 0; i < samples; i++) {
            const readIndex = (writeIndex + 1) % delayLength;
            const nextIndex = (writeIndex + 2) % delayLength;

            // Enhanced averaging filter with slight randomness for natural decay
            const avg = (delayLine[readIndex] + delayLine[nextIndex]) * 0.5;
            const filtered = avg * dampening;

            // Add very subtle pitch drift for organic feel
            const drift = 1 + (Math.random() - 0.5) * 0.0001;

            data[i] = delayLine[writeIndex];
            delayLine[writeIndex] = filtered * drift;
            writeIndex = readIndex;
        }

        // Apply amplitude envelope
        const attackSamples = sampleRate * 0.002; // 2ms attack
        const releaseSamples = sampleRate * 0.3; // 300ms release

        for (let i = 0; i < samples; i++) {
            let env = 1;
            if (i < attackSamples) {
                env = i / attackSamples;
            } else if (i > samples - releaseSamples) {
                env = (samples - i) / releaseSamples;
            }
            data[i] *= env;
        }

        return buffer;
    },

    // ==========================================
    // FM SYNTHESIS (Bell-like tones)
    // ==========================================

    createFMBell(freq, duration, harmonicity = 2.5, modulationIndex = 3) {
        const sampleRate = this.ctx.sampleRate;
        const samples = Math.ceil(sampleRate * duration);
        const buffer = this.ctx.createBuffer(2, samples, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            // Slight stereo detuning
            const detune = channel === 0 ? 1 : 1.002;
            const carrierFreq = freq * detune;
            const modFreq = carrierFreq * harmonicity;

            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;

                // Amplitude envelope - bell-like with fast attack, slow decay
                const ampEnv = Math.exp(-3 * t) * (1 - Math.exp(-t * 100));

                // Modulation index envelope - decreases over time for natural bell
                const modEnv = modulationIndex * Math.exp(-4 * t);

                // FM synthesis
                const modulator = Math.sin(2 * Math.PI * modFreq * t) * modEnv;
                const carrier = Math.sin(2 * Math.PI * carrierFreq * t + modulator);

                data[i] = carrier * ampEnv * 0.3;
            }
        }

        return buffer;
    },

    // ==========================================
    // BEAUTIFUL HARVEST CHIME
    // ==========================================

    playHarvestChime() {
        if (!this.isEnabled()) return;
        this.ensureContext();

        // Try sample first
        if (this.playSample('chime', 0.8)) return;

        // Synthesis fallback - kalimba-style dual notes
        const vol = this.getVolume();
        const now = this.ctx.currentTime;

        // Pentatonic notes: G5 (784Hz) and D6 (1175Hz)
        const notes = [
            { freq: 784, delay: 0, vol: 0.7 },
            { freq: 1175, delay: 0.08, vol: 0.5 }
        ];

        const reverbSend = this.createReverbSend(0.5);

        notes.forEach(note => {
            // Use Karplus-Strong for beautiful plucked sound
            const buffer = this.createKarplusStrong(note.freq, 1.5, 0.7);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;

            const gain = this.ctx.createGain();
            gain.gain.value = note.vol * vol;

            // Warm filter
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 4000;
            filter.Q.value = 0.5;

            source.connect(filter);
            filter.connect(gain);
            gain.connect(reverbSend.input);
            gain.connect(reverbSend.reverb);

            source.start(now + note.delay);
        });
    },

    // ==========================================
    // CELEBRATION ARPEGGIO
    // ==========================================

    playHarvestAllCelebration() {
        if (!this.isEnabled()) return;
        this.ensureContext();

        if (this.playSample('celebration', 0.8)) return;

        const vol = this.getVolume();
        const now = this.ctx.currentTime;

        // Major pentatonic ascending: C5, D5, E5, G5, A5, C6
        const notes = [523, 587, 659, 784, 880, 1047];

        const reverbSend = this.createReverbSend(0.6);

        notes.forEach((freq, i) => {
            const delay = i * 0.12;

            // Alternate between Karplus-Strong and FM for variety
            const buffer = i % 2 === 0
                ? this.createKarplusStrong(freq, 2, 0.8)
                : this.createFMBell(freq, 2, 2.5, 2);

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now + delay);
            gain.gain.linearRampToValueAtTime(0.4 * vol, now + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 2);

            source.connect(gain);
            gain.connect(reverbSend.input);
            gain.connect(reverbSend.reverb);

            source.start(now + delay);
        });

        // Add magical shimmer at the end
        setTimeout(() => {
            this.playShimmer(1568, 0.15 * vol); // G6
        }, 700);
    },

    // Ethereal shimmer effect
    playShimmer(freq, vol) {
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const reverbSend = this.createReverbSend(0.7);

        // Multiple detuned oscillators for chorus effect
        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq * (1 + (i - 1) * 0.003); // Slight detune

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(vol / 3, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(reverbSend.input);
            gain.connect(reverbSend.reverb);

            osc.start(now);
            osc.stop(now + 1.2);
        }
    },

    // ==========================================
    // ORGANIC LEAF RUSTLE
    // ==========================================

    playGrowthRustle() {
        if (!this.isEnabled()) return;
        this.ensureContext();

        if (this.playSample('rustle', 0.6)) return;

        const vol = this.getVolume();
        const now = this.ctx.currentTime;
        const sampleRate = this.ctx.sampleRate;

        // Create organic rustle with multiple filtered noise layers
        const duration = 0.4;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        // Pink noise state
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);

            // Reset noise state for each channel with slight variation
            const channelOffset = channel * 0.1;

            for (let i = 0; i < bufferSize; i++) {
                const t = i / bufferSize;

                // Voss-McCartney pink noise (more natural than simple algorithm)
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                const pink = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;

                // Natural envelope with multiple peaks (like actual leaf movement)
                const env1 = Math.sin(Math.PI * t) * Math.sin(Math.PI * t);
                const env2 = Math.sin(Math.PI * t * 2 + channelOffset) * 0.3;
                const env = env1 + Math.max(0, env2);

                // Add some granular texture
                const grain = (Math.random() > 0.98) ? Math.random() * 0.2 : 0;

                data[i] = (pink * 0.15 + grain) * env;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Bandpass for leafy character
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2500;
        filter.Q.value = 0.8;

        // Second filter for warmth
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 6000;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.7 * vol;

        source.connect(filter);
        filter.connect(lowpass);
        lowpass.connect(gain);
        gain.connect(this.masterGain);

        source.start();
    },

    // ==========================================
    // MELANCHOLIC WILT SOUND
    // ==========================================

    playWiltDroop() {
        if (!this.isEnabled()) return;
        this.ensureContext();

        if (this.playSample('droop', 0.5)) return;

        const vol = this.getVolume();
        const now = this.ctx.currentTime;

        const reverbSend = this.createReverbSend(0.5);

        // Descending minor third: G4 (392) to E4 (330) - melancholic interval
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator(); // Octave below for depth
        const vibrato = this.ctx.createOscillator();
        const vibratoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        const gain2 = this.ctx.createGain();

        // Gentle vibrato
        vibrato.type = 'sine';
        vibrato.frequency.value = 5;
        vibratoGain.gain.value = 4;
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        vibratoGain.connect(osc2.frequency);

        // Main tone - descending
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.6);

        // Sub octave
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(196, now);
        osc2.frequency.exponentialRampToValueAtTime(165, now + 0.6);

        // Envelope
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08 * vol, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.03 * vol, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(reverbSend.input);
        gain.connect(reverbSend.reverb);
        gain2.connect(reverbSend.input);

        vibrato.start(now);
        osc.start(now);
        osc2.start(now);
        vibrato.stop(now + 0.7);
        osc.stop(now + 0.75);
        osc2.stop(now + 0.75);
    },

    // ==========================================
    // WHISPER-SOFT HOVER (Peaceful breath)
    // ==========================================

    lastHoverTime: 0,
    lastHoveredId: null,

    playHoverSoft(plantId = null) {
        if (!this.isEnabled()) return;

        // Prevent rapid re-triggering - only play once per plant, with 300ms cooldown
        const now = Date.now();
        if (plantId !== null) {
            if (plantId === this.lastHoveredId && now - this.lastHoverTime < 500) return;
            this.lastHoveredId = plantId;
        } else {
            if (now - this.lastHoverTime < 300) return;
        }
        this.lastHoverTime = now;

        this.ensureContext();

        if (this.playSample('hover', 0.2)) return;

        const vol = this.getVolume();
        const ctxNow = this.ctx.currentTime;

        // Peaceful breath - soft filtered noise like a gentle sigh
        const duration = 0.2;
        const sampleRate = this.ctx.sampleRate;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < bufferSize; i++) {
                const t = i / bufferSize;
                // Very soft breath envelope - quick fade in, gentle fade out
                const env = Math.sin(Math.PI * t) * Math.pow(1 - t, 0.5);
                // Gentle noise with slight tone
                const noise = (Math.random() * 2 - 1) * 0.3;
                const tone = Math.sin(2 * Math.PI * 400 * t / sampleRate) * 0.1;
                data[i] = (noise + tone) * env * 0.08;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Soft lowpass for warmth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.15 * vol; // Very quiet

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        source.start();
    },

    // ==========================================
    // DELICATE BUTTERFLY FLUTTER
    // ==========================================

    playButterflyFlutter() {
        if (!this.isEnabled()) return;
        this.ensureContext();

        if (this.playSample('flutter', 0.4)) return;

        const vol = this.getVolume();
        const now = this.ctx.currentTime;
        const sampleRate = this.ctx.sampleRate;

        // Create delicate, airy flutter
        const duration = 0.15;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            const phaseOffset = channel * Math.PI * 0.5;

            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                const progress = i / bufferSize;

                // Rapid flutter - like tiny wing beats
                const flutterRate = 60; // Wing beats per second
                const flutter = Math.sin(2 * Math.PI * flutterRate * t + phaseOffset);

                // Amplitude modulation for natural variation
                const ampMod = 0.7 + 0.3 * Math.sin(2 * Math.PI * 8 * t);

                // Smooth envelope
                const env = Math.sin(Math.PI * progress);

                // High frequency shimmer
                const shimmer = Math.sin(2 * Math.PI * 4000 * t) * 0.02;

                data[i] = (flutter * 0.05 + shimmer) * ampMod * env;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Highpass for airy quality
        const highpass = this.ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 3000;
        highpass.Q.value = 0.3;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.4 * vol;

        const reverbSend = this.createReverbSend(0.3);

        source.connect(highpass);
        highpass.connect(gain);
        gain.connect(reverbSend.input);
        gain.connect(reverbSend.reverb);

        source.start();
    },

    // ==========================================
    // AMBIENT SOUNDSCAPES
    // ==========================================

    ambientSources: [],
    ambientGain: null,
    isAmbientPlaying: false,

    startAmbientSoundscape(season) {
        if (this.isAmbientPlaying) return;
        if (!this.isEnabled() || !gardenSettings.ambientEnabled) return;
        this.ensureContext();

        this.isAmbientPlaying = true;
        const vol = this.getVolume();

        // Try to load audio file first
        const sampleName = `ambient-${season}`;
        if (this.samples[sampleName]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.samples[sampleName];
            source.loop = true;

            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.value = 0.3 * vol;

            source.connect(this.ambientGain);
            this.ambientGain.connect(this.masterGain);
            source.start();
            this.ambientSources.push(source);
            return;
        }

        // Synthesis fallback - create rich, layered soundscape
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.35 * vol;
        this.ambientGain.connect(this.masterGain);

        if (season === 'summer') {
            this.createSummerAmbient();
        } else if (season === 'autumn') {
            this.createAutumnAmbient();
        } else if (season === 'winter') {
            this.createWinterAmbient();
        } else {
            this.createSpringAmbient();
        }
    },

    createSummerAmbient() {
        const sampleRate = this.ctx.sampleRate;
        const duration = 8;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            const stereoPhase = channel * Math.PI * 0.3;

            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                let sample = 0;

                // Multiple cricket voices with natural rhythm variation
                const cricketPhases = [0, 1.3, 2.7, 4.1];
                cricketPhases.forEach((phase, idx) => {
                    const cricketFreq = 4200 + idx * 200;
                    const rhythm = Math.sin((t + phase) * (10 + idx * 0.5));
                    const envelope = rhythm > 0.6 ? Math.pow((rhythm - 0.6) / 0.4, 2) : 0;
                    const chirp = Math.sin(2 * Math.PI * cricketFreq * t + stereoPhase);
                    sample += chirp * envelope * 0.008;
                });

                // Warm background drone
                const drone = Math.sin(2 * Math.PI * 120 * t) * 0.003;

                // Soft night air texture
                const air = (Math.random() * 2 - 1) * 0.002;

                data[i] = sample + drone + air;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 6000;

        source.connect(filter);
        filter.connect(this.ambientGain);
        source.start();
        this.ambientSources.push(source);
    },

    createAutumnAmbient() {
        const sampleRate = this.ctx.sampleRate;
        const duration = 10;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        // Pink noise state
        let b = [0, 0, 0, 0, 0, 0];

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);

            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;

                // Layered wind with slow modulation
                const windMod1 = (Math.sin(t * 0.2) + 1) * 0.5;
                const windMod2 = (Math.sin(t * 0.35 + 1) + 1) * 0.3;
                const windMod3 = (Math.sin(t * 0.08) + 1) * 0.2;
                const windEnv = windMod1 * 0.5 + windMod2 * 0.3 + windMod3 * 0.2;

                // Pink noise
                const white = Math.random() * 2 - 1;
                b[0] = 0.99886 * b[0] + white * 0.0555179;
                b[1] = 0.99332 * b[1] + white * 0.0750759;
                b[2] = 0.96900 * b[2] + white * 0.1538520;
                b[3] = 0.86650 * b[3] + white * 0.3104856;
                b[4] = 0.55000 * b[4] + white * 0.5329522;
                b[5] = -0.7616 * b[5] - white * 0.0168980;
                const pink = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + white * 0.5362) * 0.08;

                // Occasional leaf rustle
                const rustleChance = Math.random();
                const rustle = rustleChance > 0.9995 ? (Math.random() * 2 - 1) * 0.05 : 0;

                data[i] = pink * windEnv + rustle;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;

        source.connect(filter);
        filter.connect(this.ambientGain);
        source.start();
        this.ambientSources.push(source);
    },

    createWinterAmbient() {
        const sampleRate = this.ctx.sampleRate;
        const duration = 12;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);

            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;

                // Very soft, slow-breathing noise
                const breathe = (Math.sin(t * 0.1) + 1) * 0.4 + 0.2;
                const softNoise = (Math.random() * 2 - 1) * 0.003 * breathe;

                // Distant, crystalline shimmer
                const shimmerChance = Math.random();
                let shimmer = 0;
                if (shimmerChance > 0.9998) {
                    const shimmerFreq = 2000 + Math.random() * 2000;
                    shimmer = Math.sin(2 * Math.PI * shimmerFreq * t) * 0.01;
                }

                data[i] = softNoise + shimmer;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1500;

        source.connect(filter);
        filter.connect(this.ambientGain);
        source.start();
        this.ambientSources.push(source);
    },

    createSpringAmbient() {
        const sampleRate = this.ctx.sampleRate;
        const duration = 10;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            const stereoOffset = channel * 0.5;

            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                let sample = 0;

                // Soft nature bed
                sample += (Math.random() * 2 - 1) * 0.002;

                // Occasional bird calls (sparse and varied)
                if (Math.random() > 0.9997) {
                    const birdType = Math.floor(Math.random() * 3);
                    const birdLength = 600 + Math.random() * 400;

                    for (let j = 0; j < birdLength && i + j < bufferSize; j++) {
                        const bt = j / birdLength;
                        const birdEnv = Math.sin(Math.PI * bt);
                        let birdFreq;

                        if (birdType === 0) {
                            // Descending chirp
                            birdFreq = 3500 - bt * 1500;
                        } else if (birdType === 1) {
                            // Warbling
                            birdFreq = 2800 + Math.sin(bt * 20) * 400;
                        } else {
                            // Two-note call
                            birdFreq = bt < 0.5 ? 3000 : 2500;
                        }

                        const birdSound = Math.sin(2 * Math.PI * birdFreq * bt) * birdEnv * 0.02;
                        data[i + j] += birdSound;
                    }
                }

                // Gentle breeze
                const breeze = (Math.sin(t * 0.3 + stereoOffset) + 1) * 0.3;
                sample += (Math.random() * 2 - 1) * 0.001 * breeze;

                data[i] += sample;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 4000;

        source.connect(filter);
        filter.connect(this.ambientGain);
        source.start();
        this.ambientSources.push(source);
    },

    stopAmbientSoundscape() {
        this.ambientSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {}
        });
        this.ambientSources = [];
        this.isAmbientPlaying = false;
    }
};

// Sparkle particles for growth animation
function sparkleParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x,
            y: y - 20,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * -3 - 1,
            life: 40,
            size: 2 + Math.random() * 3,
            color: ['#FFD700', '#FFF8DC', '#FFFACD', '#FFE4B5'][Math.floor(Math.random() * 4)],
            isSparkle: true
        });
    }
}

// Update coin display
function updateCoins(amount) {
    currentCoins += amount;
    const coinDisplay = document.getElementById('coinCount');
    if (coinDisplay) {
        coinDisplay.textContent = currentCoins;

        // Animate coin gain (positive amounts only)
        if (amount > 0 && gardenSettings.animationsEnabled) {
            showCoinAnimation(coinDisplay, amount);
        }
    }
    // Save to storage
    chrome.storage.local.set({ coins: currentCoins });
}

// Floating coin animation when earning coins
function showCoinAnimation(element, amount) {
    const rect = element.getBoundingClientRect();
    const floater = document.createElement('div');
    floater.className = 'coin-floater';
    floater.textContent = `+${amount}`;
    floater.style.left = `${rect.left + rect.width / 2}px`;
    floater.style.top = `${rect.top}px`;
    document.body.appendChild(floater);

    // Trigger animation
    requestAnimationFrame(() => {
        floater.classList.add('animate');
    });

    // Remove after animation
    setTimeout(() => floater.remove(), 1000);
}

// Load coins from storage
async function loadCoins() {
    const result = await chrome.storage.local.get(['coins']);
    if (result.coins !== undefined) {
        currentCoins = result.coins;
        updateCoins(0); // Refresh display
    }
}

// ============================================
// Seasonal Themes
// ============================================
function getCurrentSeason() {
    // Check if user has a manual season preference
    if (gardenSettings.seasonMode && gardenSettings.seasonMode !== 'auto') {
        return gardenSettings.seasonMode;
    }
    // Auto-detect based on current month
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
}

function applySeason() {
    const season = getCurrentSeason();
    const body = document.body;

    // Remove existing season classes
    body.classList.remove('season-spring', 'season-summer', 'season-autumn', 'season-winter');

    // Apply current season (spring is default, no class needed)
    if (season !== 'spring') {
        body.classList.add(`season-${season}`);
    }

    // Season is now shown implicitly through the garden visuals
    // No separate season indicator needed in the new minimal UI
}

// ============================================
// Screenshot & Share Feature (One-Click Share Tour)
// ============================================
async function captureGardenScreenshot() {
    const bloomingCount = plants.filter(p => p.age < 0.3).length;
    const season = getCurrentSeason();
    const seasonEmoji = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' }[season];
    const gardenName = document.getElementById('gardenName')?.textContent || 'My Digital Sanctuary';

    try {
        // If blur tab titles is enabled, temporarily hide domain labels
        const originalTooltip = tooltip.style.display;
        if (shareSettings.blurTabTitles) {
            tooltip.style.display = 'none';
        }

        // Use html2canvas to capture the entire garden container
        const gardenContainer = document.getElementById('garden-container');
        const capturedCanvas = await html2canvas(gardenContainer, {
            backgroundColor: null,
            scale: 2, // Higher resolution
            logging: false
        });

        // Restore tooltip
        tooltip.style.display = originalTooltip;

        // Create final canvas with text overlay
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');

        finalCanvas.width = capturedCanvas.width;
        finalCanvas.height = capturedCanvas.height + 100;

        // Draw captured garden
        finalCtx.drawImage(capturedCanvas, 0, 0);

        // If blur tab titles, add blur overlay on domain text areas
        if (shareSettings.blurTabTitles) {
            finalCtx.filter = 'blur(8px)';
            // Blur the lower portion where text appears
            finalCtx.drawImage(capturedCanvas, 0, capturedCanvas.height * 0.7, capturedCanvas.width, capturedCanvas.height * 0.3,
                              0, capturedCanvas.height * 0.7, capturedCanvas.width, capturedCanvas.height * 0.3);
            finalCtx.filter = 'none';
        }

        // Add beautiful footer overlay
        const gradient = finalCtx.createLinearGradient(0, capturedCanvas.height, 0, finalCanvas.height);
        gradient.addColorStop(0, 'rgba(255, 249, 245, 0.95)');
        gradient.addColorStop(1, 'rgba(255, 236, 210, 0.95)');
        finalCtx.fillStyle = gradient;
        finalCtx.fillRect(0, capturedCanvas.height, finalCanvas.width, 100);

        // Main title (respect garden name setting)
        finalCtx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
        finalCtx.fillStyle = '#5D7A4A';
        finalCtx.textAlign = 'center';
        const titleText = shareSettings.includeGardenName
            ? `${gardenName} ${seasonEmoji}`
            : `My TabBloom Garden ${seasonEmoji}`;
        finalCtx.fillText(titleText, finalCanvas.width / 2, capturedCanvas.height + 40);

        // Stats line
        finalCtx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
        finalCtx.fillStyle = '#7A6B5A';
        finalCtx.fillText(
            `✨ ${currentCoins} coins  •  🌷 ${bloomingCount} blooming  •  🌿 ${plants.length} tabs`,
            finalCanvas.width / 2,
            capturedCanvas.height + 70
        );

        // Watermark
        finalCtx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        finalCtx.fillStyle = '#B8A898';
        finalCtx.fillText('tabbloom.app', finalCanvas.width / 2, capturedCanvas.height + 92);

        // Convert to blob
        const blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));

        // Try clipboard first, then download
        if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            showShareFeedback('Copied! Share away 🌱');
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tabbloom-garden-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
            showShareFeedback('Downloaded! 🌱');
        }

        AudioSystem.playHarvestChime();
    } catch (err) {
        console.error('Failed to share:', err);
        showShareFeedback('Share failed');
    }
}

function showShareFeedback(message, isError = false) {
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = `toast share-toast ${isError ? 'toast-error' : ''}`;
    toast.innerHTML = `
        <span class="toast-icon">${isError ? Icons.get('close', 16) : Icons.get('check', 16)}</span>
        <span>${message}</span>
    `;

    Toast.init();
    Toast.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Enhanced share with preview modal
function showSharePreview() {
    let modal = document.getElementById('sharePreviewModal');

    if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
        return;
    }

    const level = getGardenLevel();
    const healthyCount = plants.filter(p => p.age < 0.3).length;
    const wiltingCount = plants.filter(p => p.age >= 0.3 && p.age < 0.7).length;

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sharePreviewModal';
        modal.className = 'share-preview-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Share Garden');
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    modal.innerHTML = `
        <div class="share-preview-content">
            <div class="share-preview-header">
                <h3>Share Your Garden</h3>
                <button class="share-preview-close" aria-label="Close">${Icons.get('close', 16)}</button>
            </div>

            <div class="share-preview-canvas" id="sharePreviewCanvas">
                <div class="share-preview-placeholder">
                    ${Icons.get('camera', 32)}
                    <span>Generating preview...</span>
                </div>
            </div>

            <div class="share-preview-stats">
                <div class="share-stat">
                    <span class="share-stat-icon" style="color: ${level.color}">${Icons.get(level.icon, 16)}</span>
                    <span>Level ${level.level}</span>
                </div>
                <div class="share-stat">
                    <span class="share-stat-icon" style="color: var(--logo-green)">${Icons.get('leaf', 16)}</span>
                    <span>${healthyCount} healthy</span>
                </div>
                <div class="share-stat">
                    <span class="share-stat-icon" style="color: var(--color-coins)">${Icons.get('coin', 16)}</span>
                    <span>${currentCoins} coins</span>
                </div>
            </div>

            <div class="share-options">
                <label class="share-option">
                    <input type="checkbox" id="shareIncludeName" ${shareSettings.includeGardenName ? 'checked' : ''}>
                    <span>Include garden name</span>
                </label>
                <label class="share-option">
                    <input type="checkbox" id="shareBlurTitles" ${shareSettings.blurTabTitles ? 'checked' : ''}>
                    <span>Blur tab titles (privacy)</span>
                </label>
            </div>

            <div class="share-actions">
                <button class="btn-primary share-action-btn" id="shareCopy">
                    ${Icons.get('copy', 16)}
                    <span>Copy to Clipboard</span>
                </button>
                <button class="btn-secondary share-action-btn" id="shareDownload">
                    ${Icons.get('download', 16)}
                    <span>Download</span>
                </button>
            </div>
        </div>
    `;

    // Attach handlers
    modal.querySelector('.share-preview-close').addEventListener('click', () => modal.classList.add('hidden'));

    modal.querySelector('#shareIncludeName').addEventListener('change', (e) => {
        shareSettings.includeGardenName = e.target.checked;
        chrome.storage.local.set({ shareSettings });
        generateSharePreview();
    });

    modal.querySelector('#shareBlurTitles').addEventListener('change', (e) => {
        shareSettings.blurTabTitles = e.target.checked;
        chrome.storage.local.set({ shareSettings });
        generateSharePreview();
    });

    modal.querySelector('#shareCopy').addEventListener('click', async () => {
        await shareGardenImage('clipboard');
    });

    modal.querySelector('#shareDownload').addEventListener('click', async () => {
        await shareGardenImage('download');
    });

    modal.classList.remove('hidden');

    // Generate preview
    generateSharePreview();
}

async function generateSharePreview() {
    const previewContainer = document.getElementById('sharePreviewCanvas');
    if (!previewContainer) return;

    try {
        const canvas = await createShareCanvas();
        previewContainer.innerHTML = '';

        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.className = 'share-preview-image';
        img.alt = 'Garden preview';
        previewContainer.appendChild(img);
    } catch (err) {
        previewContainer.innerHTML = `
            <div class="share-preview-error">
                ${Icons.get('close', 24)}
                <span>Failed to generate preview</span>
            </div>
        `;
    }
}

async function createShareCanvas() {
    const season = getCurrentSeason();
    const seasonEmoji = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' }[season];
    const gardenName = document.getElementById('gardenName')?.textContent || 'My Digital Sanctuary';
    const bloomingCount = plants.filter(p => p.age < 0.3).length;
    const level = getGardenLevel();

    const gardenContainer = document.getElementById('garden-container');
    const capturedCanvas = await html2canvas(gardenContainer, {
        backgroundColor: null,
        scale: 2,
        logging: false
    });

    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');

    finalCanvas.width = capturedCanvas.width;
    finalCanvas.height = capturedCanvas.height + 120;

    // Draw captured garden
    finalCtx.drawImage(capturedCanvas, 0, 0);

    // Privacy blur
    if (shareSettings.blurTabTitles) {
        finalCtx.filter = 'blur(8px)';
        finalCtx.drawImage(capturedCanvas, 0, capturedCanvas.height * 0.7, capturedCanvas.width, capturedCanvas.height * 0.3,
                          0, capturedCanvas.height * 0.7, capturedCanvas.width, capturedCanvas.height * 0.3);
        finalCtx.filter = 'none';
    }

    // Footer gradient
    const gradient = finalCtx.createLinearGradient(0, capturedCanvas.height, 0, finalCanvas.height);
    gradient.addColorStop(0, 'rgba(255, 249, 245, 0.98)');
    gradient.addColorStop(1, 'rgba(255, 236, 210, 0.98)');
    finalCtx.fillStyle = gradient;
    finalCtx.fillRect(0, capturedCanvas.height, finalCanvas.width, 120);

    // Title
    finalCtx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    finalCtx.fillStyle = '#5D7A4A';
    finalCtx.textAlign = 'center';
    const titleText = shareSettings.includeGardenName
        ? `${gardenName} ${seasonEmoji}`
        : `My TabBloom Garden ${seasonEmoji}`;
    finalCtx.fillText(titleText, finalCanvas.width / 2, capturedCanvas.height + 40);

    // Stats line with level
    finalCtx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    finalCtx.fillStyle = '#7A6B5A';
    finalCtx.fillText(
        `Level ${level.level} ${level.name}  •  ${bloomingCount} blooming  •  ${currentCoins} coins`,
        finalCanvas.width / 2,
        capturedCanvas.height + 68
    );

    // Plant count
    finalCtx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    finalCtx.fillStyle = '#9A8A7A';
    finalCtx.fillText(`${plants.length} tabs in garden`, finalCanvas.width / 2, capturedCanvas.height + 90);

    // Watermark
    finalCtx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    finalCtx.fillStyle = '#B8A898';
    finalCtx.fillText('TabBloom', finalCanvas.width / 2, capturedCanvas.height + 112);

    return finalCanvas;
}

async function shareGardenImage(mode) {
    const modal = document.getElementById('sharePreviewModal');

    try {
        const canvas = await createShareCanvas();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        if (mode === 'clipboard' && navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            showShareFeedback('Copied to clipboard!');
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tabbloom-garden-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
            showShareFeedback('Downloaded!');
        }

        modal?.classList.add('hidden');
        AudioSystem.playHarvestChime();
    } catch (err) {
        console.error('Share failed:', err);
        showShareFeedback('Share failed', true);
    }
}

// ============================================
// Onboarding (First-time Experience)
// ============================================
async function checkOnboarding() {
    const result = await chrome.storage.local.get(['hasSeenOnboarding']);

    if (!result.hasSeenOnboarding) {
        showOnboarding();
    }
}

function showOnboarding() {
    const overlay = document.getElementById('onboarding');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function hideOnboarding() {
    const overlay = document.getElementById('onboarding');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    chrome.storage.local.set({ hasSeenOnboarding: true });
}

function setupOnboarding() {
    const closeBtn = document.getElementById('onboardingClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideOnboarding();
            AudioSystem.playGrowthRustle();
        });
    }
}

// Configuration - Warmer, cozier color palette
const COLORS = {
    petalPink: '#FFB7C5',
    petalWhite: '#FFF5F7',
    petalDeep: '#E891A5',
    petalSunset: '#FFCBA4',
    stamen: '#8B5A2B',
    anther: '#DEB887',
    stem: '#5D7A4A',        // Warmer green
    stemDark: '#4A6339',
    leaf: '#7BA05B',        // Warmer, more yellow-green
    leafDark: '#5D7A4A',
    leafHighlight: '#98BF6A',
    wilted: '#C4A574',
    wiltedPetal: '#D4C4A8',
    text: '#3D3226',        // Warm brown text
    shadow: 'rgba(62, 45, 35, 0.15)', // Warm shadow

    // Sunset gradient colors
    skyTop: '#7BA4D4',      // Soft blue
    skyMid: '#F8C9A8',      // Peachy orange
    skyBottom: '#FFE4D6',   // Warm cream
    sunGlow: '#FFD89B',     // Golden glow

    // Light pool colors
    warmLight: 'rgba(255, 236, 210, 0.4)',
    pinkLight: 'rgba(255, 183, 197, 0.25)',
};

// ============================================
// Background Rendering (Sunset Gradient + Effects)
// ============================================
function drawBackground() {
    // Main sunset gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(0.3, COLORS.skyMid);
    skyGradient.addColorStop(0.6, COLORS.skyBottom);
    skyGradient.addColorStop(1, '#FFF9F5');

    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);

    // Soft sun glow (upper area)
    const sunX = width * 0.7;
    const sunY = height * 0.15;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, height * 0.5);
    sunGlow.addColorStop(0, 'rgba(255, 216, 155, 0.6)');
    sunGlow.addColorStop(0.3, 'rgba(255, 200, 150, 0.3)');
    sunGlow.addColorStop(0.6, 'rgba(255, 180, 130, 0.1)');
    sunGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height);

    // Warm light pools scattered around
    drawLightPools();

    // Soft vignette
    drawVignette();

    // Subtle grid pattern (garden bed feel)
    drawGardenGrid();
}

function drawLightPools() {
    // Create 2-3 warm light pools
    const pools = [
        { x: width * 0.2, y: height * 0.6, radius: width * 0.4, color: COLORS.warmLight },
        { x: width * 0.8, y: height * 0.4, radius: width * 0.35, color: COLORS.pinkLight },
        { x: width * 0.5, y: height * 0.8, radius: width * 0.5, color: 'rgba(255, 240, 220, 0.3)' },
    ];

    pools.forEach(pool => {
        const gradient = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pool.radius);
        gradient.addColorStop(0, pool.color);
        gradient.addColorStop(0.5, pool.color.replace(/[\d.]+\)$/, '0.1)'));
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawVignette() {
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.2,
        width / 2, height / 2, Math.max(width, height) * 0.8
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.7, 'transparent');
    gradient.addColorStop(1, 'rgba(62, 45, 35, 0.15)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function drawGardenGrid() {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#7BA05B';
    ctx.lineWidth = 1;

    const gridSize = 25;

    // Only draw in lower portion (garden bed area)
    const startY = height * 0.3;

    for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.restore();
}

// Draw soft shadow under a plant
function drawPlantShadow(x, y, scale = 1) {
    ctx.save();

    const shadowWidth = 35 * scale;
    const shadowHeight = 12 * scale;

    const gradient = ctx.createRadialGradient(x, y + 45, 0, x, y + 45, shadowWidth);
    gradient.addColorStop(0, 'rgba(62, 45, 35, 0.2)');
    gradient.addColorStop(0.5, 'rgba(62, 45, 35, 0.1)');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y + 45, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Grid layout settings - larger plants with more breathing room
const PLANT_SIZE = 80;
const PLANT_HEIGHT = 110;
const SPACING = 110;
const SCALE = 1.4;

// Create interactive DOM element overlay for a plant
function createPlantElement(tab, x, y, plantIndex = 0) {
    const plant = document.createElement('div');
    plant.className = 'plant';
    plant.style.left = `${x - PLANT_SIZE / 2}px`;
    plant.style.top = `${y - PLANT_HEIGHT / 2}px`;
    plant.style.width = `${PLANT_SIZE}px`;
    plant.style.height = `${PLANT_HEIGHT}px`;
    plant.style.zIndex = '10';
    plant.style.transformOrigin = 'center bottom';

    // Set plant index for staggered breathing animation
    plant.style.setProperty('--plant-index', plantIndex);

    // Add checkbox for selection mode
    const checkbox = document.createElement('div');
    checkbox.className = 'plant-checkbox';
    checkbox.innerHTML = Icons.get('check', 14);
    plant.appendChild(checkbox);

    plant.addEventListener('mouseenter', () => {
        AudioSystem.playHoverSoft(tab.id); // Pass plant ID to prevent repeated sounds
        // Apply magical hover animation with warm glow
        plant.style.animation = 'magicalPulse 1.5s infinite ease-in-out';
        plant.style.transform = 'scale(1.4) rotate(5deg) translateY(-12px)';
        plant.style.filter = 'drop-shadow(0 0 25px rgba(255, 220, 150, 0.8)) drop-shadow(0 0 15px rgba(255, 183, 197, 0.6)) brightness(1.15)';
        plant.style.zIndex = '100';
        // Show tooltip with warm styling
        tooltip.style.left = `${x + 20}px`;
        tooltip.style.top = `${y - 70}px`;
        tooltip.innerHTML = `<strong style="color: #5D7A4A;">${tab.title}</strong><br><span style="font-size:10px; color: #7A6B5A;">${new URL(tab.url).hostname}</span>`;
        tooltip.classList.remove('hidden');
    });

    plant.addEventListener('mouseleave', () => {
        // Restore gentle breathing animation
        plant.style.animation = 'gentleBreathe 10s infinite ease-in-out, gentleSway 14s infinite ease-in-out';
        plant.style.transform = '';
        plant.style.filter = '';
        plant.style.zIndex = '10';
        tooltip.classList.add('hidden');
    });

    plant.addEventListener('click', async () => {
        // If in selection mode, toggle selection instead of harvesting
        if (selectionMode) {
            const plantObj = plants.find(p => p.tabId === tab.id);
            if (plantObj) {
                togglePlantSelection(plantObj);
            }
            return;
        }

        // Normal click behavior - show plant detail modal
        const plantObj = plants.find(p => p.tabId === tab.id);
        if (plantObj) {
            showPlantDetail(plantObj);
        }
    });

    document.getElementById('garden-container').appendChild(plant);
    return plant;
}

// Canvas-based particle burst effect when harvesting
function bloomParticles(x, y, count = 40) {
    // Main petal burst
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 3 + Math.random() * 5;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 4, // bias upward
            life: 70 + Math.random() * 40,
            size: 4 + Math.random() * 7,
            color: [COLORS.petalPink, COLORS.petalWhite, COLORS.petalSunset, COLORS.leaf, '#FFD89B'][Math.floor(Math.random() * 5)],
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }

    // Golden sparkle trail
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * -3 - 2,
            life: 50 + Math.random() * 30,
            size: 2 + Math.random() * 4,
            color: ['#FFD700', '#FFF8DC', '#FFE4B5', '#FFFFFF'][Math.floor(Math.random() * 4)],
            isSparkle: true
        });
    }
}

// Calculate required canvas height based on plant count
function calculateRequiredHeight(containerHeight, containerWidth) {
    if (plants.length === 0) return containerHeight;

    const cols = Math.max(1, Math.floor(containerWidth / SPACING));
    const rows = Math.ceil(plants.length / cols);
    const PADDING_TOP = 60;  // Space at top for visual breathing room
    const PADDING_BOTTOM = 80; // Space at bottom

    const requiredHeight = PADDING_TOP + (rows * SPACING) + PADDING_BOTTOM;
    return Math.max(containerHeight, requiredHeight);
}

// Set canvas to fill the container responsively (with dynamic height for scrolling)
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    width = containerWidth;
    height = calculateRequiredHeight(containerHeight, containerWidth);

    canvas.width = width;
    canvas.height = height;
    layoutPlants();

    // Reinitialize ambient effects for new dimensions
    if (plants.length > 0) {
        initAmbientEffects();
    }
}

window.addEventListener('resize', resizeCanvas);

// Scroll hint visibility - show when more content is below
const gardenContainerEl = document.getElementById('garden-container');
const scrollHint = document.getElementById('scroll-hint');

function updateScrollHint() {
    if (!gardenContainerEl || !scrollHint) return;

    const { scrollTop, scrollHeight, clientHeight } = gardenContainerEl;
    const isScrollable = scrollHeight > clientHeight;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20;

    if (isScrollable && !isAtBottom) {
        scrollHint.classList.add('visible');
    } else {
        scrollHint.classList.remove('visible');
    }
}

gardenContainerEl?.addEventListener('scroll', updateScrollHint);
// Initial check after layout
setTimeout(updateScrollHint, 500);

// Canvas mouse tracking for hover effects
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Track hovered plant for canvas rendering effects only
    // (DOM plant elements handle cursor and tooltip via their own mouseenter/mouseleave)
    hoveredPlant = null;
    plants.forEach(p => {
        if (Math.hypot(mouseX - p.x, mouseY - p.y) < 40) {
            hoveredPlant = p;
        }
    });
});

canvas.addEventListener('mouseleave', () => {
    hoveredPlant = null;
});

// ============================================
// Keyboard Navigation (Accessibility)
// ============================================
let focusedPlantIndex = -1;

// ============================================
// Global Keyboard Shortcuts
// ============================================
const KEYBOARD_SHORTCUTS = {
    'h': { action: 'harvestAll', description: 'Harvest all wilting tabs', modifier: false },
    's': { action: 'toggleSearch', description: 'Focus search', modifier: false },
    'r': { action: 'refresh', description: 'Refresh garden', modifier: false },
    'm': { action: 'toggleSelectMode', description: 'Toggle select mode', modifier: false },
    '1': { action: 'filterAll', description: 'Show all tabs', modifier: false },
    '2': { action: 'filterHealthy', description: 'Show healthy tabs', modifier: false },
    '3': { action: 'filterWilting', description: 'Show wilting tabs', modifier: false },
    '?': { action: 'showShortcuts', description: 'Show keyboard shortcuts', modifier: false },
    'Escape': { action: 'escape', description: 'Close dialogs/exit modes', modifier: false },
};

function executeShortcut(action) {
    switch (action) {
        case 'harvestAll':
            const harvestBtn = document.getElementById('harvestAll');
            if (harvestBtn && !harvestBtn.disabled) {
                harvestBtn.click();
            }
            break;
        case 'toggleSearch':
            const searchToggle = document.getElementById('searchToggle');
            const searchContainer = document.querySelector('.filter-search-container');
            const searchInput = document.getElementById('filterSearch');
            if (searchContainer?.classList.contains('expanded')) {
                searchInput?.focus();
            } else {
                searchToggle?.click();
            }
            break;
        case 'refresh':
            refreshGarden();
            break;
        case 'toggleSelectMode':
            const selectModeToggle = document.getElementById('selectModeToggle');
            selectModeToggle?.click();
            break;
        case 'filterAll':
            setFilter('all');
            break;
        case 'filterHealthy':
            setFilter('healthy');
            break;
        case 'filterWilting':
            setFilter('wilting');
            break;
        case 'showShortcuts':
            showKeyboardShortcutsModal();
            break;
        case 'escape':
            handleEscapeKey();
            break;
    }
}

function setFilter(filter) {
    const filterBtn = document.querySelector(`.filter-segment[data-filter="${filter}"]`);
    if (filterBtn) {
        filterBtn.click();
    }
}

function handleEscapeKey() {
    // Priority order for escape handling
    const plantDetail = document.getElementById('plantDetailOverlay');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const searchContainer = document.querySelector('.filter-search-container');

    if (plantDetail?.classList.contains('visible')) {
        hidePlantDetail();
    } else if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
        shortcutsModal.classList.add('hidden');
    } else if (selectionMode) {
        exitSelectionMode();
    } else if (searchContainer?.classList.contains('expanded')) {
        const searchInput = document.getElementById('filterSearch');
        if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
        searchContainer.classList.remove('expanded');
        document.getElementById('searchToggle')?.setAttribute('aria-expanded', 'false');
    } else {
        focusedPlantIndex = -1;
        clearPlantFocus();
    }
}

function showKeyboardShortcutsModal() {
    let modal = document.getElementById('shortcutsModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shortcutsModal';
        modal.className = 'shortcuts-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Keyboard shortcuts');

        const shortcuts = Object.entries(KEYBOARD_SHORTCUTS)
            .filter(([key]) => key !== 'Escape')
            .map(([key, { description }]) => `
                <div class="shortcut-row">
                    <kbd class="shortcut-key">${key === '?' ? 'Shift + /' : key}</kbd>
                    <span class="shortcut-desc">${description}</span>
                </div>
            `).join('');

        modal.innerHTML = `
            <div class="shortcuts-modal-content">
                <div class="shortcuts-modal-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button class="shortcuts-close" aria-label="Close">${Icons.get('close', 16)}</button>
                </div>
                <div class="shortcuts-list">
                    ${shortcuts}
                    <div class="shortcut-row">
                        <kbd class="shortcut-key">Arrow keys</kbd>
                        <span class="shortcut-desc">Navigate plants</span>
                    </div>
                    <div class="shortcut-row">
                        <kbd class="shortcut-key">Enter</kbd>
                        <span class="shortcut-desc">Harvest focused plant</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        modal.querySelector('.shortcuts-close').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }

    modal.classList.remove('hidden');
    AudioSystem.playHoverSoft();
}

document.addEventListener('keydown', (e) => {
    // Don't handle shortcuts when typing in input fields
    const activeEl = document.activeElement;
    const isInputField = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;

    // Always allow Escape
    if (e.key === 'Escape') {
        e.preventDefault();
        executeShortcut('escape');
        return;
    }

    // Skip shortcuts when typing (except Escape)
    if (isInputField) {
        return;
    }

    // Check for global shortcuts
    const key = e.key.toLowerCase();
    const shortcut = KEYBOARD_SHORTCUTS[e.key] || KEYBOARD_SHORTCUTS[key];

    if (shortcut && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        executeShortcut(shortcut.action);
        return;
    }

    // Plant navigation shortcuts (arrows)
    const gardenContainer = document.getElementById('garden-container');
    if (!gardenContainer) return;

    if (plants.length === 0) return;

    switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            e.preventDefault();
            focusedPlantIndex = (focusedPlantIndex + 1) % plants.length;
            focusPlant(focusedPlantIndex);
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            e.preventDefault();
            focusedPlantIndex = focusedPlantIndex <= 0 ? plants.length - 1 : focusedPlantIndex - 1;
            focusPlant(focusedPlantIndex);
            break;
        case 'Enter':
        case ' ':
            e.preventDefault();
            if (focusedPlantIndex >= 0 && focusedPlantIndex < plants.length) {
                if (selectionMode) {
                    togglePlantSelection(plants[focusedPlantIndex]);
                } else {
                    harvestPlantByIndex(focusedPlantIndex);
                }
            }
            break;
    }
});

function focusPlant(index) {
    if (index < 0 || index >= plants.length) return;

    const plant = plants[index];
    hoveredPlant = plant;

    // Visual focus indicator
    clearPlantFocus();
    if (plant.element) {
        plant.element.classList.add('keyboard-focused');
        plant.element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Play gentle audio feedback
    AudioSystem.playHoverSoft(plant.tabId);

    // Update tooltip
    showTooltip(plant);
}

function clearPlantFocus() {
    document.querySelectorAll('.plant.keyboard-focused').forEach(el => {
        el.classList.remove('keyboard-focused');
    });
    hoveredPlant = null;
    tooltip.classList.add('hidden');
}

async function harvestPlantByIndex(index) {
    if (index < 0 || index >= plants.length) return;

    const plant = plants[index];
    bloomParticles(plant.x, plant.y, 30);
    AudioSystem.playHarvestChime();

    try {
        await chrome.tabs.remove(plant.tab.id);
        if (plant.element) plant.element.remove();
        plants = plants.filter(p => p !== plant);
        layoutPlants();
        updateCoins(gardenSettings.harvestCoins);
        recordHarvest(1, gardenSettings.harvestCoins);
        updateStatsDisplay();

        // Adjust focus index
        focusedPlantIndex = Math.min(focusedPlantIndex, plants.length - 1);
        if (plants.length > 0 && focusedPlantIndex >= 0) {
            focusPlant(focusedPlantIndex);
        }
    } catch (err) {
        console.error("Failed to close tab:", err);
    }
}

function showTooltip(plant) {
    const gardenContainer = document.getElementById('garden-container');
    if (!gardenContainer) return;

    tooltip.innerHTML = `
        <strong style="color: var(--text-primary);">${plant.tab.title || 'Untitled'}</strong><br>
        <span style="color: var(--text-secondary); font-size: 11px;">${plant.getFriendlyName()}</span>
    `;
    tooltip.style.left = `${Math.min(plant.x + 20, gardenContainer.offsetWidth - 200)}px`;
    tooltip.style.top = `${plant.y - 60}px`;
    tooltip.classList.remove('hidden');
}

// Canvas click handler - show plant detail modal
canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Find closest plant
    let closestPlant = null;
    let minDist = Infinity;
    plants.forEach(plant => {
        const dist = Math.hypot(clickX - plant.x, clickY - plant.y);
        if (dist < 50 + 30 && dist < minDist) { // generous hit area
            minDist = dist;
            closestPlant = plant;
        }
    });

    if (closestPlant) {
        // Visual feedback
        if (closestPlant.element) {
            closestPlant.element.style.transform = 'scale(1.1)';
            closestPlant.element.style.transition = 'transform 0.15s ease-out';
            setTimeout(() => {
                if (closestPlant.element) {
                    closestPlant.element.style.transform = '';
                }
            }, 150);
        }

        AudioSystem.playHoverSoft(closestPlant.tabId);

        // Show plant detail modal
        showPlantDetail(closestPlant);
    }
});

// Calculate centered grid positions for all plants
function layoutPlants() {
    if (plants.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();

    const cols = Math.max(1, Math.floor(width / SPACING));
    const rows = Math.ceil(plants.length / cols);

    // Center horizontally, but flow from top down for scrolling
    const gridWidth = Math.min(plants.length, cols) * SPACING;
    const startX = (width - gridWidth) / 2 + SPACING / 2;
    const PADDING_TOP = 60; // Match the padding in calculateRequiredHeight
    const startY = PADDING_TOP + SPACING / 2;

    plants.forEach((plant, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        plant.x = startX + col * SPACING;
        plant.y = startY + row * SPACING;

        // Update DOM element position if it exists
        if (plant.element) {
            plant.element.style.left = `${plant.x - PLANT_SIZE / 2}px`;
            plant.element.style.top = `${plant.y - PLANT_HEIGHT / 2}px`;
        }
    });

    // Trigger canvas resize if plant count changed significantly
    const container = canvas.parentElement;
    const requiredHeight = calculateRequiredHeight(container.clientHeight, container.clientWidth);
    if (Math.abs(canvas.height - requiredHeight) > SPACING) {
        canvas.height = requiredHeight;
        height = requiredHeight;
    }

    // Update scroll hint after layout changes
    setTimeout(updateScrollHint, 100);
}

// Calculate plant health based on time since last activity
// Returns 0-1 where 0 is fresh/blooming and 1 is completely wilted
function calculateHealthFromActivity(lastActiveTime) {
    const now = Date.now();
    const hoursSinceActive = (now - lastActiveTime) / (1000 * 60 * 60);

    if (hoursSinceActive < 1) {
        // < 1 hour: full bloom
        return 0;
    } else if (hoursSinceActive < 24) {
        // 1-24 hours: gradual fade (0.1 to 0.5)
        return 0.1 + (hoursSinceActive / 24) * 0.4;
    } else if (hoursSinceActive < 72) {
        // 24-72 hours: more wilted (0.5 to 0.7)
        return 0.5 + ((hoursSinceActive - 24) / 48) * 0.2;
    } else {
        // 72+ hours: fully wilted (0.7 to 1.0)
        const daysOver3 = (hoursSinceActive - 72) / 24;
        return Math.min(1, 0.7 + daysOver3 * 0.1);
    }
}

// Flower variety - 8 types with different colors and shapes for domain categories
const FLOWER_TYPES = {
    // Social Media - Coral/Pink roses (warm, social, expressive)
    rose: {
        name: 'rose',
        category: 'social',
        petalCount: 8,
        petalShape: 'round',
        colors: { bloom: '#FF6B8A', accent: '#FF4D6D', center: '#FFE066' }
    },
    // Dev Tools - Blue/Purple iris (technical, precise)
    iris: {
        name: 'iris',
        category: 'dev',
        petalCount: 6,
        petalShape: 'curved',
        colors: { bloom: '#7C83FD', accent: '#5C64FC', center: '#B8BBFF' }
    },
    // AI/Chat - Iridescent orchid (futuristic, intelligent)
    orchid: {
        name: 'orchid',
        category: 'ai',
        petalCount: 5,
        petalShape: 'curved',
        colors: { bloom: '#A78BFA', accent: '#8B5CF6', center: '#C4B5FD' },
        gradient: true // Special iridescent effect
    },
    // Google Services - Multi-color tulip (brand colors)
    tulip: {
        name: 'tulip',
        category: 'google',
        petalCount: 4,
        petalShape: 'cup',
        colors: { bloom: '#4285F4', accent: '#34A853', center: '#FBBC04' }
    },
    // Media/Entertainment - Orange/Red dahlia (vibrant, energetic)
    dahlia: {
        name: 'dahlia',
        category: 'media',
        petalCount: 10,
        petalShape: 'thin',
        colors: { bloom: '#FF6B35', accent: '#F7931A', center: '#FFD93D' }
    },
    // Shopping - Gold/Amber marigold (commerce, value)
    marigold: {
        name: 'marigold',
        category: 'shopping',
        petalCount: 12,
        petalShape: 'round',
        colors: { bloom: '#FFB347', accent: '#FF8C00', center: '#8B4513' }
    },
    // Work/Productivity - Teal lily (professional, calm)
    lily: {
        name: 'lily',
        category: 'work',
        petalCount: 6,
        petalShape: 'curved',
        colors: { bloom: '#00B894', accent: '#00A085', center: '#FFD700' }
    },
    // Default/Other - Clean white daisy (neutral, versatile)
    daisy: {
        name: 'daisy',
        category: 'other',
        petalCount: 10,
        petalShape: 'thin',
        colors: { bloom: '#F8F9FA', accent: '#E9ECEF', center: '#FFD700' }
    }
};

// Domain to friendly name mapping for smart labels
const DOMAIN_FRIENDLY_NAMES = {
    // AI/Chat
    'chatgpt.com': 'ChatGPT',
    'chat.openai.com': 'ChatGPT',
    'claude.ai': 'Claude',
    'gemini.google.com': 'Gemini',
    'grok.com': 'Grok',
    'x.com/i/grok': 'Grok',
    'perplexity.ai': 'Perplexity',
    'poe.com': 'Poe',
    'character.ai': 'Character',
    'you.com': 'You.com',
    'copilot.microsoft.com': 'Copilot',

    // Social
    'twitter.com': 'Twitter',
    'x.com': 'Twitter',
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'linkedin.com': 'LinkedIn',
    'reddit.com': 'Reddit',
    'discord.com': 'Discord',
    'tiktok.com': 'TikTok',
    'threads.net': 'Threads',

    // Dev Tools
    'github.com': 'GitHub',
    'gitlab.com': 'GitLab',
    'stackoverflow.com': 'Stack Overflow',
    'vercel.com': 'Vercel',
    'netlify.com': 'Netlify',
    'railway.app': 'Railway',
    'replit.com': 'Replit',
    'codepen.io': 'CodePen',
    'codesandbox.io': 'CodeSandbox',
    'npmjs.com': 'npm',
    'localhost': 'Localhost',

    // Google
    'google.com': 'Google',
    'mail.google.com': 'Gmail',
    'drive.google.com': 'Drive',
    'docs.google.com': 'Docs',
    'sheets.google.com': 'Sheets',
    'calendar.google.com': 'Calendar',
    'meet.google.com': 'Meet',
    'photos.google.com': 'Photos',

    // Work
    'slack.com': 'Slack',
    'notion.so': 'Notion',
    'figma.com': 'Figma',
    'linear.app': 'Linear',
    'asana.com': 'Asana',
    'trello.com': 'Trello',
    'airtable.com': 'Airtable',
    'miro.com': 'Miro',
    'zoom.us': 'Zoom',

    // Media
    'youtube.com': 'YouTube',
    'netflix.com': 'Netflix',
    'spotify.com': 'Spotify',
    'twitch.tv': 'Twitch',
    'hulu.com': 'Hulu',
    'disneyplus.com': 'Disney+',
    'primevideo.com': 'Prime Video',
    'soundcloud.com': 'SoundCloud',

    // Shopping
    'amazon.com': 'Amazon',
    'ebay.com': 'eBay',
    'etsy.com': 'Etsy',
    'shopify.com': 'Shopify',
    'walmart.com': 'Walmart',
    'target.com': 'Target',

    // News
    'news.ycombinator.com': 'Hacker News',
    'medium.com': 'Medium',
    'substack.com': 'Substack',
    'nytimes.com': 'NY Times',
    'bbc.com': 'BBC',
    'cnn.com': 'CNN',
    'theverge.com': 'The Verge',
    'techcrunch.com': 'TechCrunch',
    'wired.com': 'Wired'
};

// Domain categories for flower assignment (expanded)
function getFlowerTypeForUrl(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');

        // AI/Chat Tools → Orchid (iridescent, futuristic)
        if (/chatgpt|openai|claude\.ai|anthropic|gemini\.google|bard\.google|grok|perplexity|character\.ai|poe\.com|copilot|you\.com/i.test(hostname)) {
            return FLOWER_TYPES.orchid;
        }

        // Dev Tools → Iris (blue/purple, technical)
        if (/github|gitlab|stackoverflow|vercel|netlify|railway|replit|codepen|codesandbox|npmjs|localhost|127\.0\.0|\.local$/i.test(hostname)) {
            return FLOWER_TYPES.iris;
        }

        // Google Services → Tulip (brand colors)
        if (/google\.com|gmail|gdocs|gsheets|gcalendar|youtube\.com/i.test(hostname) && !/gemini/i.test(hostname)) {
            return FLOWER_TYPES.tulip;
        }

        // Social Media → Rose (coral/pink, social)
        if (/facebook|twitter|x\.com|instagram|tiktok|reddit|discord|linkedin|threads|mastodon/i.test(hostname)) {
            return FLOWER_TYPES.rose;
        }

        // Media/Entertainment → Dahlia (orange/red, vibrant)
        if (/netflix|spotify|twitch|hulu|disney|primevideo|soundcloud|vimeo|dailymotion/i.test(hostname)) {
            return FLOWER_TYPES.dahlia;
        }

        // Shopping → Marigold (gold, commerce)
        if (/amazon|ebay|etsy|shopify|walmart|target|aliexpress|wish\.com/i.test(hostname)) {
            return FLOWER_TYPES.marigold;
        }

        // Work/Productivity → Lily (teal, professional)
        if (/slack|notion|figma|linear|asana|trello|airtable|miro|zoom|teams|jira|confluence|basecamp/i.test(hostname)) {
            return FLOWER_TYPES.lily;
        }

        // Default → Daisy (neutral, clean)
        return FLOWER_TYPES.daisy;
    } catch {
        return FLOWER_TYPES.daisy;
    }
}

// Get friendly display name for a domain
function getFriendlyDomainName(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');

        // Check exact match first
        if (DOMAIN_FRIENDLY_NAMES[hostname]) {
            return DOMAIN_FRIENDLY_NAMES[hostname];
        }

        // Check subdomain matches (e.g., mail.google.com)
        const fullPath = hostname + urlObj.pathname;
        for (const [domain, name] of Object.entries(DOMAIN_FRIENDLY_NAMES)) {
            if (fullPath.startsWith(domain)) {
                return name;
            }
        }

        // Fallback: clean up the hostname
        // Remove common TLDs and format nicely
        let cleanName = hostname
            .replace(/\.(com|org|net|io|co|app|dev|ai)$/, '')
            .split('.').pop(); // Get last part before TLD

        // Capitalize first letter
        cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

        // Truncate if too long
        if (cleanName.length > 12) {
            cleanName = cleanName.slice(0, 10) + '...';
        }

        return cleanName;
    } catch {
        return 'Tab';
    }
}

class Plant {
    constructor(tab, lastActiveTime) {
        this.tabId = tab.id;
        this.tab = tab; // Store full tab reference
        this.title = tab.title;
        this.url = tab.url;

        // Assign flower type based on domain
        this.flowerType = getFlowerTypeForUrl(tab.url || '');
        this.x = 0;
        this.y = 0;
        this.element = null; // DOM element reference
        this.lastActiveTime = lastActiveTime || Date.now();
        this.age = calculateHealthFromActivity(this.lastActiveTime);
        this.previousAge = this.age; // Track for animations
        this.sway = Math.random() * Math.PI * 2; // Random start phase
        this.swaySpeed = 0.008 + Math.random() * 0.01; // Subtle, restrained sway

        // Growth animation state
        this.growthScale = 1;
        this.growthTarget = 1;

        // Organic variation - each plant is slightly different
        this.scaleVariation = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
        this.offsetX = (Math.random() - 0.5) * 25; // Random position offset
        this.offsetY = (Math.random() - 0.5) * 15;
        this.rotationOffset = (Math.random() - 0.5) * 0.1; // Slight lean

        // Pre-generate random values for consistent rendering
        this.spotOffsets = Array(6).fill(0).map(() => (Math.random() - 0.5) * 0.6);
        this.spotSizes = Array(6).fill(0).map(() => 0.8 + Math.random() * 0.5);
        this.stamenLengths = Array(6).fill(0).map(() => 6 + Math.random() * 2);

        // Extra visual flair
        this.hasButterfly = Math.random() < 0.1; // 10% chance to attract a butterfly
        this.glowIntensity = 0;
        this.targetGlow = 0;

        // Load favicon for flower center display
        this.faviconUrl = tab.favIconUrl || null;
        if (this.faviconUrl) {
            loadFavicon(this.faviconUrl);
        }
    }

    // Calculate recency scale - recently active tabs appear larger
    getRecencyScale() {
        const now = Date.now();
        const timeSinceActive = now - this.lastActiveTime;
        const oneHour = 60 * 60 * 1000;
        const fourHours = 4 * oneHour;

        if (timeSinceActive < oneHour) {
            // Very recent (< 1 hour): 1.15x - 1.25x scale
            const freshness = 1 - (timeSinceActive / oneHour);
            return 1.15 + freshness * 0.1;
        } else if (timeSinceActive < fourHours) {
            // Recent (1-4 hours): 1.0x - 1.15x scale
            const freshness = 1 - ((timeSinceActive - oneHour) / (fourHours - oneHour));
            return 1.0 + freshness * 0.15;
        } else if (this.age >= 0.5) {
            // Wilting: 0.85x - 0.95x scale (slightly smaller)
            return 0.85 + (1 - this.age) * 0.1;
        }
        // Normal: 1.0x
        return 1.0;
    }

    // Get friendly display name for this tab's domain
    getFriendlyName() {
        return getFriendlyDomainName(this.url || '');
    }

    // Update health based on current time, with animation triggers
    updateHealth() {
        const newAge = calculateHealthFromActivity(this.lastActiveTime);

        // Check for growth (tab was used, health improved)
        if (newAge < this.previousAge - 0.1) {
            this.triggerGrowthAnimation();
            AudioSystem.playGrowthRustle();

            // Track "saved from wilting" - tab was at risk (>50% wilted) and recovered
            if (this.previousAge >= 0.5) {
                recordTabSaved();
            }
        }

        // Check for wilting transition
        if (newAge >= 0.7 && this.previousAge < 0.7) {
            AudioSystem.playWiltDroop();
        }

        this.previousAge = this.age;
        this.age = newAge;
    }

    // Trigger growth animation (upward stretch + sparkles)
    triggerGrowthAnimation() {
        this.growthTarget = 1.15;
        sparkleParticles(this.x, this.y);

        // Return to normal after animation
        setTimeout(() => {
            this.growthTarget = 1;
        }, 300);
    }

    update() {
        this.sway += this.swaySpeed;

        // Smooth growth animation
        this.growthScale += (this.growthTarget - this.growthScale) * 0.1;

        // Smooth glow transition
        this.glowIntensity += (this.targetGlow - this.glowIntensity) * 0.15;
    }

    draw() {
        const swayOffset = Math.sin(this.sway) * 2; // Subtle sway
        const isHovered = this === hoveredPlant;
        const isWilted = this.age >= 0.7;

        // Update glow target based on hover
        this.targetGlow = isHovered ? 1 : 0;

        // Draw shadow first (before plant)
        drawPlantShadow(this.x + this.offsetX, this.y + this.offsetY, this.scaleVariation);

        ctx.save();
        ctx.translate(this.x + this.offsetX, this.y + this.offsetY);

        // Apply slight rotation for organic feel
        ctx.rotate(this.rotationOffset);

        // Apply growth animation scale with individual variation AND recency scaling
        const recencyScale = this.getRecencyScale();
        const baseScale = SCALE * this.growthScale * this.scaleVariation * recencyScale;

        // Apply hover effects with warm golden glow
        if (isHovered || this.glowIntensity > 0.01) {
            const glowAmount = this.glowIntensity;
            const hoverScale = 1 + glowAmount * 0.2; // Scale up to 1.2x

            ctx.scale(baseScale * hoverScale, baseScale * hoverScale);

            // Warm golden glow (layered for richness)
            ctx.shadowColor = `rgba(255, 200, 120, ${0.8 * glowAmount})`;
            ctx.shadowBlur = 25 * glowAmount;

            // Draw outer glow halo
            if (glowAmount > 0.1) {
                ctx.save();
                const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
                glowGradient.addColorStop(0, `rgba(255, 220, 150, ${0.4 * glowAmount})`);
                glowGradient.addColorStop(0.5, `rgba(255, 183, 197, ${0.2 * glowAmount})`);
                glowGradient.addColorStop(1, 'transparent');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(0, 0, 50, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        } else {
            ctx.scale(baseScale, baseScale);
        }

        // Draw elegant curved stem
        ctx.strokeStyle = COLORS.stem;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 35);
        ctx.quadraticCurveTo(swayOffset * 0.5, 20, swayOffset, 5);
        ctx.stroke();

        // Draw leaves on stem
        this.drawLeaf(ctx, swayOffset * 0.3, 25, -0.4, 8);
        this.drawLeaf(ctx, swayOffset * 0.5, 18, 0.5, 7);

        // Position flower head
        ctx.translate(swayOffset, isWilted ? 8 : 0);

        if (isWilted) {
            // Wilted lily - drooping petals
            ctx.rotate(0.3);
            this.drawWiltedLily(ctx);
        } else {
            // Beautiful blooming oriental lily
            this.drawOrientalLily(ctx);
        }

        ctx.restore();

        // Draw centered domain name below the flower (using smart friendly names)
        try {
            const text = this.getFriendlyName();
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            const fontSize = Math.min(13, canvas.width / 32); // slightly smaller for cleaner look
            ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillStyle = '#FFFFFF'; // Brand white
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const textY = this.y + 58;
            const maxWidth = 85;

            // With friendly names, text should usually fit - but handle overflow gracefully
            if (ctx.measureText(text).width > maxWidth) {
                const parts = text.split('.');
                let line1 = '';
                let line2 = '';
                parts.forEach((part, i) => {
                    const segment = i < parts.length - 1 ? part + '.' : part;
                    if (ctx.measureText(line1 + segment).width < maxWidth) {
                        line1 += segment;
                    } else {
                        line2 += segment;
                    }
                });
                ctx.fillText(line1.trim(), this.x, textY);
                if (line2) {
                    ctx.fillText(line2.trim(), this.x, textY + 16);
                }
            } else {
                ctx.fillText(text, this.x, textY);
            }

            ctx.restore();
        } catch (e) {
            // Skip text for invalid URLs
        }
    }

    // Draw a single elegant lily leaf
    drawLeaf(ctx, x, y, angle, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Leaf shape
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.3, -size * 0.4, size, -size * 0.1);
        ctx.quadraticCurveTo(size * 0.3, size * 0.2, 0, 0);
        ctx.fillStyle = COLORS.leaf;
        ctx.fill();

        // Leaf vein
        ctx.strokeStyle = COLORS.leafDark;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.3, -size * 0.1, size * 0.8, -size * 0.05);
        ctx.stroke();

        ctx.restore();
    }

    // Draw the beautiful oriental lily bloom
    drawOrientalLily(ctx) {
        const petalCount = 6;
        const petalLength = 14;
        const petalWidth = 5;

        // Draw back petals first (3 petals)
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2 / 3) - Math.PI / 2;
            this.drawLilyPetal(ctx, angle, petalLength, petalWidth, true, i);
        }

        // Draw front petals (3 petals, offset)
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2 / 3) - Math.PI / 2 + Math.PI / 3;
            this.drawLilyPetal(ctx, angle, petalLength * 0.95, petalWidth * 0.9, false, i + 3);
        }

        // Draw stamens
        this.drawStamens(ctx);

        // Draw center - either favicon or colored pistil
        this.drawFlowerCenter(ctx);
    }

    // Draw flower center with optional favicon
    drawFlowerCenter(ctx) {
        const centerRadius = 5;
        const faviconImg = this.faviconUrl ? faviconCache.get(this.faviconUrl) : null;

        if (faviconImg && faviconImg.complete && faviconImg.naturalWidth > 0) {
            // Draw circular favicon in center
            ctx.save();

            // Create circular clip
            ctx.beginPath();
            ctx.arc(0, -1, centerRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // Draw favicon centered
            const size = centerRadius * 2;
            ctx.drawImage(faviconImg, -centerRadius, -1 - centerRadius, size, size);

            ctx.restore();

            // Draw subtle border around favicon
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(0, -1, centerRadius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Fallback: draw colored center pistil
            const centerColor = this.flowerType?.colors?.center || COLORS.anther;
            ctx.fillStyle = centerColor;
            ctx.beginPath();
            ctx.arc(0, -2, 3, 0, Math.PI * 2);
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(-0.5, -2.5, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw a single recurved lily petal with gradient and spots
    drawLilyPetal(ctx, angle, length, width, isBack, petalIndex) {
        ctx.save();
        ctx.rotate(angle);

        // Use flower type colors
        const bloomColor = this.flowerType?.colors?.bloom || COLORS.petalPink;
        const accentColor = this.flowerType?.colors?.accent || COLORS.petalDeep;

        // Create petal gradient with flower-specific colors
        const gradient = ctx.createLinearGradient(0, 0, 0, -length);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(0.3, bloomColor);
        gradient.addColorStop(0.7, COLORS.petalWhite);
        gradient.addColorStop(1, isBack ? bloomColor : COLORS.petalWhite);

        // Draw recurved petal shape
        ctx.beginPath();
        ctx.moveTo(0, 0);

        // Left edge with elegant curve
        ctx.bezierCurveTo(
            -width * 0.8, -length * 0.3,
            -width * 1.2, -length * 0.7,
            -width * 0.3, -length
        );

        // Petal tip curves back (recurved)
        ctx.quadraticCurveTo(0, -length * 1.1, width * 0.3, -length);

        // Right edge
        ctx.bezierCurveTo(
            width * 1.2, -length * 0.7,
            width * 0.8, -length * 0.3,
            0, 0
        );

        ctx.fillStyle = gradient;
        ctx.fill();

        // Petal outline for definition
        ctx.strokeStyle = 'rgba(233, 145, 165, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Add characteristic spots (using pre-generated values)
        if (!isBack) {
            ctx.fillStyle = 'rgba(180, 80, 100, 0.4)';
            for (let i = 0; i < 3; i++) {
                const spotY = -length * (0.3 + i * 0.15);
                const spotX = this.spotOffsets[petalIndex + i] * width;
                ctx.beginPath();
                ctx.arc(spotX, spotY, this.spotSizes[petalIndex + i], 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Center vein
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.quadraticCurveTo(0, -length * 0.6, 0, -length * 0.85);
        ctx.stroke();

        ctx.restore();
    }

    // Draw stamens with anthers
    drawStamens(ctx) {
        const stamenCount = this.flowerType?.petalCount || 6;
        const centerColor = this.flowerType?.colors?.center || COLORS.anther;

        for (let i = 0; i < Math.min(stamenCount, 6); i++) {
            const angle = (i * Math.PI * 2 / stamenCount) + Math.PI / 6;
            const length = this.stamenLengths[i] || 7; // Use pre-generated length

            ctx.save();
            ctx.rotate(angle);

            // Stamen filament
            ctx.strokeStyle = COLORS.petalWhite;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(0, -length);
            ctx.stroke();

            // Anther (pollen holder) with flower-specific center color
            ctx.fillStyle = centerColor;
            ctx.beginPath();
            ctx.ellipse(0, -length - 1.5, 1, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    // Draw wilted lily with drooping petals
    drawWiltedLily(ctx) {
        const petalCount = 6;

        for (let i = 0; i < petalCount; i++) {
            const angle = (i * Math.PI * 2 / petalCount) - Math.PI / 2;
            ctx.save();
            ctx.rotate(angle);

            // Drooping, curled petal
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-3, 4, -5, 10, -2, 14);
            ctx.quadraticCurveTo(0, 15, 2, 14);
            ctx.bezierCurveTo(5, 10, 3, 4, 0, 0);

            const gradient = ctx.createLinearGradient(0, 0, 0, 14);
            gradient.addColorStop(0, COLORS.wilted);
            gradient.addColorStop(1, COLORS.wiltedPetal);
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.restore();
        }

        // Dried center
        ctx.fillStyle = COLORS.wilted;
        ctx.beginPath();
        ctx.arc(0, 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================
// Real-time Tab Listeners
// ============================================
function setupTabListeners() {
    // When a new tab is created
    chrome.tabs.onCreated.addListener((tab) => {
        // Create new plant for the tab
        const newPlant = new Plant(tab, Date.now());
        plants.push(newPlant);
        layoutPlants();
        newPlant.element = createPlantElement(tab, newPlant.x, newPlant.y, plants.length - 1);
        updateStatsDisplay();

        // Play a soft growth sound
        AudioSystem.playGrowthRustle();

        // Add sparkle effect for new plant
        sparkleParticles(newPlant.x, newPlant.y);
    });

    // When a tab is closed (externally, not via harvest)
    chrome.tabs.onRemoved.addListener((tabId) => {
        const plantIndex = plants.findIndex(p => p.tabId === tabId);
        if (plantIndex !== -1) {
            const plant = plants[plantIndex];
            // Remove DOM element
            if (plant.element) {
                plant.element.remove();
            }
            // Remove from array
            plants.splice(plantIndex, 1);
            layoutPlants();
            updateStatsDisplay();
        }
    });

    // When a tab is updated (URL change, title change)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            const plant = plants.find(p => p.tabId === tabId);
            if (plant) {
                // Update plant info
                plant.tab = tab;
                plant.title = tab.title;
                plant.url = tab.url;
                plant.lastActiveTime = Date.now();
                plant.age = 0; // Reset to blooming since it's active
            }
        }
    });

    // When a tab becomes active
    chrome.tabs.onActivated.addListener((activeInfo) => {
        const plant = plants.find(p => p.tabId === activeInfo.tabId);
        if (plant) {
            plant.lastActiveTime = Date.now();
            // Trigger growth animation
            plant.triggerGrowthAnimation();
        }
    });
}

// Load user settings from storage (sync for cross-device persistence)
async function loadGardenSettings() {
    try {
        const result = await chrome.storage.sync.get(['tabbloomSettings']);
        if (result.tabbloomSettings) {
            gardenSettings = { ...gardenSettings, ...result.tabbloomSettings };
        }
        // Apply garden name
        const nameEl = document.getElementById('gardenName');
        if (nameEl && gardenSettings.gardenName) {
            nameEl.textContent = gardenSettings.gardenName;
        }
        // Apply animation setting
        if (!gardenSettings.animationsEnabled) {
            document.documentElement.style.setProperty('--animation-state', 'paused');
        }
    } catch (err) {
        // Using default settings
    }
}

async function initGarden() {
    // Show loading state immediately
    showLoadingState();

    try {
        // Load user settings first
        await loadGardenSettings();

        // Apply seasonal theme
        applySeason();

        // Load saved coins
        await loadCoins();

        // Load tab activity data with error handling
        const activityResult = await safeAsync(
            () => chrome.storage.local.get(['tabActivity']),
            { tabActivity: {} },
            'loading tab activity'
        );
        const tabActivity = activityResult?.tabActivity || {};

        // Query tabs with error handling
        const tabs = await safeAsync(
            () => chrome.tabs.query({}),
            [],
            'querying tabs'
        );

        if (!tabs || tabs.length === 0) {
            console.warn('No tabs found or query failed');
        }

        plants = tabs.map(tab => {
            const lastActiveTime = tabActivity[tab.id] || Date.now();
            return new Plant(tab, lastActiveTime);
        });
        layoutPlants();

        // Create DOM overlay elements for each plant with staggered animation
        plants.forEach((plant, index) => {
            plant.element = createPlantElement(plant.tab, plant.x, plant.y, index);
        });
    } catch (error) {
        console.error('Failed to initialize garden plants:', error);
        initializationError = error;
    }

    // Set up Harvest button
    const harvestBtn = document.getElementById('harvestAll');
    if (harvestBtn) {
        harvestBtn.addEventListener('click', harvestDormantTabs);
    }

    // Set up Settings button (opens options page)
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }

    // Set up Quick Actions mini-bar
    setupQuickActions();

    // Set up filter and batch selection systems
    setupFilterSystem();
    setupBatchSelection();

    // Load garden stats for tracking
    await loadGardenStats();

    // Load achievements
    await loadAchievements();
    checkAchievements();

    // Set up onboarding
    setupOnboarding();
    await checkOnboarding();

    // Initialize ambient effects (fireflies, butterflies)
    initAmbientEffects();

    // Initialize dark mode
    updateDarkMode();

    // Set up real-time tab listeners
    setupTabListeners();

    // Load share settings
    await loadShareSettings();

    // Show welcome tooltip for first-time users
    await showWelcomeTooltip();

    // Update plant health every 10 seconds
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(updateAllPlantHealth, 10000);

    // Initial stats display
    updateStatsDisplay();

    // Mark initialization complete
    isInitialized = true;

    // Hide loading state with slight delay for smooth transition
    setTimeout(() => hideLoadingState(), 100);

    // Start Game Loop
    animationFrameId = requestAnimationFrame(loop);

    // Pause animations when panel is hidden to save CPU
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            // Also pause health checks to reduce background CPU
            if (healthCheckInterval) {
                clearInterval(healthCheckInterval);
                healthCheckInterval = null;
            }
        } else {
            animationFrameId = requestAnimationFrame(loop);
            // Resume health checks
            if (!healthCheckInterval) {
                healthCheckInterval = setInterval(updateAllPlantHealth, 10000);
            }
        }
    });

    // Schedule periodic memory cleanup
    setInterval(scheduleCleanup, 60000); // Every minute

    // Log successful initialization
    console.log('TabBloom garden initialized successfully', {
        plants: plants.length,
        season: getCurrentSeason(),
        level: getGardenLevel()?.name
    });
}

// Periodically update all plant health based on activity
async function updateAllPlantHealth() {
    // Reload activity data in case it changed (with error handling)
    const activityResult = await safeAsync(
        () => chrome.storage.local.get(['tabActivity']),
        { tabActivity: {} },
        'loading activity data'
    );
    const tabActivity = activityResult?.tabActivity || {};

    plants.forEach(plant => {
        // Update last active time if it changed
        if (tabActivity[plant.tabId]) {
            plant.lastActiveTime = tabActivity[plant.tabId];
        }
        plant.updateHealth();
    });

    // Update stats display (debounced to prevent excessive DOM updates)
    updateStatsDisplayDebounced();
}

// Debounced version of stats display update
const updateStatsDisplayDebounced = debounce(updateStatsDisplay, 200);

// Update the stats display in header and footer
function updateStatsDisplay() {
    const healthyCount = plants.filter(p => p.age < 0.3).length;
    const wiltingCount = plants.filter(p => p.age >= 0.3 && p.age < 0.7).length;
    const dormantCount = plants.filter(p => p.age >= 0.7).length;
    const harvestableCount = wiltingCount + dormantCount;

    // Update stat pills in compact header
    const healthyCountEl = document.getElementById('healthyCount');
    const wiltingCountEl = document.getElementById('wiltingCount');
    const streakCountEl = document.getElementById('streakCount');
    const streakStat = document.getElementById('streakStat');
    const subtitleEl = document.getElementById('gardenSubtitle');
    const weeklyStatsEl = document.getElementById('weeklyStats');

    if (healthyCountEl) healthyCountEl.textContent = healthyCount;
    if (wiltingCountEl) wiltingCountEl.textContent = harvestableCount;
    if (streakCountEl) streakCountEl.textContent = gardenStats.currentStreak || 0;
    if (subtitleEl) subtitleEl.textContent = `${plants.length} plants`;
    if (weeklyStatsEl) weeklyStatsEl.textContent = `${healthyCount} healthy, ${harvestableCount} wilting`;

    // Hide streak if zero
    if (streakStat) {
        streakStat.setAttribute('data-value', gardenStats.currentStreak || 0);
    }

    // Update dynamic CTA
    updateDynamicCTA();
}

// Harvest all wilting and dormant tabs
async function harvestDormantTabs() {
    // Now harvest both wilting (age >= 0.3) and dormant (age >= 0.7) tabs
    const harvestPlants = plants.filter(p => p.age >= 0.3);

    if (harvestPlants.length === 0) {
        Toast.show('All plants are healthy!', 'info');
        return;
    }

    let harvestedCount = 0;
    const harvestedTabs = [];

    // Play harvest chime once for batch
    AudioSystem.playHarvestChime();

    for (const plant of harvestPlants) {
        try {
            // Store tab info for undo
            harvestedTabs.push({
                url: plant.tab.url,
                title: plant.tab.title,
                favIconUrl: plant.tab.favIconUrl
            });
            await chrome.tabs.remove(plant.tabId);
            bloomParticles(plant.x, plant.y);
            if (plant.element) {
                plant.element.remove();
            }
            harvestedCount++;
            // Small delay between harvests for satisfying cascade
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            console.error("Failed to close tab:", err);
        }
    }

    // Remove harvested plants from array (keep only healthy)
    plants = plants.filter(p => p.age < 0.3);
    layoutPlants();

    // Award coins for batch harvest (bonus for efficiency!)
    const coinsEarned = harvestedCount * gardenSettings.harvestCoins;
    updateCoins(coinsEarned);

    // Record stats for lifetime tracking
    recordHarvest(harvestedCount, coinsEarned);

    // Update stats and filter counts
    updateStatsDisplay();
    updateFilterCounts();

    // Celebration time! Confetti + happy chime + undo toast
    if (harvestedCount > 0) {
        AudioSystem.playHarvestAllCelebration();
        showUndoToast(harvestedTabs, coinsEarned);

        // Trigger confetti burst (garden colors)
        if (gardenSettings.confettiEnabled && typeof confetti === 'function') {
            confetti({
                particleCount: 80 + harvestedCount * 10,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#00B894', '#FFD60A', '#007AFF', '#5856D6', '#FF9500']
            });
        }
    }
}

// Set up Quick Actions mini-bar
function setupQuickActions() {
    const quickStats = document.getElementById('quickStats');
    const quickRefresh = document.getElementById('quickRefresh');
    const quickShare = document.getElementById('quickShare');

    if (quickStats) {
        quickStats.addEventListener('click', () => {
            AudioSystem.playHoverSoft();
            showGardenStats();
        });
    }

    if (quickRefresh) {
        quickRefresh.addEventListener('click', async () => {
            AudioSystem.playGrowthRustle();
            // Re-fetch tabs and refresh garden
            const activityResult = await chrome.storage.local.get(['tabActivity']);
            const tabActivity = activityResult.tabActivity || {};

            const tabs = await chrome.tabs.query({});
            plants.forEach(p => {
                if (p.element) p.element.remove();
            });

            plants = tabs.map(tab => {
                const lastActiveTime = tabActivity[tab.id] || Date.now();
                return new Plant(tab, lastActiveTime);
            });
            layoutPlants();

            plants.forEach((plant, index) => {
                plant.element = createPlantElement(plant.tab, plant.x, plant.y, index);
            });

            updateStatsDisplay();

            // Visual feedback - brief sparkle
            sparkleParticles(width / 2, height / 2);
        });
    }

    if (quickShare) {
        quickShare.addEventListener('click', () => {
            AudioSystem.playHoverSoft();
            showSharePreview();
        });
    }
}

function loop(timestamp) {
    // Safety check - don't run if not initialized
    if (!isInitialized && !canvas) {
        console.warn('Loop called before initialization complete');
        return;
    }

    // FPS throttling
    const frameInterval = getFrameInterval();
    if (timestamp - lastFrameTime < frameInterval) {
        animationFrameId = requestAnimationFrame(loop);
        return;
    }
    lastFrameTime = timestamp;

    frameCount++;

    // Periodic cleanup every 500 frames (~8 seconds at 60fps)
    if (frameCount % 500 === 0) {
        scheduleCleanup();
    }

    // Minimal mode: skip all decorative effects
    const isMinimal = gardenSettings.minimalMode;
    const perfMode = gardenSettings.performanceMode;
    const showParticles = !isMinimal && (perfMode === 'full' || perfMode === 'balanced');
    const showButterflies = !isMinimal && perfMode === 'full';

    // Draw beautiful background (sunset gradient, light pools, vignette)
    drawBackground();

    // Summer: Draw pulsing sun rays (skip in lite mode)
    if (showParticles && getCurrentSeason() === 'summer') {
        drawSunRays(ctx);
    }

    // Draw soft clouds drifting across sky (skip in lite mode)
    if (showParticles) {
        clouds.forEach(cloud => {
            cloud.update();
            cloud.draw(ctx);
        });
    }

    // Draw ambient particles (fireflies) behind plants (skip in lite/balanced)
    if (showButterflies) {
        ambientParticles.forEach(particle => {
            particle.update();
            particle.draw(ctx);
        });
    }

    // Draw butterflies behind plants (full mode only)
    if (showButterflies) {
        butterflies.forEach(butterfly => {
            butterfly.update();
            butterfly.draw(ctx);
        });
    }

    // Draw seasonal particles (autumn leaves, winter snowflakes)
    if (showParticles) {
        seasonalParticles.forEach(particle => {
            particle.update();
            particle.draw(ctx);
        });
    }

    // Draw plants (respect maxVisiblePlants)
    const maxPlants = gardenSettings.maxVisiblePlants || plants.length;
    const visiblePlants = maxPlants > 0 ? plants.slice(0, maxPlants) : plants;
    visiblePlants.forEach(plant => {
        plant.update();
        plant.draw();
    });

    // Update and draw burst particles (on top of everything)
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.isSparkle ? 0.02 : 0.1; // gentler gravity for floatier feel
        p.vx *= 0.99; // gentle air resistance
        p.life--;

        // Update rotation if present
        if (p.rotation !== undefined) {
            p.rotation += p.rotationSpeed || 0;
        }

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        const maxLife = p.isSparkle ? 80 : 110;
        ctx.globalAlpha = p.isSparkle ? p.life / maxLife : Math.pow(p.life / maxLife, 1.3);

        if (p.isSparkle) {
            // Twinkling sparkle effect with glow
            const twinkle = Math.sin(p.life * 0.5) * 0.5 + 0.5;
            ctx.globalAlpha *= twinkle;

            // Add warm glow to sparkles
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;

            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * twinkle, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
        } else {
            // Petal particles with rotation and soft glow
            ctx.save();
            ctx.translate(p.x, p.y);
            if (p.rotation !== undefined) {
                ctx.rotate(p.rotation);
            }

            // Add subtle glow
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 5;

            ctx.fillStyle = p.color;

            // Draw as petal shape
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 0.5, p.size, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Optional: Draw scanline overlay for pixel-art feel (subtle)
    if (window.enableScanlines) {
        drawScanlines();
    }

    animationFrameId = requestAnimationFrame(loop);
}

// Subtle scanline effect for retro pixel-art feel
function drawScanlines() {
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#000';

    for (let y = 0; y < height; y += 3) {
        ctx.fillRect(0, y, width, 1);
    }

    ctx.restore();
}

// Initialize ambient particles, butterflies, and clouds
function initAmbientEffects() {
    const season = getCurrentSeason();

    // Create fireflies/sparkles
    const particleCount = Math.floor((width * height) / 15000);
    ambientParticles = [];
    for (let i = 0; i < Math.max(15, particleCount); i++) {
        ambientParticles.push(new AmbientParticle());
    }

    // Create butterflies - more in spring!
    const baseButterflyCount = Math.min(4, Math.max(2, Math.floor(plants.length / 5)));
    const butterflyCount = season === 'spring' ? baseButterflyCount + 3 :
                           season === 'summer' ? baseButterflyCount + 1 :
                           season === 'winter' ? 0 : baseButterflyCount;
    butterflies = [];
    for (let i = 0; i < butterflyCount; i++) {
        butterflies.push(new Butterfly());
    }

    // Create soft drifting clouds
    const cloudCount = season === 'winter' ? 5 : 3 + Math.floor(Math.random() * 3);
    clouds = [];
    for (let i = 0; i < cloudCount; i++) {
        clouds.push(new Cloud());
    }

    // Create seasonal particles
    seasonalParticles = [];
    if (season === 'autumn') {
        // Falling orange leaves
        const leafCount = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < leafCount; i++) {
            seasonalParticles.push(new AutumnLeaf());
        }
    } else if (season === 'winter') {
        // Soft snowflakes
        const snowCount = 30 + Math.floor(Math.random() * 20);
        for (let i = 0; i < snowCount; i++) {
            seasonalParticles.push(new Snowflake());
        }
    }

    // Start ambient soundscape (user interaction required for audio)
    document.addEventListener('click', function startAmbient() {
        AudioSystem.startAmbientSoundscape(season);
        document.removeEventListener('click', startAmbient);
    }, { once: true });
}

// ============================================
// Dark Mode Auto-Detection
// ============================================
let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

function updateDarkMode() {
    isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Update color palette for dark mode
    if (isDarkMode) {
        COLORS.skyTop = '#1a1a2e';
        COLORS.skyMid = '#2d2d44';
        COLORS.skyBottom = '#3d3d5c';
        COLORS.text = '#e0e0e0';
        COLORS.shadow = 'rgba(0, 0, 0, 0.4)';
    } else {
        COLORS.skyTop = '#7BA4D4';
        COLORS.skyMid = '#F8C9A8';
        COLORS.skyBottom = '#FFE4D6';
        COLORS.text = '#3D3226';
        COLORS.shadow = 'rgba(62, 45, 35, 0.15)';
    }
}

// Listen for dark mode changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateDarkMode);

// ============================================
// First-Install Welcome Tooltip
// ============================================
async function showWelcomeTooltip() {
    const result = await chrome.storage.local.get(['hasSeenWelcome']);

    if (!result.hasSeenWelcome) {
        // Create welcome tooltip container
        const welcomeTip = document.createElement('div');
        welcomeTip.id = 'welcome-tooltip';
        welcomeTip.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(255,249,245,0.98), rgba(255,236,210,0.98));
            padding: 16px 24px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            z-index: 10000;
            text-align: center;
            max-width: 280px;
            animation: floatIn 0.5s ease-out;
            pointer-events: auto;
        `;

        // Create content
        const icon = document.createElement('div');
        icon.style.cssText = 'font-size: 24px; margin-bottom: 8px;';
        icon.textContent = '🌱';

        const title = document.createElement('div');
        title.style.cssText = 'color: #5D7A4A; font-weight: 600; margin-bottom: 4px;';
        title.textContent = 'Welcome to your sanctuary!';

        const desc = document.createElement('div');
        desc.style.cssText = 'color: #7A6B5A; font-size: 12px; line-height: 1.4;';
        desc.innerHTML = 'Your tabs are seeds — nurture them by visiting!<br>Click any flower to harvest.';

        const button = document.createElement('button');
        button.style.cssText = `
            margin-top: 12px;
            background: #5D7A4A;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 12px;
            pointer-events: auto;
        `;
        button.textContent = 'Got it!';

        // Add click handler properly (not inline)
        button.addEventListener('click', () => {
            welcomeTip.remove();
            chrome.storage.local.set({ hasSeenWelcome: true });
        });

        // Assemble tooltip
        welcomeTip.appendChild(icon);
        welcomeTip.appendChild(title);
        welcomeTip.appendChild(desc);
        welcomeTip.appendChild(button);

        document.body.appendChild(welcomeTip);

        // Add float animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatIn {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================
// Garden Leveling System
// ============================================
const GARDEN_LEVELS = [
    { level: 1, name: 'Seedling', coinsRequired: 0, icon: 'seedling', color: '#8B9A6B' },
    { level: 2, name: 'Sprout', coinsRequired: 100, icon: 'leaf', color: '#6B8E4E' },
    { level: 3, name: 'Budding', coinsRequired: 250, icon: 'flower', color: '#4A7C3F' },
    { level: 4, name: 'Blooming', coinsRequired: 500, icon: 'flower', color: '#00B894' },
    { level: 5, name: 'Flourishing', coinsRequired: 1000, icon: 'star', color: '#00D9A5' },
    { level: 6, name: 'Master Gardener', coinsRequired: 2500, icon: 'trophy', color: '#FFD700' }
];

// Get current garden level based on total coins earned
function getGardenLevel() {
    const totalCoins = gardenStats.coinsEarned || 0;
    let currentLevel = GARDEN_LEVELS[0];

    for (const level of GARDEN_LEVELS) {
        if (totalCoins >= level.coinsRequired) {
            currentLevel = level;
        } else {
            break;
        }
    }

    return currentLevel;
}

// Get progress to next level (0-1)
function getLevelProgress() {
    const totalCoins = gardenStats.coinsEarned || 0;
    const currentLevel = getGardenLevel();
    const currentLevelIndex = GARDEN_LEVELS.findIndex(l => l.level === currentLevel.level);
    const nextLevel = GARDEN_LEVELS[currentLevelIndex + 1];

    if (!nextLevel) {
        return 1; // Max level reached
    }

    const coinsInCurrentLevel = totalCoins - currentLevel.coinsRequired;
    const coinsNeededForNext = nextLevel.coinsRequired - currentLevel.coinsRequired;

    return Math.min(1, coinsInCurrentLevel / coinsNeededForNext);
}

// Get coins needed for next level
function getCoinsToNextLevel() {
    const totalCoins = gardenStats.coinsEarned || 0;
    const currentLevel = getGardenLevel();
    const currentLevelIndex = GARDEN_LEVELS.findIndex(l => l.level === currentLevel.level);
    const nextLevel = GARDEN_LEVELS[currentLevelIndex + 1];

    if (!nextLevel) {
        return 0; // Max level
    }

    return nextLevel.coinsRequired - totalCoins;
}

// Check for level up and trigger celebration
let previousLevel = null;

function checkLevelUp() {
    const currentLevel = getGardenLevel();

    if (previousLevel && currentLevel.level > previousLevel.level) {
        // Level up!
        celebrateLevelUp(currentLevel);
    }

    previousLevel = currentLevel;
    updateLevelDisplay();
}

// Celebrate level up with toast and confetti
function celebrateLevelUp(newLevel) {
    // Play celebration sound
    AudioSystem.playHarvestAllCelebration();

    // Show level-up toast
    const toast = document.createElement('div');
    toast.className = 'toast level-up-toast';
    toast.innerHTML = `
        <div class="level-up-icon" aria-hidden="true">
            ${Icons.get(newLevel.icon, 28)}
        </div>
        <div class="level-up-content">
            <span class="level-up-label">Level Up!</span>
            <strong class="level-up-name">${newLevel.name}</strong>
        </div>
    `;

    Toast.init();
    Toast.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);

    // Confetti burst
    if (gardenSettings.confettiEnabled && typeof confetti === 'function') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: [newLevel.color, '#FFD700', '#00B894', '#FFFFFF']
        });
    }
}

// Update level display in UI
function updateLevelDisplay() {
    const level = getGardenLevel();
    const progress = getLevelProgress();
    const coinsToNext = getCoinsToNextLevel();

    // Update level indicator in header (if exists)
    const levelIndicator = document.getElementById('levelIndicator');
    const levelProgress = document.getElementById('levelProgress');
    const levelText = document.getElementById('levelText');
    const levelNum = document.getElementById('levelNum');
    const levelIcon = document.getElementById('levelIcon');
    const levelBadge = document.querySelector('.level-badge');

    if (levelIndicator) {
        levelIndicator.style.setProperty('--level-color', level.color);
        levelIndicator.setAttribute('data-level', level.level);
        levelIndicator.title = `Level ${level.level}: ${level.name}`;
    }

    if (levelBadge) {
        levelBadge.style.backgroundColor = level.color;
    }

    if (levelNum) {
        levelNum.textContent = level.level;
    }

    if (levelIcon && typeof Icons !== 'undefined') {
        Icons.insert(levelIcon, level.icon, 12);
    }

    if (levelProgress) {
        levelProgress.style.width = `${progress * 100}%`;
        levelProgress.style.backgroundColor = level.color;
    }

    if (levelText) {
        if (coinsToNext > 0) {
            const nextLevelName = GARDEN_LEVELS.find(l => l.level === level.level + 1)?.name || 'Max';
            levelText.textContent = `${coinsToNext} to ${nextLevelName}`;
        } else {
            levelText.textContent = '✨ Max Level';
        }
    }
}

// ============================================
// Streak Rewards System
// ============================================
const STREAK_REWARDS = [
    { days: 7, coins: 50, name: 'Weekly Bloom' },
    { days: 14, coins: 100, name: 'Fortnight Flora' },
    { days: 30, coins: 250, name: 'Monthly Master' }
];

function checkStreakRewards() {
    const streak = gardenStats.currentStreak || 0;
    const claimedRewards = gardenStats.claimedStreakRewards || [];

    for (const reward of STREAK_REWARDS) {
        if (streak >= reward.days && !claimedRewards.includes(reward.days)) {
            // Award streak bonus
            grantStreakReward(reward);
            gardenStats.claimedStreakRewards = [...claimedRewards, reward.days];
            saveGardenStats();
        }
    }
}

function grantStreakReward(reward) {
    // Add coins
    updateCoins(reward.coins);
    gardenStats.coinsEarned += reward.coins;

    // Show reward toast
    Toast.show(`🔥 ${reward.name}! +${reward.coins} coins for ${reward.days}-day streak`, 'success', 4000);

    // Confetti
    if (gardenSettings.confettiEnabled && typeof confetti === 'function') {
        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#FF9500', '#FFD700', '#FF6B35']
        });
    }

    checkLevelUp();
}

// ============================================
// Garden Stats (Lifetime Tracking)
// ============================================
let gardenStats = {
    totalHarvested: 0,
    coinsEarned: 0,
    gardenCreated: Date.now(),
    seasonVisits: { spring: 0, summer: 0, autumn: 0, winter: 0 },
    longestStreak: 0,
    currentStreak: 0,
    lastVisit: Date.now(),
    tabsSavedFromWilting: 0,
    claimedStreakRewards: []
};

async function loadGardenStats() {
    const result = await chrome.storage.local.get(['gardenStats']);
    if (result.gardenStats) {
        gardenStats = { ...gardenStats, ...result.gardenStats };
    }

    // Initialize level tracking
    previousLevel = getGardenLevel();

    // Update season visit
    const season = getCurrentSeason();
    gardenStats.seasonVisits[season] = (gardenStats.seasonVisits[season] || 0) + 1;

    // Check streak
    const now = Date.now();
    const daysSinceLastVisit = (now - gardenStats.lastVisit) / (1000 * 60 * 60 * 24);
    if (daysSinceLastVisit < 2) {
        gardenStats.currentStreak++;
        if (gardenStats.currentStreak > gardenStats.longestStreak) {
            gardenStats.longestStreak = gardenStats.currentStreak;
        }
    } else if (daysSinceLastVisit >= 2) {
        // Streak broken - reset claimed rewards for re-earning
        gardenStats.currentStreak = 1;
        gardenStats.claimedStreakRewards = [];
    }
    gardenStats.lastVisit = now;

    saveGardenStats();

    // Check for streak rewards after a delay (so UI is loaded)
    setTimeout(() => {
        checkStreakRewards();
        updateLevelDisplay();
    }, 1000);
}

function saveGardenStats() {
    chrome.storage.local.set({ gardenStats });
}

// ============================================
// Achievement System
// ============================================
const ACHIEVEMENTS = [
    // Harvest achievements
    { id: 'first_harvest', name: 'First Bloom', description: 'Harvest your first wilted tab', icon: 'seedling', check: () => gardenStats.totalHarvested >= 1 },
    { id: 'harvester_10', name: 'Green Thumb', description: 'Harvest 10 tabs', icon: 'leaf', check: () => gardenStats.totalHarvested >= 10 },
    { id: 'harvester_50', name: 'Master Gardener', description: 'Harvest 50 tabs', icon: 'flower', check: () => gardenStats.totalHarvested >= 50 },
    { id: 'harvester_100', name: 'Tab Whisperer', description: 'Harvest 100 tabs', icon: 'trophy', check: () => gardenStats.totalHarvested >= 100 },

    // Coin achievements
    { id: 'coins_100', name: 'Penny Saver', description: 'Earn 100 coins', icon: 'coin', check: () => gardenStats.coinsEarned >= 100 },
    { id: 'coins_500', name: 'Coin Collector', description: 'Earn 500 coins', icon: 'coin', check: () => gardenStats.coinsEarned >= 500 },
    { id: 'coins_1000', name: 'Rich Gardener', description: 'Earn 1000 coins', icon: 'star', check: () => gardenStats.coinsEarned >= 1000 },

    // Streak achievements
    { id: 'streak_3', name: 'Regular Visitor', description: 'Maintain a 3-day streak', icon: 'fire', check: () => gardenStats.longestStreak >= 3 },
    { id: 'streak_7', name: 'Weekly Warrior', description: 'Maintain a 7-day streak', icon: 'fire', check: () => gardenStats.longestStreak >= 7 },
    { id: 'streak_30', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: 'fire', check: () => gardenStats.longestStreak >= 30 },

    // Activity achievements
    { id: 'saver_10', name: 'Tab Saver', description: 'Save 10 tabs from wilting', icon: 'heart', check: () => (gardenStats.tabsSavedFromWilting || 0) >= 10 },
];

let unlockedAchievements = new Set();

async function loadAchievements() {
    const result = await chrome.storage.local.get(['achievements']);
    if (result.achievements) {
        unlockedAchievements = new Set(result.achievements);
    }
}

function saveAchievements() {
    chrome.storage.local.set({ achievements: [...unlockedAchievements] });
}

function checkAchievements() {
    let newlyUnlocked = [];

    for (const achievement of ACHIEVEMENTS) {
        if (!unlockedAchievements.has(achievement.id) && achievement.check()) {
            unlockedAchievements.add(achievement.id);
            newlyUnlocked.push(achievement);
        }
    }

    if (newlyUnlocked.length > 0) {
        saveAchievements();
        // Show notification for first new achievement
        showAchievementUnlocked(newlyUnlocked[0]);
    }

    return newlyUnlocked;
}

function showAchievementUnlocked(achievement) {
    Toast.init();
    const toast = document.createElement('div');
    toast.className = 'toast achievement-toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <span class="achievement-badge" aria-hidden="true">${Icons.get(achievement.icon, 20)}</span>
        <div class="achievement-content">
            <span class="achievement-label">Achievement Unlocked!</span>
            <strong class="achievement-name">${achievement.name}</strong>
        </div>
    `;
    Toast.container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getAchievementProgress() {
    return {
        unlocked: unlockedAchievements.size,
        total: ACHIEVEMENTS.length,
        achievements: ACHIEVEMENTS.map(a => ({
            ...a,
            unlocked: unlockedAchievements.has(a.id)
        }))
    };
}

// Harvest milestones for celebrations
const HARVEST_MILESTONES = [
    { count: 1, title: 'First Harvest!', message: 'You harvested your first wilted tab. Your garden journey begins!' },
    { count: 10, title: 'Green Thumb', message: '10 tabs harvested! You\'re getting the hang of this.' },
    { count: 25, title: 'Garden Keeper', message: '25 tabs harvested! Your garden is flourishing.' },
    { count: 50, title: 'Master Gardener', message: '50 tabs harvested! You\'re a true garden master.' },
    { count: 100, title: 'Tab Whisperer', message: '100 tabs harvested! Legendary status achieved.' },
    { count: 250, title: 'Digital Botanist', message: '250 tabs harvested! Your dedication is inspiring.' },
    { count: 500, title: 'Garden Legend', message: '500 tabs harvested! A true legend walks among us.' }
];

function recordHarvest(count = 1, coins = 10) {
    const previousTotal = gardenStats.totalHarvested;
    gardenStats.totalHarvested += count;
    gardenStats.coinsEarned += coins;
    saveGardenStats();

    // Check for level up
    checkLevelUp();

    // Check for milestone achievements
    for (const milestone of HARVEST_MILESTONES) {
        if (previousTotal < milestone.count && gardenStats.totalHarvested >= milestone.count) {
            showMilestoneCelebration(milestone);
            break; // Only show one milestone at a time
        }
    }

    // Check for badge achievements
    checkAchievements();
}

function showMilestoneCelebration(milestone) {
    // Extra confetti burst for milestones
    if (gardenSettings.confettiEnabled && typeof confetti === 'function') {
        // Multiple bursts for extra celebration
        confetti({
            particleCount: 100,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#FFD60A', '#FF9500', '#00B894', '#5856D6', '#FF2D55']
        });
        setTimeout(() => {
            confetti({
                particleCount: 50,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#FFD60A', '#FF9500', '#00B894']
            });
            confetti({
                particleCount: 50,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#FFD60A', '#FF9500', '#00B894']
            });
        }, 200);
    }

    // Create milestone toast
    Toast.init();
    const toast = document.createElement('div');
    toast.className = 'toast milestone-toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <span class="milestone-icon" aria-hidden="true">${Icons.get('star', 24)}</span>
        <div class="milestone-content">
            <strong class="milestone-title">${milestone.title}</strong>
            <span class="milestone-message">${milestone.message}</span>
        </div>
    `;
    Toast.container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    // Longer display for milestones
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function recordTabSaved() {
    gardenStats.tabsSavedFromWilting = (gardenStats.tabsSavedFromWilting || 0) + 1;
    saveGardenStats();
}

function getFavoriteSeason() {
    const visits = gardenStats.seasonVisits;
    let maxSeason = 'spring';
    let maxVisits = 0;
    for (const [season, count] of Object.entries(visits)) {
        if (count > maxVisits) {
            maxVisits = count;
            maxSeason = season;
        }
    }
    return maxSeason;
}

function getGardenAge() {
    const days = Math.floor((Date.now() - gardenStats.gardenCreated) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Brand new!';
    if (days === 1) return '1 day old';
    if (days < 7) return `${days} days old`;
    if (days < 30) return `${Math.floor(days / 7)} weeks old`;
    if (days < 365) return `${Math.floor(days / 30)} months old`;
    return `${Math.floor(days / 365)} years old`;
}

function showGardenStats() {
    // Remove existing panel if open
    const existing = document.getElementById('statsModal');
    if (existing && !existing.classList.contains('hidden')) {
        existing.classList.add('hidden');
        return;
    }

    const level = getGardenLevel();
    const progress = getLevelProgress();
    const coinsToNext = getCoinsToNextLevel();
    const favSeason = getFavoriteSeason();
    const seasonEmojis = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
    const seasonNames = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

    // Category breakdown
    const categoryBreakdown = getCategoryBreakdown();
    const topCategories = Object.entries(categoryBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .filter(([, count]) => count > 0);

    // Unlocked achievements count
    const unlockedCount = (gardenStats.unlockedAchievements || []).length;
    const totalAchievements = ACHIEVEMENTS.length;

    let modal = document.getElementById('statsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'statsModal';
        modal.className = 'stats-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Garden Statistics');
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    const nextLevelName = GARDEN_LEVELS.find(l => l.level === level.level + 1)?.name || 'Max';

    modal.innerHTML = `
        <div class="stats-modal-content">
            <div class="stats-modal-header">
                <h3>Garden Statistics</h3>
                <button class="stats-close" aria-label="Close">${Icons.get('close', 16)}</button>
            </div>

            <!-- Level Section -->
            <div class="stats-level-section">
                <div class="stats-level-badge" style="background: ${level.color}">
                    ${Icons.get(level.icon, 20)}
                </div>
                <div class="stats-level-info">
                    <div class="stats-level-name">Level ${level.level}: ${level.name}</div>
                    <div class="stats-level-progress-bar">
                        <div class="stats-level-progress-fill" style="width: ${progress * 100}%; background: ${level.color}"></div>
                    </div>
                    <div class="stats-level-subtext">${coinsToNext > 0 ? `${coinsToNext} coins to ${nextLevelName}` : 'Max level reached!'}</div>
                </div>
            </div>

            <!-- Main Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-card-value">${gardenStats.coinsEarned}</span>
                    <span class="stat-card-label">Coins Earned</span>
                </div>
                <div class="stat-card">
                    <span class="stat-card-value">${gardenStats.totalHarvested}</span>
                    <span class="stat-card-label">Tabs Harvested</span>
                </div>
                <div class="stat-card">
                    <span class="stat-card-value">${gardenStats.currentStreak}</span>
                    <span class="stat-card-label">Day Streak</span>
                </div>
                <div class="stat-card">
                    <span class="stat-card-value">${gardenStats.tabsSavedFromWilting || 0}</span>
                    <span class="stat-card-label">Tabs Saved</span>
                </div>
            </div>

            <!-- Secondary Stats -->
            <div class="stats-secondary">
                <div class="stats-row">
                    <span class="stats-row-label">Garden Age</span>
                    <span class="stats-row-value">${getGardenAge()}</span>
                </div>
                <div class="stats-row">
                    <span class="stats-row-label">Longest Streak</span>
                    <span class="stats-row-value">${gardenStats.longestStreak || 0} days</span>
                </div>
                <div class="stats-row">
                    <span class="stats-row-label">Favorite Season</span>
                    <span class="stats-row-value">${seasonEmojis[favSeason]} ${seasonNames[favSeason]}</span>
                </div>
                <div class="stats-row">
                    <span class="stats-row-label">Achievements</span>
                    <span class="stats-row-value">${unlockedCount}/${totalAchievements}</span>
                </div>
            </div>

            ${topCategories.length > 0 ? `
            <!-- Category Breakdown -->
            <div class="stats-section">
                <div class="stats-section-title">Top Categories</div>
                <div class="stats-categories">
                    ${topCategories.map(([cat, count]) => `
                        <div class="stats-category-item">
                            <span class="stats-category-dot" style="background: ${getCategoryColor(cat)}"></span>
                            <span class="stats-category-name">${capitalizeFirst(cat)}</span>
                            <span class="stats-category-count">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <button class="stats-close-btn btn-primary">Done</button>
        </div>
    `;

    // Attach close handlers
    modal.querySelector('.stats-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelector('.stats-close-btn').addEventListener('click', () => modal.classList.add('hidden'));

    modal.classList.remove('hidden');
    AudioSystem.playHoverSoft();
}

function getCategoryBreakdown() {
    const breakdown = {};
    plants.forEach(plant => {
        const category = plant.flowerType?.category || 'other';
        breakdown[category] = (breakdown[category] || 0) + 1;
    });
    return breakdown;
}

function getCategoryColor(category) {
    const colors = {
        social: '#FF6B8A',
        dev: '#7C83FD',
        ai: '#A78BFA',
        google: '#4285F4',
        media: '#FF6B35',
        shopping: '#FFB347',
        work: '#00B894',
        other: '#E9ECEF'
    };
    return colors[category] || colors.other;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// Share Tour Settings
// ============================================
let shareSettings = {
    includeGardenName: true,
    blurTabTitles: false
};

async function loadShareSettings() {
    const result = await chrome.storage.local.get(['shareSettings']);
    if (result.shareSettings) {
        shareSettings = { ...shareSettings, ...result.shareSettings };
    }
}

function saveShareSettings() {
    chrome.storage.local.set({ shareSettings });
}

function showShareSettingsPanel() {
    // Remove existing panel if open
    const existing = document.getElementById('share-settings-panel');
    if (existing) {
        existing.remove();
        return;
    }

    // Create panel container
    const panel = document.createElement('div');
    panel.id = 'share-settings-panel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, rgba(255,249,245,0.98), rgba(255,236,210,0.98));
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 200px;
        pointer-events: auto;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 600; color: #5D7A4A; margin-bottom: 12px; font-size: 14px;';
    title.textContent = 'Share Settings';

    // Garden name checkbox
    const label1 = document.createElement('label');
    label1.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 10px; cursor: pointer; font-size: 12px; color: #7A6B5A;';
    const checkbox1 = document.createElement('input');
    checkbox1.type = 'checkbox';
    checkbox1.checked = shareSettings.includeGardenName;
    checkbox1.style.accentColor = '#5D7A4A';
    checkbox1.addEventListener('change', (e) => {
        shareSettings.includeGardenName = e.target.checked;
        saveShareSettings();
    });
    label1.appendChild(checkbox1);
    label1.appendChild(document.createTextNode('Include garden name'));

    // Blur titles checkbox
    const label2 = document.createElement('label');
    label2.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: #7A6B5A;';
    const checkbox2 = document.createElement('input');
    checkbox2.type = 'checkbox';
    checkbox2.checked = shareSettings.blurTabTitles;
    checkbox2.style.accentColor = '#5D7A4A';
    checkbox2.addEventListener('change', (e) => {
        shareSettings.blurTabTitles = e.target.checked;
        saveShareSettings();
    });
    label2.appendChild(checkbox2);
    label2.appendChild(document.createTextNode('Blur tab titles (privacy)'));

    // Done button
    const doneBtn = document.createElement('button');
    doneBtn.style.cssText = `
        margin-top: 12px;
        width: 100%;
        background: #5D7A4A;
        color: white;
        border: none;
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
    `;
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => panel.remove());

    // Assemble panel
    panel.appendChild(title);
    panel.appendChild(label1);
    panel.appendChild(label2);
    panel.appendChild(doneBtn);

    document.body.appendChild(panel);
}

// ============================================
// A-GRADE UPGRADE: Coach Marks Tutorial System
// ============================================

const CoachMarks = {
    steps: [
        {
            id: 'welcome',
            target: '.garden-scroll',
            icon: '🌱',
            title: 'Welcome to your garden!',
            description: 'Each flower represents one of your browser tabs. Watch them grow and bloom!',
            position: 'center'
        },
        {
            id: 'plants',
            target: '.plant',
            icon: '🌸',
            title: 'These are your tabs',
            description: 'Healthy tabs bloom brightly. Ignored tabs start to wilt. Click any flower to see options.',
            position: 'bottom'
        },
        {
            id: 'harvest',
            target: '#harvestAll',
            icon: '✂️',
            title: 'Harvest wilting tabs',
            description: 'Close unused tabs with one click and earn coins! Keep your garden (and browser) healthy.',
            position: 'top'
        },
        {
            id: 'level',
            target: '.level-indicator',
            icon: '⭐',
            title: 'Level up your garden',
            description: 'Earn coins by harvesting to unlock new levels. Can you become a Master Gardener?',
            position: 'bottom'
        },
        {
            id: 'shortcuts',
            target: '.header-actions',
            icon: '⌨️',
            title: 'Pro tip: Keyboard shortcuts!',
            description: 'Press ? anytime to see all shortcuts. Try H to harvest, S to search, M for multi-select.',
            position: 'left'
        }
    ],

    currentStep: 0,
    overlay: null,
    tooltip: null,
    spotlight: null,

    async shouldShow() {
        const result = await chrome.storage.local.get(['coachMarksCompleted', 'coachMarksSkipped']);
        return !result.coachMarksCompleted && !result.coachMarksSkipped;
    },

    async start() {
        if (!(await this.shouldShow())) return;

        // Wait for plants to render
        await new Promise(r => setTimeout(r, 800));

        // Don't show if no plants exist
        if (plants.length === 0) return;

        this.currentStep = 0;
        this.createOverlay();
        this.showStep(0);
    },

    createOverlay() {
        // Remove existing if any
        this.destroy();

        this.overlay = document.createElement('div');
        this.overlay.className = 'coach-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-label', 'Tutorial');

        this.spotlight = document.createElement('div');
        this.spotlight.className = 'coach-spotlight';

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'coach-tooltip';

        this.overlay.appendChild(this.spotlight);
        this.overlay.appendChild(this.tooltip);
        document.body.appendChild(this.overlay);

        // Animate in
        requestAnimationFrame(() => this.overlay.classList.add('visible'));
    },

    showStep(index) {
        const step = this.steps[index];
        if (!step) {
            this.complete();
            return;
        }

        const target = document.querySelector(step.target);
        if (!target && step.target !== '.garden-scroll') {
            // Skip this step if target doesn't exist
            this.showStep(index + 1);
            return;
        }

        // Position spotlight
        if (target && step.position !== 'center') {
            const rect = target.getBoundingClientRect();
            const padding = 8;
            this.spotlight.style.left = `${rect.left - padding}px`;
            this.spotlight.style.top = `${rect.top - padding}px`;
            this.spotlight.style.width = `${rect.width + padding * 2}px`;
            this.spotlight.style.height = `${rect.height + padding * 2}px`;
            this.spotlight.style.display = 'block';
        } else {
            this.spotlight.style.display = 'none';
        }

        // Position tooltip
        this.tooltip.setAttribute('data-position', step.position);
        this.tooltip.innerHTML = `
            <div class="coach-icon" aria-hidden="true">${step.icon}</div>
            <h4 class="coach-title">${step.title}</h4>
            <p class="coach-description">${step.description}</p>
            <div class="coach-actions">
                <div class="coach-progress" aria-label="Step ${index + 1} of ${this.steps.length}">
                    ${this.steps.map((_, i) => `
                        <span class="coach-dot ${i < index ? 'completed' : ''} ${i === index ? 'active' : ''}"></span>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="coach-btn coach-btn--skip" aria-label="Skip tutorial">Skip</button>
                    <button class="coach-btn coach-btn--next" aria-label="${index === this.steps.length - 1 ? 'Finish' : 'Next step'}">
                        ${index === this.steps.length - 1 ? 'Got it!' : 'Next'}
                    </button>
                </div>
            </div>
        `;

        // Position tooltip based on target - simplified for side panel
        // CSS handles horizontal centering, we just need to set vertical position
        const viewportHeight = window.innerHeight;

        if (target && step.position !== 'center') {
            const rect = target.getBoundingClientRect();
            let top;

            switch (step.position) {
                case 'bottom':
                    top = rect.bottom + 16;
                    break;
                case 'top':
                    // Position above target, but ensure it stays in viewport
                    top = Math.max(16, rect.top - 180);
                    break;
                case 'left':
                case 'right':
                    top = Math.max(16, rect.top);
                    break;
            }

            // Ensure tooltip doesn't go below viewport
            const maxTop = viewportHeight - 200;
            this.tooltip.style.top = `${Math.min(top, maxTop)}px`;
            this.tooltip.style.transform = 'none';
        } else {
            // Center position
            this.tooltip.style.top = '50%';
            this.tooltip.style.transform = 'translateY(-50%)';
        }

        // Add event listeners
        this.tooltip.querySelector('.coach-btn--skip').onclick = () => this.skip();
        this.tooltip.querySelector('.coach-btn--next').onclick = () => this.next();
    },

    next() {
        this.currentStep++;
        if (this.currentStep >= this.steps.length) {
            this.complete();
        } else {
            this.showStep(this.currentStep);
        }
        AudioSystem.playHoverSoft();
    },

    skip() {
        chrome.storage.local.set({ coachMarksSkipped: true });
        this.destroy();
        AudioSystem.playHoverSoft();
    },

    complete() {
        chrome.storage.local.set({ coachMarksCompleted: true });
        this.destroy();
        AudioSystem.playGrowthRustle();

        // Show completion toast
        Toast.show('🎉 Tutorial complete! Press ? for keyboard shortcuts.', 'success', 3000);
    },

    destroy() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            setTimeout(() => this.overlay?.remove(), 300);
            this.overlay = null;
            this.tooltip = null;
            this.spotlight = null;
        }
    }
};

// ============================================
// A-GRADE UPGRADE: Feature Discovery System
// ============================================

const FeatureDiscovery = {
    features: {
        'keyboardShortcuts': {
            trigger: 'filterUse',
            triggerCount: 3,
            message: 'Pro tip: Press 1, 2, 3 to quick-filter',
            shown: false
        },
        'batchSelect': {
            trigger: 'plantHover',
            triggerCount: 5,
            message: 'Try pressing M for multi-select mode',
            shown: false
        },
        'categoryFilter': {
            trigger: 'harvest',
            triggerCount: 5,
            message: 'Did you know? You can filter by category too',
            shown: false
        },
        'search': {
            trigger: 'plantClick',
            triggerCount: 8,
            message: 'Press S to quickly search your tabs',
            shown: false
        }
    },

    counters: {},
    shownFeatures: new Set(),

    async init() {
        const result = await chrome.storage.local.get(['discoveredFeatures']);
        if (result.discoveredFeatures) {
            this.shownFeatures = new Set(result.discoveredFeatures);
        }
    },

    track(event) {
        this.counters[event] = (this.counters[event] || 0) + 1;

        // Check if any feature should be discovered
        for (const [featureId, feature] of Object.entries(this.features)) {
            if (this.shownFeatures.has(featureId)) continue;
            if (feature.trigger !== event) continue;
            if (this.counters[event] < feature.triggerCount) continue;

            this.showDiscoveryTip(featureId, feature);
            break; // Only show one at a time
        }
    },

    showDiscoveryTip(featureId, feature) {
        this.shownFeatures.add(featureId);
        chrome.storage.local.set({ discoveredFeatures: Array.from(this.shownFeatures) });

        // Create and show tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'discovery-tooltip';
        tooltip.setAttribute('role', 'status');
        tooltip.setAttribute('aria-live', 'polite');
        tooltip.setAttribute('data-arrow', 'bottom');
        tooltip.textContent = `💡 ${feature.message}`;

        // Position near bottom center
        tooltip.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
        `;

        document.body.appendChild(tooltip);

        // Auto-dismiss
        setTimeout(() => {
            tooltip.style.opacity = '0';
            tooltip.style.transition = 'opacity 0.3s';
            setTimeout(() => tooltip.remove(), 300);
        }, 4000);

        AudioSystem.playHoverSoft();
    },

    markDiscovered(featureId) {
        this.shownFeatures.add(featureId);
        chrome.storage.local.set({ discoveredFeatures: Array.from(this.shownFeatures) });
    }
};

// ============================================
// A-GRADE UPGRADE: Smart Stat Visibility
// ============================================

function updateStatVisibility() {
    // Update data-value attributes for CSS-based visibility
    const streakStat = document.getElementById('streakStat');
    const wiltingStat = document.querySelector('.stat-pill--wilting');

    const streakCount = gardenStats.currentStreak || 0;
    const wiltingCount = plants.filter(p => p.age >= 0.3).length;

    if (streakStat) {
        streakStat.setAttribute('data-value', streakCount);
    }

    if (wiltingStat) {
        wiltingStat.setAttribute('data-value', wiltingCount);
        wiltingStat.setAttribute('data-attention', wiltingCount > 0 ? 'true' : 'false');
    }

    // Update healthy stat
    const healthyStat = document.querySelector('.stat-pill--healthy');
    if (healthyStat) {
        const healthyCount = plants.filter(p => p.age < 0.3).length;
        healthyStat.setAttribute('data-value', healthyCount);
    }
}

// ============================================
// A-GRADE UPGRADE: Zero Tabs Empty State
// ============================================

function showZeroTabsState() {
    const container = document.getElementById('garden-container');
    if (!container) return;

    // Check if empty state already exists
    if (container.querySelector('.empty-garden')) return;

    const emptyState = document.createElement('div');
    emptyState.className = 'empty-garden';
    emptyState.setAttribute('role', 'status');
    emptyState.innerHTML = `
        <div class="empty-garden-icon" aria-hidden="true">🌱</div>
        <h3 class="empty-garden-title">Your garden awaits</h3>
        <p class="empty-garden-desc">Open some tabs to plant your first seeds and watch them grow!</p>
        <button class="empty-garden-btn" id="openNewTabBtn">Plant a seed</button>
    `;

    container.appendChild(emptyState);

    // Add click handler
    emptyState.querySelector('#openNewTabBtn')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://newtab' });
    });
}

function hideZeroTabsState() {
    const emptyState = document.querySelector('.empty-garden');
    if (emptyState) {
        emptyState.remove();
    }
}

// ============================================
// A-GRADE UPGRADE: Offline Indicator
// ============================================

const ConnectionStatus = {
    isOnline: navigator.onLine,

    init() {
        window.addEventListener('online', () => this.updateStatus(true));
        window.addEventListener('offline', () => this.updateStatus(false));
        this.updateStatus(navigator.onLine);
    },

    updateStatus(online) {
        this.isOnline = online;
        this.updateUI();
    },

    updateUI() {
        let banner = document.getElementById('offlineBanner');

        if (!this.isOnline) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'offlineBanner';
                banner.className = 'offline-banner';
                banner.setAttribute('role', 'alert');
                banner.innerHTML = `
                    <span class="offline-banner-icon">📡</span>
                    <span>Offline — changes will sync when reconnected</span>
                `;

                // Insert at top of body
                document.body.insertBefore(banner, document.body.firstChild);
            }
            banner.classList.add('visible');
        } else {
            banner?.classList.remove('visible');
        }
    }
};

// ============================================
// A-GRADE UPGRADE: Keyboard Shortcut Hint Bar
// ============================================

function setupKeyboardHintBar() {
    // Detect keyboard user
    document.addEventListener('keydown', function detectKeyboard(e) {
        if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
            document.body.classList.add('keyboard-user');
            showShortcutHintBar();
        }
    }, { once: true });
}

async function showShortcutHintBar() {
    // Check if dismissed
    const result = await chrome.storage.local.get(['shortcutHintDismissed']);
    if (result.shortcutHintDismissed) return;

    // Check if already exists
    if (document.querySelector('.shortcut-hint-bar')) return;

    const hintBar = document.createElement('div');
    hintBar.className = 'shortcut-hint-bar';
    hintBar.setAttribute('role', 'region');
    hintBar.setAttribute('aria-label', 'Keyboard shortcuts');
    hintBar.innerHTML = `
        <span class="shortcut-hint"><kbd>H</kbd> harvest</span>
        <span class="shortcut-hint"><kbd>S</kbd> search</span>
        <span class="shortcut-hint"><kbd>M</kbd> select</span>
        <span class="shortcut-hint"><kbd>?</kbd> all shortcuts</span>
        <button class="shortcut-hint-dismiss" aria-label="Dismiss shortcuts hint">${Icons.get('close', 12)}</button>
    `;

    // Insert before footer
    const footer = document.querySelector('.garden-footer');
    footer?.parentNode?.insertBefore(hintBar, footer);

    // Dismiss handler
    hintBar.querySelector('.shortcut-hint-dismiss')?.addEventListener('click', () => {
        hintBar.classList.add('dismissed');
        chrome.storage.local.set({ shortcutHintDismissed: true });
    });
}

// ============================================
// A-GRADE UPGRADE: Bottom Sheet (Mobile)
// ============================================

const BottomSheet = {
    overlay: null,
    sheet: null,

    show(plant) {
        this.destroy();

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'bottom-sheet-overlay';
        this.overlay.addEventListener('click', () => this.hide());

        // Create sheet
        this.sheet = document.createElement('div');
        this.sheet.className = 'bottom-sheet';
        this.sheet.setAttribute('role', 'dialog');
        this.sheet.setAttribute('aria-modal', 'true');

        const status = getPlantStatus(plant);
        const statusText = status === 'healthy' ? '🌱 Healthy' :
                          status === 'wilting' ? '🥀 Wilting' : '💤 Dormant';

        this.sheet.innerHTML = `
            <div class="bottom-sheet-handle" aria-hidden="true"></div>
            <div class="bottom-sheet-header">
                <img class="bottom-sheet-favicon"
                     src="${plant.faviconUrl || 'icons/icon48.png'}"
                     alt=""
                     onerror="this.src='icons/icon48.png'">
                <h3 class="bottom-sheet-title">${plant.tab.title || 'Untitled'}</h3>
            </div>
            <div class="bottom-sheet-meta">
                ${statusText} • ${getFriendlyDomainName(plant.url || '')}
            </div>
            <div class="bottom-sheet-actions">
                <button class="bottom-sheet-btn bottom-sheet-btn--secondary" data-action="visit">
                    Visit Tab
                </button>
                <button class="bottom-sheet-btn bottom-sheet-btn--primary" data-action="harvest">
                    Harvest
                </button>
            </div>
        `;

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.sheet);

        // Animate in
        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
            this.sheet.classList.add('visible');
        });

        // Action handlers
        this.sheet.querySelector('[data-action="visit"]')?.addEventListener('click', () => {
            chrome.tabs.update(plant.tabId, { active: true });
            this.hide();
        });

        this.sheet.querySelector('[data-action="harvest"]')?.addEventListener('click', async () => {
            await harvestSinglePlant(plant);
            this.hide();
        });

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    },

    hide() {
        this.overlay?.classList.remove('visible');
        this.sheet?.classList.remove('visible');

        setTimeout(() => this.destroy(), 300);
    },

    destroy() {
        this.overlay?.remove();
        this.sheet?.remove();
        this.overlay = null;
        this.sheet = null;
    }
};

// Helper to harvest a single plant
async function harvestSinglePlant(plant) {
    try {
        const harvestInfo = {
            url: plant.tab.url,
            title: plant.tab.title,
            favIconUrl: plant.tab.favIconUrl
        };

        await chrome.tabs.remove(plant.tabId);
        bloomParticles(plant.x, plant.y);

        if (plant.element) plant.element.remove();
        plants = plants.filter(p => p !== plant);

        layoutPlants();

        const coinsEarned = gardenSettings.harvestCoins;
        updateCoins(coinsEarned);
        recordHarvest(1, coinsEarned);
        updateStatsDisplay();
        updateFilterCounts();

        AudioSystem.playHarvestChime();

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        showUndoToast([harvestInfo], coinsEarned);
    } catch (err) {
        console.error('Failed to harvest plant:', err);
        Toast.error('Could not close tab');
    }
}

// ============================================
// A-GRADE UPGRADE: Touch Gesture Support
// ============================================

const TouchGestures = {
    startX: 0,
    startY: 0,
    currentElement: null,
    swipeThreshold: 80,

    init() {
        const container = document.getElementById('garden-container');
        if (!container) return;

        // Use passive: false to allow preventDefault
        container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    },

    handleTouchStart(e) {
        const touch = e.touches[0];
        this.startX = touch.clientX;
        this.startY = touch.clientY;

        // Find plant element
        const plantEl = e.target.closest('.plant');
        if (plantEl) {
            this.currentElement = plantEl;
        }
    },

    handleTouchMove(e) {
        if (!this.currentElement) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - this.startX;
        const deltaY = touch.clientY - this.startY;

        // Only handle horizontal swipes
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
            e.preventDefault();

            const progress = Math.min(1, Math.abs(deltaX) / this.swipeThreshold);
            this.currentElement.style.setProperty('--swipe-x', `${deltaX}px`);
            this.currentElement.style.setProperty('--swipe-progress', progress);

            if (deltaX < 0) {
                this.currentElement.classList.add('swiping-left');
                this.currentElement.classList.remove('swiping-right');
            } else {
                this.currentElement.classList.add('swiping-right');
                this.currentElement.classList.remove('swiping-left');
            }
        }
    },

    handleTouchEnd(e) {
        if (!this.currentElement) return;

        const plantIndex = parseInt(this.currentElement.dataset.plantIndex);
        const plant = plants[plantIndex];

        const deltaX = (e.changedTouches?.[0]?.clientX || this.startX) - this.startX;

        // Check if swipe exceeded threshold
        if (Math.abs(deltaX) >= this.swipeThreshold && plant) {
            if (deltaX < 0) {
                // Swipe left = harvest
                harvestSinglePlant(plant);
            } else {
                // Swipe right = mark as favorite (future feature)
                Toast.show('⭐ Favorites coming soon!', 'info');
            }
        }

        // Reset element styles
        this.currentElement.classList.remove('swiping-left', 'swiping-right');
        this.currentElement.style.removeProperty('--swipe-x');
        this.currentElement.style.removeProperty('--swipe-progress');
        this.currentElement = null;
    }
};

// ============================================
// A-GRADE UPGRADE: Initialize All Enhancements
// ============================================

async function initAGradeFeatures() {
    // Initialize feature discovery tracking
    await FeatureDiscovery.init();

    // Set up keyboard hint bar
    setupKeyboardHintBar();

    // Initialize connection status
    ConnectionStatus.init();

    // Initialize touch gestures on mobile
    if ('ontouchstart' in window) {
        TouchGestures.init();
    }

    // Update stat visibility
    updateStatVisibility();

    // Start coach marks tutorial after delay
    setTimeout(() => CoachMarks.start(), 1500);

    // Check for zero tabs state
    if (plants.length === 0) {
        showZeroTabsState();
    }
}

// Patch the original updateStatsDisplay to include A-grade features
const originalUpdateStatsDisplay = typeof updateStatsDisplay === 'function' ? updateStatsDisplay : null;

// Hook into stats updates
function enhancedStatsUpdate() {
    updateStatVisibility();

    // Check zero tabs
    if (plants.length === 0) {
        showZeroTabsState();
    } else {
        hideZeroTabsState();
    }
}

// Call after stats display updates
setInterval(enhancedStatsUpdate, 5000);

resizeCanvas();
initGarden().then(() => {
    initAGradeFeatures();
});
