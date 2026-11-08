<script setup>
defineProps({
  cue: { type: Object, default: null },
});
</script>

<template>
  <span
    v-if="cue"
    :key="cue.id"
    class="not-yet"
    :style="{ left: `${cue.x}px`, top: `${cue.y}px` }"
    role="status"
  >not yet</span>
</template>

<style scoped>
.not-yet {
  position: fixed;
  z-index: 3;
  transform: translate(-50%, -140%);
  padding: 0.2rem 0.45rem;
  border-radius: 2px;
  background: var(--ink);
  color: var(--ground);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  pointer-events: none;
  animation: not-yet-fade 1.1s ease-out forwards;
}

@keyframes not-yet-fade {
  0% {
    opacity: 0;
    translate: 0 4px;
  }
  15%,
  70% {
    opacity: 1;
    translate: 0 0;
  }
  100% {
    opacity: 0;
    translate: 0 -4px;
  }
}

@keyframes not-yet-fade-still {
  0%,
  100% {
    opacity: 0;
  }
  15%,
  70% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .not-yet {
    animation-name: not-yet-fade-still;
  }
}
</style>
