<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { TreeScene } from '../tree_scene/TreeScene.js';

const props = defineProps({
  entries: { type: Array, required: true },
  unlockedThroughDay: { type: Number, required: true },
  isPaused: { type: Boolean, default: false },
});
const emit = defineEmits(['open', 'locked', 'unavailable']);

const containerRef = ref(null);
let treeScene = null;

onMounted(() => {
  try {
    treeScene = new TreeScene(containerRef.value, {
      entries: props.entries,
      onOpen: (entry) => emit('open', entry),
      onLockedTap: (entry, point) => emit('locked', entry, point),
    });
    treeScene.setUnlockedThroughDay(props.unlockedThroughDay);
    treeScene.setPaused(props.isPaused);
  } catch (error) {
    console.error('Tree scene failed to start (WebGL unavailable?)', error);
    emit('unavailable');
  }
});

watch(
  () => props.unlockedThroughDay,
  (day) => treeScene?.setUnlockedThroughDay(day),
);

watch(
  () => props.isPaused,
  (isPaused) => treeScene?.setPaused(isPaused),
);

onBeforeUnmount(() => treeScene?.dispose());
</script>

<template>
  <div ref="containerRef" class="tree-canvas" />
</template>

<style scoped>
.tree-canvas {
  position: fixed;
  inset: 0;
  touch-action: none;
}

.tree-canvas :deep(canvas) {
  display: block;
  outline: none;
}
</style>
