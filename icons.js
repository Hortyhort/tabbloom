/**
 * TabBloom Icon System
 * Minimal SVG stroke icons - Apple SF Symbols inspired
 * All icons: 20x20 viewBox, 1.5px stroke, round caps/joins
 */

const Icons = {
  // ========== Brand / Navigation ==========
  flower: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="7" r="2.5"/>
    <circle cx="7" cy="9" r="2.5"/>
    <circle cx="13" cy="9" r="2.5"/>
    <circle cx="8" cy="12" r="2.5"/>
    <circle cx="12" cy="12" r="2.5"/>
    <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none"/>
    <path d="M10 14v4"/>
  </svg>`,

  seedling: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 18v-8"/>
    <path d="M10 14c-4 0-6-3-6-6 3 0 6 2 6 6z"/>
    <path d="M10 10c4 0 6-3 6-6-3 0-6 2-6 6z"/>
  </svg>`,

  leaf: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 17c0-8 4-12 12-14-2 8-6 12-12 14z"/>
    <path d="M5 17c4-4 8-8 12-14"/>
  </svg>`,

  leafDroop: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 12c0-6 3-9 9-10-1.5 6-4.5 9-9 10z"/>
    <path d="M6 12c3-3 6-6 9-10"/>
    <path d="M6 12c-1 2-2 4-1 6"/>
  </svg>`,

  // ========== Actions ==========
  settings: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="2.5"/>
    <path d="M10 2v2.5M10 15.5V18M18 10h-2.5M4.5 10H2M15.66 4.34l-1.77 1.77M6.11 13.89l-1.77 1.77M15.66 15.66l-1.77-1.77M6.11 6.11L4.34 4.34"/>
  </svg>`,

  refresh: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 10a7 7 0 0 1 12.9-3.8"/>
    <path d="M17 10a7 7 0 0 1-12.9 3.8"/>
    <path d="M16 2v4h-4"/>
    <path d="M4 18v-4h4"/>
  </svg>`,

  camera: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="5" width="16" height="12" rx="2"/>
    <circle cx="10" cy="11" r="3"/>
    <path d="M6 5l1-2h6l1 2"/>
  </svg>`,

  share: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2v10"/>
    <path d="M6 6l4-4 4 4"/>
    <path d="M16 11v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5"/>
  </svg>`,

  harvest: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 7c0-3 2-5 6-5s6 2 6 5"/>
    <path d="M7 7v5c0 1 .5 2 3 2s3-1 3-2V7"/>
    <path d="M10 14v4"/>
    <path d="M7 18h6"/>
  </svg>`,

  // ========== Status / Info ==========
  coin: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="7"/>
    <circle cx="10" cy="10" r="4"/>
  </svg>`,

  fire: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2c0 3-2 5-2 8 0 2.5 2 4 4 4s4-1.5 4-4c0-4-3-6-3-8"/>
    <path d="M10 18c-2 0-4-1.5-4-4 0-3 2-5 2-8"/>
    <path d="M10 12c0 1 .5 2 2 2s2-1 2-2c0-2-1.5-3-1.5-4"/>
  </svg>`,

  chart: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="10" width="3" height="7"/>
    <rect x="8.5" y="6" width="3" height="11"/>
    <rect x="14" y="3" width="3" height="14"/>
  </svg>`,

  trophy: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 3h10v5a5 5 0 0 1-10 0V3z"/>
    <path d="M5 5H3a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3"/>
    <path d="M15 5h2a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3"/>
    <path d="M10 13v3"/>
    <path d="M6 18h8"/>
  </svg>`,

  star: `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 14.27l-4.77 2.44.91-5.32-3.87-3.77 5.34-.78L10 2z"/>
  </svg>`,

  heart: `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 17.5s-7-4.5-7-9c0-2.5 2-4.5 4.5-4.5 1.5 0 2.5.7 2.5.7s1-.7 2.5-.7c2.5 0 4.5 2 4.5 4.5 0 4.5-7 9-7 9z"/>
  </svg>`,

  // ========== Settings Icons ==========
  speaker: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 8h2l4-4v12l-4-4H3V8z"/>
    <path d="M13 7a4 4 0 0 1 0 6"/>
    <path d="M15 5a7 7 0 0 1 0 10"/>
  </svg>`,

  speakerOff: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 8h2l4-4v12l-4-4H3V8z"/>
    <path d="M14 8l4 4"/>
    <path d="M18 8l-4 4"/>
  </svg>`,

  bolt: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 2L4 11h5l-1 7 7-9h-5l1-7z"/>
  </svg>`,

  sparkle: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2v4M10 14v4M2 10h4M14 10h4"/>
    <path d="M4.93 4.93l2.83 2.83M12.24 12.24l2.83 2.83M15.07 4.93l-2.83 2.83M7.76 12.24l-2.83 2.83"/>
  </svg>`,

  lock: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="9" width="12" height="9" rx="2"/>
    <path d="M7 9V6a3 3 0 0 1 6 0v3"/>
  </svg>`,

  eye: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
    <circle cx="10" cy="10" r="2.5"/>
  </svg>`,

  eyeOff: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 2l16 16"/>
    <path d="M9.5 5.1A6 6 0 0 1 18 10a11.2 11.2 0 0 1-1.8 2.7"/>
    <path d="M5.6 5.6A11.2 11.2 0 0 0 2 10a6 6 0 0 0 9.2 4.2"/>
  </svg>`,

  download: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2v10"/>
    <path d="M6 8l4 4 4-4"/>
    <path d="M3 14v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
  </svg>`,

  trash: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 5h14"/>
    <path d="M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>
    <path d="M5 5l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"/>
  </svg>`,

  // ========== Seasonal ==========
  sun: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="4"/>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41"/>
  </svg>`,

  snowflake: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2v16M2 10h16"/>
    <path d="M5.64 5.64l8.72 8.72M14.36 5.64l-8.72 8.72"/>
    <path d="M10 4l-2 2 2-2 2 2"/>
    <path d="M10 16l-2-2 2 2 2-2"/>
  </svg>`,

  leafFall: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3c-4 0-7 3-7 7 0 2 1 4 3 5"/>
    <path d="M12 3c0 4-3 7-7 7"/>
    <path d="M8 15c2 3 5 2 8 0"/>
    <path d="M14 13l2 2-2 2"/>
  </svg>`,

  butterfly: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 5v10"/>
    <ellipse cx="6" cy="8" rx="4" ry="5"/>
    <ellipse cx="14" cy="8" rx="4" ry="5"/>
    <ellipse cx="6" cy="14" rx="3" ry="3"/>
    <ellipse cx="14" cy="14" rx="3" ry="3"/>
  </svg>`,

  // ========== UI Elements ==========
  chevronDown: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 7l5 5 5-5"/>
  </svg>`,

  chevronRight: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 5l5 5-5 5"/>
  </svg>`,

  close: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 5l10 10M15 5L5 15"/>
  </svg>`,

  check: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 10l4 4 8-8"/>
  </svg>`,

  info: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="7"/>
    <path d="M10 9v4"/>
    <circle cx="10" cy="6.5" r="0.5" fill="currentColor"/>
  </svg>`,

  menu: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 5h14M3 10h14M3 15h14"/>
  </svg>`,

  plus: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 4v12M4 10h12"/>
  </svg>`,

  search: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="9" cy="9" r="5"/>
    <path d="M13 13l4 4"/>
  </svg>`,

  filter: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 4h14l-5 6v6l-4 2V10L3 4z"/>
  </svg>`,

  // ========== Helpers ==========

  /**
   * Get icon HTML with custom size and color
   * @param {string} name - Icon name
   * @param {number} size - Size in pixels (default 20)
   * @param {string} color - CSS color (default 'currentColor')
   * @returns {string} SVG HTML string
   */
  get(name, size = 20, color = 'currentColor') {
    const icon = this[name];
    if (!icon) {
      console.warn(`Icon "${name}" not found`);
      return '';
    }

    // Replace size and color in SVG
    return icon
      .replace(/width="20"/g, `width="${size}"`)
      .replace(/height="20"/g, `height="${size}"`)
      .replace(/stroke="currentColor"/g, `stroke="${color}"`);
  },

  /**
   * Insert icon into DOM element
   * @param {HTMLElement} element - Target element
   * @param {string} name - Icon name
   * @param {number} size - Size in pixels
   */
  insert(element, name, size = 20) {
    if (element) {
      element.innerHTML = this.get(name, size);
    }
  },

  /**
   * Create a span element with icon
   * @param {string} name - Icon name
   * @param {number} size - Size in pixels
   * @param {string} className - Additional CSS class
   * @returns {HTMLElement} Span element containing icon
   */
  create(name, size = 20, className = '') {
    const span = document.createElement('span');
    span.className = `icon ${className}`.trim();
    span.innerHTML = this.get(name, size);
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Icons = Icons;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Icons;
}
