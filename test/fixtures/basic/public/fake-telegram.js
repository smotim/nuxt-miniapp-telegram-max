// Stands in for telegram-web-app.js: reads the launch hash and records calls.
(function () {
  var params = new URLSearchParams(location.hash.slice(1))
  var calls = window.__sdkCalls = []
  window.Telegram = {
    WebApp: {
      initData: params.get('tgWebAppData') || '',
      initDataUnsafe: {},
      platform: params.get('tgWebAppPlatform') || 'unknown',
      colorScheme: 'dark',
      ready: function () { calls.push('ready') },
      expand: function () { calls.push('expand') },
      onEvent: function () {},
      offEvent: function () {},
      BackButton: {
        show: function () { calls.push('back:show') },
        hide: function () { calls.push('back:hide') },
        onClick: function (callback) { window.__pressBack = callback },
        offClick: function () { window.__pressBack = null },
      },
    },
  }
})()
