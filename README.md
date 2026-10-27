# nuxt-miniapp-telegram-max

Один Nuxt-проект — мини-приложение сразу в **Telegram** и в **MAX**, и обычный сайт
в придачу. Один API для обоих мессенджеров, безопасный для SSR, и проверка
initData на сервере.

*English below.*

## Зачем

Бот нужен в двух мессенджерах, а мини-приложения у них разные: свои скрипты
(`telegram-web-app.js` и `max-web-app.js`), свои глобальные объекты, параметры
запуска, модель ответов (колбэки у Telegram, промисы у MAX) и набор возможностей.
Писать приложение дважды не хочется, а условия «если Telegram, иначе если MAX»
расползаются по всему коду.

Модуль даёт один `useMiniApp()`, который одинаково работает в Telegram, в MAX и в
браузере. Чего у клиента нет — не падает, а честно отвечает `null` или
`'unsupported'`, и приложение показывает своё.

## Что решено за вас

То, на что натыкаешься в продакшене, а не в документации:

- **Мигание при SSR.** Сервер всегда рисует сайт. Ещё до первой отрисовки на
  `<html>` встаёт класс `mini-app-telegram` или `mini-app-max` — разметка «только
  для мессенджера» показывается без мигания и без ошибок гидрации.
- **Обрезанная initData.** Telegram на Android и десктопе отдаёт в
  `tgWebApp.initData` огрызок вида `query_id`; модуль берёт данные из хеша запуска.
- **Поздний хеш на iOS.** Telegram на iOS иногда ставит параметры запуска уже после
  загрузки страницы — модуль их дожидается.
- **Перезагрузка внутри приложения.** Роутер стирает хеш при первой навигации; после
  F5 на внутренней странице мессенджер и initData не теряются.
- **Start-параметр один раз.** `?startapp=…` срабатывает один раз за запуск —
  перезагрузка не уводит человека обратно на страницу ссылки.
- **Кнопка «Назад» как стек.** Модалка поверх страницы забирает кнопку и
  возвращает при закрытии — без «назад», выкидывающего из приложения.
- **SDK не пришёл.** Нет сети или недоступен CDN — приложение работает как сайт, а
  initData всё равно подписывает запросы.
- **MAX в браузере** отклоняет промис на каждое касание с вибрацией — модуль это
  глушит, в трекер ошибок не летит.
- **Проверка подписи на сервере** для обоих мессенджеров: схема у MAX та же, что у
  Telegram. Web Crypto — Node, Bun, Deno, edge.

