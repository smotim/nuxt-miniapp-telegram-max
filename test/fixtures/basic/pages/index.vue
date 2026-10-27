<template>
  <main>
    <p class="only-messenger">
      messenger
    </p>
    <!-- The server renders the website: state of the client goes after hydration. -->
    <ClientOnly>
      <p data-test="client">
        {{ miniApp.client.value }}
      </p>
      <p data-test="user">
        {{ miniApp.launch.value?.user?.first_name ?? '' }}
      </p>
      <p data-test="start-param">
        {{ miniApp.startParam.value ?? '' }}
      </p>
      <p data-test="sdk-missing">
        {{ miniApp.sdkMissing.value }}
      </p>
      <p data-test="route">
        {{ route.fullPath }}
      </p>
      <button
        data-test="open-modal"
        @click="modalOpen = true"
      >
        Open
      </button>
      <button
        data-test="check-server"
        @click="checkServer"
      >
        Check
      </button>
      <p data-test="server">
        {{ server }}
      </p>
      <FixtureModal
        v-if="modalOpen"
        @close="modalOpen = false"
      />
    </ClientOnly>
  </main>
</template>

<script setup lang="ts">
const miniApp = useMiniApp()
const route = useRoute()
const modalOpen = ref(false)
const server = ref('')

async function checkServer() {
  const answer = await $fetch('/api/me', { headers: miniApp.initDataHeaders() })
  server.value = `${answer.client}:${answer.name}`
}
</script>
