import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import db from './database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyToken, isAdmin, AuthenticatedRequest } from './auth';
import { getServerConfig } from '../lib/server-config';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Recent prizes persistence
const RECENT_PRIZES_DIR = path.join(process.cwd(), 'data');
const RECENT_PRIZES_FILE = path.join(RECENT_PRIZES_DIR, 'recent-prizes.json');

const writeRecentPrizes = async (arr: Array<Record<string, unknown>>) => {
  try {
    await fs.promises.mkdir(RECENT_PRIZES_DIR, { recursive: true });
    const tmp = RECENT_PRIZES_FILE + '.tmp';
    await fs.promises.writeFile(tmp, JSON.stringify(arr, null, 2), 'utf8');
    await fs.promises.rename(tmp, RECENT_PRIZES_FILE);
  } catch (e) {
    console.error('[Premio] ❌ Failed to write recent prizes file:', e);
  }
};

const appendRecentPrize = async (prize: Record<string, unknown>) => {
  try {
    let existing: Array<Record<string, unknown>> = [];
    try {
      const raw = await fs.promises.readFile(RECENT_PRIZES_FILE, 'utf8');
      existing = JSON.parse(raw) as Array<Record<string, unknown>>;
    } catch (e) {
      // ignore read errors, treat as empty
      existing = [];
    }

    existing.unshift(prize);
    const truncated = existing.slice(0, 3);
    await writeRecentPrizes(truncated);
  } catch (e) {
    console.error('[Premio] ❌ Failed to persist recent prize:', e);
  }
};

// Set ffmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// Function to generate image thumbnail using ffmpeg
const generateImageThumbnail = (imagePath: string, outputPath: string, retryCount = 0): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(imagePath)
      .output(outputPath)
      .size('?x240')  // Maintain aspect ratio, max height 240px
      .format('mjpeg')
      .outputOptions([
        '-q:v', '2' // High quality
      ])
      .on('end', () => {
    // console.log('✅ Server-side image thumbnail generated:', outputPath);
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Server-side image thumbnail generation failed:', err.message);
        if (retryCount < 2) {
    // console.log(`⏳ Retrying thumbnail generation (attempt ${retryCount + 1}/2)...`);
          setTimeout(() => {
            generateImageThumbnail(imagePath, outputPath, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 2000);
        } else {
          reject(err);
        }
      })
      .run();
  });
};

// Function to generate video thumbnail using ffmpeg
const generateVideoThumbnail = (videoPath: string, outputPath: string, retryCount = 0): Promise<void> => {
  return new Promise((resolve, reject) => {
    // First, get video information to determine duration and best timestamp
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('❌ Error getting video metadata for thumbnail:', err.message);
        // Fallback to original method if ffprobe fails
        fallbackThumbnailGeneration();
        return;
      }

      const duration = metadata.format.duration || 0;
      let timestamp = '00:00:01'; // Default to 1 second

      // Choose a better timestamp based on video duration
      if (duration > 10) {
        timestamp = '00:00:05'; // 5 seconds for longer videos
      } else if (duration > 3) {
        timestamp = '00:00:02'; // 2 seconds for medium videos
      } else if (duration > 1) {
        timestamp = '00:00:01'; // 1 second for short videos
      } else {
        timestamp = '00:00:00.5'; // 0.5 seconds for very short videos
      }

      // Generate thumbnail with better settings
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '?x240' // Maintain aspect ratio, max height 240px
        })
        .outputOptions([
          '-vf', 'select=gt(scene\\,0.1)', // Select frames with scene changes to avoid black frames
          '-frames:v', '1', // Only get one frame
          '-q:v', '2' // High quality
        ])
        .on('end', () => {
          // console.log('✅ Server-side video thumbnail generated:', outputPath);
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ Server-side video thumbnail generation failed:', err.message);
          // Try fallback method
          fallbackThumbnailGeneration();
        });
    });

    // Fallback method without scene detection
    const fallbackThumbnailGeneration = () => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:02', '00:00:05', '00:00:01'], // Try multiple timestamps
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '?x240' // Maintain aspect ratio
        })
        .on('end', () => {
          // console.log('✅ Server-side video thumbnail generated (fallback):', outputPath);
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ Server-side video thumbnail generation failed (fallback):', err.message);
          if (retryCount < 2) {
            // console.log(`⏳ Retrying thumbnail generation (attempt ${retryCount + 1}/2)...`);
            setTimeout(() => {
              generateVideoThumbnail(videoPath, outputPath, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, 2000);
          } else {
            reject(err);
          }
        });
    };
  });
};



// Server startup time tracking
const SERVER_START_TIME = Date.now();

const app = express();

// Function to get local IP address
const getLocalIpAddress = (): string => {
  // Allow explicit override via env variable
  if (process.env.SERVER_HOST) {
    return process.env.SERVER_HOST;
  }

  const networkInterfaces = os.networkInterfaces();

  // Virtual/ignored adapter name patterns (WSL, Hyper-V, VPN tunnels, Docker, etc.)
  const virtualPatterns = /vethernet|hyper[\s-]?v|wsl|loopback|vmware|virtualbox|docker|tap|tun|vlan|vbridge/i;

  let fallback: string | null = null;

  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    if (!addresses) continue;

    const isVirtual = virtualPatterns.test(interfaceName);

    for (const address of addresses) {
      if (address.family !== 'IPv4' || address.internal) continue;

      if (!isVirtual) {
        // First real (non-virtual) adapter wins
        return address.address;
      } else if (!fallback) {
        // Keep as fallback in case no real adapter is found
        fallback = address.address;
      }
    }
  }

  return fallback || 'localhost';
};

/**
 * Get the IP address from request headers.
 * This returns the IP address that the client used to connect to the server.
 * Supports proxy headers (X-Forwarded-For, X-Real-IP) and direct connections.
 */
const getClientConnectionHost = (req: express.Request): string => {
  // Check if behind a proxy (X-Forwarded-Host header)
  const forwardedHost = req.get('X-Forwarded-Host');
  if (forwardedHost) {
    return forwardedHost.split(',')[0].trim();
  }
  
  // Use the Host header (contains hostname and port)
  const hostHeader = req.get('Host');
  if (hostHeader) {
    // Extract just the hostname part (remove port if present)
    const hostname = hostHeader.split(':')[0];
    return hostname;
  }
  
  // Fallback to first available local IP
  return getLocalIpAddress();
};

// Generate random password
const generateRandomPassword = (length: number = 12): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateRandomString = (length: number): string => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ------------------------------------------------------------------
// External premio service integration (runs on the server side)
// This allows the backend to receive "premio" notifications even when
// no dashboard GUI is open in a browser.
// ------------------------------------------------------------------
const PREMIO_WS_URL = process.env.PREMIO_WS_URL || '';
let externalWs: WebSocket | null = null;
let premioReconnectAttempts = 0;
let premioReconnectTimer: NodeJS.Timeout | null = null;
let isPremioConnected = false;

const schedulePremioReconnect = () => {
  premioReconnectAttempts = Math.min(premioReconnectAttempts + 1, 10);
  const base = 1000; // 1s
  const max = 30000; // 30s
  const backoff = Math.min(base * Math.pow(2, premioReconnectAttempts - 1), max);
  const jitter = Math.floor(Math.random() * 1000);
  const delay = backoff + jitter;
  if (premioReconnectTimer) clearTimeout(premioReconnectTimer);
  premioReconnectTimer = setTimeout(() => {
    premioReconnectTimer = null;
    connectToPremioService();
  }, delay);
};

const normalizeWsUrl = (url: string) => {
  if (!url) return url;
  return url.replace(/^WS:/i, 'ws:').replace(/^WSS:/i, 'wss:');
};