Это тонкий слой над официальными скриптами, а не своя реализация их протоколов.
Только Telegram и все его возможности — смотрите
[tma.js](https://github.com/Telegram-Mini-Apps/tma.js).

## Быстрый старт

```bash
npx nuxt module add nuxt-miniapp-telegram-max
```

Больше ничего не нужно: откройте приложение кнопкой меню бота или ссылкой
`startapp` — в Telegram и в MAX.

```vue
<template>
  <!-- Только после гидрации: сервер рисует сайт. -->
  <ClientOnly>
    <p v-if="miniApp.launch.value?.user">
      Привет, {{ miniApp.launch.value.user.first_name }}
    </p>
  </ClientOnly>
  <button @click="remove">Удалить</button>
</template>

<script setup lang="ts">
const miniApp = useMiniApp()
const haptics = useMiniAppHaptics()

async function remove() {
  // Родной диалог там, где он есть; null — нарисуйте свой.
  const confirmed = await (miniApp.sdk.showConfirm('Удалить?') ?? myDialog('Удалить?'))
  if (confirmed) haptics.notification('success')
}
</script>
```

```ts
// server/api/me.get.ts — токены: NUXT_MINI_APPS_TELEGRAM_BOT_TOKEN, NUXT_MINI_APPS_MAX_BOT_TOKEN
export default defineEventHandler(async (event) => {
  const { client, data } = await requireMiniAppInitData(event)
  return { client, userId: data.user?.id }
})
```

```ts
// Клиент: подпись запроса тем же заголовком, что читает сервер.
await $fetch('/api/me', { headers: useMiniApp().initDataHeaders() })
```

Полный справочник — ниже, по-английски.

---

## English

One Nuxt project as a mini app in both **Telegram** and **MAX**, and the plain
website too. One SSR-safe API for both messengers, plus init data validation on
the server.

It is a thin layer over the official scripts
([telegram-web-app.js](https://core.telegram.org/bots/webapps),
[max-web-app.js](https://dev.max.ru/docs/webapps/bridge)): it loads the
messenger's script only inside that messenger and works around what real
clients do — init data cut short on Android and desktop, the launch hash set
late on iOS, the hash dropped by the router, reloads deep inside the app, MAX
rejecting a promise on every haptic tap in a browser, an SDK that never comes.
For a Telegram-only app with every feature of the platform, see
[tma.js](https://github.com/Telegram-Mini-Apps/tma.js).

### Setup

```bash
npx nuxt module add nuxt-miniapp-telegram-max
```

### Server-rendered markup

The server cannot know the client, so it always renders the website. Don't put
`client`, `launch` or `colorScheme` into server-rendered markup — Vue would
report a hydration mismatch. Instead:

```css
/* Shown before the first paint, no mismatch. */
html:not(.mini-app-telegram):not(.mini-app-max) .in-messenger { display: none; }
html.mini-app-max .not-in-max { display: none; }
```

or wrap it in `<ClientOnly>`, or read the state in `onMounted`. Code — plugins,
middleware, handlers — reads it anywhere.

### `useMiniApp()`

| | |
| --- | --- |
| `client` | `Ref<'telegram' \| 'max' \| 'web'>` — where the app runs. On the server: `'web'`. |
| `isMiniApp` | `ComputedRef<boolean>` |
| `colorScheme` | `Ref<'light' \| 'dark'>` — Telegram's theme; the system scheme in MAX and on the website. |
| `initData` | `Ref<string>` — raw init data for your API. |
| `launch` | `Ref<MiniAppInitData \| null>` — parsed: `user`, `startParam`, `chat`, `authDate`… Not verified: trust what your server checked. |
| `startParam` | `Ref<string \| null>` — the start parameter to act on. Set once per launch, so a reload doesn't send the user back to the link's page. |
| `sdkMissing` | `Ref<boolean>` — opened in a messenger whose SDK did not load (no network). The app runs as the website. |
| `sdk` | The client's SDK: `openLink`, `openInternalLink`, `close`, `showPopup`, `showConfirm`, `downloadFile`, `setClosingConfirmation`, `setVerticalSwipes`… Narrow by `sdk.client` for `sdk.raw` and client-only methods. |
| `initDataHeaders()` | `{ 'X-Telegram-Init-Data': … }` or `{ 'X-Max-Init-Data': … }` for `$fetch`. |
| `ready()` | Hides the messenger's loader. Called for you unless `autoReady: false`. |

`useMiniApp()` reads module state, not the Nuxt instance: call it anywhere —
in setup, in route middleware, in a handler after `await`. The module's plugin
runs before your plugins and before the first navigation, so they all see the
final state.

### Composables

```ts
// The messenger's back button while mounted. Layers stack: a modal takes the
// button over the page and gives it back on close.
useMiniAppBackButton(() => router.back())
useMiniAppBackButton(close, { enabled: isOpen })

// Ask before closing while true; stays on while any component asks.
useMiniAppClosingConfirmation(hasUnsavedChanges)

// Does nothing on the website.
useMiniAppHaptics().impact('light')
```

### Start parameter

```ts
// middleware/start-param.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const param = useMiniApp().startParam.value
  if (to.path === '/' && param?.startsWith('event_')) {
    return navigateTo(`/events/${param.slice(6)}`)
  }
})
```

Set `autoReady: false` and call `useMiniApp().ready()` after such a redirect,
so the messenger reveals the app on the target page, not on the home page.

### Server

`requireMiniAppInitData(event)` reads the header `initDataHeaders()` sends,
checks the signature and `auth_date` (a day by default: `{ maxAge }`), and
answers 401 with `data.reason` — `missing`, `malformed`, `signature`,
`expired`. Init data with a repeated key is refused as `malformed`.
`validateInitData(raw, botToken)` and `parseInitData(raw)` are there for
anything else.

### Options

```ts
export default defineNuxtConfig({
  miniApps: {
    telegram: { sdkUrl: 'https://telegram.org/js/telegram-web-app.js' },
    max: { sdkUrl: 'https://st.max.ru/js/max-web-app.js' },
    sdkTimeout: 5000,
    earlyDetect: true,
    autoReady: true,
    cleanLaunchHash: true,
    expand: false,
    verticalSwipes: true,
    colorSchemeAttribute: '',
    initDataHeaders: { telegram: 'X-Telegram-Init-Data', max: 'X-Max-Init-Data' },
  },
})
```

| Option | |
| --- | --- |
| `telegram.sdkUrl` | Serve your own copy where telegram.org is slow to reach (Telegram's webview ignores the device's proxy). |
| `sdkTimeout` | Inside a messenger the app waits for its SDK before hydrating — up to this long when the network is bad. The website never waits. |
| `earlyDetect` | The inline `<head>` script behind the `mini-app-*` classes. Turn off under a CSP without inline scripts; the plugin still detects the client. |
| `autoReady` | Call the messenger's `ready()` once the app is hydrated. |
| `cleanLaunchHash` | Remove `#tgWebAppData=…` from the address bar and the route once mounted. Until then it is in `location`: analytics that send the first page view earlier should drop the hash. |
| `expand` | Open Telegram mini apps at full height. |
| `verticalSwipes` | `false` stops swipe-down-to-close — for pages with their own vertical gestures. |
| `colorSchemeAttribute` | E.g. `'data-color-scheme'`: the scheme as an attribute on `<html>`, restored before the first paint in a mini app. Build-time. |

Telegram's script sets its theme as CSS variables (`--tg-theme-bg-color`…)
itself. MAX's has no theme at all — no `colorScheme`, no `themeParams`, no theme
event — the module follows `prefers-color-scheme` there.

### Storage

sessionStorage keeps the launch hash and init data for the tab, so a reload
inside the app still signs requests; init data is a credential your server
accepts for `maxAge`, the same as Telegram's own SDK keeps it. localStorage
keeps only the last color scheme. The module makes no network requests besides
loading the messenger's script.

### Development

```bash
pnpm install
pnpm dev        # playground
pnpm test       # unit + end-to-end (Chromium: pnpm exec playwright-core install chromium)
pnpm lint
```

## License

[MIT](./LICENSE)
