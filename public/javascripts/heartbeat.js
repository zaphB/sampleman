window.setInterval(function() {
  // call heartbeat from backend and avoid caching
  fetch('/heartbeat?'+Date.now())
}, 3000)

