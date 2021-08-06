// call heartbeat from backend and avoid caching
fetch('/heartbeat?'+Date.now())
window.setInterval(function() {
  fetch('/heartbeat?'+Date.now())
}, 2000)
