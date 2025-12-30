/**
 * Entry point loader
 * Ensures the DOM is ready before executing the large application module.
 *
 * The full app previously lived in this file; it now lives in `mainApp.js`.
 * This keeps initialization order predictable and makes refactors safer.
 */

async function domReady() {
  if (document.readyState === 'loading') {
    await new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
}

async function boot() {
  await domReady();
  await import('./mainApp.js');
}

boot();




