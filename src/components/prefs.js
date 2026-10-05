// Live visual preferences shared by components (palette, note names, skin).

import { PALETTES } from '../data/notes.js';

export const prefs = {
  palette: PALETTES.normal,
  noteNames: 'solfege',
  reduced: false,
};

export function applyPrefs(settings) {
  prefs.palette = PALETTES[settings.colorMode] || PALETTES.normal;
  prefs.noteNames = settings.noteNames;
  prefs.reduced = settings.animations === 'reduced';
}
