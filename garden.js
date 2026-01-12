// garden.js - The TabBloom Rendering Engine
const canvas = document.getElementById('garden-canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

let plants = [];
let width, height;

// Configuration
const COLORS = {
    blooming: '#FFB7C5',
    healthy: '#4A7043',
    wilted: '#D2B48C',
    text: '#1d1d1f'
};

// Grid layout settings - larger plants with more breathing room
const PLANT_SIZE = 60;
const SPACING = 80;
const SCALE = 1.8;

// Set canvas to fill the container responsively
function resizeCanvas() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width;
    canvas.height = height;
    layoutPlants();
}

window.addEventListener('resize', resizeCanvas);

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
    });
}

class Plant {
    constructor(tab) {
        this.tabId = tab.id;
        this.title = tab.title;
        this.url = tab.url;
        this.x = 0;
        this.y = 0;
        this.age = Math.random(); // Placeholder for activity logic
        this.sway = Math.random() * Math.PI * 2; // Random start phase
        this.swaySpeed = 0.02 + Math.random() * 0.02;
    }

    update() {
        this.sway += this.swaySpeed;
    }

    draw() {
        const swayOffset = Math.sin(this.sway) * 5;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(SCALE, SCALE); // Scale up for larger plants

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

    // Start Game Loop
    requestAnimationFrame(loop);
}

function loop() {
    ctx.clearRect(0, 0, width, height);

    plants.forEach(plant => {
        plant.update();
        plant.draw();
    });

    requestAnimationFrame(loop);
}

// Interactivity - adjusted hit detection for larger scaled plants
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hovered = null;
    const hitRadius = 25 * SCALE; // Scale hit detection with plant size

    plants.forEach(p => {
        const dx = p.x - mx;
        const dy = p.y - my;
        if (Math.sqrt(dx*dx + dy*dy) < hitRadius) {
            hovered = p;
        }
    });

    if (hovered) {
        tooltip.style.left = `${mx + 15}px`;
        tooltip.style.top = `${my - 40}px`;
        tooltip.innerHTML = `<strong>${hovered.title}</strong><br><span style="font-size:10px; opacity:0.7">${new URL(hovered.url).hostname}</span>`;
        tooltip.classList.remove('hidden');
        canvas.style.cursor = 'pointer';
    } else {
        tooltip.classList.add('hidden');
        canvas.style.cursor = 'default';
    }
});

resizeCanvas();
initGarden();
