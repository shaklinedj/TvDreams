module.exports = {
  apps: [{
    name: 'TvDreams',
    // Use the real tsx CLI entry point (.mjs) — works on Linux and Windows without shim issues.
    script: 'node_modules/tsx/dist/cli.mjs',
    args: 'src/server/index.ts',
    interpreter: 'node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      // DISPLAY_API_BASE_URL and DISPLAY_WS_URL are intentionally NOT set here.
      // The server builds them dynamically from req.hostname on each request,
      // so every display gets the correct IP regardless of which network interface it used.
      // They are loaded from .env by dotenv if explicitly needed.
    },
    env_production: {
      NODE_ENV: 'production',
    },
    // Logs: null device per platform
    error_file: (process.platform === 'win32') ? 'NUL' : '/dev/null',
    out_file: (process.platform === 'win32') ? 'NUL' : '/dev/null',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    restart_delay: 4000
  }]
};
