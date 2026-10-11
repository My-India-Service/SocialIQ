module.exports = {
  apps: [
    {
      name: 'socialaidigital-api',
      cwd: '/var/www/socialaidigital-api/server',
      script: 'index.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
