<script setup>
import { computed, ref, watch } from 'vue';

import FlipbookViewer from './components/FlipbookViewer.vue';
import TreeCanvas from './components/TreeCanvas.vue';
import TreeCue from './components/TreeCue.vue';
import { useCalendarPhase } from './composables/useCalendarPhase.js';
import { useFlipbookRoute } from './composables/useFlipbookRoute.js';
import { CALENDAR_YEAR, ENTRIES } from './content_manifest/manifest.js';
import { getMastheadCopy } from './content_manifest/masthead.js';

const NOT_YET_CUE_MS = 1100;

const { phase, unlockedThroughDay } = useCalendarPhase(CALENDAR_YEAR);
const masthead = computed(() => getMastheadCopy(phase.value, unlockedThroughDay.value));

const notYetCue = ref(null);
const hoverCue = ref(null);
const isSceneUnavailable = ref(false);
let cueId = 0;

function isUnlocked(entry) {
  return entry.day <= unlockedThroughDay.value;
}

const { routeIssueId, openIssue, closeIssue } = useFlipbookRoute();
const activeEntry = computed(() => {
  const entry = ENTRIES.find((candidate) => candidate.id === routeIssueId.value);
  return entry && isUnlocked(entry) ? entry : null;
});

// A shared link to an issue that hasn't unlocked yet (or doesn't exist) just lands on the tree.
watch(
  [routeIssueId, activeEntry],
  ([issueId, entry]) => {
    if (issueId && !entry) {
      closeIssue();
    }
  },
  { immediate: true },
);

function openEntry(entry) {
  if (!isUnlocked(entry)) {
    return;
  }
  openIssue(entry.id);
}

function showNotYet(_entry, point) {
  cueId += 1;
  const id = cueId;
  notYetCue.value = { id, ...point };
  window.setTimeout(() => {
    if (notYetCue.value?.id === id) {
      notYetCue.value = null;
    }
  }, NOT_YET_CUE_MS);
}

function showHover(entry, point) {
  hoverCue.value = entry ? { text: entry.number, ...point } : null;
}
</script>

<template>
  <TreeCanvas
    :entries="ENTRIES"
    :unlocked-through-day="unlockedThroughDay"
    :is-paused="Boolean(activeEntry)"
    @open="openEntry"
    @locked="showNotYet"
    @hover="showHover"
    @unavailable="isSceneUnavailable = true"
  />

  <header class="hero">
    <h1>blunt snowboard magazine</h1>
    <p>{{ masthead.tagline }}</p>
    <p class="status">{{ masthead.status }}</p>
    <p v-if="masthead.aside" class="aside">{{ masthead.aside }}</p>
  </header>

  <nav class="ornament-index" :class="{ 'is-visible': isSceneUnavailable }" aria-label="Ornaments">
    <ul>
      <li v-for="entry in ENTRIES" :key="entry.day">
        <button type="button" :disabled="!isUnlocked(entry)" @click="openEntry(entry)">
          December {{ entry.day }}: {{ entry.title }}
        </button>
      </li>
    </ul>
  </nav>

  <TreeCue v-if="notYetCue" :key="notYetCue.id" text="not yet" :x="notYetCue.x" :y="notYetCue.y" is-fading />
  <TreeCue v-else-if="hoverCue && !activeEntry" :text="hoverCue.text" :x="hoverCue.x" :y="hoverCue.y" />
  <FlipbookViewer v-if="activeEntry" :key="activeEntry.id" :entry="activeEntry" @close="closeIssue" />
</template>

<style scoped>
.hero {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1;
  padding: max(3.5vh, env(safe-area-inset-top)) 4vw 0;
  pointer-events: none;
}

h1 {
  margin: 0;
  color: var(--neon-pink);
  font-size: min(max(6.4vw, 1.9rem), 8.5vh);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 0.95;
}

p {
  margin: 0.7em 0 0;
  max-width: 34ch;
  color: var(--ink-soft);
  font-size: clamp(0.95rem, 1.25vw, 1.15rem);
  line-height: 1.35;
}

.status {
  margin-top: 0.6em;
  color: var(--ink);
  font-weight: 700;
}

.aside {
  margin-top: 0.3em;
  font-size: clamp(0.85rem, 1.05vw, 1rem);
}

/* Keyboard / assistive path to the same ornaments: hidden until focused, shown if WebGL fails. */
.ornament-index:not(:focus-within, .is-visible) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.ornament-index {
  position: fixed;
  left: 4vw;
  bottom: 3vh;
  z-index: 2;
  max-height: 50vh;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  background: var(--ground);
  border: 1px solid var(--ink);
}

.ornament-index ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ornament-index button {
  padding: 0.2rem 0;
  border: 0;
  background: none;
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}

.ornament-index button:disabled {
  color: var(--ink-soft);
  opacity: 0.55;
  cursor: default;
}
</style>
