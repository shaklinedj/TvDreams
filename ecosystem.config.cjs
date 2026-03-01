// Detect the server's local IP for display clients (can be overridden via env vars)
const getDisplayHost = () => {
  if (process.env.DISPLAY_API_BASE_URL || process.env.FRONTEND_URL) return null; // will be overridden below
  try {
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch (e) {}
  return 'localhost';
};

const displayHost = getDisplayHost() || 'localhost';
const displayApiBase = process.env.DISPLAY_API_BASE_URL || process.env.FRONTEND_URL || `http://${displayHost}:3001`;
const displayWsUrl = process.env.DISPLAY_WS_URL || (() => {
  try {
    const url = new URL(displayApiBase);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.hostname}:3001`;
  } catch (e) {
    return `ws://${displayHost}:3001`;
  }
})();

module.exports = {
  apps: [{
    name: 'TvDreams',
    // Use the real tsx CLI entry point (.mjs) so PM2 runs `node tsx.mjs src/server/index.ts`
    // This works on both Linux and Windows without shim issues.
    script: 'node_modules/tsx/dist/cli.mjs',
    args: 'src/server/index.ts',
    interpreter: 'node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      DISPLAY_API_BASE_URL: displayApiBase,
      DISPLAY_WS_URL: displayWsUrl,
    },
    env_production: {
      NODE_ENV: 'production',
      DISPLAY_API_BASE_URL: displayApiBase,
      DISPLAY_WS_URL: displayWsUrl,
    },
    // Logs: null device per platform
    error_file: (process.platform === 'win32') ? 'NUL' : '/dev/null',
    out_file: (process.platform === 'win32') ? 'NUL' : '/dev/null',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    restart_delay: 4000
  }]
};
