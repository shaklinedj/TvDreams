import networkConfig from './network-config';

/**
 * Get client-side API configuration (for use in React app)
 * Uses environment variables configured by Vite
 */
export async function getClientConfig() {
  // Try to fetch config from server endpoint
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      return {
        host: config.clientHost,
        port: config.port,
        apiBaseUrl: config.apiBaseUrl,
        wsUrl: config.wsUrl
      };
    }
  } catch (e) {
    console.warn('Failed to fetch config from server, using fallback');
  }
  // Fallback to the central config file if the API is down
  const { CLIENT_HOST, PORT } = networkConfig;
  return {
    host: CLIENT_HOST,
    port: PORT,
    apiBaseUrl: `http://${CLIENT_HOST}:${PORT}`,
    wsUrl: `ws://${CLIENT_HOST}:${PORT}`
  };
}