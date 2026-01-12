// garden.js - The TabBloom Rendering Engine
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

// Wilt speed multipliers (hours until fully wilted)
const WILT_SPEEDS = {
    slow: 24,
    normal: 12,
    fast: 6,
    rapid: 2
};

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

    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
        <div class="empty-state-icon" aria-hidden="true">
            ${Icons.get('seedling', 48)}
        </div>
        <h3 class="empty-state-title">Your garden is empty</h3>
        <p class="empty-state-description">
            Open some browser tabs to plant flowers in your garden.
        </p>
    `;

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
    const hostname = new URL(tab.url || 'about:blank').hostname;
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
                    <p class="plant-detail-url">${hostname}</p>
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
                <button class="btn-icon" id="detail-harvest" aria-label="Harvest this plant" title="Harvest">
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
        Toast.success(`Harvested +${gardenSettings.harvestCoins} coins`);

        // Show empty state if no plants left
        if (plants.length === 0) {
            showEmptyState();
        }
    } catch (err) {
        console.error("Failed to close tab:", err);
        Toast.error("Couldn't close tab");
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
    }
    // Save to storage
    chrome.storage.local.set({ coins: currentCoins });
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

function showShareFeedback(message) {
    const btn = document.getElementById('shareBtn');
    const originalText = btn.textContent;
    btn.textContent = message;
    btn.style.fontSize = '10px';

    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.fontSize = '';
    }, 2000);
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
        try {
            console.log('Harvesting tab:', tab.title);
            await chrome.tabs.remove(tab.id);
            bloomParticles(x, y);
            AudioSystem.playHarvestChime();
            plant.remove();
            // Remove from plants array
            plants = plants.filter(p => p.tabId !== tab.id);
            layoutPlants();
            updateCoins(gardenSettings.harvestCoins); // Reward for harvesting
            recordHarvest(1, gardenSettings.harvestCoins); // Track individual harvest
        } catch (err) {
            console.error("Failed to close tab:", err);
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

document.addEventListener('keydown', (e) => {
    // Only handle if garden is focused
    const gardenContainer = document.getElementById('garden-container');
    if (!gardenContainer || !gardenContainer.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
    }

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
                harvestPlantByIndex(focusedPlantIndex);
            }
            break;
        case 'Escape':
            focusedPlantIndex = -1;
            clearPlantFocus();
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
        <span style="color: var(--text-secondary); font-size: 11px;">${new URL(plant.tab.url || 'about:blank').hostname}</span>
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

// Flower variety - 5 types with different colors and shapes
const FLOWER_TYPES = {
    lily: {
        name: 'lily',
        petalCount: 6,
        petalShape: 'curved',
        colors: { bloom: '#FFB7C5', accent: '#FF8FA3', center: '#FFD700' }
    },
    rose: {
        name: 'rose',
        petalCount: 8,
        petalShape: 'round',
        colors: { bloom: '#FF6B6B', accent: '#FF4757', center: '#FFE66D' }
    },
    sunflower: {
        name: 'sunflower',
        petalCount: 12,
        petalShape: 'long',
        colors: { bloom: '#FFD93D', accent: '#FF9F1C', center: '#6B4423' }
    },
    daisy: {
        name: 'daisy',
        petalCount: 10,
        petalShape: 'thin',
        colors: { bloom: '#FFFFFF', accent: '#F0F0F0', center: '#FFD700' }
    },
    tulip: {
        name: 'tulip',
        petalCount: 4,
        petalShape: 'cup',
        colors: { bloom: '#9B59B6', accent: '#8E44AD', center: '#F1C40F' }
    },
    nightbloom: {
        name: 'nightbloom',
        petalCount: 7,
        petalShape: 'curved',
        colors: { bloom: '#2C1654', accent: '#1A0A30', center: '#9B59B6' },
        glows: true // Special property for dark mode glow effect
    }
};

// Domain categories for flower assignment
function getFlowerTypeForUrl(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();

        // Social media → Rose (passionate, expressive)
        if (/facebook|twitter|instagram|tiktok|reddit|discord|linkedin/i.test(hostname)) {
            return FLOWER_TYPES.rose;
        }
        // News/Media → Sunflower (bright, informative)
        if (/news|bbc|cnn|nytimes|guardian|medium|substack/i.test(hostname)) {
            return FLOWER_TYPES.sunflower;
        }
        // Work/Productivity → Lily (elegant, professional)
        if (/github|gitlab|jira|slack|notion|figma|google|docs|sheets/i.test(hostname)) {
            return FLOWER_TYPES.lily;
        }
        // Entertainment → Tulip (colorful, fun)
        if (/youtube|netflix|spotify|twitch|hulu|disney/i.test(hostname)) {
            return FLOWER_TYPES.tulip;
        }
        // Knowledge/Research → Night Bloom (mysterious, glowing)
        if (/wikipedia|stackoverflow|archive|wayback|library|research|academic|scholar|arxiv|jstor|edu\./i.test(hostname)) {
            return FLOWER_TYPES.nightbloom;
        }
        // Default → Daisy (simple, versatile)
        return FLOWER_TYPES.daisy;
    } catch {
        // Random fallback
        const types = Object.values(FLOWER_TYPES);
        return types[Math.floor(Math.random() * types.length)];
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

        // Apply growth animation scale with individual variation
        const baseScale = SCALE * this.growthScale * this.scaleVariation;

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

        // Draw centered domain name below the flower
        try {
            const text = new URL(this.url).hostname.replace('www.', '');
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            const fontSize = Math.min(16, canvas.width / 30); // scales with panel width
            ctx.font = `${fontSize}px system-ui, sans-serif`;
            ctx.fillStyle = COLORS.stem;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const textY = this.y + 60;
            const maxWidth = 90;

            // Wrap to two lines if too long
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

        // Draw center pistil
        ctx.fillStyle = COLORS.stem;
        ctx.beginPath();
        ctx.arc(0, -2, 2, 0, Math.PI * 2);
        ctx.fill();
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
        console.log('Using default settings');
    }
}

async function initGarden() {
    // Load user settings first
    await loadGardenSettings();

    // Apply seasonal theme
    applySeason();

    // Load saved coins
    await loadCoins();

    // Load tab activity data
    const activityResult = await chrome.storage.local.get(['tabActivity']);
    const tabActivity = activityResult.tabActivity || {};

    const tabs = await chrome.tabs.query({});
    plants = tabs.map(tab => {
        const lastActiveTime = tabActivity[tab.id] || Date.now();
        return new Plant(tab, lastActiveTime);
    });
    layoutPlants();

    // Create DOM overlay elements for each plant with staggered animation
    plants.forEach((plant, index) => {
        plant.element = createPlantElement(plant.tab, plant.x, plant.y, index);
    });

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

    // Load garden stats for tracking
    await loadGardenStats();

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
    setInterval(updateAllPlantHealth, 10000);

    // Initial stats display
    updateStatsDisplay();

    // Start Game Loop
    requestAnimationFrame(loop);
}

// Periodically update all plant health based on activity
async function updateAllPlantHealth() {
    // Reload activity data in case it changed
    const activityResult = await chrome.storage.local.get(['tabActivity']);
    const tabActivity = activityResult.tabActivity || {};

    plants.forEach(plant => {
        // Update last active time if it changed
        if (tabActivity[plant.tabId]) {
            plant.lastActiveTime = tabActivity[plant.tabId];
        }
        plant.updateHealth();
    });

    // Update stats display
    updateStatsDisplay();
}

// Update the stats display in header and footer
function updateStatsDisplay() {
    const bloomingCount = plants.filter(p => p.age < 0.3).length;
    const wiltedCount = plants.filter(p => p.age >= 0.7).length;

    // Update stats bar
    const healthyCountEl = document.getElementById('healthyCount');
    const wiltingCountEl = document.getElementById('wiltingCount');
    const subtitleEl = document.getElementById('gardenSubtitle');
    const weeklyStatsEl = document.getElementById('weeklyStats');

    if (healthyCountEl) healthyCountEl.textContent = bloomingCount;
    if (wiltingCountEl) wiltingCountEl.textContent = wiltedCount;
    if (subtitleEl) subtitleEl.textContent = `${plants.length} plants`;
    if (weeklyStatsEl) weeklyStatsEl.textContent = `${bloomingCount} healthy, ${wiltedCount} wilting`;
}

// Harvest all wilted/dormant tabs
async function harvestDormantTabs() {
    const dormantPlants = plants.filter(p => p.age >= 0.7);

    if (dormantPlants.length === 0) {
        Toast.show('All plants are healthy!', 'info');
        return;
    }

    let harvestedCount = 0;

    // Play harvest chime once for batch
    AudioSystem.playHarvestChime();

    for (const plant of dormantPlants) {
        try {
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

    // Remove harvested plants from array
    plants = plants.filter(p => p.age < 0.7);
    layoutPlants();

    // Award coins for batch harvest (bonus for efficiency!)
    const coinsEarned = harvestedCount * 15;
    updateCoins(coinsEarned);

    // Record stats for lifetime tracking
    recordHarvest(harvestedCount, coinsEarned);

    // Update stats
    updateStatsDisplay();

    // Celebration time! Confetti + happy chime + toast
    if (harvestedCount > 0) {
        AudioSystem.playHarvestAllCelebration();
        Toast.success(`Harvested ${harvestedCount} tabs, +${coinsEarned} coins!`);

        // Trigger confetti burst (garden colors)
        if (gardenSettings.confettiEnabled && typeof confetti === 'function') {
            confetti({
                particleCount: 80 + harvestedCount * 10,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#34C759', '#FFD60A', '#007AFF', '#5856D6', '#FF9500']
            });
        }
    }

    console.log(`Harvested ${harvestedCount} dormant tabs!`);
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
            captureGardenScreenshot();
        });
    }
}

function loop(timestamp) {
    // FPS throttling
    const frameInterval = getFrameInterval();
    if (timestamp - lastFrameTime < frameInterval) {
        requestAnimationFrame(loop);
        return;
    }
    lastFrameTime = timestamp;

    frameCount++;

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

    requestAnimationFrame(loop);
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
    tabsSavedFromWilting: 0
};

async function loadGardenStats() {
    const result = await chrome.storage.local.get(['gardenStats']);
    if (result.gardenStats) {
        gardenStats = { ...gardenStats, ...result.gardenStats };
    }

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
        gardenStats.currentStreak = 1;
    }
    gardenStats.lastVisit = now;

    saveGardenStats();
}

function saveGardenStats() {
    chrome.storage.local.set({ gardenStats });
}

function recordHarvest(count = 1, coins = 10) {
    gardenStats.totalHarvested += count;
    gardenStats.coinsEarned += coins;
    saveGardenStats();
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
    const existing = document.getElementById('garden-stats-panel');
    if (existing) {
        existing.remove();
        return;
    }

    const favSeason = getFavoriteSeason();
    const seasonEmojis = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
    const seasonNames = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

    const panel = document.createElement('div');
    panel.id = 'garden-stats-panel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(255,249,245,0.98), rgba(255,236,210,0.98));
        padding: 20px 24px;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        z-index: 10000;
        min-width: 260px;
        pointer-events: auto;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 700; color: #5D7A4A; margin-bottom: 16px; font-size: 16px; text-align: center;';
    title.textContent = '🌿 Garden Stats';

    // Stats grid
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;';

    const statItems = [
        { label: 'Tabs Saved', value: gardenStats.tabsSavedFromWilting || 0, emoji: '💚' },
        { label: 'Harvested', value: gardenStats.totalHarvested, emoji: '🌾' },
        { label: 'Coins Earned', value: gardenStats.coinsEarned, emoji: '✨' },
        { label: 'Garden Age', value: getGardenAge(), emoji: '🌱' },
        { label: 'Day Streak', value: `${gardenStats.currentStreak} days`, emoji: '🔥' },
        { label: 'Favorite Season', value: `${seasonEmojis[favSeason]} ${seasonNames[favSeason]}`, emoji: '' },
    ];

    statItems.forEach(stat => {
        const item = document.createElement('div');
        item.style.cssText = `
            background: rgba(255,255,255,0.6);
            padding: 10px;
            border-radius: 10px;
            text-align: center;
        `;
        item.innerHTML = `
            <div style="font-size: 18px; font-weight: 700; color: #5D7A4A;">${stat.emoji} ${stat.value}</div>
            <div style="font-size: 11px; color: #7A6B5A; margin-top: 2px;">${stat.label}</div>
        `;
        statsGrid.appendChild(item);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
        margin-top: 16px;
        width: 100%;
        background: #5D7A4A;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
    `;
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => panel.remove());

    // Assemble
    panel.appendChild(title);
    panel.appendChild(statsGrid);
    panel.appendChild(closeBtn);

    document.body.appendChild(panel);

    // Play a soft sound
    AudioSystem.playHoverSoft();
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

resizeCanvas();
initGarden();
