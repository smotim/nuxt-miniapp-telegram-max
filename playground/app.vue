<template>
  <main>
    <h1>nuxt-miniapp-telegram-max</h1>

    <p class="only-messenger">
      This line is visible only in a messenger: shown by the class on &lt;html&gt;, no flash.
    </p>
    <!-- The server renders the website: the client's state goes after hydration. -->
    <ClientOnly>
      <p>
        Client: <strong data-test="client">{{ miniApp.client.value }}</strong>,
        scheme: <strong data-test="scheme">{{ miniApp.colorScheme.value }}</strong>
      </p>
      <p v-if="miniApp.launch.value?.user">
        Hello, <span data-test="user">{{ miniApp.launch.value.user.first_name }}</span>
      </p>
      <p v-if="miniApp.startParam.value">
        Start parameter: <code data-test="start-param">{{ miniApp.startParam.value }}</code>
      </p>
    </ClientOnly>

    <section>
      <button @click="haptics.impact('medium')">
        Haptic
      </button>
      <button @click="popup">
        Popup
      </button>
      <button @click="modalOpen = true">
        Open modal
      </button>
      <label>
        <input
          v-model="dirty"
          type="checkbox"
        >
        Ask before closing
      </label>
      <button @click="checkServer">
        Check init data on the server
      </button>
    </section>

    <p
      v-if="popupResult"
      data-test="popup-result"
    >
      {{ popupResult }}
    </p>
    <pre
      v-if="serverAnswer"
      data-test="server"
    >{{ serverAnswer }}</pre>

    <PlaygroundModal
      v-if="modalOpen"
      @close="modalOpen = false"
    />
  </main>
</template>

<script setup lang="ts">
const miniApp = useMiniApp()
const haptics = useMiniAppHaptics()
const modalOpen = ref(false)
const dirty = ref(false)
const popupResult = ref('')
const serverAnswer = ref('')

useMiniAppClosingConfirmation(dirty)

async function popup() {
  const answer = miniApp.sdk.showPopup({
    title: 'nuxt-miniapp-telegram-max',
    message: 'A native popup, or your own dialog where the client has none.',
    buttons: [{ id: 'yes', type: 'default', text: 'Yes' }, { type: 'cancel' }],
  })
  popupResult.value = answer ? `Pressed: ${await answer}` : 'No native popups here — draw your own.'
}

async function checkServer() {
  try {
    serverAnswer.value = JSON.stringify(await $fetch('/api/me', { headers: miniApp.initDataHeaders() }), null, 2)
  }
  catch (error) {
    serverAnswer.value = String(error)
  }
}
</script>

<style>
html:not(.mini-app-telegram):not(.mini-app-max) .only-messenger {
  display: none;
}

html[data-color-scheme='dark'] {
  background: #17212b;
  color: #f5f5f5;
}
</style>