const connectToPremioService = () => {
  if (!PREMIO_WS_URL) return;

  // Avoid creating multiple concurrent sockets
  if (externalWs && (externalWs.readyState === WebSocket.OPEN || externalWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const wsUrl = normalizeWsUrl(PREMIO_WS_URL);
    externalWs = new WebSocket(wsUrl);

    externalWs.onopen = () => {
      premioReconnectAttempts = 0;
      isPremioConnected = true;
      console.log('[Server] Connected to premio service');
      // Notify connected CMS clients about premio service availability
      wss.clients.forEach((client) => {
        const wsClient = client as WebSocketConnection;
        if (!wsClient.screenId && wsClient.readyState === WebSocket.OPEN) {
          try {
            wsClient.send(JSON.stringify({ type: 'premio_connection', data: { connected: true } }));
          } catch (e) {
            // ignore send errors per-client
          }
        }
      });
    };

    externalWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        // console.log('[Premio] 📨 Mensaje recibido del servicio externo:', JSON.stringify(data));
        if (data.type === 'premio' || data.tipo === 'premio') {
          broadcastPrize(data);
        } else {
          // console.log('[Premio] ⚠️ Tipo de mensaje desconocido:', data.type ?? data.tipo);
        }
      } catch (e) {
        console.error('[Premio] ❌ Error parseando mensaje:', e);
      }
    };

    externalWs.onclose = () => {
      externalWs = null;
      isPremioConnected = false;
      console.log('[Server] Premio service disconnected, scheduling reconnect');
      // Notify connected CMS clients about premio service loss
      wss.clients.forEach((client) => {
        const wsClient = client as WebSocketConnection;
        if (!wsClient.screenId && wsClient.readyState === WebSocket.OPEN) {
          try {
            wsClient.send(JSON.stringify({ type: 'premio_connection', data: { connected: false } }));
          } catch (e) {
            // ignore
          }
        }
      });
      // Only schedule if onerror hasn't already queued a reconnect
      if (!premioReconnectTimer) {
        schedulePremioReconnect();
      }
    };

    externalWs.onerror = (err) => {
      isPremioConnected = false;
      console.error('[Server] Premio WebSocket error:', err);
      // Notify CMS clients about error state
      wss.clients.forEach((client) => {
        const wsClient = client as WebSocketConnection;
        if (!wsClient.screenId && wsClient.readyState === WebSocket.OPEN) {
          try {
            wsClient.send(JSON.stringify({ type: 'premio_connection', data: { connected: false } }));
          } catch (e) {}
        }
      });
      // Force cleanup and schedule reconnect directly — don't rely solely on onclose
      try { if (externalWs) externalWs.close(); } catch (e) {}
      externalWs = null;
      schedulePremioReconnect();
    };
  } catch (err) {
    console.error('[Server] Failed to connect to premio service:', err);
    schedulePremioReconnect();
  }
};

// Helper: broadcast show_prize to all connected displays
const broadcastPrize = (data: object) => {
  const prizeWithTimestamp = { ...(data as Record<string, unknown>), receivedAt: Date.now() };
  // Persist last 3 prizes to disk for dashboard retrieval
  try {
    appendRecentPrize(prizeWithTimestamp as Record<string, unknown>);
  } catch (e) {
    console.error('[Premio] ❌ Error scheduling prize persistence:', e);
  }
  let displayCount = 0;
  let cmsCount = 0;
  wss.clients.forEach((client) => {
    const wsClient = client as WebSocketConnection;
    if (wsClient.readyState !== WebSocket.OPEN) return;
    if (wsClient.screenId) {
      // Display client — send the overlay command
      displayCount++;
      wsClient.send(JSON.stringify({
        type: 'display_command',
        data: {
          screenId: wsClient.screenId,
          command: 'show_prize',
          params: data
        }
      }));
    } else {
      // CMS dashboard client — notify about the received prize
      cmsCount++;
      try {
        wsClient.send(JSON.stringify({ type: 'premio_received', data: prizeWithTimestamp }));
      } catch (e) { /* ignore per-client send errors */ }
    }
  });
  console.log(`[Premio] 🏆 show_prize enviado a ${displayCount} display(s), notificado a ${cmsCount} dashboard(s)`);
  if (displayCount === 0) {
    console.warn('[Premio] ⚠️ No hay displays conectados para recibir el premio');
  }
};

// start connection if URL provided
connectToPremioService();


// Get server configuration
const serverConfig = getServerConfig();

// In-memory store for tracking active display connections
const activeConnections = new Map(); // ws -> screenId
const activeSessions = new Map(); // sessionId -> { ws, screenId, connectedAt, lastSeen }

// Analytics caching to improve performance
interface AnalyticsData {
  monthlyFileOperations: {
    uploads: number;
    deletions: number;
    netChange: number;
    last30DaysUploads: number;
    last30DaysDeletions: number;
  };
  systemMetrics: {
    uptime: number;
    avgConnectionTime: number;
    totalConnections: number;
    totalUniqueScreensConnected: number;
    totalStorage: number;
  };
}

let analyticsCache: { data: AnalyticsData; timestamp: number } | null = null;
const ANALYTICS_CACHE_TTL = 30000; // 30 seconds cache TTL

// Helper function to invalidate analytics cache
const invalidateAnalyticsCache = () => {
  analyticsCache = null;
};

// Session timeout constants
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - how often we check for dead connections
const PING_INTERVAL = 30000; // 30 seconds - how often clients send ping
const STALE_SESSION_TIMEOUT = 90000; // 90 seconds - 3x ping interval, considers a session stale without recent ping

const PORT = serverConfig.port;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

app.use(cors({
  origin: true, // Allow all origins for simplicity, could be more restrictive in production
  credentials: true // Enable credentials (cookies) to be sent
}));
app.use(express.json({ limit: '50mb' })); // Set charset will be handled by express.json automatically
app.use(cookieParser());
/*
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(process.cwd(), 'public')));
*/
// --- MEJORA DE CACHÉ ---
// Opciones para el cache de los archivos estáticos
const staticOptions = {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath, stat) => {
    // Fija una política de cache corta: la app usará la imagen del caché por
    // 300 segundos (5 minutos) antes de volver a preguntar al servidor.
    res.set('Cache-Control', 'public, max-age=600');
    
    // Set proper charset for HTML and text files to display Spanish characters correctly
    if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  },
};

