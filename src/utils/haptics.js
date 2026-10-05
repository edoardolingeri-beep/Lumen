// Optional, very light vibration (Android/Chrome; silently ignored elsewhere).

import { save } from './storage.js';

function vibrate(pattern) {
  if (!save.data.settings.vibration) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    /* not supported */
  }
}

export const haptics = {
  note: () => vibrate(6),
  tap: () => vibrate(4),
  drop: () => vibrate(10),
  soft: () => vibrate([4, 30, 4]),
  success: () => vibrate([14, 60, 18, 60, 36]),
  world: () => vibrate([20, 80, 20, 80, 20, 80, 60]),
};
