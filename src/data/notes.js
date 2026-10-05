// The seven notes of LUMEN. Degree 1..7 maps to DO..SI (C major).
// Degree 0 is a rest (silence).

export const REST = 0;

export const NOTES = [
  null,
  { deg: 1, name: 'DO', letter: 'C', semitone: 0, symbol: 'circle' },
  { deg: 2, name: 'RE', letter: 'D', semitone: 2, symbol: 'diamond' },
  { deg: 3, name: 'MI', letter: 'E', semitone: 4, symbol: 'triangle' },
  { deg: 4, name: 'FA', letter: 'F', semitone: 5, symbol: 'square' },
  { deg: 5, name: 'SOL', letter: 'G', semitone: 7, symbol: 'star' },
  { deg: 6, name: 'LA', letter: 'A', semitone: 9, symbol: 'diamondOutline' },
  { deg: 7, name: 'SI', letter: 'B', semitone: 11, symbol: 'circleOutline' },
];

// Soft pastel palette (normal) and a colour-blind friendly palette that keeps
// strong luminance differences. Symbols are always shown, so colour is never
// the only cue.
export const PALETTES = {
  normal: [
    '#9aa3b8',
    '#7fa7ff', // DO blue
    '#8fd6f5', // RE azure
    '#98e2b4', // MI green
    '#f2df98', // FA yellow
    '#ffbf8f', // SOL orange
    '#ffa9c9', // LA pink
    '#c2a7ff', // SI violet
  ],
  colorblind: [
    '#9aa3b8',
    '#4f8fe0', // DO strong blue
    '#a6dcff', // RE pale sky
    '#2fb59a', // MI bluish green
    '#f0e442', // FA yellow
    '#e69f00', // SOL orange
    '#f4a3c8', // LA reddish purple, light
    '#8a63d2', // SI deep violet
  ],
};

export function noteFrequency(deg, octave = 4) {
  if (!deg) return 0;
  const n = NOTES[deg];
  const midi = 12 * (octave + 1) + n.semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteLabel(deg, style = 'solfege') {
  if (!deg) return 'REST';
  return style === 'letters' ? NOTES[deg].letter : NOTES[deg].name;
}

// Inline SVG symbol for a note (or rest). Size in px; colour via currentColor.
export function symbolSVG(deg, size = 24) {
  const s = size;
  const shape = deg ? NOTES[deg].symbol : 'rest';
  let inner;
  switch (shape) {
    case 'circle':
      inner = '<circle cx="12" cy="12" r="6.2" fill="currentColor"/>';
      break;
    case 'diamond':
      inner = '<path d="M12 4.6 19.4 12 12 19.4 4.6 12Z" fill="currentColor"/>';
      break;
    case 'triangle':
      inner = '<path d="M12 5.2 19 17.8H5Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>';
      break;
    case 'square':
      inner = '<rect x="6.3" y="6.3" width="11.4" height="11.4" rx="1.6" fill="currentColor"/>';
      break;
    case 'star':
      inner = '<path d="M12 3.8 14.1 9.9 20.2 12 14.1 14.1 12 20.2 9.9 14.1 3.8 12 9.9 9.9Z" fill="currentColor"/>';
      break;
    case 'diamondOutline':
      inner = '<path d="M12 5.4 18.6 12 12 18.6 5.4 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
      break;
    case 'circleOutline':
      inner = '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/>';
      break;
    default:
      inner = '<path d="M6.5 12h11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
  }
  return `<svg class="sym" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

/** '#rrggbb' + alpha → 'rgba(r,g,b,a)'. */
export function alpha(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/** Set --c, --c-soft, --c-soft2, --c-glow, --c-line on an element for a colour. */
export function setColorVars(el, hex, prefix = '--c') {
  el.style.setProperty(prefix, hex);
  el.style.setProperty(`${prefix}-soft`, alpha(hex, 0.16));
  el.style.setProperty(`${prefix}-soft2`, alpha(hex, 0.34));
  el.style.setProperty(`${prefix}-glow`, alpha(hex, 0.5));
  el.style.setProperty(`${prefix}-line`, alpha(hex, 0.42));
}
