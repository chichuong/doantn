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
      script: 'app.py',
      interpreter: 'python',
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'karat-cloudflare-tunnel',
      cwd: './Backend',
      script: 'cloudflared.exe',
      args: 'tunnel --url http://localhost:3000',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
