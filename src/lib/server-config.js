import networkConfig from './network-config';
/**
 * Get the server configuration. It now reads from the central network-config file.
 */
export function getServerConfig() {
    const { CLIENT_HOST, PORT } = networkConfig;
    // The server always listens on all interfaces.
    const listenHost = '0.0.0.0';
    return {
        listenHost,
        clientHost: CLIENT_HOST,
        port: PORT,
        apiBaseUrl: `http://${CLIENT_HOST}:${PORT}`,
        wsUrl: `ws://${CLIENT_HOST}:${PORT}`
    };
}
