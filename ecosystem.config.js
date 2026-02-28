module.exports = {
  apps: [{
    name: 'cms-hlaure',
    script: 'src/server/index.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      // Display configuration injected into display.html
      DISPLAY_API_BASE_URL: process.env.DISPLAY_API_BASE_URL || process.env.FRONTEND_URL || `http://localhost:3001`,
      DISPLAY_WS_URL: process.env.DISPLAY_WS_URL || (() => {
        try {
          const url = new URL(process.env.DISPLAY_API_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3001');
          const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
          return `${protocol}//${url.hostname}:3001`;
        } catch (e) {
          return 'ws://localhost:3001';
        }
      })()
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Restart delay
    restart_delay: 4000,
    // Graceful shutdown
    kill_timeout: 3000,
    listen_timeout: 5000
  }]
};