// Aplica las opciones de caché al servir la carpeta de uploads y la pública
app.use('/uploads', express.static(UPLOADS_DIR, staticOptions));
// Serve a version of display.html with injected runtime config when requested.
app.get('/display.html', (req, res, next) => {
  try {
    const publicPath = path.join(process.cwd(), 'public', 'display.html');
    if (!fs.existsSync(publicPath)) return next();
    let html = fs.readFileSync(publicPath, 'utf8');

    // Build DISPLAY_CONFIG from environment variables (allow overrides).
    // Fall back to FRONTEND_URL or serverConfig values when DISPLAY_* vars are not provided.
    const displayConfig: any = {};

    // Use the Host header from the request so displays on other machines get the correct server IP
    const requestHost = req.hostname || req.get('host')?.split(':')[0] || getLocalIpAddress();
    const serverPort = process.env.DISPLAY_WS_PORT || serverConfig.port;
    const apiBase = process.env.DISPLAY_API_BASE_URL
      || process.env.FRONTEND_URL
      || `http://${requestHost}:${serverPort}`;
    displayConfig.apiBaseUrl = apiBase;

    if (process.env.DISPLAY_WS_URL) {
      displayConfig.wsUrl = process.env.DISPLAY_WS_URL;
    } else {
      // Derive wsUrl from apiBase but force server port (e.g., :3001)
      try {
        const parsed = new URL(apiBase);
        const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = parsed.hostname;
        const port = serverPort;
        displayConfig.wsUrl = `${wsProtocol}//${host}:${port}`;
      } catch (e) {
        // Fallback to serverConfig
        displayConfig.wsUrl = serverConfig.wsUrl;
      }
    }

    if (Object.keys(displayConfig).length > 0) {
      const injectScript = `<script>window.DISPLAY_CONFIG = ${JSON.stringify(displayConfig)};</script>`;
      // Inject before closing </head> if present, otherwise before body
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${injectScript}\n</head>`);
      } else if (html.includes('<body')) {
        html = html.replace(/<body(.*?)>/, match => `${match}\n${injectScript}`);
      } else {
        html = injectScript + html;
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('Failed to serve injected display.html:', err);
    return next();
  }
});

app.use(express.static(path.join(process.cwd(), 'public'), staticOptions));
// ----------------------

// Serve built frontend files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist'), staticOptions));
}

// WebSocket connection handler
interface WebSocketConnection extends WebSocket {
  isAlive: boolean;
  screenId?: number; // Store as number for consistent comparison
  sessionId?: string; // Unique session ID for this display connection
}

wss.on('connection', async (ws: WebSocketConnection) => {
    // console.log('Client connected');
  ws.isAlive = true;

  // Immediately inform new CMS clients of the current premio service status
  try {
    ws.send(JSON.stringify({ type: 'premio_connection', data: { connected: isPremioConnected } }));
  } catch (e) { /* ignore */ }

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message: Buffer) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      switch (parsedMessage.type) {
        case 'register': {
          // Parse screenId as number for consistent database comparison
          const screenIdNumber = parseInt(parsedMessage.screenId, 10);
          if (isNaN(screenIdNumber)) {
            console.error('Invalid screenId received:', parsedMessage.screenId);
            break;
          }
          
          // Validate that the screen exists in the database
          const screenExists = await db.get('SELECT id FROM screens WHERE id = ?', [screenIdNumber]);
          if (!screenExists) {
            console.error(`Screen with ID ${screenIdNumber} does not exist in database. Skipping registration.`);
            ws.send(JSON.stringify({
              type: 'error',
              message: `Screen ID ${screenIdNumber} not found. Please check your configuration.`
            }));
            break;
          }
          
          const previousScreenId = ws.screenId;
          const previousSessionId = ws.sessionId;
          const isReRegistration = previousScreenId !== undefined;
          
          // Generate or use provided session ID
          let sessionId = parsedMessage.sessionId;
          if (!sessionId) {
            sessionId = uuidv4();
          }
          
          // FIX: Close old WebSocket if this sessionId is already connected
          // This prevents duplicate connections from the same display (e.g., after page reload)
          if (activeSessions.has(sessionId)) {
            const oldSession = activeSessions.get(sessionId);
            if (oldSession && oldSession.ws && oldSession.ws !== ws) {
              // console.log(`⚠️ Session ${sessionId} already exists. Closing old WebSocket connection.`);
              // Remove old connection from activeConnections
              if (activeConnections.has(oldSession.ws)) {
                activeConnections.delete(oldSession.ws);
              }
              // Close old WebSocket
              oldSession.ws.close();
            }
          }
          
          // Clean up previous session if this WebSocket had a different sessionId before
          // (This handles the case where a WebSocket changes from one session to another)
          if (previousSessionId && activeSessions.has(previousSessionId)) {
            const prevSession = activeSessions.get(previousSessionId);
            // Only delete if it's still pointing to this same WebSocket
            if (prevSession && prevSession.ws === ws) {
              activeSessions.delete(previousSessionId);
            }
          }
          
          ws.screenId = screenIdNumber;
          ws.sessionId = sessionId;
          activeConnections.set(ws, ws.screenId);
          activeSessions.set(sessionId, { 
            ws: ws, 
            screenId: screenIdNumber, 
            connectedAt: new Date(),
            lastSeen: new Date()
          });
          
          // Send session ID back to client
          ws.send(JSON.stringify({
            type: 'session_registered',
            sessionId: sessionId,
            screenId: screenIdNumber
          }));
          
          if (isReRegistration) {
    // console.log(`Display client re-registered from screenId ${previousScreenId} to screenId: ${ws.screenId}, sessionId: ${sessionId}`);
          } else {
    // console.log(`Display client registered for screenId: ${ws.screenId}, sessionId: ${sessionId}`);
            
            // Track connection event in database with session ID
            // But first, check if there's a recent connect event without disconnect for this session
            const recentConnect = await db.get(`
              SELECT id FROM connection_events 
              WHERE session_id = ? AND event_type = 'connect'
                AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                AND NOT EXISTS (
                  SELECT 1 FROM connection_events c2 
                  WHERE c2.session_id = connection_events.session_id 
                    AND c2.event_type = 'disconnect' 
                    AND c2.timestamp > connection_events.timestamp
                )
              ORDER BY timestamp DESC LIMIT 1
            `, [sessionId]);
            
            if (recentConnect) {
    // console.log(`Found recent unpaired connect event for session ${sessionId}, not logging new connect`);
            } else {
              // Track connection event in database with session ID
              try {
                await db.run('INSERT INTO connection_events (screen_id, session_id, event_type) VALUES (?, ?, ?)', [ws.screenId, sessionId, 'connect']);
    // console.log(`Connection event logged for screen ${ws.screenId}, session ${sessionId}`);
              } catch (error) {
                console.error('Failed to log connection event:', error);
              }
            }
          }
          
          broadcast(JSON.stringify({ type: 'connection_update' }), ws);
          break;
        }
        case 'media_view': {
          // Handle media view tracking with server-side timestamps only
          if (parsedMessage.data && ws.screenId) {
            try {
              const { mediaId, event } = parsedMessage.data;
              const serverTimestamp = new Date(); // Use server time instead of client timestamp
              
              // Convert to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
              const mysqlTimestamp = serverTimestamp.toISOString().slice(0, 19).replace('T', ' ');
              
              if (event === 'start') {
                // Record media view start with server timestamp
                await db.run('INSERT INTO media_views (screen_id, media_id, started_at) VALUES (?, ?, ?)', [
                  ws.screenId, 
                  mediaId, 
                  mysqlTimestamp
                ]);
    // console.log(`Media view started: Screen ${ws.screenId}, Media ${mediaId} at ${mysqlTimestamp}`);
              } else if (event === 'end') {
                // Update the most recent media view with duration using server time
                const startTime = await db.get(`
                  SELECT started_at FROM media_views 
                  WHERE screen_id = ? AND media_id = ? AND duration_seconds IS NULL 
                  ORDER BY started_at DESC LIMIT 1
                `, [ws.screenId, mediaId]) as { started_at: string } | undefined;
                
                if (startTime) {
                  // Parse the MySQL datetime format and calculate duration correctly
                  const startDate = new Date(startTime.started_at + ' UTC'); // Add UTC to ensure proper parsing
                  const duration = Math.floor((serverTimestamp.getTime() - startDate.getTime()) / 1000);
                  
                  // Ensure duration is positive and reasonable (max 24 hours)
                  if (duration > 0 && duration < 86400) {
                    await db.run(`
                      UPDATE media_views 
                      SET duration_seconds = ? 
                      WHERE screen_id = ? AND media_id = ? AND started_at = ?
                    `, [duration, ws.screenId, mediaId, startTime.started_at]);
    // console.log(`Media view ended: Screen ${ws.screenId}, Media ${mediaId}, Duration ${duration}s`);
                  } else {
                    console.warn(`Invalid duration calculated: ${duration}s for Screen ${ws.screenId}, Media ${mediaId}. Skipping update.`);
                  }
                }
              }
            } catch (error) {
              console.error('Failed to track media view:', error);
            }
          }
          break;
        }
        case 'content_playing': {
          // Forward current playing content to connected CMS clients
          if (parsedMessage.data && ws.screenId) {
            const message = {
              type: 'content_playing',
              data: {
                ...parsedMessage.data,
                screenId: ws.screenId
              }
            };
            
            // Broadcast to all connected CMS clients (not displays)
            wss.clients.forEach((client) => {
              const wsClient = client as WebSocketConnection;
              if (wsClient !== ws && wsClient.readyState === WebSocket.OPEN && !wsClient.screenId) {
                // Only send to CMS clients (clients without screenId)
                wsClient.send(JSON.stringify(message));
              }
            });
            
    // console.log(`Forwarded playing content from screen ${ws.screenId}`);
          }
          break;
        }
        case 'ping': {
          // HEARTBEAT: Respond to ping with pong and update last seen timestamp
          
          // Try to get screenId and sessionId from message (new client format)
          const messageScreenId = parsedMessage.screenId;
          const messageSessionId = parsedMessage.sessionId;
          
          // Update last seen timestamp
          if (messageScreenId && messageSessionId) {
            // Client sent IDs in message (Flutter client with fix)
            const session = activeSessions.get(messageSessionId);
            if (session) {
              session.lastSeen = new Date();
              // console.log(`🏓 Ping from display ${messageScreenId} (session ${messageSessionId})`);
              
              // Restore mapping if lost (network issues/reconnection scenarios)
              if (!ws.screenId || !ws.sessionId) {
                ws.screenId = messageScreenId;
                ws.sessionId = messageSessionId;
                activeConnections.set(ws, messageScreenId);
                // console.log(`🔧 Restored display mapping for screenId=${messageScreenId}`);
              }
            } else {
              // Session not found - might be a stale connection
              // console.warn(`⚠️ Ping from unknown session ${messageSessionId}, screenId=${messageScreenId}`);
            }
          } else if (ws.screenId && ws.sessionId) {
            // Fallback: Use WebSocket context (old web client or no IDs in message)
            const session = activeSessions.get(ws.sessionId);
            if (session) {
              session.lastSeen = new Date();
              // console.log(`🏓 Ping from display ${ws.screenId} (session ${ws.sessionId}) via context`);
            }
          }
          
          // Always respond with pong
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
        }
        default:
    // console.log('[Server] Received message from dashboard, broadcasting...');
          broadcast(message.toString(), ws);
          break;
      }
    } catch (e) {
      console.error('Failed to parse message or invalid message format:', e);
    }
  });

  ws.on('close', async () => {
    if (ws.screenId && ws.sessionId) {
      activeConnections.delete(ws);
      
      // Clean up session tracking — only if this WS is still the active one for this session.
      // Guard prevents wiping a session that was already re-claimed by a new connection
      // (e.g. display reloads: new WS registers same sessionId before old WS fires onclose)
      if (activeSessions.has(ws.sessionId)) {
        const session = activeSessions.get(ws.sessionId);
        if (session && session.ws === ws) {
          activeSessions.delete(ws.sessionId);
        }
      }
      
    // console.log(`Display client for screenId ${ws.screenId}, sessionId ${ws.sessionId} disconnected.`);
      
      // Track disconnection event in database with session ID - validate screen exists first
      try {
        const screenExists = await db.get('SELECT id FROM screens WHERE id = ?', [ws.screenId]);
        if (screenExists) {
          await db.run('INSERT INTO connection_events (screen_id, session_id, event_type) VALUES (?, ?, ?)', [ws.screenId, ws.sessionId, 'disconnect']);
    // console.log(`Disconnect event recorded for screen ${ws.screenId}, session ${ws.sessionId}`);
        } else {
    // console.log(`Skipping disconnect event logging for non-existent screen ID ${ws.screenId}`);
        }
      } catch (error) {
        console.error('Failed to log disconnection event:', error);
      }
      
      broadcast(JSON.stringify({ type: 'connection_update' }), ws);
    } else {
    // console.log('Client disconnected');
    }
  });
});

// Heartbeat to prune dead connections
setInterval(() => {
  wss.clients.forEach((ws: WebSocketConnection) => {
    if (ws.isAlive === false) {
      if (ws.screenId) activeConnections.delete(ws);
      // FIX: Also clean up session when WebSocket is dead
      if (ws.sessionId && activeSessions.has(ws.sessionId)) {
        activeSessions.delete(ws.sessionId);
        // console.log(`🧹 Cleaned up dead session: ${ws.sessionId}`);
      }
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
  
  // FIX: Clean up stale sessions that haven't sent a ping recently
  // This catches sessions where WebSocket closed without proper cleanup
  const now = Date.now();
  
  for (const [sessionId, session] of activeSessions.entries()) {
    const timeSinceLastSeen = now - session.lastSeen.getTime();
    if (timeSinceLastSeen > STALE_SESSION_TIMEOUT) {
      // console.log(`🧹 Removing stale session ${sessionId} (inactive for ${Math.round(timeSinceLastSeen/1000)}s)`);
      // Also remove from activeConnections if exists
      if (session.ws && activeConnections.has(session.ws)) {
        activeConnections.delete(session.ws);
      }
      activeSessions.delete(sessionId);
    }
  }
}, HEARTBEAT_INTERVAL);

// Cleanup function for server restart scenarios
async function cleanupStaleData() {
  try {
    // console.log('🧹 Cleaning up stale data from previous server sessions...');
    
    // Add disconnect events for any connect events without corresponding disconnects from previous sessions
    // Now handles both session-based and legacy screen-based connections
    // Only for connections older than 5 minutes to avoid interfering with legitimate quick reconnects
    const unpairedConnects = await db.query(`
      SELECT DISTINCT c1.screen_id, c1.session_id, c1.timestamp as connect_time
      FROM connection_events c1
      WHERE c1.event_type = 'connect'
        AND c1.timestamp < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        AND NOT EXISTS (
          SELECT 1 FROM connection_events c2 
          WHERE c2.screen_id = c1.screen_id 
            AND c2.event_type = 'disconnect' 
            AND c2.timestamp > c1.timestamp
            AND (
              (c1.session_id IS NOT NULL AND c2.session_id = c1.session_id) OR
              (c1.session_id IS NULL AND c2.session_id IS NULL)
            )
        )
    `) as { screen_id: number; session_id: string | null; connect_time: string }[];
    
    for (const connect of unpairedConnects) {
      // Add a disconnect event 1 second after the connect event
      const disconnectTime = new Date(new Date(connect.connect_time).getTime() + 1000)
        .toISOString().slice(0, 19).replace('T', ' ');
      
      await db.run(`
        INSERT INTO connection_events (screen_id, session_id, event_type, timestamp) 
        VALUES (?, ?, 'disconnect', ?)
      `, [connect.screen_id, connect.session_id, disconnectTime]);
    }
    
    if (unpairedConnects.length > 0) {
    // console.log(`🧹 Added ${unpairedConnects.length} missing disconnect events for previous sessions`);
    }
    
    // console.log('✅ Cleanup completed successfully');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run cleanup on server start
cleanupStaleData();

// Initialize default folders and screens
async function initializeDefaultData() {
  try {
    // console.log('🔧 Initializing default folders and screens...');
    
    // Default folders to create
    const defaultFolders = ['horizontales', 'verticales'];
    
    // Create default folders if they don't exist
    for (const folderName of defaultFolders) {
      const existingFolder = await db.get('SELECT id FROM folders WHERE name = ?', [folderName]);
      
      if (!existingFolder) {
        // Create folder in database
        await db.run('INSERT INTO folders (name) VALUES (?)', [folderName]);
    // console.log(`📁 Created folder: ${folderName}`);
        
        // Create physical directory
        const folderPath = path.join(UPLOADS_DIR, folderName);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
    // console.log(`📂 Created physical directory: ${folderPath}`);
        }
      }
    }
    
    // Default screens to create
    const defaultScreens = [
      {
        name: 'Pantalla Horizontal',
        location: 'Sala Principal',
        resolution: '1920x1080',
        orientation: 'horizontal',
        assignedFolder: 'horizontales',
        transitionType: 'fade',
        duration: 5
      },
      {
        name: 'Pantalla Vertical',
        location: 'Entrada',
        resolution: '1080x1920',
        orientation: 'vertical',
        assignedFolder: 'verticales',
        transitionType: 'slide',
        duration: 8
      }
    ];
    
    // Create default screens if they don't exist
    for (const screen of defaultScreens) {
      const existingScreen = await db.get('SELECT id FROM screens WHERE name = ?', [screen.name]);
      
      if (!existingScreen) {
        await db.run(`
          INSERT INTO screens (name, location, resolution, orientation, assignedFolder, transitionType, duration) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [screen.name, screen.location, screen.resolution, screen.orientation, screen.assignedFolder, screen.transitionType, screen.duration]);
    // console.log(`📺 Created screen: ${screen.name} (${screen.orientation}) -> ${screen.assignedFolder}`);
      }
    }
    
    // console.log('✅ Default data initialization completed');
  } catch (error) {
    console.error('❌ Error during default data initialization:', error);
  }
}

