<template>
  <div
    class="modal"
    data-test="modal"
  >
    <p>The messenger's back button now closes this modal, then goes back to the page's layer.</p>
    <button @click="emit('close')">
      Close
    </button>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()

useMiniAppBackButton(() => emit('close'))
</script>
