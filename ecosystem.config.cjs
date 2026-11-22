module.exports = {
  apps: [
    {
      name: 'karat-retail-server',
      cwd: './Backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'karat-forecasting-ai',
      cwd: './Forecasting',
      script: '.venv/Scripts/python.exe',
      args: '-m uvicorn src.api.main:app --host 127.0.0.1 --port 8001',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        FORECAST_SERVICE_TOKEN: 'karat-local-dev-token',
      },
    },
    {
      name: 'karat-cloudflare-tunnel',
      cwd: './Backend',
      script: 'cloudflared.exe',
      args: 'tunnel run karat-retail',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
