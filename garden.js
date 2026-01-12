// garden.js - The TabBloom Rendering Engine
const canvas = document.getElementById('garden-canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

let plants = [];
let particles = [];
let width, height;
let hoveredPlant = null;
let currentCoins = 120; // Starting coins

// ============================================
// Web Audio API Sound System (ASMR Sounds)
// ============================================
const AudioSystem = {
    ctx: null,

    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },

    ensureContext() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    // Gentle chime on harvest (high, pleasant note)
    playHarvestChime() {
        this.ensureContext();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.1); // E6

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.4);

        // Second harmonic for richness
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1760, this.ctx.currentTime);
        gain2.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc2.start(this.ctx.currentTime);
        osc2.stop(this.ctx.currentTime + 0.3);
    },

    // Soft rustle on growth/refresh
    playGrowthRustle() {
        this.ensureContext();
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Pink noise for natural rustle
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 0.5;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        source.start();
    },

    // Sad droop tone on wilt
    playWiltDroop() {
        this.ensureContext();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.3); // Drop to A3

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.35);
    },

    // Soft hover sound
    playHoverSoft() {
        this.ensureContext();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 600;

        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
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
    const coinDisplay = document.querySelector('.pill.coins');
    if (coinDisplay) {
        coinDisplay.textContent = `✨ ${currentCoins}`;
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

// Configuration
const COLORS = {
    petalPink: '#FFB7C5',
    petalWhite: '#FFF5F7',
    petalDeep: '#E891A5',
    stamen: '#8B4513',
    anther: '#CD853F',
    stem: '#4A7043',
    stemDark: '#3D5C37',
    leaf: '#5C8A4D',
    leafDark: '#4A7043',
    wilted: '#C4A574',
    wiltedPetal: '#D4C4A8',
    text: '#1d1d1f'
};

// Grid layout settings - larger plants with more breathing room
const PLANT_SIZE = 80;
const PLANT_HEIGHT = 110;
const SPACING = 110;
const SCALE = 1.4;

// Create interactive DOM element overlay for a plant
function createPlantElement(tab, x, y) {
    const plant = document.createElement('div');
    plant.className = 'plant';
    plant.style.position = 'absolute';
    plant.style.left = `${x - PLANT_SIZE / 2}px`;
    plant.style.top = `${y - PLANT_HEIGHT / 2}px`;
    plant.style.width = `${PLANT_SIZE}px`;
    plant.style.height = `${PLANT_HEIGHT}px`;
    plant.style.background = 'transparent'; // Canvas draws the visual
    plant.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.4s ease-out';
    plant.style.cursor = 'pointer';
    plant.style.zIndex = '10';
    plant.style.transformOrigin = 'center bottom';

    plant.addEventListener('mouseenter', () => {
        plant.style.transform = 'scale(1.12) rotate(2deg) translateY(-3px)';
        plant.style.filter = 'drop-shadow(0 0 15px rgba(255, 183, 197, 0.6)) brightness(1.1)';
        AudioSystem.playHoverSoft();
        // Show tooltip
        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y - 60}px`;
        tooltip.innerHTML = `<strong>${tab.title}</strong><br><span style="font-size:10px; opacity:0.7">${new URL(tab.url).hostname}</span>`;
        tooltip.classList.remove('hidden');
    });

    plant.addEventListener('mouseleave', () => {
        plant.style.transform = 'scale(1) rotate(0deg) translateY(0)';
        plant.style.filter = 'none';
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
            updateCoins(10); // Reward for harvesting
        } catch (err) {
            console.error("Failed to close tab:", err);
        }
    });

    document.getElementById('garden-container').appendChild(plant);
    return plant;
}

// Canvas-based particle burst effect when harvesting
function bloomParticles(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 6,
            vy: Math.random() * -6 - 3,
            life: 80,
            size: 4 + Math.random() * 6,
            color: [COLORS.petalPink, COLORS.petalWhite, COLORS.anther, COLORS.leaf][Math.floor(Math.random() * 4)]
        });
    }
}

// Set canvas to fill the container responsively
function resizeCanvas() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width;
    canvas.height = height;
    layoutPlants();
}

window.addEventListener('resize', resizeCanvas);

// Canvas mouse tracking for hover effects
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if mouse is over a plant
    hoveredPlant = null;
    plants.forEach(p => {
        if (Math.hypot(mouseX - p.x, mouseY - p.y) < 40) {
            hoveredPlant = p;
        }
    });

    // Update cursor and tooltip
    if (hoveredPlant) {
        canvas.style.cursor = 'pointer';
        tooltip.style.left = `${mouseX + 15}px`;
        tooltip.style.top = `${mouseY - 40}px`;
        tooltip.innerHTML = `<strong>${hoveredPlant.title}</strong><br><span style="font-size:10px; opacity:0.7">${new URL(hoveredPlant.url).hostname}</span>`;
        tooltip.classList.remove('hidden');
    } else {
        canvas.style.cursor = 'default';
        tooltip.classList.add('hidden');
    }
});

canvas.addEventListener('mouseleave', () => {
    hoveredPlant = null;
    tooltip.classList.add('hidden');
    canvas.style.cursor = 'default';
});

// Calculate centered grid positions for all plants
function layoutPlants() {
    if (plants.length === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;

    const cols = Math.max(1, Math.floor(width / SPACING));
    const rows = Math.max(1, Math.ceil(plants.length / cols));

    // Calculate grid dimensions to center it
    const gridWidth = Math.min(plants.length, cols) * SPACING;
    const gridHeight = rows * SPACING;
    const startX = centerX - gridWidth / 2 + SPACING / 2;
    const startY = centerY - gridHeight / 2 + SPACING / 2;

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

class Plant {
    constructor(tab, lastActiveTime) {
        this.tabId = tab.id;
        this.tab = tab; // Store full tab reference
        this.title = tab.title;
        this.url = tab.url;
        this.x = 0;
        this.y = 0;
        this.element = null; // DOM element reference
        this.lastActiveTime = lastActiveTime || Date.now();
        this.age = calculateHealthFromActivity(this.lastActiveTime);
        this.previousAge = this.age; // Track for animations
        this.sway = Math.random() * Math.PI * 2; // Random start phase
        this.swaySpeed = 0.02 + Math.random() * 0.02;

        // Growth animation state
        this.growthScale = 1;
        this.growthTarget = 1;

        // Pre-generate random values for consistent rendering
        this.spotOffsets = Array(6).fill(0).map(() => (Math.random() - 0.5) * 0.6);
        this.spotSizes = Array(6).fill(0).map(() => 0.8 + Math.random() * 0.5);
        this.stamenLengths = Array(6).fill(0).map(() => 6 + Math.random() * 2);
    }

    // Update health based on current time, with animation triggers
    updateHealth() {
        const newAge = calculateHealthFromActivity(this.lastActiveTime);

        // Check for growth (tab was used, health improved)
        if (newAge < this.previousAge - 0.1) {
            this.triggerGrowthAnimation();
            AudioSystem.playGrowthRustle();
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
    }

    draw() {
        const swayOffset = Math.sin(this.sway) * 3;
        const isHovered = this === hoveredPlant;
        const isWilted = this.age >= 0.7;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Apply growth animation scale
        const baseScale = SCALE * this.growthScale;

        // Apply hover effects
        if (isHovered) {
            ctx.scale(baseScale * 1.15, baseScale * 1.15);
            ctx.shadowColor = 'rgba(255, 183, 197, 0.6)';
            ctx.shadowBlur = 15;
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

        // Create petal gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, -length);
        gradient.addColorStop(0, COLORS.petalDeep);
        gradient.addColorStop(0.3, COLORS.petalPink);
        gradient.addColorStop(0.7, COLORS.petalWhite);
        gradient.addColorStop(1, isBack ? COLORS.petalPink : COLORS.petalWhite);

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
        const stamenCount = 6;
        for (let i = 0; i < stamenCount; i++) {
            const angle = (i * Math.PI * 2 / stamenCount) + Math.PI / 6;
            const length = this.stamenLengths[i]; // Use pre-generated length

            ctx.save();
            ctx.rotate(angle);

            // Stamen filament
            ctx.strokeStyle = COLORS.petalWhite;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(0, -length);
            ctx.stroke();

            // Anther (pollen holder)
            ctx.fillStyle = COLORS.anther;
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

async function initGarden() {
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

    // Create DOM overlay elements for each plant
    plants.forEach(plant => {
        plant.element = createPlantElement(plant.tab, plant.x, plant.y);
    });

    // Set up Harvest Dormant Tabs button
    const harvestBtn = document.getElementById('harvestAll');
    if (harvestBtn) {
        harvestBtn.addEventListener('click', harvestDormantTabs);
    }

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

// Update the stats text in footer
function updateStatsDisplay() {
    const statsText = document.querySelector('.stats-text');
    if (statsText) {
        const bloomingCount = plants.filter(p => p.age < 0.3).length;
        const wiltedCount = plants.filter(p => p.age >= 0.7).length;
        statsText.textContent = `${bloomingCount} blooming, ${wiltedCount} wilted of ${plants.length} tabs`;
    }
}

// Harvest all wilted/dormant tabs
async function harvestDormantTabs() {
    const dormantPlants = plants.filter(p => p.age >= 0.7);

    if (dormantPlants.length === 0) {
        console.log('No dormant tabs to harvest');
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
    updateCoins(harvestedCount * 15);

    // Update stats
    updateStatsDisplay();

    console.log(`Harvested ${harvestedCount} dormant tabs!`);
}

function loop() {
    ctx.clearRect(0, 0, width, height);

    // Draw plants
    plants.forEach(plant => {
        plant.update();
        plant.draw();
    });

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.isSparkle ? 0.02 : 0.08; // lighter gravity for sparkles
        p.life--;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        const maxLife = p.isSparkle ? 40 : 80;
        ctx.globalAlpha = p.life / maxLife;

        if (p.isSparkle) {
            // Twinkling sparkle effect
            const twinkle = Math.sin(p.life * 0.5) * 0.5 + 0.5;
            ctx.globalAlpha *= twinkle;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * twinkle, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Regular petal particles
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(loop);
}

resizeCanvas();
initGarden();