// Run initialization after cleanup
initializeDefaultData();

// API endpoints

// Status endpoint for connection testing
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Server is running',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

// Premio service status
app.get('/api/premio-status', (req, res) => {
  res.json({ connected: isPremioConnected, configured: !!PREMIO_WS_URL });
});

// Health check endpoint for Docker
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: Date.now()
  });
});

// Recent prizes retrieval for dashboard
app.get('/api/premio/recent', async (req, res) => {
  try {
    const raw = await fs.promises.readFile(RECENT_PRIZES_FILE, 'utf8');
    const arr = JSON.parse(raw);
    res.json(arr);
  } catch (e) {
    // If file missing or parse error, return empty array
    res.json([]);
  }
});

// Test prize endpoint - sends show_prize to all connected displays
app.post('/api/test-prize', (req, res) => {
  const payload = req.body && Object.keys(req.body).length > 0
    ? req.body
    : { tipo: 'premio', maquina: 'TEST-01', ubicacion: 'Zona Demo', monto: 1000, montoFormateado: '$1.000,00' };

  // console.log('[Premio] 🧪 Test prize enviado manualmente:', JSON.stringify(payload));
  broadcastPrize(payload);

  const displayCount = [...wss.clients].filter((c) => {
    const wc = c as WebSocketConnection;
    return wc.screenId && wc.readyState === WebSocket.OPEN;
  }).length;

  res.status(200).json({ 
    ok: true, 
    message: `Premio enviado a ${displayCount} display(s)`,
    payload 
  });
});

