// Stands in for max-web-app.js: its data arrives as #WebAppData=…
(function () {
  var params = new URLSearchParams(location.hash.slice(1))
  var calls = window.__sdkCalls = []
  window.WebApp = {
    initData: params.get('WebAppData') || '',
    platform: params.get('WebAppPlatform'),
    ready: function () { calls.push('ready') },
    BackButton: { show: function () {}, hide: function () {}, onClick: function () {}, offClick: function () {} },
  }
})()
