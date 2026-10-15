/** Production API origin override (Vite bakes VITE_API_URL at build time). */
(function () {
  var host = location.hostname;
  if (host === 'www.socialaidigital.com' || host === 'socialaidigital.com') {
    window.__SOCIALIQ_API_URL__ = 'https://api.myindiaservice.com';
  } else if (host.endsWith('.onrender.com')) {
    window.__SOCIALIQ_API_URL__ = 'https://socialiq-37aa.onrender.com';
  }
})();