// User and Auth Endpoints
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

// User registration by admin - generates shareable link with temporary password
app.post('/api/users/register', verifyToken, isAdmin, async (req: AuthenticatedRequest, res) => {
  const { username, email, role = 'user' } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: 'Se requieren nombre de usuario y correo electrónico' });
  }

  // Generate temporary password
  const temporaryPassword = generateRandomPassword();
  const saltRounds = 10;
  const hash = bcrypt.hashSync(temporaryPassword, saltRounds);

  try {
    const info = await db.run('INSERT INTO users (username, email, password_hash, role, first_login) VALUES (?, ?, ?, ?, ?)', [username, email, hash, role, 1]);
    const newUser = await db.get('SELECT id, username, email, role, first_login FROM users WHERE id = ?', [info.insertId]);
    
    // Generate shareable link instead of sending email
    const frontendUrl = process.env.FRONTEND_URL || `http://${getLocalIpAddress()}:5173`;
    const loginUrl = `${frontendUrl}/login`;
    const shareableInfo = {
      username,
      temporaryPassword,
      loginUrl,
      message: `🎉 ¡Bienvenido al Sistema!

👤 Usuario: ${username}
🔑 Contraseña temporal: ${temporaryPassword}
🌐 Enlace de acceso: ${loginUrl}

⚠️ Importante: Debes cambiar tu contraseña en el primer inicio de sesión.

¡Gracias por unirte a nuestro equipo! 🚀`
    };
    
    res.status(201).json({
      user: newUser,
      shareableInfo
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    if ((error as { code: string }).code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: 'Error de base de datos' });
  }
});

// Original register endpoint for self-registration (if needed)
app.post('/api/users/self-register', async (req, res) => {
  const { username, email, password, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Se requieren nombre de usuario y contraseña' });
  }

  const saltRounds = 10;
  const hash = bcrypt.hashSync(password, saltRounds);

  try {
    const info = await db.run('INSERT INTO users (username, email, password_hash, role, first_login) VALUES (?, ?, ?, ?, ?)', [username, email, hash, role, 0]);
    const newUser = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [info.insertId]);
    res.status(201).json(newUser);
  } catch (error: unknown) {
    console.error('Registration error:', error);
    if ((error as { code: string }).code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    res.status(500).json({ error: 'Error de base de datos' });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Se requieren nombre de usuario y contraseña' });
  }

  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]) as { id: number; username: string; email: string; password_hash: string; role: string; first_login?: number };

  if (user && bcrypt.compareSync(password, user.password_hash)) {
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role,
      first_login: user.first_login
    }, SECRET_KEY, { expiresIn: '7d' });
    
    // Set HTTPOnly cookie
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure flag in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });
    
    res.json({ 
      token, // Keep token in response for backward compatibility
      first_login: user.first_login === 1,
      message: 'Login successful'
    });
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

// Logout endpoint to clear HTTPOnly cookie
app.post('/api/users/logout', (req, res) => {
  res.clearCookie('auth-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  res.json({ message: 'Logout successful' });
});

app.get('/api/users', verifyToken, isAdmin, async (req, res) => {
  const users = await db.query('SELECT id, username, email, role, first_login, created_at FROM users') as unknown[];
  res.json(users);
});

// Change password endpoint for users
app.post('/api/users/change-password', verifyToken, async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Se requiere la contraseña actual y la nueva contraseña' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  try {
    const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [userId]) as { password_hash: string };
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verify current password
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Hash new password
    const saltRounds = 10;
    const newHash = bcrypt.hashSync(newPassword, saltRounds);

    // Update password and mark first_login as false
    const info = await db.run('UPDATE users SET password_hash = ?, first_login = 0 WHERE id = ?', [newHash, userId]);

    if (info.affectedRows > 0) {
      res.json({ message: 'Contraseña cambiada exitosamente' });
    } else {
      res.status(500).json({ error: 'Error al actualizar contraseña' });
    }
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin reset user password endpoint
app.post('/api/users/:id/reset-password', verifyToken, isAdmin, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  // If no password provided, generate a random one
  const passwordToSet = newPassword || generateRandomPassword();
  
  try {
    const user = await db.get('SELECT username, email FROM users WHERE id = ?', [id]) as { username: string; email: string } | undefined;
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Hash new password
    const saltRounds = 10;
    const newHash = bcrypt.hashSync(passwordToSet, saltRounds);

    // Update password and mark as first login
    const info = await db.run('UPDATE users SET password_hash = ?, first_login = 1 WHERE id = ?', [newHash, id]);

    if (info.affectedRows > 0) {
      // Generate shareable link instead of sending email
      const frontendUrl = process.env.FRONTEND_URL || `http://${getLocalIpAddress()}:5173`;
      const loginUrl = `${frontendUrl}/login`;
      const shareableInfo = {
        username: user.username,
        temporaryPassword: passwordToSet,
        loginUrl,
        message: `🔄 Contraseña Restablecida

👤 Usuario: ${user.username}
🔑 Nueva contraseña temporal: ${passwordToSet}
🌐 Enlace de acceso: ${loginUrl}

⚠️ Recuerda cambiar tu contraseña después del primer inicio de sesión.

¡Accede ahora y mantén tu cuenta segura! 🔒`
      };

      res.json({ 
        message: 'Contraseña restablecida exitosamente',
        shareableInfo,
        temporaryPassword: newPassword ? undefined : passwordToSet // Only return if generated
      });
    } else {
      res.status(500).json({ error: 'Error al restablecer contraseña' });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id', verifyToken, isAdmin, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ error: 'Se requiere el rol del usuario' });
    }

    try {
        const info = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);

        if (info.affectedRows > 0) {
            const updatedUser = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [id]);
            res.status(200).json(updatedUser);
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error de base de datos' });
    }
});

app.delete('/api/users/:id', verifyToken, isAdmin, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user?.id === parseInt(id, 10)) {
        return res.status(403).json({ error: 'Admin users cannot delete themselves.' });
    }

    try {
        const info = await db.run('DELETE FROM users WHERE id = ?', [id]);

        if (info.affectedRows > 0) {
            res.status(200).json({ message: 'Usuario eliminado exitosamente' });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error de base de datos' });
    }
});

// Configuration endpoint for display clients
app.get('/api/config', (req, res) => {
  // Use the IP address from the client's connection instead of picking the first available IP
  const actualHost = getClientConnectionHost(req);
  const dynamicConfig = {
    ...serverConfig,
    clientHost: actualHost,
    port: serverConfig.port,
    apiBaseUrl: `http://${actualHost}:${serverConfig.port}`,
    wsUrl: `ws://${actualHost}:${serverConfig.port}`
  };
  
  // console.log('Serving config to client:', dynamicConfig);
  res.json(dynamicConfig);
});

app.get('/api/screens', async (req, res) => {
  const screens = await db.query('SELECT * FROM screens') as unknown[];
  res.json(screens);
});

interface ErrorWithCode {
  code: string;
}

const hasCode = (error: unknown): error is ErrorWithCode => {
  return typeof error === 'object' && error !== null && 'code' in error;
};

app.post('/api/screens', verifyToken, async (req, res) => {
  const { name, location, resolution, orientation, assignedFolder, transitionType, duration } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Se requiere el nombre de la pantalla' });
  }
  try {
    const info = await db.run(
      'INSERT INTO screens (name, location, resolution, orientation, assignedFolder, transitionType, duration) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, location, resolution, orientation, assignedFolder || null, transitionType || 'fade', duration || 10]
    );
    const newScreen = await db.get('SELECT * FROM screens WHERE id = ?', [info.insertId]);
    // Broadcast to all displays so they can update their available screens list
    broadcast(JSON.stringify({ type: 'screen_updated', data: newScreen }));
    res.status(201).json(newScreen);
  } catch (error: unknown) {
    console.error('Error creating screen:', error);
    if (hasCode(error) && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El nombre de la pantalla ya existe' });
    }
    res.status(500).json({ error: 'Error de base de datos' });
  }
});

