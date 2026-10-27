<template>
  <div data-test="modal">
    Modal
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
useMiniAppBackButton(() => emit('close'))
</script>
