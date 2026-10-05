// LUMEN — entry point.
import { app } from './app.js';

app.init();

// Offline support (PWA). Registered after load so it never delays the game.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Expose for debugging / automated tests.
window.__lumen = app;