app.get('/api/playlists/:screenId', async (req, res) => {
  const { screenId } = req.params;
  const screenIdNumber = parseInt(screenId, 10);
  
  if (isNaN(screenIdNumber)) {
    return res.status(400).json({ error: 'Invalid screen ID' });
  }
  
  try {
    const mediaIds = await db.query(
      'SELECT media_id FROM screen_media WHERE screen_id = ? ORDER BY display_order ASC',
      [screenIdNumber]
    ) as { media_id: number }[];

    if (mediaIds.length === 0) {
      return res.json([]);
    }

    const placeholders = mediaIds.map(() => '?').join(',');
    const media = await db.query(
      `SELECT * FROM media WHERE id IN (${placeholders})`,
      mediaIds.map((row) => row.media_id)
    ) as { id: number; [key: string]: unknown }[];

    // Order the results based on the original order from screen_media
    const orderedMedia = mediaIds.map((row) => media.find((m) => m.id === row.media_id));

    res.json(orderedMedia);
  } catch (error) {
    console.error('Failed to get playlist:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/screens/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const screen = await db.get('SELECT * FROM screens WHERE id = ?', [id]);
    if (screen) {
      res.json(screen);
    } else {
      res.status(404).json({ error: 'Screen not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/screens/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  // Only allow valid screen fields from the database schema
  const validFields = ['name', 'location', 'resolution', 'orientation', 'assignedFolder', 'transitionType', 'duration'];
  const filteredFields: Record<string, unknown> = {};
  
  validFields.forEach(field => {
    if (fields[field] !== undefined) {
      filteredFields[field] = fields[field];
    }
  });

  const fieldEntries = Object.entries(filteredFields);
  if (fieldEntries.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
  const values = fieldEntries.map(([, value]) => value);
  values.push(id);

  try {
    const info = await db.run(`UPDATE screens SET ${setClause} WHERE id = ?`, values);

    if (info.affectedRows > 0) {
      const updatedScreen = await db.get('SELECT * FROM screens WHERE id = ?', [id]);
    // console.log('--- BROADCASTING TO ALL DISPLAYS ---');
      // Broadcast to all displays so they can update their available screens list
      broadcast(JSON.stringify({ type: 'screen_updated', data: updatedScreen }));
      res.status(200).json(updatedScreen);
    } else {
      res.status(404).json({ error: 'Screen not found' });
    }
  } catch (error: unknown) {
    console.error('Error updating screen:', error);
    if (hasCode(error) && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Screen name already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/screens/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Check if screen exists
    const screen = await db.get('SELECT * FROM screens WHERE id = ?', [id]) as { id: number; name: string; assignedFolder: string } | undefined;
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    // Check if screen has active display connections
    const screenIdNumber = parseInt(id);
    let hasActiveConnections = false;
    for (const screenId of activeConnections.values()) {
      if (screenId === screenIdNumber) {
        hasActiveConnections = true;
        break;
      }
    }
    
    if (hasActiveConnections) {
      return res.status(400).json({ error: 'No se puede eliminar una pantalla que tiene displays conectados. Desconecte los displays primero.' });
    }

    const info = await db.run('DELETE FROM screens WHERE id = ?', [id]);

    if (info.affectedRows > 0) {
      // Broadcast to all displays so they can update their available screens list
      broadcast(JSON.stringify({ type: 'screen_updated', data: { id: screenIdNumber } }));
      res.status(200).json({ message: 'Screen deleted successfully' });
    } else {
      res.status(404).json({ error: 'Screen not found' });
    }
  } catch (error) {
    console.error('Error deleting screen:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Multer config for file uploads with thumbnail support
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = generateRandomString(7);
    const extension = path.extname(file.originalname);
    const fieldName = file.fieldname;
    
    if (fieldName === 'thumbnail') {
      cb(null, uniqueSuffix + '_thumb.jpg');
    } else {
      cb(null, uniqueSuffix + extension);
    }
  },
});
const upload = multer({ storage });

// Media API endpoints
app.get('/api/media', async (req, res) => {
  const { folder } = req.query;
    // console.log(`[GET /api/media] Received request for folder: "${folder}"`);
  try {
    let media;
    if (folder && folder !== 'all') {
      media = await db.query('SELECT * FROM media WHERE folder = ?', [folder]);
    // console.log(`[GET /api/media] Found ${media.length} files in folder "${folder}".`);
    } else {
      media = await db.query('SELECT * FROM media');
    // console.log(`[GET /api/media] No folder specified, found ${media.length} total files.`);
    }
    
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/media', verifyToken, upload.fields([{name: 'file', maxCount: 1}, {name: 'thumbnail', maxCount: 1}]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
    // console.log('📁 File upload request received');
    // console.log('Files received:', Object.keys(files || {}));
  
  if (!files?.file || files.file.length === 0) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  const mainFile = files.file[0];
  const thumbnailFile = files.thumbnail?.[0];
  
    // console.log(`📄 Main file: ${mainFile.filename} (${mainFile.mimetype})`);
  if (thumbnailFile) {
    // console.log(`🖼️ Thumbnail file: ${thumbnailFile.filename} (${thumbnailFile.mimetype}, ${thumbnailFile.size} bytes)`);
  } else {
    // console.log('❌ No thumbnail file received');
  }
  
  const { mimetype, filename, size } = mainFile;
  const { folder } = req.body;
  const name = path.parse(filename).name;

  try {
    // Create folder directory if it doesn't exist and folder is specified
    let targetDir = UPLOADS_DIR;
    let finalFilePath = `/uploads/${filename}`;
    let fileFilePath = path.join(UPLOADS_DIR, filename);
    
    if (folder && folder.trim()) {
      const folderPath = path.join(UPLOADS_DIR, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    // console.log(`📁 Created folder directory: ${folderPath}`);
      }
      targetDir = folderPath;
      finalFilePath = `/uploads/${folder}/${filename}`;
      fileFilePath = path.join(folderPath, filename);
      
      // Move the uploaded file to the folder directory
      const currentPath = mainFile.path;
      fs.renameSync(currentPath, fileFilePath);
    // console.log(`📂 Moved file from ${currentPath} to ${fileFilePath}`);
    } else {
      // File stays in uploads root
      fileFilePath = path.join(UPLOADS_DIR, filename);
    }

    let thumbnailPath = null;
    
    if (thumbnailFile) {
      if (folder && folder.trim()) {
        // Move thumbnail to folder directory too
        const thumbnailNewPath = path.join(targetDir, thumbnailFile.filename);
        fs.renameSync(thumbnailFile.path, thumbnailNewPath);
        thumbnailPath = `/uploads/${folder}/${thumbnailFile.filename}`;
      } else {
        thumbnailPath = `/uploads/${thumbnailFile.filename}`;
      }
    // console.log(`✅ Client thumbnail will be saved as: ${thumbnailPath}`);
    } else {
      // Generate server-side thumbnail for files without client thumbnail
      const thumbnailFileName = `${generateRandomString(7)}_thumb.jpg`;
      const thumbnailFilePath = path.join(targetDir, thumbnailFileName);
      
      if (mimetype.startsWith('video/')) {
        try {
    // console.log('🎬 Generating server-side thumbnail for video...');
          await generateVideoThumbnail(fileFilePath, thumbnailFilePath);
          
          if (fs.existsSync(thumbnailFilePath)) {
            thumbnailPath = folder ? `/uploads/${folder}/${thumbnailFileName}` : `/uploads/${thumbnailFileName}`;
    // console.log(`✅ Server video thumbnail generated: ${thumbnailPath}`);
          }
        } catch (error) {
          console.error('⚠️ Server-side video thumbnail generation failed:', error);
          // Continue without thumbnail - not a fatal error
        }
      } else if (mimetype.startsWith('image/')) {
        try {
    // console.log('🖼️ Generating server-side thumbnail for image...');
          await generateImageThumbnail(fileFilePath, thumbnailFilePath);
          
          if (fs.existsSync(thumbnailFilePath)) {
            thumbnailPath = folder ? `/uploads/${folder}/${thumbnailFileName}` : `/uploads/${thumbnailFileName}`;
    // console.log(`✅ Server image thumbnail generated: ${thumbnailPath}`);
          }
        } catch (error) {
          console.error('⚠️ Server-side image thumbnail generation failed:', error);
          // Continue without thumbnail - not a fatal error
        }
      }
    }

    const info = await db.run('INSERT INTO media (name, type, path, size, folder, thumbnail) VALUES (?, ?, ?, ?, ?, ?)', [name, mimetype, finalFilePath, size, folder, thumbnailPath]);
    
    // Track file upload operation
    await db.run('INSERT INTO file_operations (operation_type, file_name, file_size, folder) VALUES (?, ?, ?, ?)', ['upload', name, size, folder]);
    
    // Invalidate analytics cache when media is uploaded
    invalidateAnalyticsCache();
    
    const newMedia = await db.get('SELECT * FROM media WHERE id = ?', [info.insertId]) as unknown;
    // console.log(`💾 Media saved to database:`, { 
    //   id: newMedia?.id, 
    //   name: newMedia?.name, 
    //   thumbnail: newMedia?.thumbnail 
    // });
    
    broadcast(JSON.stringify({ type: 'media_updated' }));
    res.status(201).json(newMedia);
  } catch (error) {
    console.error('❌ Database error during upload:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/media/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const file = await db.get('SELECT name, path, size, folder, thumbnail FROM media WHERE id = ?', [id]) as { name: string; path: string; size: number; folder: string; thumbnail: string | null };
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete main file
    const filePath = path.join(process.cwd(), file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    // console.log(`🗑️ Deleted main file: ${filePath}`);
    }

    // Delete thumbnail if it exists
    if (file.thumbnail) {
      const thumbnailPath = path.join(process.cwd(), file.thumbnail);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
    // console.log(`🗑️ Deleted thumbnail: ${thumbnailPath}`);
      }
    }

    const info = await db.run('DELETE FROM media WHERE id = ?', [id]);

    if (info.affectedRows > 0) {
      // Track file deletion operation
      await db.run('INSERT INTO file_operations (operation_type, file_name, file_size, folder) VALUES (?, ?, ?, ?)', ['delete', file.name, file.size, file.folder]);
      
      // Invalidate analytics cache when media is deleted
      invalidateAnalyticsCache();
      
      broadcast(JSON.stringify({ type: 'media_updated' }));
      res.status(200).json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found in database' });
    }
  } catch (error) {
    console.error('❌ Error deleting media:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/media/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Se requiere el nombre del archivo multimedia' });
  }

  try {
    const info = await db.run(
      'UPDATE media SET name = ? WHERE id = ?', 
      [name, id]
    );

    if (info.affectedRows > 0) {
      // Fetch the updated record to return it
      const updatedMedia = await db.get('SELECT * FROM media WHERE id = ?', [id]);
      
      broadcast(JSON.stringify({ type: 'media_updated' }));
      res.status(200).json(updatedMedia);
    } else {
      res.status(404).json({ error: 'Media not found' });
    }
  } catch (error) {
    console.error('Error updating media:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/status/screens', async (req, res) => {
  const connectionCounts: { [key: number]: number } = {};
  const lastSeenMap: { [key: number]: Date } = {};
  
  // FIX: Count using activeSessions (unique sessions) instead of activeConnections (raw WebSockets)
  // This prevents counting duplicate connections from the same display
  for (const [sessionId, session] of activeSessions.entries()) {
    const screenId = session.screenId;
    const lastSeen = session.lastSeen;
    
    // Count connections per screen
    connectionCounts[screenId] = (connectionCounts[screenId] || 0) + 1;
    
    // Keep the most recent lastSeen for each screen
    if (!lastSeenMap[screenId] || lastSeen > lastSeenMap[screenId]) {
      lastSeenMap[screenId] = lastSeen;
    }
  }
  
  // Get all configured screens and merge with connection status
  const allScreens = await db.query('SELECT id, name FROM screens') as { id: number; name: string }[];
  const now = new Date();
  const screenStatus = allScreens.map(screen => {
    const lastSeen = lastSeenMap[screen.id];
    const secondsSinceLastSeen = lastSeen ? Math.floor((now.getTime() - lastSeen.getTime()) / 1000) : null;
    
    // Consider a display "online" if we've seen a ping in the last 60 seconds
    // This accounts for the 30s ping interval + 30s grace period
    const isOnline = secondsSinceLastSeen !== null && secondsSinceLastSeen < 60;
    
    return {
      id: screen.id,
      name: screen.name,
      connected: connectionCounts[screen.id] > 0,
      online: isOnline,
      connectionCount: connectionCounts[screen.id] || 0,
      lastSeen: lastSeen ? lastSeen.toISOString() : null,
      secondsSinceLastSeen: secondsSinceLastSeen
    };
  });
  
  res.json({
    screens: screenStatus,
    totalConnected: activeSessions.size, // FIX: Use activeSessions (unique displays) instead of activeConnections (raw WebSockets)
    totalOnline: screenStatus.filter(s => s.online).length, // Displays seen in last 60s
    totalUniqueScreensConnected: Object.keys(connectionCounts).length, // Unique screens with connections
    totalConfigured: allScreens.length
  });
});

// DEBUG: Diagnostic endpoint to inspect connection state
// This helps identify ghost displays and duplicate connections
app.get('/api/debug/connections', (req, res) => {
  const now = new Date();
  
  // Get detailed info from activeSessions
  const sessionsInfo = Array.from(activeSessions.entries()).map(([sessionId, session]) => {
    const timeSinceLastSeen = Math.floor((now.getTime() - session.lastSeen.getTime()) / 1000);
    const connectionDuration = Math.floor((now.getTime() - session.connectedAt.getTime()) / 1000);
    
    return {
      sessionId,
      screenId: session.screenId,
      connectedAt: session.connectedAt.toISOString(),
      lastSeen: session.lastSeen.toISOString(),
      secondsSinceLastSeen: timeSinceLastSeen,
      connectionDurationSeconds: connectionDuration,
      isStale: timeSinceLastSeen > (STALE_SESSION_TIMEOUT / 1000), // More than STALE_SESSION_TIMEOUT seconds since last ping
      websocketState: session.ws ? session.ws.readyState : 'null'
    };
  });
  
  // Count WebSocket connections per screen from activeConnections
  const wsConnectionCounts: { [key: number]: number } = {};
  for (const screenId of activeConnections.values()) {
    wsConnectionCounts[screenId] = (wsConnectionCounts[screenId] || 0) + 1;
  }
  
  // Count sessions per screen from activeSessions
  const sessionConnectionCounts: { [key: number]: number } = {};
  for (const [sessionId, session] of activeSessions.entries()) {
    const screenId = session.screenId;
    sessionConnectionCounts[screenId] = (sessionConnectionCounts[screenId] || 0) + 1;
  }
  
  res.json({
    summary: {
      activeConnectionsSize: activeConnections.size,
      activeSessionsSize: activeSessions.size,
      discrepancy: activeConnections.size - activeSessions.size,
      staleSessions: sessionsInfo.filter(s => s.isStale).length
    },
    webSocketConnections: {
      total: activeConnections.size,
      perScreen: wsConnectionCounts
    },
    sessions: {
      total: activeSessions.size,
      perScreen: sessionConnectionCounts,
      details: sessionsInfo
    },
    potentialIssues: {
      hasDiscrepancy: activeConnections.size !== activeSessions.size,
      hasStaleSessions: sessionsInfo.some(s => s.isStale),
      hasDuplicatesInWebSockets: Object.values(wsConnectionCounts).some(count => count > 1),
      hasDuplicatesInSessions: Object.values(sessionConnectionCounts).some(count => count > 1)
    }
  });
});

// Analytics endpoint with caching
app.get('/api/analytics', async (req, res) => {
  try {
    // Check if we have cached data that's still valid
    const now = Date.now();
    if (analyticsCache && (now - analyticsCache.timestamp) < ANALYTICS_CACHE_TTL) {
      // Return cached data
      return res.json(analyticsCache.data);
    }
    
    // Calculate real uptime from server start time
    const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    
    // Current month file operations with proper tracking
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    // OPTIMIZED: Combine all file operations queries into ONE query
    const fileOperationsStats = await db.get(`
      SELECT 
        COUNT(CASE WHEN operation_type = 'upload' AND DATE_FORMAT(created_at, '%Y-%m') = ? THEN 1 END) as month_uploads,
        COUNT(CASE WHEN operation_type = 'delete' AND DATE_FORMAT(created_at, '%Y-%m') = ? THEN 1 END) as month_deletions,
        COUNT(CASE WHEN operation_type = 'upload' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as last30_uploads,
        COUNT(CASE WHEN operation_type = 'delete' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as last30_deletions
      FROM file_operations
    `, [`${currentYear}-${currentMonth}`, `${currentYear}-${currentMonth}`]) as { 
      month_uploads: number; 
      month_deletions: number;
      last30_uploads: number;
      last30_deletions: number;
    };
    
    // Calculate net change (uploads minus deletions)
    const netChange = fileOperationsStats.month_uploads - fileOperationsStats.month_deletions;
    
    // Calculate total storage from media table for consistency
    const totalStorageQuery = await db.get(`
      SELECT COALESCE(SUM(size), 0) as total_size 
      FROM media
    `) as { total_size: number };
    
    // Ensure totalStorage is always a number
    const totalStorage = Number(totalStorageQuery?.total_size || 0);
    
    // OPTIMIZED: Simplified connection time calculation - only use last 100 connections to reduce load
    // Use LIMIT to avoid scanning entire table and get only the first disconnect for each connect
    const avgConnectionQuery = await db.get(`
      SELECT 
        COALESCE(AVG(TIMESTAMPDIFF(MINUTE, connect.timestamp, COALESCE(disconnect.timestamp, NOW()))), 0) as avg_minutes
      FROM (
        SELECT timestamp, session_id FROM connection_events 
        WHERE event_type = 'connect' AND session_id IS NOT NULL
        ORDER BY timestamp DESC LIMIT 100
      ) connect
      LEFT JOIN (
        SELECT session_id, MIN(timestamp) as timestamp
        FROM connection_events
        WHERE event_type = 'disconnect'
        GROUP BY session_id
      ) disconnect ON 
        disconnect.session_id = connect.session_id AND
        disconnect.timestamp > connect.timestamp
    `) as { avg_minutes: number } | undefined;
    
    // Convert minutes to hours and ensure avgConnectionTime is always a number and never NaN
    const avgConnectionMinutes = avgConnectionQuery?.avg_minutes;
    let avgConnectionTime = 0;
    
    if (avgConnectionMinutes && !isNaN(avgConnectionMinutes) && avgConnectionMinutes >= 0) {
      // Convert minutes to hours (rounded to 1 decimal place)
      avgConnectionTime = Math.round((avgConnectionMinutes / 60) * 10) / 10;
    } else if (activeConnections.size > 0) {
      // Fallback: if we have active connections but no historical data, 
      // show a minimal time to indicate there are active connections
      avgConnectionTime = 0.1;
    }
    
    // Current connection counts
    const connectionCounts: { [key: number]: number } = {};
    for (const screenId of activeConnections.values()) {
      connectionCounts[screenId] = (connectionCounts[screenId] || 0) + 1;
    }
    
    const analytics = {
      monthlyFileOperations: {
        uploads: fileOperationsStats.month_uploads,
        deletions: fileOperationsStats.month_deletions,
        netChange: netChange,
        last30DaysUploads: fileOperationsStats.last30_uploads,
        last30DaysDeletions: fileOperationsStats.last30_deletions
      },
      systemMetrics: {
        uptime,
        avgConnectionTime,
        totalConnections: activeConnections.size, // Total display connections
        totalUniqueScreensConnected: Object.keys(connectionCounts).length, // Unique screens with connections
        totalStorage: totalStorage
      }
    };
    
    // Cache the analytics data
    analyticsCache = {
      data: analytics,
      timestamp: Date.now()
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// Folder management endpoints
app.get('/api/folders', async (req, res) => {
  try {
    const folders = await db.query('SELECT * FROM folders ORDER BY name ASC');
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/folders', verifyToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Se requiere el nombre de la carpeta' });
  }

  const folderName = name.trim().toLowerCase();
  
  try {
    // Create physical directory within uploads folder
    const folderPath = path.join(UPLOADS_DIR, folderName);
    
    // Check if physical directory already exists
    if (fs.existsSync(folderPath)) {
      return res.status(409).json({ error: 'Folder directory already exists' });
    }
    
    // Create the database entry first
    const info = await db.run('INSERT INTO folders (name) VALUES (?)', [folderName]);
    
    // Create the physical directory
    try {
      fs.mkdirSync(folderPath, { recursive: true });
    // console.log(`📁 Created folder directory: ${folderPath}`);
    } catch (fsError) {
      // If directory creation fails, rollback database entry
      await db.run('DELETE FROM folders WHERE id = ?', [info.insertId]);
      console.error('Failed to create folder directory:', fsError);
      return res.status(500).json({ error: 'Failed to create folder directory' });
    }
    
    const newFolder = await db.get('SELECT * FROM folders WHERE id = ?', [info.insertId]);
    res.status(201).json(newFolder);
  } catch (error: unknown) {
    console.error('Error creating folder:', error);
    if (hasCode(error) && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El nombre de la carpeta ya existe' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/folders/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if folder exists
    const folder = await db.get('SELECT * FROM folders WHERE id = ?', [id]) as { id: number; name: string } | undefined;
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if folder has media files
    const mediaCount = await db.get('SELECT COUNT(*) as count FROM media WHERE folder = ?', [folder.name]) as { count: number };
    if (mediaCount.count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una carpeta que contiene archivos multimedia. Primero mueva o elimine los archivos.' });
    }

    // Check if folder is assigned to any screens
    const screenCount = await db.get('SELECT COUNT(*) as count FROM screens WHERE assignedFolder = ?', [folder.name]) as { count: number };
    if (screenCount.count > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una carpeta asignada a pantallas. Primero reasigne las pantallas.' });
    }

    const info = await db.run('DELETE FROM folders WHERE id = ?', [id]);

    if (info.affectedRows > 0) {
      // Also remove the physical directory if it exists
      const folderPath = path.join(UPLOADS_DIR, folder.name);
      try {
        if (fs.existsSync(folderPath)) {
          // Check if directory is empty before deletion
          const files = fs.readdirSync(folderPath);
          if (files.length === 0) {
            fs.rmdirSync(folderPath);
    // console.log(`📁 Removed folder directory: ${folderPath}`);
          } else {
            console.warn(`⚠️ Folder directory ${folderPath} not empty, not removing physical directory`);
          }
        }
      } catch (fsError) {
        console.error('Failed to remove folder directory:', fsError);
        // Continue with success response since database deletion succeeded
      }
      
      res.status(200).json({ message: 'Folder deleted successfully' });
    } else {
      res.status(404).json({ error: 'Folder not found' });
    }
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Catch-all handler for serving the frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });
}

export const broadcast = (message: string, sender?: WebSocketConnection) => {
    // console.log('--- BROADCAST FUNCTION CALLED ---');
    // console.log(`[Server] Broadcasting message: ${message}`);
  wss.clients.forEach((client: WebSocketConnection) => {
    if (client !== sender && client.readyState === client.OPEN) {
    // console.log(`[Server] Sending message to client with screenId: ${client.screenId || 'N/A'}`);
      client.send(message);
    }
  });
};

export const broadcastToScreen = (message: string, screenId: string | number) => {
    // console.log(`--- BROADCASTING TO SCREEN ${screenId} ---`);
    // console.log(`[Server] Broadcasting message to screen ${screenId}: ${message}`);
  
  // Convert screenId to number for comparison
  const targetScreenId = typeof screenId === 'string' ? parseInt(screenId, 10) : screenId;
  
  wss.clients.forEach((client: WebSocketConnection) => {
    if (client.screenId === targetScreenId && client.readyState === client.OPEN) {
    // console.log(`[Server] Sending message to screen ${screenId}`);
      client.send(message);
    }
  });
};

server.listen(PORT, serverConfig.listenHost, () => {
  const actualHost = getLocalIpAddress();
  console.log(`✅ Server running on http://${actualHost}:${PORT}`);
  console.log(`✅ WebSocket server available at ws://${actualHost}:${PORT}`);
  console.log(`✅ Listening on all interfaces (0.0.0.0:${PORT})`);
});
