module.exports = {
  apps: [{
    name: 'TvDreams',
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
    // Provide explicit production env block so `pm2 --env production` finds it
    env_production: {
      NODE_ENV: 'production',
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
    // Redirect logs to a null device to avoid filling log files by default.
    // On Windows use 'NUL', on Unix use '/dev/null'.
    error_file: (process.platform === 'win32') ? 'NUL' : '/dev/null',
    out_file: (process.platform === 'win32') ? 'NUL' : '/dev/null',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Small restart delay between crashes to avoid busy-restart loops
    restart_delay: 4000
  }]
};
