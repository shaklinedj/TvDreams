/**
 * This file contains the central network configuration for the application.
 * It is the single source of truth for the server's address.
 */

interface NetworkConfig {
  // The host that clients (browsers, displays) will use to connect to the server.
  // For development on a single machine, 'localhost' is fine.
  // For access from other devices on your local network, this MUST be the local IP address
  // of the machine running the server (e.g., '192.168.1.100').
  CLIENT_HOST: string;

  // The port the server will run on.
  PORT: number;
}

// For client-side, we'll use window.location.hostname if available
// This allows the frontend to automatically connect to the server it was served from
const getClientHost = (): string => {
  if (typeof window !== 'undefined') {
    // In browser environment, use the hostname the page was served from
    return window.location.hostname;
  }
  // Fallback for SSR or non-browser environments
  return 'localhost';
};

const config: NetworkConfig = {
  CLIENT_HOST: getClientHost(),
  PORT: 3001,
};

export default config;
