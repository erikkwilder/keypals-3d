import './lib/polyfills';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/bagel-fat-one/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/600.css';
import '@fontsource/lexend/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
// tells the start-up check in index.html that the game is running
(window as unknown as { __keypalsStarted: boolean }).__keypalsStarted = true;
