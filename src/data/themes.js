// Customisation catalogue. Prices are in ✨ NOTES, earned by playing.
// Everything is cosmetic: nothing here makes puzzles easier.

export const THEMES = [
  { id: 'midnight', name: 'MIDNIGHT', price: 0, sky: ['#050a1e', '#0b1538', '#141d48'], glow: '#4a6fe0', glow2: '#6b5bd6', stars: 1 },
  { id: 'aurora', name: 'AURORA', price: 120, sky: ['#03111a', '#0a2a33', '#11393a'], glow: '#43d6a8', glow2: '#7a5cff', stars: 1 },
  { id: 'sunset', name: 'SUNSET', price: 150, sky: ['#130a1d', '#341632', '#53283a'], glow: '#f29a7c', glow2: '#b45cc0', stars: 0.7 },
  { id: 'ocean', name: 'OCEAN', price: 120, sky: ['#020f1d', '#062843', '#0a3a56'], glow: '#38a8f0', glow2: '#2fd0c8', stars: 0.8 },
  { id: 'forest', name: 'FOREST', price: 150, sky: ['#040e0a', '#0b2116', '#143020'], glow: '#76cf92', glow2: '#c8d070', stars: 0.9 },
  { id: 'galaxy', name: 'GALAXY', price: 200, sky: ['#04030e', '#120a2c', '#220f46'], glow: '#a978ff', glow2: '#ff7ac8', stars: 2.4 },
];

export const SKINS = [
  { id: 'pastel', name: 'Pastel', price: 0, desc: 'Soft glowing glass' },
  { id: 'glass', name: 'Crystal', price: 80, desc: 'Clear with a coloured rim' },
  { id: 'pearl', name: 'Pearl', price: 100, desc: 'Moonlit white tiles' },
  { id: 'aurora', name: 'Aurora', price: 140, desc: 'Gentle gradient light' },
];

export const PARTICLES = [
  { id: 'dust', name: 'Star dust', price: 0, desc: 'Slow drifting light' },
  { id: 'fireflies', name: 'Fireflies', price: 60, desc: 'Warm flickers' },
  { id: 'snow', name: 'Snowfall', price: 60, desc: 'Quiet falling flakes' },
  { id: 'sparkle', name: 'Sparkles', price: 90, desc: 'Tiny twinkling crosses' },
];

export const WAVES = [
  { id: 'rings', name: 'Rings', price: 0, desc: 'A single soft ring' },
  { id: 'double', name: 'Double ring', price: 50, desc: 'Two echoing rings' },
  { id: 'bloom', name: 'Bloom', price: 70, desc: 'A glowing bloom' },
  { id: 'ripple', name: 'Ripples', price: 70, desc: 'Water-like ripples' },
];

export const SOUNDS = [
  { id: 'piano', name: 'Soft piano', price: 0, desc: 'Warm felt piano' },
  { id: 'chime', name: 'Glass chime', price: 100, desc: 'Delicate bells' },
  { id: 'musicbox', name: 'Music box', price: 100, desc: 'Tiny metal tines' },
  { id: 'warm', name: 'Warm pad', price: 120, desc: 'Velvet synth' },
];

export const AMBIENCES = [
  { id: 'drift', name: 'Drift', price: 0, desc: 'Pure ambient pad' },
  { id: 'rain', name: 'Night rain', price: 80, desc: 'Pad with soft rain' },
  { id: 'ocean', name: 'Ocean', price: 80, desc: 'Slow distant waves' },
  { id: 'space', name: 'Deep space', price: 100, desc: 'Low cosmic drone' },
];

export const CATALOG = {
  theme: { label: 'Sky', items: THEMES },
  skin: { label: 'Notes', items: SKINS },
  particles: { label: 'Particles', items: PARTICLES },
  waves: { label: 'Waves', items: WAVES },
  sound: { label: 'Sound', items: SOUNDS },
  ambience: { label: 'Ambience', items: AMBIENCES },
};

export const findTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
