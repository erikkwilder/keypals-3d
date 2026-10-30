import './lib/polyfills';
// the fonts, in the Latin letters only (names with accents are in latin-ext for the two everyday fonts):
// every script a font comes in added a long list of font declarations to the first page's styles
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/fredoka/latin-ext-400.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-ext-400.css';
import '@fontsource/bagel-fat-one/latin-400.css';
import '@fontsource/fraunces/latin-500.css';
import '@fontsource/fraunces/latin-700.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/lexend/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-700.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

// a screen's code that won't download after the game was updated (this page still asks for the old
// files): load the page again, once, to get the new ones
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('keypals-reloaded')) return;
    sessionStorage.setItem('keypals-reloaded', '1');
  } catch { return; }
  e.preventDefault();
  location.reload();
});

mount(App, { target: document.getElementById('app')! });
// the loading screen's words give way to the first screen's own (its picture stays until the 3D is up)
document.documentElement.classList.add('kp-up');
// tells the start-up check in index.html that the game is running
(window as unknown as { __keypalsStarted: boolean }).__keypalsStarted = true;
