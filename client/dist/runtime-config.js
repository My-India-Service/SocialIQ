/** Production API origin override (Vite bakes VITE_API_URL at build time). */
(function () {
  var host = location.hostname;
  // socialaidigital.com serves the API on the same origin (/api), so it needs no override.
  if (host.endsWith('.onrender.com')) {
    window.__SOCIALIQ_API_URL__ = 'https://socialiq-37aa.onrender.com';
  }
})();
