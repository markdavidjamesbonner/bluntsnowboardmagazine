import { createApp } from 'vue';

import App from './App.vue';
import { setupConsoleUnlock } from './composables/consoleUnlock.js';
import './styles/global.css';

// Restored before mount so a deep link to a console-unlocked issue isn't bounced back to the tree.
await setupConsoleUnlock();

createApp(App).mount('#app');
