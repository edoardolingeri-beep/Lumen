// Line icons (24×24, stroke = currentColor).

const P = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  back: '<path d="M14.5 6 8.5 12l6 6"/>',
  close: '<path d="M7 7l10 10M17 7 7 17"/>',
  music: '<path d="M9 17.5V6.5l9-2v11"/><circle cx="6.8" cy="17.5" r="2.2"/><circle cx="15.8" cy="15.5" r="2.2"/>',
  musicOff: '<path d="M9 17.5V6.5l9-2v11"/><circle cx="6.8" cy="17.5" r="2.2"/><circle cx="15.8" cy="15.5" r="2.2"/><path d="M4 4l16 16"/>',
  sound: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  soundOff: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',
  undo: '<path d="M9 7 5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/>',
  redo: '<path d="m15 7 4 4-4 4"/><path d="M19 11h-9a5 5 0 0 0 0 10h2"/>',
  hint: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-.7c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5z"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  star: '<path d="m12 3.6 2.5 5.3 5.7.7-4.2 3.9 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.2-3.9 5.7-.7z"/>',
  starFill: '<path d="m12 3.6 2.5 5.3 5.7.7-4.2 3.9 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.2-3.9 5.7-.7z" fill="currentColor"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  sparkle: '<path d="M12 3.5c.6 4 2.5 6.4 6.5 7.3-4 .9-5.9 3.3-6.5 7.7-.6-4.4-2.5-6.8-6.5-7.7 4-.9 5.9-3.3 6.5-7.3z" fill="currentColor" stroke="none"/><path d="M18.5 3.5v3M17 5h3" stroke-width="1.3"/>',
  journey: '<circle cx="5.5" cy="17" r="1.6"/><circle cx="11" cy="9" r="1.6"/><circle cx="18.5" cy="6" r="1.6"/><circle cx="16" cy="15.5" r="1.6"/><path d="m6.5 15.6 3.6-5.2M12.5 8.4l4.6-1.8M17.9 7.6l-1.4 6.4"/>',
  daily: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/><circle cx="12" cy="15" r="1.4" fill="currentColor"/>',
  zen: '<path d="M12 19c-4.5 0-7.5-2.6-8.5-6 3 0 5.8.8 8.5 3.2 2.7-2.4 5.5-3.2 8.5-3.2-1 3.4-4 6-8.5 6z"/><path d="M12 16.2c-1.7-2-2.4-4.4-2-7.4 1 .6 1.6 1.2 2 2 .4-.8 1-1.4 2-2 .4 3-.3 5.4-2 7.4z"/>',
  theme: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-2-.5-1.3.3-2.5 1.7-2.5h1.9a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="7.8" cy="11" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.3" r="1.1" fill="currentColor"/><circle cx="15" cy="7.6" r="1.1" fill="currentColor"/>',
  check: '<path d="m5.5 12.5 4 4 9-9"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  sky: '<path d="M18.5 14.5A7 7 0 0 1 9.5 5.5a7 7 0 1 0 9 9z"/><path d="M17 3.5v3M15.5 5h3"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>',
  loop: '<path d="M17 7H8a4 4 0 0 0 0 8h1"/><path d="m14.5 4.5 2.5 2.5-2.5 2.5"/><path d="M7 17h9a4 4 0 0 0 0-8h-1"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>',
  listen: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3.5" y="13" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="13" width="4" height="6.5" rx="1.5"/>',
};

export function icon(name, size = 22, extra = '') {
  return `<svg class="ico ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
