import { MediaFile, Screen } from '@/types';
import networkConfig from './network-config';

// Real WebSocket client
interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: ((message: WebSocketMessage) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private isConnected = false;
  private reconnectInterval: number = 30000; // 30 seconds
  private reconnectTimeoutId: NodeJS.Timeout | null = null;

  connect(): void {
    if (this.isConnected || this.ws) return;

    const { CLIENT_HOST, PORT } = networkConfig;
    this.ws = new WebSocket(`ws://${CLIENT_HOST}:${PORT}`);

    this.ws.onopen = () => {
      this.isConnected = true;
    // console.log('WebSocket client connected');
      this.notifyConnectionListeners(true);
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.notifyListeners(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.ws = null;
    // console.log('WebSocket client disconnected. Attempting to reconnect...');
      this.notifyConnectionListeners(false);
      this.reconnectTimeoutId = setTimeout(() => this.connect(), this.reconnectInterval);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // onclose will be called next
    };
  }

  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  send(message: Omit<WebSocketMessage, 'timestamp'>): void {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected, message not sent');
      return;
    }

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(fullMessage));
    // console.log('WebSocket message sent:', fullMessage);
  }

  onMessage(callback: (message: WebSocketMessage) => void): void {
    this.listeners.push(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionListeners.push(callback);
  }

  private notifyListeners(message: WebSocketMessage): void {
    this.listeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in WebSocket message listener:', error);
      }
    });
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in WebSocket connection listener:', error);
      }
    });
  }

  // Utility methods for common message types
  sendMediaUpdate(mediaFile: Partial<MediaFile>): void {
    this.send({
      type: 'media_updated',
      data: mediaFile as Record<string, unknown>
    });
  }

  sendScreenUpdate(screen: Partial<Screen>): void {
    this.send({
      type: 'screen_updated',
      data: screen as Record<string, unknown>
    });
  }

  sendPlaylistUpdate(playlist: Record<string, unknown>): void {
    this.send({
      type: 'playlist_updated',
      data: playlist
    });
  }

  sendDisplayCommand(screenId: string | number, command: string, params?: Record<string, unknown>): void {
    // Convert screenId to number for consistent handling
    const screenIdNumber = typeof screenId === 'string' ? parseInt(screenId, 10) : screenId;
    
    this.send({
      type: 'display_command',
      data: {
        screenId: screenIdNumber,
        command,
        params: params || {},
        timestamp: Date.now()
      }
    });
  }

  sendAnalyticsUpdate(): void {
    this.send({
      type: 'analytics_updated',
      data: { timestamp: Date.now() }
    });
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }
}

export const websocketClient = new WebSocketClient();

// Auto-connect when module is imported
if (typeof window !== 'undefined') {
  websocketClient.connect();
}