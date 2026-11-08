<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createBook } from '../flipbook/createBook.js';
import { flipbookImageUrl } from '../utils/assetUrl.js';
import { spreadPageIndexes } from '../utils/flipbookLayout.js';

const props = defineProps({
  entry: { type: Object, required: true },
});
const emit = defineEmits(['close']);

const dialogRef = ref(null);
const stageRef = ref(null);
const zoomRef = ref(null);
const thumbStripRef = ref(null);
const currentIndex = ref(0);
const isPortrait = ref(false);
const isZoomed = ref(false);

const pageCount = props.entry.flipbook.pageCount;
const visiblePages = computed(() => spreadPageIndexes(currentIndex.value, pageCount, isPortrait.value));
let book = null;
let panStart = null;

function handleKeydown(event) {
  // Handled here (not only via the dialog's native cancel) so one press backs out exactly one
  // level; preventDefault stops the browser from also cancelling the dialog on the same press.
  if (event.key === 'Escape') {
    event.preventDefault();
    handleCancel();
    return;
  }
  if (isZoomed.value) {
    return;
  }
  if (event.key === 'ArrowRight') {
    book.flipNext();
  } else if (event.key === 'ArrowLeft') {
    book.flipPrev();
  }
}

// Esc backs out one level: zoom first, then the flipbook.
function handleCancel() {
  if (isZoomed.value) {
    isZoomed.value = false;
  } else {
    emit('close');
  }
}

async function toggleZoom() {
  isZoomed.value = !isZoomed.value;
  if (!isZoomed.value) {
    return;
  }
  await nextTick();
  const zoom = zoomRef.value;
  zoom.scrollLeft = (zoom.scrollWidth - zoom.clientWidth) / 2;
  zoom.scrollTop = (zoom.scrollHeight - zoom.clientHeight) / 2;
}

// Touch pans natively by scrolling; a mouse needs click-and-drag.
function startPan(event) {
  if (event.pointerType !== 'mouse') {
    return;
  }
  panStart = { x: event.clientX, y: event.clientY, left: zoomRef.value.scrollLeft, top: zoomRef.value.scrollTop };
  zoomRef.value.setPointerCapture(event.pointerId);
}

function movePan(event) {
  if (!panStart) {
    return;
  }
  zoomRef.value.scrollLeft = panStart.left - (event.clientX - panStart.x);
  zoomRef.value.scrollTop = panStart.top - (event.clientY - panStart.y);
}

function endPan() {
  panStart = null;
}

watch(visiblePages, async () => {
  await nextTick();
  thumbStripRef.value
    ?.querySelector('[aria-current="page"]')
    ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
});

onMounted(() => {
  dialogRef.value.showModal();
  book = createBook(stageRef.value, {
    issueId: props.entry.id,
    pageCount,
    aspect: props.entry.flipbook.aspect,
    onFlip: (pageIndex) => {
      currentIndex.value = pageIndex;
    },
    onLayout: (portrait) => {
      isPortrait.value = portrait;
    },
  });
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  book?.destroy();
});
</script>

<template>
  <dialog ref="dialogRef" class="flipbook" :aria-label="entry.title" @cancel.prevent="handleCancel">
    <header class="toolbar">
      <h2>{{ entry.title }}</h2>
      <button type="button" class="icon-button" aria-label="Zoom" :aria-pressed="isZoomed" @click="toggleZoom">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
          <path v-if="!isZoomed" d="M10.5 7.5v6M7.5 10.5h6" />
          <path v-else d="M7.5 10.5h6" />
        </svg>
      </button>
      <button type="button" class="icon-button" aria-label="Close" @click="emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </header>

    <div ref="stageRef" class="stage" />

    <div
      v-if="isZoomed"
      ref="zoomRef"
      class="zoom"
      @pointerdown="startPan"
      @pointermove="movePan"
      @pointerup="endPan"
      @pointercancel="endPan"
    >
      <div class="zoom-spread">
        <img
          v-for="pageIndex in visiblePages"
          :key="pageIndex"
          :src="flipbookImageUrl(entry.id, 'page', pageIndex + 1)"
          :alt="`Page ${pageIndex + 1}`"
          draggable="false"
        />
      </div>
    </div>

    <nav ref="thumbStripRef" class="thumbs" aria-label="Pages">
      <button
        v-for="pageNumber in pageCount"
        :key="pageNumber"
        type="button"
        :aria-label="`Page ${pageNumber}`"
        :aria-current="visiblePages.includes(pageNumber - 1) ? 'page' : undefined"
        :style="{ aspectRatio: entry.flipbook.aspect }"
        @click="book.flipTo(pageNumber - 1)"
      >
        <img :src="flipbookImageUrl(entry.id, 'thumb', pageNumber)" alt="" loading="lazy" draggable="false" />
      </button>
    </nav>
  </dialog>
</template>

<style scoped>
.flipbook {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: var(--ink);
  color: var(--ground);
}

.flipbook::backdrop {
  background: var(--ink);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: max(0.6rem, env(safe-area-inset-top)) 1rem 0.6rem 1.25rem;
}

h2 {
  flex: 1;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  opacity: 0.85;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.icon-button:hover,
.icon-button[aria-pressed='true'] {
  background: rgb(255 255 255 / 0.12);
}

.icon-button svg {
  width: 1.4rem;
  height: 1.4rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.stage,
.zoom {
  grid-row: 2;
  grid-column: 1;
  min-height: 0;
}

.stage {
  display: grid;
  place-items: center;
  padding: 0.5rem 2vw;
  overflow: hidden;
}

/* Book pages are built outside Vue (createBook.js), so they're styled through :deep. */
.stage :deep(.flipbook-page) {
  background: #fff;
}

.stage :deep(.flipbook-page img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

.zoom {
  z-index: 1;
  overflow: auto;
  background: var(--ink);
  cursor: grab;
  overscroll-behavior: contain;
}

.zoom:active {
  cursor: grabbing;
}

.zoom-spread {
  display: flex;
  justify-content: center;
  width: max-content;
  min-width: 100%;
  padding: 2rem;
}

.zoom-spread img {
  display: block;
  height: 190vh;
  user-select: none;
}

.thumbs {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.6rem 1.25rem max(0.75rem, env(safe-area-inset-bottom));
  scrollbar-width: thin;
}

.thumbs button {
  flex: none;
  height: 4rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.06);
  cursor: pointer;
  opacity: 0.6;
}

.thumbs button:hover {
  opacity: 0.9;
}

.thumbs button[aria-current='page'] {
  border-color: var(--neon-pink);
  opacity: 1;
}

.thumbs img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
