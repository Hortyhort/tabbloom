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

    // Happy celebration chime for batch harvest
    playHarvestAllCelebration() {
        this.ensureContext();

        // Ascending happy arpeggio (C-E-G-C)
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            const startTime = this.ctx.currentTime + i * 0.08;
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });

        // Add sparkle overlay
        const sparkle = this.ctx.createOscillator();
        const sparkleGain = this.ctx.createGain();
        sparkle.connect(sparkleGain);
        sparkleGain.connect(this.ctx.destination);
        sparkle.type = 'sine';
        sparkle.frequency.setValueAtTime(2093, this.ctx.currentTime + 0.3); // C7
        sparkleGain.gain.setValueAtTime(0.04, this.ctx.currentTime + 0.3);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
        sparkle.start(this.ctx.currentTime + 0.3);
        sparkle.stop(this.ctx.currentTime + 0.6);
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
    },

    // Ultra-soft butterfly wing flutter (ASMR)
    playButterflyFlutter() {
        this.ensureContext();
        // Create soft fluttering with rapid tiny oscillations
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Gentle flutter pattern
        for (let i = 0; i < bufferSize; i++) {
            const flutter = Math.sin(i * 0.15) * Math.sin(i * 0.02);
            data[i] = flutter * Math.pow(1 - i / bufferSize, 1.5) * 0.3;
        }

        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        source.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = 800;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        source.start();
    },

    // Ambient soundscape state
    ambientSource: null,
    ambientGain: null,
    isAmbientPlaying: false,

    // Start seasonal ambient soundscape (very quiet background)
    startAmbientSoundscape(season) {
        if (this.isAmbientPlaying) return;
        this.ensureContext();

        // Create noise buffer for ambient sound
        const duration = 4; // 4 second loop
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (season === 'summer') {
            // Crickets: rhythmic chirping pattern
            for (let i = 0; i < bufferSize; i++) {
                const chirpFreq = 4000 + Math.sin(i * 0.001) * 500;
                const chirpPattern = Math.sin(i * 0.05) > 0.8 ? 1 : 0;
                const chirp = Math.sin(i * chirpFreq / this.ctx.sampleRate) * chirpPattern;
                data[i] = chirp * 0.02 * (0.5 + Math.random() * 0.5);
            }
        } else if (season === 'autumn') {
            // Soft wind: filtered noise with gentle modulation
            for (let i = 0; i < bufferSize; i++) {
                const windMod = Math.sin(i * 0.0001) * 0.5 + 0.5;
                data[i] = (Math.random() * 2 - 1) * 0.015 * windMod;
            }
        } else if (season === 'winter') {
            // Snow hush: very soft white noise
            for (let i = 0; i < bufferSize; i++) {
                const hush = Math.sin(i * 0.00005) * 0.3 + 0.7;
                data[i] = (Math.random() * 2 - 1) * 0.008 * hush;
            }
        } else {
            // Spring: gentle birds/nature (soft tones)
            for (let i = 0; i < bufferSize; i++) {
                const birdChance = Math.random() > 0.9995 ? Math.sin(i * 0.1) * 0.03 : 0;
                const rustle = (Math.random() * 2 - 1) * 0.005;
                data[i] = birdChance + rustle;
            }
        }

        this.ambientSource = this.ctx.createBufferSource();
        this.ambientSource.buffer = buffer;
        this.ambientSource.loop = true;

        // Filter for warmth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = season === 'summer' ? 6000 : 2000;

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.3; // Very quiet

        this.ambientSource.connect(filter);
        filter.connect(this.ambientGain);
        this.ambientGain.connect(this.ctx.destination);

        this.ambientSource.start();
        this.isAmbientPlaying = true;
    },

    stopAmbientSoundscape() {
        if (this.ambientSource) {
            this.ambientSource.stop();
            this.ambientSource = null;
            this.isAmbientPlaying = false;
        }
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

// ============================================
// Seasonal Themes
// ============================================
function getCurrentSeason() {
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

    // Update season pill
    const seasonPill = document.querySelector('.pill.season');
    if (seasonPill) {
        const seasonNames = {
            spring: 'Spring',
            summer: 'Summer',
            autumn: 'Autumn',
            winter: 'Winter'
        };
        seasonPill.textContent = seasonNames[season];
    }
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
        AudioSystem.playHoverSoft();
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
            updateCoins(10); // Reward for harvesting
            recordHarvest(1, 10); // Track individual harvest
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

// Set canvas to fill the container responsively
function resizeCanvas() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width;
    canvas.height = height;
    layoutPlants();

    // Reinitialize ambient effects for new dimensions
    if (plants.length > 0) {
        initAmbientEffects();
    }
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

// Canvas click handler for harvesting plants
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
        // 0. Quick scale flash for punchy feedback
        if (closestPlant.element) {
            closestPlant.element.style.transform = 'scale(1.3)';
            closestPlant.element.style.transition = 'transform 0.1s ease-out';
        }

        // 1. Spawn particles IMMEDIATELY at current (live) position
        bloomParticles(closestPlant.x, closestPlant.y, 30); // bigger burst for satisfaction
        AudioSystem.playHarvestChime();

        // 2. Now close the real tab (async)
        try {
            await chrome.tabs.remove(closestPlant.tab.id);

            // 3. Remove DOM element if exists
            if (closestPlant.element) {
                closestPlant.element.remove();
            }

            // 4. Remove from plants array and relayout
            plants = plants.filter(p => p !== closestPlant);
            layoutPlants();

            updateCoins(10);
            recordHarvest(1, 10); // Track individual harvest
            updateStatsDisplay();
        } catch (err) {
            console.error("Failed to close tab:", err);
        }
    }
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
        this.swaySpeed = 0.015 + Math.random() * 0.02; // Slower, more varied sway

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
        const swayOffset = Math.sin(this.sway) * 4; // Slightly more sway
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

async function initGarden() {
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

    // Set up Harvest Dormant Tabs button
    const harvestBtn = document.getElementById('harvestAll');
    if (harvestBtn) {
        harvestBtn.addEventListener('click', harvestDormantTabs);
    }

    // Set up Share button
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', captureGardenScreenshot);
    }

    // Set up Share settings button
    const shareSettingsBtn = document.getElementById('shareSettingsBtn');
    if (shareSettingsBtn) {
        shareSettingsBtn.addEventListener('click', showShareSettingsPanel);
    }

    // Set up Garden Stats button
    const statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        statsBtn.addEventListener('click', showGardenStats);
    }

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
    const coinsEarned = harvestedCount * 15;
    updateCoins(coinsEarned);

    // Record stats for lifetime tracking
    recordHarvest(harvestedCount, coinsEarned);

    // Update stats
    updateStatsDisplay();

    // Celebration time! Confetti + happy chime
    if (harvestedCount > 0) {
        AudioSystem.playHarvestAllCelebration();

        // Trigger confetti burst (garden colors)
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 80 + harvestedCount * 10,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFB7C5', '#FFD166', '#A8CABA', '#5D7A4A', '#98BF6A']
            });
        }
    }

    console.log(`Harvested ${harvestedCount} dormant tabs!`);
}

