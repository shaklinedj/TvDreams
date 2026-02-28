/**
 * This file contains the central network configuration for the application.
 * It is the single source of truth for the server's address.
 */
// For client-side, we'll use window.location.hostname if available
// This allows the frontend to automatically connect to the server it was served from
const getClientHost = () => {
    if (typeof window !== 'undefined') {
        // In browser environment, use the hostname the page was served from
        return window.location.hostname;
    }
    // Fallback for SSR or non-browser environments
    return 'localhost';
};

const config = {
    CLIENT_HOST: getClientHost(),
    PORT: 3001,
};
export default config;
