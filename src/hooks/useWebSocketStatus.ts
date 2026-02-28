import { useState, useEffect } from 'react';
import { websocketClient } from '@/lib/websocket';

export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Set initial connection status
    setIsConnected(websocketClient.isConnectionActive());

    // Listen for connection changes
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    websocketClient.onConnectionChange(handleConnectionChange);

    // Cleanup function to remove listener would go here if WebSocket client supported it
    return () => {
      // Note: Current WebSocket client doesn't support removing listeners
      // This is acceptable for this use case since the hook lifecycle matches app lifecycle
    };
  }, []);

  return isConnected;
}