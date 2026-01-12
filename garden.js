// garden.js - The TabBloom Rendering Engine
const canvas = document.getElementById('garden-canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

let plants = [];
let particles = [];
let width, height;
let hoveredPlant = null;

// Configuration
const COLORS = {
    blooming: '#FFB7C5',
    healthy: '#4A7043',
    wilted: '#D2B48C',
    text: '#1d1d1f'
};

// Grid layout settings - larger plants with more breathing room
const PLANT_SIZE = 80;
const PLANT_HEIGHT = 100;
const SPACING = 100;
const SCALE = 1.8;

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
    plant.style.transition = 'transform 0.4s ease, filter 0.3s ease';
    plant.style.cursor = 'pointer';
    plant.style.zIndex = '10';

    plant.addEventListener('mouseenter', () => {
        plant.style.transform = 'scale(1.15) rotate(4deg)';
        plant.style.filter = 'drop-shadow(0 0 12px rgba(255, 183, 197, 0.8)) brightness(1.2)';
        // Show tooltip
        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y - 60}px`;
        tooltip.innerHTML = `<strong>${tab.title}</strong><br><span style="font-size:10px; opacity:0.7">${new URL(tab.url).hostname}</span>`;
        tooltip.classList.remove('hidden');
    });

    plant.addEventListener('mouseleave', () => {
        plant.style.transform = 'scale(1) rotate(0deg)';
        plant.style.filter = 'none';
        tooltip.classList.add('hidden');
    });

    plant.addEventListener('click', () => {
        console.log('Harvesting tab:', tab.title);
        bloomParticles(x, y);
        chrome.tabs.remove(tab.id);
        plant.remove();
        // Remove from plants array
        plants = plants.filter(p => p.tabId !== tab.id);
        layoutPlants();
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
            color: ['#FFB7C5', '#FFD166', '#A8CABA', '#4A7043'][Math.floor(Math.random() * 4)]
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

class Plant {
    constructor(tab) {
        this.tabId = tab.id;
        this.tab = tab; // Store full tab reference
        this.title = tab.title;
        this.url = tab.url;
        this.x = 0;
        this.y = 0;
        this.element = null; // DOM element reference
        this.age = Math.random(); // Placeholder for activity logic
        this.sway = Math.random() * Math.PI * 2; // Random start phase
        this.swaySpeed = 0.02 + Math.random() * 0.02;
    }

    update() {
        this.sway += this.swaySpeed;
    }

    draw() {
        const swayOffset = Math.sin(this.sway) * 5;
        const isHovered = this === hoveredPlant;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Apply hover effects
        if (isHovered) {
            ctx.scale(SCALE * 1.15, SCALE * 1.15); // Scale up when hovered
            ctx.shadowColor = 'rgba(255, 183, 197, 0.8)';
            ctx.shadowBlur = 12;
        } else {
            ctx.scale(SCALE, SCALE); // Normal scale
        }

        // Draw Stem
        ctx.strokeStyle = COLORS.healthy;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.quadraticCurveTo(swayOffset, 10, swayOffset, 0);
        ctx.stroke();

        // Draw Bloom based on "health"
        if (this.age < 0.7) {
            // Healthy Bloom
            ctx.fillStyle = COLORS.blooming;
            ctx.beginPath();
            ctx.arc(swayOffset, -5, 12, 0, Math.PI * 2); // Larger bloom
            ctx.fill();

            // Center
            ctx.fillStyle = '#FFD166';
            ctx.beginPath();
            ctx.arc(swayOffset, -5, 5, 0, Math.PI * 2); // Larger center
            ctx.fill();
        } else {
            // Wilted
            ctx.fillStyle = COLORS.wilted;
            ctx.beginPath();
            ctx.ellipse(swayOffset, 5, 8, 14, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

async function initGarden() {
    const tabs = await chrome.tabs.query({});
    plants = tabs.map(tab => new Plant(tab));
    layoutPlants();

    // Create DOM overlay elements for each plant
    plants.forEach(plant => {
        plant.element = createPlantElement(plant.tab, plant.x, plant.y);
    });

    // Start Game Loop
    requestAnimationFrame(loop);
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
        p.vy += 0.08; // gentle gravity
        p.life--;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life / 80;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(loop);
}

resizeCanvas();
initGarden();