function loop() {
    frameCount++;

    // Draw beautiful background (sunset gradient, light pools, vignette)
    drawBackground();

    // Summer: Draw pulsing sun rays
    if (getCurrentSeason() === 'summer') {
        drawSunRays(ctx);
    }

    // Draw soft clouds drifting across sky
    clouds.forEach(cloud => {
        cloud.update();
        cloud.draw(ctx);
    });

    // Draw ambient particles (fireflies) behind plants
    ambientParticles.forEach(particle => {
        particle.update();
        particle.draw(ctx);
    });

    // Draw butterflies behind plants
    butterflies.forEach(butterfly => {
        butterfly.update();
        butterfly.draw(ctx);
    });

    // Draw seasonal particles (autumn leaves, winter snowflakes)
    seasonalParticles.forEach(particle => {
        particle.update();
        particle.draw(ctx);
    });

    // Draw plants
    plants.forEach(plant => {
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
    lastVisit: Date.now()
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
        { label: 'Harvested', value: gardenStats.totalHarvested, emoji: '🌾' },
        { label: 'Coins Earned', value: gardenStats.coinsEarned, emoji: '✨' },
        { label: 'Garden Age', value: getGardenAge(), emoji: '🌱' },
        { label: 'Day Streak', value: `${gardenStats.currentStreak} days`, emoji: '🔥' },
        { label: 'Best Streak', value: `${gardenStats.longestStreak} days`, emoji: '🏆' },
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
