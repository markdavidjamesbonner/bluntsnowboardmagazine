<script setup>
defineProps({
  text: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  isFading: { type: Boolean, default: false },
});
</script>

<template>
  <span
    class="tree-cue"
    :class="{ 'is-fading': isFading }"
    :style="{ left: `${x}px`, top: `${y}px` }"
    :role="isFading ? 'status' : undefined"
    :aria-hidden="isFading ? undefined : 'true'"
  >{{ text }}</span>
</template>

<style scoped>
.tree-cue {
  position: fixed;
  z-index: 3;
  transform: translate(-50%, -150%);
  padding: 0.35rem 0.55rem;
  border: 1px solid #000;
  border-radius: 5px;
  background: #fff;
  color: #000;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}

.tree-cue.is-fading {
  animation: tree-cue-fade 1.1s ease-out forwards;
}

@keyframes tree-cue-fade {
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

@keyframes tree-cue-fade-still {
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
  .tree-cue.is-fading {
    animation-name: tree-cue-fade-still;
  }
}
</style>
