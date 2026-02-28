// Display Application - Fullscreen advertising content viewer

// Configuration will be loaded dynamically from the server
let API_BASE_URL = 'http://localhost:3001'; // fallback
let WS_URL = 'ws://localhost:3001'; // fallback

// IndexedDB Cache Manager for handling large binary data
class IndexedDBCacheManager {
    constructor(dbName = 'DisplayCacheDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                // console.warn('[IndexedDB] Not supported, falling back to localStorage');
                resolve(false);
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                // console.error('[IndexedDB] Failed to open database');
                resolve(false);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                // console.log('[IndexedDB] Database opened successfully');
                resolve(true);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('mediaCache')) {
                    const mediaStore = db.createObjectStore('mediaCache', { keyPath: 'path' });
                    mediaStore.createIndex('timestamp', 'timestamp', { unique: false });
                    mediaStore.createIndex('size', 'size', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('memoryCache')) {
                    const memoryStore = db.createObjectStore('memoryCache', { keyPath: 'path' });
                    memoryStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async setItem(storeName, key, data) {
        if (!this.db) return false;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const dataToStore = {
                path: key,
                ...data,
                timestamp: Date.now()
            };
            
            const request = store.put(dataToStore);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                // console.error(`[IndexedDB] Error storing ${key}:`, request.error);
                resolve(false);
            };
        });
    }

    async getItem(storeName, key) {
        if (!this.db) return null;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                // console.error(`[IndexedDB] Error getting ${key}:`, request.error);
                resolve(null);
            };
        });
    }

    async removeItem(storeName, key) {
        if (!this.db) return false;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                // console.error(`[IndexedDB] Error removing ${key}:`, request.error);
                resolve(false);
            };
        });
    }

    async getAllKeys(storeName) {
        if (!this.db) return [];
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAllKeys();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                // console.error('[IndexedDB] Error getting all keys:', request.error);
                resolve([]);
            };
        });
    }

    async clear(storeName) {
        if (!this.db) return false;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => {
                // console.log(`[IndexedDB] Cleared ${storeName}`);
                resolve(true);
            };
            request.onerror = () => {
                // console.error(`[IndexedDB] Error clearing ${storeName}:`, request.error);
                resolve(false);
            };
        });
    }

    async getStorageUsage(storeName) {
        if (!this.db) return { count: 0, totalSize: 0 };
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const items = request.result;
                const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
                resolve({ count: items.length, totalSize });
            };
            request.onerror = () => {
                // console.error('[IndexedDB] Error getting storage usage:', request.error);
                resolve({ count: 0, totalSize: 0 });
            };
        });
    }
}

class DisplayApp {
    constructor() {
        this.clickCount = 0;
        this.clickTimer = null;
        this.currentScreenId = null;
        this.sessionId = null; // Unique session ID for this display connection
        this.contentRotationTimer = null;
        this.currentContentIndex = 0;
        this.mediaFiles = [];
        this.isConfigMode = false;
        this.isTransitioning = false; // Add flag to prevent rapid transitions
        this.configLoaded = false; // Track if server config is loaded
        this.orientation = localStorage.getItem('display_orientation') || 'horizontal'; // Add orientation setting
        this.contentUpdateQueued = false; // Queue flag for pending content updates
        this.lastContentUpdate = 0; // Timestamp of last content update to prevent spam
        this.offlineMediaCache = []; // Cache for offline media
        this.isOfflineMode = false; // Track offline status
        this.wasConnected = false; // Track if WebSocket was previously connected for reconnection detection
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        
        // Enhanced caching properties
        this.preloadCache = new Map(); // In-memory cache for preloaded content
        this.cacheStats = { hits: 0, misses: 0, preloaded: 0 };
        this.serviceWorkerReady = false;
        this.preloadQueue = [];
        this.maxCacheSize = 100; // Increased cache size for better performance
        this.cacheExpiryTime = 1000 * 60 * 60 * 4; // 4 hours - longer cache retention
        
        // Initialize IndexedDB cache manager for large binary data
        this.indexedDBManager = new IndexedDBCacheManager();
        this.indexedDBSupported = false;
        
        // Cache for available screens list to keep it in sync with dashboard
        this.availableScreensCache = null;
        this.availableScreensLastFetch = 0;
        
        this.init();
    }

    // Generate a unique session ID for this display instance
    generateSessionId() {
        // Simple UUID v4 implementation for client-side
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Get or create session ID (persistent across page reloads)
    getSessionId() {
        if (!this.sessionId) {
            // Try to get existing session ID from localStorage first
            const storedSessionId = localStorage.getItem('display_session_id');
            if (storedSessionId) {
                this.sessionId = storedSessionId;
            } else {
                // Generate new session ID and store it
                this.sessionId = this.generateSessionId();
                localStorage.setItem('display_session_id', this.sessionId);
            }
        }
        return this.sessionId;
    }

    async init() {
        // console.log('Initializing Display App...');
        
        // Initialize IndexedDB cache manager first
        this.indexedDBSupported = await this.indexedDBManager.init();
        // console.log('[Cache] IndexedDB supported:', this.indexedDBSupported);
        
        // Initialize enhanced caching system
        await this.initCaching();
        
        // Load server configuration first
        await this.loadServerConfig();
        
        // Load offline cache
        this.loadOfflineCache();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check for saved screen configuration
        await this.loadConfiguration();
        
        // Apply orientation settings
        this.applyOrientation();
        
        // Enter fullscreen mode
        this.enterFullscreen();
        
        // Start content loading
        await this.loadContent();

        // Connect to WebSocket
        this.connectWebSocket();
        
        // Hide loading screen
        document.getElementById('loadingScreen').classList.add('hidden');
        
        // Start content rotation
        this.startContentRotation();
        
        // console.log('Display App initialized successfully');
    }

    // Offline media caching system
    loadOfflineCache() {
        try {
            const cached = localStorage.getItem('display_offline_media');
            if (cached) {
                this.offlineMediaCache = JSON.parse(cached);
                // console.log('Loaded offline cache with', this.offlineMediaCache.length, 'media files');
            }
        } catch (error) {
            // console.error('Error loading offline cache:', error);
            this.offlineMediaCache = [];
        }
    }

    async saveOfflineCache(mediaFiles) {
        try {
            // Cache ALL media files for offline support (images and videos up to reasonable limit)
            const imagesToCache = mediaFiles.filter(media => media.type.startsWith('image/')).slice(0, 10);
            const videosToCache = mediaFiles.filter(media => media.type.startsWith('video/')).slice(0, 5); // Cache up to 5 videos
            const allMediaToCache = [...imagesToCache, ...videosToCache];
            const cacheData = [];
            let savedCount = 0;

            // console.log(`[Cache] Starting offline cache for ${imagesToCache.length} images and ${videosToCache.length} videos`);

            for (const media of allMediaToCache) {
                try {
                    // Use media.path instead of media.filePath for consistency
                    const mediaUrl = `${API_BASE_URL}${media.path}`;
                    
                    const response = await fetch(mediaUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        
                        // Store binary data in IndexedDB if supported (always use IndexedDB for videos)
                        if (this.indexedDBSupported) {
                            const success = await this.indexedDBManager.setItem('mediaCache', media.path, {
                                blob: blob,
                                media: media,
                                size: blob.size,
                                type: blob.type,
                                cachedAt: Date.now()
                            });
                            
                            if (success) {
                                // Store only metadata in localStorage for quick access
                                cacheData.push({
                                    ...media,
                                    cachedAt: Date.now(),
                                    size: blob.size,
                                    storedInIndexedDB: true
                                });
                                savedCount++;
                                // console.log(`[Cache] Cached for offline (IndexedDB): ${media.name} (${this.formatBytes(blob.size)})`);
                            } else {
                                // console.warn(`[Cache] Failed to store in IndexedDB: ${media.name}`);
                            }
                        } else {
                            // Fallback to base64 in localStorage (with size limit) - only for images
                            if (media.type.startsWith('image/') && blob.size <= 500 * 1024) { // Only cache small images
                                const base64 = await this.blobToBase64(blob);
                                cacheData.push({
                                    ...media,
                                    cachedData: base64,
                                    cachedAt: Date.now(),
                                    size: blob.size,
                                    storedInIndexedDB: false
                                });
                                savedCount++;
                                // console.log(`[Cache] Cached for offline (localStorage): ${media.name} (${this.formatBytes(blob.size)})`);
                            } else {
                                // console.warn(`[Cache] File too large for localStorage fallback: ${media.name} (${this.formatBytes(blob.size)})`);
                            }
                        }
                    }
                } catch (error) {
                    // console.warn('Failed to cache media for offline:', media.name, error);
                }
            }

            this.offlineMediaCache = cacheData;
            
            // Only store metadata in localStorage, not binary data
            try {
                localStorage.setItem('display_offline_media', JSON.stringify(cacheData));
                // console.log(`[Cache] Offline cache complete: ${savedCount}/${imagesToCache.length} images saved`);
            } catch (localStorageError) {
                // console.error('[Cache] Failed to save metadata to localStorage:', localStorageError);
                // Try to save smaller metadata set
                const metadataOnly = cacheData.map(item => ({
                    path: item.path,
                    name: item.name,
                    type: item.type,
                    cachedAt: item.cachedAt,
                    size: item.size,
                    storedInIndexedDB: item.storedInIndexedDB
                }));
                
                try {
                    localStorage.setItem('display_offline_media', JSON.stringify(metadataOnly));
                    // console.log('[Cache] Saved minimal metadata to localStorage');
                } catch (fallbackError) {
                    // console.error('[Cache] Failed to save even minimal metadata:', fallbackError);
                }
            }
            
        } catch (error) {
            // console.error('Error saving offline cache:', error);
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // ===== ENHANCED CACHING SYSTEM =====
    
    // Initialize enhanced caching system with service worker
    async initCaching() {
        // console.log('[Cache] Initializing enhanced caching system...');
        
        // Check service worker support and registration
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                this.serviceWorkerReady = true;
                // console.log('[Cache] Service Worker ready for caching');
                
                // Listen for service worker messages
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event);
                });
                
                // Get initial cache status
                await this.getCacheStatus();
                
            } catch (error) {
                // console.warn('[Cache] Service Worker not available:', error);
                this.serviceWorkerReady = false;
            }
        } else {
            // console.warn('[Cache] Service Worker not supported');
            this.serviceWorkerReady = false;
        }
        
        // Initialize memory cache from localStorage
        await this.loadMemoryCache();
        
        // Setup periodic cache cleanup
        setInterval(() => this.cleanupCache(), 300000); // Every 5 minutes
    }
    
    // Handle messages from service worker
    handleServiceWorkerMessage(event) {
        const { type, count, removedCount } = event.data;
        
        switch (type) {
            case 'PRELOAD_COMPLETE':
                // console.log('[Cache] Preloading complete:', count, 'files');
                this.cacheStats.preloaded = count;
                this.updateStatusIndicator();
                break;
                
            case 'CACHE_CLEANUP_COMPLETE':
                // console.log('[Cache] Service worker cleanup complete:', removedCount, 'items removed');
                this.cacheStats.serviceWorkerCleaned = (this.cacheStats.serviceWorkerCleaned || 0) + removedCount;
                this.updateStatusIndicator();
                break;
        }
    }
    
    // Load memory cache from localStorage (metadata only)
    async loadMemoryCache() {
        try {
            const cached = localStorage.getItem('display_memory_cache');
            if (cached) {
                const cacheData = JSON.parse(cached);
                const now = Date.now();
                
                // Filter out expired entries and load only metadata (no blobs)
                const loadPromises = [];
                Object.entries(cacheData).forEach(([key, value]) => {
                    if (now - value.timestamp < this.cacheExpiryTime) {
                        // Store metadata in memory cache, blob will be loaded from IndexedDB when needed
                        this.preloadCache.set(key, {
                            serverUrl: value.serverUrl,
                            media: value.media,
                            timestamp: value.timestamp,
                            size: value.size,
                            type: value.type,
                            // Don't load blob from localStorage as it causes issues
                            blob: null
                        });
                        
                        // If IndexedDB is supported, try to load blob immediately to reduce cache misses
                        if (this.indexedDBSupported) {
                            loadPromises.push(this.loadBlobFromIndexedDB(key));
                        }
                    }
                });
                
                // console.log('[Cache] Loaded memory cache with', this.preloadCache.size, 'items');
                
                // Load blobs from IndexedDB asynchronously to reduce initial cache misses
                if (loadPromises.length > 0) {
                    Promise.allSettled(loadPromises).then((results) => {
                        const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
                        if (successCount > 0) {
                            // console.log(`[Cache] Pre-loaded ${successCount}/${loadPromises.length} blobs from IndexedDB`);
                        }
                    });
                }
            }
        } catch (error) {
            // console.error('[Cache] Error loading memory cache:', error);
            this.preloadCache.clear();
        }
    }
    
    // Helper method to load blob from IndexedDB for a specific cache key
    async loadBlobFromIndexedDB(cacheKey) {
        if (!this.indexedDBSupported || !this.preloadCache.has(cacheKey)) {
            return false;
        }
        
        try {
            // Try both memoryCache and mediaCache stores
            let indexedDBCached = await this.indexedDBManager.getItem('memoryCache', cacheKey);
            if (!indexedDBCached || !indexedDBCached.blob) {
                indexedDBCached = await this.indexedDBManager.getItem('mediaCache', cacheKey);
            }
            
            if (indexedDBCached && indexedDBCached.blob && indexedDBCached.blob instanceof Blob) {
                const cached = this.preloadCache.get(cacheKey);
                cached.blob = indexedDBCached.blob;
                return true;
            }
        } catch (error) {
            // console.warn(`[Cache] Error loading blob from IndexedDB for ${cacheKey}:`, error);
        }
        
        return false;
    }
    
    // Save memory cache to localStorage (metadata only, no blobs)
    saveMemoryCache() {
        try {
            const cacheData = {};
            this.preloadCache.forEach((value, key) => {
                // Store only metadata, exclude blob to prevent localStorage quota issues
                cacheData[key] = {
                    serverUrl: value.serverUrl,
                    media: value.media,
                    timestamp: value.timestamp,
                    size: value.size,
                    type: value.type
                    // Explicitly exclude blob from localStorage storage
                };
            });
            localStorage.setItem('display_memory_cache', JSON.stringify(cacheData));
        } catch (error) {
            // console.error('[Cache] Error saving memory cache:', error);
            // Try to save minimal data if full metadata fails
            try {
                const minimalData = {};
                this.preloadCache.forEach((value, key) => {
                    minimalData[key] = {
                        timestamp: value.timestamp,
                        size: value.size || 0
                    };
                });
                localStorage.setItem('display_memory_cache', JSON.stringify(minimalData));
                // console.log('[Cache] Saved minimal cache metadata');
            } catch (fallbackError) {
                // console.error('[Cache] Failed to save even minimal cache data:', fallbackError);
            }
        }
    }
    
    // Preload content into both service worker and memory cache
    async preloadContent(mediaFiles) {
        if (!mediaFiles || mediaFiles.length === 0) {
            // console.log('[Cache] No content to preload');
            return;
        }
        
        // Cache ALL media files (both images and videos)
        const imagesToPreload = mediaFiles.filter(media => media.type && media.type.startsWith('image/'));
        const videosToPreload = mediaFiles.filter(media => media.type && media.type.startsWith('video/'));
        const allMediaToPreload = [...imagesToPreload, ...videosToPreload];
        
        // console.log(`[Cache] Starting preload of ${imagesToPreload.length} images and ${videosToPreload.length} videos`);
        
        // Preload via service worker for persistent caching (all media)
        if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'PRELOAD_MEDIA',
                mediaList: allMediaToPreload
            });
        }
        
        // Preload into IndexedDB cache for all media (images immediately, videos in background)
        // Images first for immediate display
        const imagePreloadPromises = imagesToPreload.map(media => this.preloadSingleFile(media));
        
        try {
            await Promise.allSettled(imagePreloadPromises);
            // console.log('[Cache] Image preload complete');
            
            // Save to localStorage
            this.saveMemoryCache();
            
            // Start background video preloading without waiting
            this.preloadVideosInBackground(videosToPreload);
            
        } catch (error) {
            // console.error('[Cache] Preload error:', error);
        }
    }
    
    // Background video preloading without blocking
    async preloadVideosInBackground(videos) {
        if (!videos || videos.length === 0) return;
        
        // console.log(`[Cache] Starting background preload of ${videos.length} videos`);
        
        // Preload videos one at a time with small delays to avoid overwhelming the system
        for (const video of videos) {
            try {
                await this.preloadSingleFile(video);
                // console.log(`[Cache] Background video preloaded: ${video.name}`);
                
                // Add a small delay between downloads to prevent overwhelming network/disk
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            } catch (error) {
                // console.warn(`[Cache] Failed to preload video in background: ${video.name}`, error);
            }
        }
        
        // console.log('[Cache] All videos preloaded in background');
    }
    
    // Preload a single file into memory cache
    async preloadSingleFile(media) {
        if (!media.path) return;
        
        const cacheKey = media.path;
        
        // Skip if already cached and fresh
        if (this.preloadCache.has(cacheKey)) {
            const cached = this.preloadCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiryTime) {
                return; // Still fresh
            }
        }
        
        try {
            const mediaUrl = `${API_BASE_URL}${media.path}`;
            const response = await fetch(mediaUrl);
            
            if (response.ok) {
                const blob = await response.blob();
                
                // Store blob in IndexedDB for persistent storage
                if (this.indexedDBSupported) {
                    await this.indexedDBManager.setItem('memoryCache', cacheKey, {
                        blob: blob,
                        media: media,
                        size: blob.size,
                        type: blob.type
                    });
                }
                
                // Cache in memory with metadata - use server URL instead of blob URL for cross-device compatibility
                this.preloadCache.set(cacheKey, {
                    serverUrl: mediaUrl, // Store server URL for cross-device access
                    blob: blob, // Keep blob for local optimization if needed (in-memory only)
                    media: media,
                    timestamp: Date.now(),
                    size: blob.size,
                    type: blob.type
                });
                
                // Maintain cache size limit
                this.maintainCacheSize();
                
                // console.log('[Cache] Preloaded:', media.name, `(${this.formatBytes(blob.size)})`);
            }
        } catch (error) {
            // console.warn('[Cache] Failed to preload:', media.name, error);
        }
    }
    
    // Get cached content, with fallback strategies - PRIORITIZE CACHE OVER SERVER
    async getCachedContent(media) {
        const cacheKey = media.path;
        
        // Try memory cache first (fastest) - PRIORITIZE CACHE
        if (this.preloadCache.has(cacheKey)) {
            const cached = this.preloadCache.get(cacheKey);
            
            // Check if still fresh (be more lenient for better performance)
            if (Date.now() - cached.timestamp < this.cacheExpiryTime) {
                this.cacheStats.hits++;
                // console.log('[Cache] Memory cache hit:', media.name);
                
                // Check if we have a valid blob in memory
                if (cached.blob && cached.blob instanceof Blob) {
                    try {
                        // For offline compatibility: if we have a blob and are offline, create a blob URL
                        // For online: prefer cached data over server requests for speed
                        if (!navigator.onLine) {
                            // Offline: create blob URL for local access
                            const blobUrl = URL.createObjectURL(cached.blob);
                            // console.log('[Cache] Offline mode: using blob URL for', media.name);
                            return blobUrl;
                        } else {
                            // Online but we have cached blob: create blob URL for faster local access
                            // This avoids server requests and improves performance
                            const blobUrl = URL.createObjectURL(cached.blob);
                            // console.log('[Cache] Fast cache access: using blob URL for', media.name);
                            return blobUrl;
                        }
                    } catch (blobError) {
                        // console.warn('[Cache] Failed to create blob URL for', media.name, blobError);
                        // Fall through to try other methods
                    }
                }
                
                // If no valid blob in memory, try to load from IndexedDB
                if (this.indexedDBSupported && !cached.blob) {
                    try {
                        const indexedDBCached = await this.indexedDBManager.getItem('memoryCache', cacheKey);
                        if (indexedDBCached && indexedDBCached.blob && indexedDBCached.blob instanceof Blob) {
                            // Update memory cache with blob from IndexedDB
                            cached.blob = indexedDBCached.blob;
                            
                            const blobUrl = URL.createObjectURL(indexedDBCached.blob);
                            // console.log('[Cache] Loaded from IndexedDB: using blob URL for', media.name);
                            return blobUrl;
                        }
                    } catch (indexedDBError) {
                        // console.warn('[Cache] Failed to load from IndexedDB for', media.name, indexedDBError);
                    }
                }
                
                // Fallback to server URL if no valid blob available
                if (cached.serverUrl) {
                    // console.log('[Cache] Using server URL for', media.name);
                    return cached.serverUrl;
                }
            } else {
                // Expired, remove from cache
                this.preloadCache.delete(cacheKey);
            }
        }
        
        // Try IndexedDB cache (offline binary cache)
        if (this.indexedDBSupported) {
            try {
                const indexedDBCached = await this.indexedDBManager.getItem('mediaCache', cacheKey);
                if (indexedDBCached && indexedDBCached.blob && indexedDBCached.blob instanceof Blob) {
                    // Check if not expired
                    const cacheAge = Date.now() - (indexedDBCached.timestamp || 0);
                    if (cacheAge < this.cacheExpiryTime) {
                        this.cacheStats.hits++;
                        // console.log('[Cache] IndexedDB cache hit:', media.name);
                        
                        try {
                            const blobUrl = URL.createObjectURL(indexedDBCached.blob);
                            return blobUrl;
                        } catch (blobError) {
                            // console.warn('[Cache] Failed to create blob URL from IndexedDB for', media.name, blobError);
                        }
                    }
                }
            } catch (error) {
                // console.warn('[Cache] Error accessing IndexedDB cache for', media.name, error);
            }
        }
        
        // Try localStorage cache (offline base64 cache - fallback)
        const localCached = this.offlineMediaCache.find(cached => cached.path === media.path);
        if (localCached) {
            // Check if cached data exists (either base64 or stored in IndexedDB)
            if (localCached.cachedData) {
                this.cacheStats.hits++;
                // console.log('[Cache] LocalStorage cache hit (base64):', media.name);
                return localCached.cachedData; // Base64 data works offline
            } else if (localCached.storedInIndexedDB && this.indexedDBSupported) {
                // Try to load from IndexedDB
                try {
                    const indexedDBItem = await this.indexedDBManager.getItem('mediaCache', cacheKey);
                    if (indexedDBItem && indexedDBItem.blob && indexedDBItem.blob instanceof Blob) {
                        this.cacheStats.hits++;
                        // console.log('[Cache] LocalStorage metadata + IndexedDB blob hit:', media.name);
                        
                        const blobUrl = URL.createObjectURL(indexedDBItem.blob);
                        return blobUrl;
                    }
                } catch (error) {
                    // console.warn('[Cache] Failed to load IndexedDB blob for cached metadata:', media.name, error);
                }
            }
        }
        
        // Cache miss - fetch and cache for future use
        this.cacheStats.misses++;
        // console.log('[Cache] Cache miss, fetching:', media.name);
        
        try {
            const mediaUrl = `${API_BASE_URL}${media.path}`;
            
            // For videos: wait for them to be cached before returning, or return server URL if caching fails
            // For images: start background preloading and return server URL immediately
            if (media.type.startsWith('video/')) {
                // Videos should be played from cache exclusively
                // Try to preload and wait a reasonable time, then use cached version
                // console.log('[Cache] Video cache miss, attempting to preload:', media.name);
                
                try {
                    await this.preloadSingleFile(media);
                    // After preloading, try to get from cache again
                    const cachedAfterPreload = this.preloadCache.get(cacheKey);
                    if (cachedAfterPreload && cachedAfterPreload.blob) {
                        const blobUrl = URL.createObjectURL(cachedAfterPreload.blob);
                        // console.log('[Cache] Video preloaded and cached, using blob URL:', media.name);
                        return blobUrl;
                    }
                } catch (preloadError) {
                    // console.warn('[Cache] Failed to preload video:', media.name, preloadError);
                }
                
                // If preloading failed, show waiting screen and retry
                // console.log('[Cache] Video not yet cached, will show loading state');
                return null; // Signal that video is not yet ready
            } else if (media.type.startsWith('image/')) {
                // Images: start preloading in background immediately but don't wait for it
                this.preloadSingleFile(media).then(() => {
                    // console.log('[Cache] Background preload completed for:', media.name);
                }).catch(error => {
                    // console.warn('[Cache] Background preload failed for:', media.name, error);
                });
                
                // Return server URL immediately to avoid delay
                // console.log('[Cache] Using server URL (cache miss) for:', media.name);
                return mediaUrl;
            }
            
            // For other media types (if any), return server URL
            return mediaUrl;
            
        } catch (error) {
            // console.error('[Cache] Failed to get cached content:', error);
            return `${API_BASE_URL}${media.path}`; // Fallback to original URL
        }
    }
    
    // Maintain cache size limit by removing oldest entries
    maintainCacheSize() {
        if (this.preloadCache.size <= this.maxCacheSize) return;
        
        // Sort by timestamp, remove oldest
        const entries = Array.from(this.preloadCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = entries.slice(0, this.preloadCache.size - this.maxCacheSize);
        
        toRemove.forEach(([key, value]) => {
            // Clean up any blob URLs that might have been created for offline access
            if (value.tempBlobUrl) {
                URL.revokeObjectURL(value.tempBlobUrl);
            }
            this.preloadCache.delete(key);
        });
        
        // console.log('[Cache] Cleaned up', toRemove.length, 'old cache entries');
    }
    
    // Cleanup expired cache entries
    async cleanupCache() {
        const now = Date.now();
        let cleaned = 0;
        
        // Clean up memory cache
        this.preloadCache.forEach((value, key) => {
            if (now - value.timestamp > this.cacheExpiryTime) {
                // Clean up any blob URLs that might have been created for offline access
                if (value.tempBlobUrl) {
                    URL.revokeObjectURL(value.tempBlobUrl);
                }
                this.preloadCache.delete(key);
                cleaned++;
            }
        });
        
        // Clean up IndexedDB cache
        if (this.indexedDBSupported) {
            try {
                const memoryKeys = await this.indexedDBManager.getAllKeys('memoryCache');
                const mediaKeys = await this.indexedDBManager.getAllKeys('mediaCache');
                
                let indexedDBCleaned = 0;
                
                // Clean expired items from memoryCache
                for (const key of memoryKeys) {
                    const item = await this.indexedDBManager.getItem('memoryCache', key);
                    if (item && item.timestamp && (now - item.timestamp > this.cacheExpiryTime)) {
                        await this.indexedDBManager.removeItem('memoryCache', key);
                        indexedDBCleaned++;
                    }
                }
                
                // Clean expired items from mediaCache
                for (const key of mediaKeys) {
                    const item = await this.indexedDBManager.getItem('mediaCache', key);
                    if (item && item.timestamp && (now - item.timestamp > this.cacheExpiryTime)) {
                        await this.indexedDBManager.removeItem('mediaCache', key);
                        indexedDBCleaned++;
                    }
                }
                
                if (indexedDBCleaned > 0) {
                    // console.log('[Cache] Cleaned up', indexedDBCleaned, 'expired IndexedDB entries');
                }
                
            } catch (error) {
                // console.warn('[Cache] Error during IndexedDB cleanup:', error);
            }
        }
        
        if (cleaned > 0) {
            // console.log('[Cache] Cleaned up', cleaned, 'expired memory cache entries');
            this.saveMemoryCache();
        }
    }
    
    // Get cache status
    async getCacheStatus() {
        const status = {
            memoryCache: {
                size: this.preloadCache.size,
                maxSize: this.maxCacheSize,
                totalSize: Array.from(this.preloadCache.values())
                    .reduce((total, entry) => total + (entry.size || 0), 0)
            },
            stats: this.cacheStats,
            serviceWorkerReady: this.serviceWorkerReady
        };
        
        // Get service worker cache status if available
        if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
            try {
                const channel = new MessageChannel();
                const swStatus = await new Promise(resolve => {
                    channel.port1.onmessage = (event) => resolve(event.data);
                    navigator.serviceWorker.controller.postMessage(
                        { type: 'GET_CACHE_STATUS' },
                        [channel.port2]
                    );
                });
                status.serviceWorker = swStatus;
            } catch (error) {
                // console.warn('[Cache] Could not get service worker status:', error);
            }
        }
        
        return status;
    }
    
    // Clear all caches
    async clearAllCaches() {
        // console.log('[Cache] Clearing all caches...');
        
        // Clear memory cache and clean up any temporary blob URLs
        this.preloadCache.forEach((value) => {
            if (value.tempBlobUrl) {
                URL.revokeObjectURL(value.tempBlobUrl);
            }
        });
        this.preloadCache.clear();
        
        // Clear localStorage cache
        try {
            localStorage.removeItem('display_memory_cache');
            localStorage.removeItem('display_offline_media');
        } catch (error) {
            // console.warn('[Cache] Error clearing localStorage:', error);
        }
        this.offlineMediaCache = [];
        
        // Clear IndexedDB caches
        if (this.indexedDBSupported) {
            try {
                await this.indexedDBManager.clear('memoryCache');
                await this.indexedDBManager.clear('mediaCache');
                // console.log('[Cache] IndexedDB caches cleared');
            } catch (error) {
                // console.error('[Cache] Error clearing IndexedDB caches:', error);
            }
        }
        
        // Clear service worker caches
        if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CLEAR_CACHE'
            });
        }
        
        // Reset stats
        this.cacheStats = { hits: 0, misses: 0, preloaded: 0 };
        
        // console.log('[Cache] All caches cleared');
    }
    
    // Utility function to format bytes
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Clean up deleted content from all cache layers
    async cleanupDeletedContent(previousMediaFiles, currentMediaFiles) {
        if (!previousMediaFiles || previousMediaFiles.length === 0) {
            return; // No previous content to compare
        }
        
        // Find deleted files by comparing IDs and paths
        const currentIds = new Set(currentMediaFiles.map(m => m.id));
        const currentPaths = new Set(currentMediaFiles.map(m => m.path));
        
        const deletedFiles = previousMediaFiles.filter(media => 
            !currentIds.has(media.id) || !currentPaths.has(media.path)
        );
        
        if (deletedFiles.length === 0) {
            // console.log('[Cache] No deleted files detected');
            return;
        }
        
        // console.log('[Cache] Cleaning up', deletedFiles.length, 'deleted files from all cache layers');
        
        // 1. Clean from memory cache
        let memoryCleared = 0;
        deletedFiles.forEach(media => {
            if (media.path && this.preloadCache.has(media.path)) {
                const cached = this.preloadCache.get(media.path);
                // Clean up any temporary blob URLs
                if (cached.tempBlobUrl) {
                    URL.revokeObjectURL(cached.tempBlobUrl);
                }
                this.preloadCache.delete(media.path);
                memoryCleared++;
            }
        });
        
        // 2. Clean from localStorage cache (offlineMediaCache)
        let localStorageCleared = 0;
        const deletedPaths = new Set(deletedFiles.map(m => m.path));
        this.offlineMediaCache = this.offlineMediaCache.filter(cached => {
            if (deletedPaths.has(cached.path)) {
                localStorageCleared++;
                return false; // Remove from cache
            }
            return true; // Keep in cache
        });
        
        // Update localStorage
        if (localStorageCleared > 0) {
            try {
                localStorage.setItem('display_offline_media', JSON.stringify(this.offlineMediaCache));
            } catch (error) {
                // console.warn('[Cache] Error updating localStorage during cleanup:', error);
            }
        }
        
        // 3. Clean from IndexedDB cache
        let indexedDBCleared = 0;
        if (this.indexedDBSupported) {
            try {
                for (const media of deletedFiles) {
                    if (media.path) {
                        // Remove from both memory and media caches in IndexedDB
                        const removed1 = await this.indexedDBManager.removeItem('memoryCache', media.path);
                        const removed2 = await this.indexedDBManager.removeItem('mediaCache', media.path);
                        
                        if (removed1 || removed2) {
                            indexedDBCleared++;
                        }
                    }
                }
                
                if (indexedDBCleared > 0) {
                    // console.log(`[Cache] Cleaned ${indexedDBCleared} items from IndexedDB`);
                }
            } catch (error) {
                // console.warn('[Cache] Error cleaning IndexedDB during deletion cleanup:', error);
            }
        }
        
        // 4. Clean from service worker cache
        if (this.serviceWorkerReady && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'REMOVE_DELETED_MEDIA',
                deletedFiles: deletedFiles
            });
        }
        
        // 5. Save updated memory cache
        this.saveMemoryCache();
        
        // console.log(`[Cache] Cleanup complete: ${memoryCleared} from memory, ${localStorageCleared} from localStorage, ${indexedDBCleared} from IndexedDB`);
        
        // Update cache statistics
        this.cacheStats.cleaned = (this.cacheStats.cleaned || 0) + memoryCleared + localStorageCleared + indexedDBCleared;
    }

    // ===== END ENHANCED CACHING SYSTEM =====

    useOfflineMode() {
        if (this.offlineMediaCache.length === 0) {
            this.showOfflineNoContentScreen();
            return;
        }

        this.isOfflineMode = true;
        this.mediaFiles = this.offlineMediaCache;
        this.currentContentIndex = 0;
        // console.log('Switched to offline mode with', this.mediaFiles.length, 'cached media files');
        this.updateStatusIndicator();
        this.startContentRotation();
    }

    exitOfflineMode() {
        this.isOfflineMode = false;
        // console.log('Exited offline mode');
    }

    async loadServerConfig() {
        // Simple: only accept configuration injected by the server via window.DISPLAY_CONFIG
        try {
            if (window.DISPLAY_CONFIG && typeof window.DISPLAY_CONFIG === 'object') {
                const cfg = window.DISPLAY_CONFIG;
                if (cfg.apiBaseUrl) API_BASE_URL = cfg.apiBaseUrl;
                if (cfg.wsUrl) WS_URL = cfg.wsUrl;
                this.configLoaded = true;
                return;
            }

            // If DISPLAY_CONFIG is not present, fail fast and show error to operator
            this.configLoaded = false;
            console.error('[Display] DISPLAY_CONFIG not provided by server (required)');
            this.showErrorScreen('Configuración de servidor no encontrada. Contacte al administrador.');
        } catch (error) {
            this.configLoaded = false;
            console.error('[Display] Error reading DISPLAY_CONFIG:', error);
            this.showErrorScreen('Error al leer configuración. Contacte al administrador.');
        }
    }

    setupEventListeners() {
        const clickZone = document.getElementById('clickZone');
        const configModal = document.getElementById('configModal');
        const configForm = document.getElementById('configForm');
        const cancelBtn = document.getElementById('cancelBtn');
        const fullscreenBtn = document.getElementById('fullscreenButton');

        // 5-click detection
        clickZone.addEventListener('click', (e) => {
            this.handleCenterClick(e);
        });

        // Fullscreen button
        fullscreenBtn.addEventListener('click', () => {
            this.enterFullscreen();
        });

        // Configuration form
        configForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConfiguration();
        });

        cancelBtn.addEventListener('click', () => {
            this.hideConfigModal();
        });

        // Fullscreen change detection
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                // Show fullscreen button when not in fullscreen
                fullscreenBtn.classList.remove('hidden');
                setTimeout(() => this.enterFullscreen(), 1000);
            } else {
                // Hide fullscreen button when in fullscreen
                fullscreenBtn.classList.add('hidden');
            }
        });

        // Keyboard shortcuts (for development)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isConfigMode) {
                this.hideConfigModal();
            } else if (e.key === 'F11') {
                e.preventDefault();
                this.enterFullscreen();
            }
        });
    }

    handleCenterClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const clickZone = document.getElementById('clickZone');
        clickZone.classList.add('active');
        
        setTimeout(() => {
            clickZone.classList.remove('active');
        }, 300);

        this.clickCount++;
            // console.log(`Click ${this.clickCount}/5`);

        // Reset timer
        if (this.clickTimer) {
            clearTimeout(this.clickTimer);
        }

        // Check if 5 clicks reached
        if (this.clickCount >= 5) {
            this.showConfigModal();
            this.clickCount = 0;
            return;
        }

        // Reset click count after 2 seconds of inactivity
        this.clickTimer = setTimeout(() => {
            this.clickCount = 0;
        }, 2000);
    }

    async showConfigModal() {
            // console.log('Opening configuration modal...');
        this.isConfigMode = true;
        
        // Load available screens
        await this.loadAvailableScreens();
        
        const modal = document.getElementById('configModal');
        modal.classList.add('show');
        
        // Focus on select element
        setTimeout(() => {
            document.getElementById('screenSelect').focus();
        }, 100);
    }

    hideConfigModal() {
            // console.log('Closing configuration modal...');
        this.isConfigMode = false;
        
        const modal = document.getElementById('configModal');
        modal.classList.remove('show');
        
        this.clickCount = 0;
    }

    // Fetch and cache available screens list
    async fetchAvailableScreens() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/screens`);
            if (!response.ok) throw new Error('Failed to fetch screens');
            const screens = await response.json();
            
            // Update cache
            this.availableScreensCache = screens;
            this.availableScreensLastFetch = Date.now();
            
            return screens;
        } catch (error) {
            // console.error('Error fetching screens:', error);
            return this.availableScreensCache || [];
        }
    }

    async loadAvailableScreens() {
        try {
            // Fetch fresh screens list
            const screens = await this.fetchAvailableScreens();

            const screenSelect = document.getElementById('screenSelect');
            // Remove any existing warning messages
            const existingWarning = screenSelect.parentNode.querySelector('.warning-message');
            if (existingWarning) {
                existingWarning.remove();
            }
            
            screenSelect.innerHTML = '<option value="">Seleccionar pantalla...</option>';
            
            if (screens.length === 0) {
                // No screens available
                screenSelect.innerHTML = '<option value="">No existen pantallas asignables - Por favor cree algunas en su CMS</option>';
                const warningMessage = document.createElement('div');
                warningMessage.className = 'warning-message';
                warningMessage.style.cssText = 'color: #f59e0b; font-size: 0.875rem; margin-top: 0.5rem; text-align: center;';
                warningMessage.textContent = 'Vaya al panel de administración y cree pantallas antes de configurar este display.';
                screenSelect.parentNode.insertBefore(warningMessage, screenSelect.nextSibling);
            } else {
                screens.forEach(screen => {
                    const option = document.createElement('option');
                    option.value = screen.id;
                    option.textContent = `${screen.name} - ${screen.location || 'Sin ubicación'}`;
                    option.selected = screen.id === this.currentScreenId;
                    screenSelect.appendChild(option);
                });
            }
            
            // Set saved orientation
            const orientationSelect = document.getElementById('orientationSelect');
            orientationSelect.value = this.orientation;
            
        } catch (error) {
            // console.error('Error loading screens:', error);
            const screenSelect = document.getElementById('screenSelect');
            screenSelect.innerHTML = '<option value="">Error de conexión - Verifique que el servidor esté funcionando</option>';
        }
    }

    async saveConfiguration() {
        const screenSelect = document.getElementById('screenSelect');
        const orientationSelect = document.getElementById('orientationSelect');
        const selectedScreenId = screenSelect.value;
        const selectedOrientation = orientationSelect.value;
        
        if (!selectedScreenId) {
            // Check if it's because no screens exist
            const screenSelect = document.getElementById('screenSelect');
            const firstOption = screenSelect.options[0];
            if (firstOption && firstOption.textContent.includes('No existen pantallas asignables')) {
                alert('No hay pantallas disponibles. Por favor vaya al panel de administración y cree pantallas primero.');
                return;
            }
            alert('Por favor selecciona una pantalla');
            return;
        }

            // console.log('Saving configuration for screen:', selectedScreenId, 'orientation:', selectedOrientation);
        
        // Save to localStorage
        localStorage.setItem('display_screen_id', selectedScreenId);
        localStorage.setItem('display_orientation', selectedOrientation);
        // Convert to number for consistent comparison with WebSocket messages
        this.currentScreenId = parseInt(selectedScreenId, 10);
        this.orientation = selectedOrientation;
        
        // Apply orientation
        this.applyOrientation();
        
        // Re-register with WebSocket if connected with new screen ID
        this.registerWithWebSocket();
        
        // Update status indicator
        this.updateStatusIndicator();
        
        // Reload content for new screen
        await this.loadContent();
        
        // Hide modal
        this.hideConfigModal();
        
        // Enter fullscreen since user interaction enables it
        this.enterFullscreen();
        
        // Show confirmation
        this.showNotification('Configuración guardada correctamente');
    }

    applyOrientation() {
        const body = document.body;
        const container = document.getElementById('displayContainer');
        
        // Remove existing orientation classes
        body.classList.remove('orientation-horizontal', 'orientation-horizontal-flipped', 
                            'orientation-vertical', 'orientation-vertical-flipped');
        
        // Apply selected orientation
        switch (this.orientation) {
            case 'horizontal':
                body.classList.add('orientation-horizontal');
                break;
            case 'horizontal-flipped':
                body.classList.add('orientation-horizontal-flipped');
                break;
            case 'vertical':
                body.classList.add('orientation-vertical');
                break;
            case 'vertical-flipped':
                body.classList.add('orientation-vertical-flipped');
                break;
        }
        
            // console.log('Applied orientation:', this.orientation);
    }

    async loadConfiguration() {
        // Check for saved screen ID
        const savedScreenId = localStorage.getItem('display_screen_id');
        const savedOrientation = localStorage.getItem('display_orientation') || 'horizontal';
        
        if (savedScreenId) {
            // Convert to number for consistent comparison with WebSocket messages
            this.currentScreenId = parseInt(savedScreenId, 10);
            // console.log('Loaded saved screen configuration:', this.currentScreenId);
        } else {
            // console.log('No saved configuration found, will show config on first run');
            // Show configuration modal for first-time setup
            setTimeout(() => this.showConfigModal(), 2000);
        }
        
        this.orientation = savedOrientation;
            // console.log('Loaded saved orientation:', savedOrientation);
        
        this.updateStatusIndicator();
    }

    async loadContent() {
        this.stopContentRotation();
        this.isTransitioning = false; // Reset transition flag when loading new content
        
        // Exit offline mode if we're trying to load fresh content
        if (this.isOfflineMode) {
            this.exitOfflineMode();
        }
        
        try {
            // console.log('Loading content for screen:', this.currentScreenId);
            if (!this.currentScreenId) {
                this.showWelcomeScreen();
                this.updateStatusIndicator(); // Update status when no screen
                return;
            }

            // 1. Fetch screen details to check status and get assigned folder
            const screenResponse = await fetch(`${API_BASE_URL}/api/screens/${this.currentScreenId}`);
            if (!screenResponse.ok) throw new Error('Could not load screen configuration.');
            this.screenData = await screenResponse.json();
            // console.log('[display.js] Fetched screen data:', this.screenData);

            const assignedFolder = this.screenData.assignedFolder;
            // console.log(`[display.js] Using assigned folder: "${assignedFolder}"`);
            
            // Require a specific folder to be assigned - no default to "all"
            if (!assignedFolder) {
                // console.warn('[display.js] No folder assigned to this screen');
                this.showNoFolderScreen();
                this.updateStatusIndicator(); // Update status when no folder
                return;
            }
            
            // 2. Fetch media for that folder
            const mediaResponse = await fetch(`${API_BASE_URL}/api/media?folder=${assignedFolder}`);
            if (!mediaResponse.ok) throw new Error('Could not load media files.');
            const mediaFiles = await mediaResponse.json();

            if (mediaFiles.length === 0) {
                this.showEmptyFolderScreen(assignedFolder);
                this.updateStatusIndicator(); // Update status when no content
                return;
            }
            
            this.mediaFiles = mediaFiles;
            this.currentContentIndex = 0;
            
            // Enhanced caching: Preload all content immediately
            await this.preloadContent(mediaFiles);
            
            // Cache media files for offline use (legacy support)
            await this.saveOfflineCache(mediaFiles);
            
            // console.log(`Loaded ${this.mediaFiles.length} media files for folder "${assignedFolder}".`);
            this.updateStatusIndicator(); // Update status when content is loaded
            this.startContentRotation();
            
        } catch (error) {
            // console.error('Error loading content:', error);
            // Try offline mode if server connection fails
            if (this.offlineMediaCache.length > 0) {
                // console.log('Server unavailable, switching to offline mode');
                this.useOfflineMode();
            } else {
                this.showErrorScreen('Error cargando contenido - Sin conexión');
                this.updateStatusIndicator(); // Update status on error
            }
        }
    }

    queueContentUpdate() {
        // Only queue if not already queued to prevent multiple updates
        if (this.contentUpdateQueued) {
            // console.log('Content update already queued, ignoring...');
            return;
        }

        // Prevent spamming updates - minimum 10 seconds between content reloads
        const now = Date.now();
        if (now - this.lastContentUpdate < 10000) {
            // console.log('Recent content update, queuing for later...');
            this.contentUpdateQueued = true;
            setTimeout(() => {
                if (this.contentUpdateQueued) { // Check if still queued
                    this.processQueuedUpdate();
                }
            }, 10000 - (now - this.lastContentUpdate));
            return;
        }

        this.contentUpdateQueued = true;
            // console.log('Queueing content update for next natural transition...');
        
        // Always wait for natural transition to prevent disruption
        // The queue will be processed when current content naturally ends
        // either via video.onended or image setTimeout completion
        
        // Don't interrupt current content - let it complete naturally
        // The processQueuedUpdate will be called by:
        // 1. Video onended event
        // 2. Image timer completion 
        // 3. nextContent() method before advancing
        
            // console.log('Update queued - will process at next natural content transition');
    }

    async processQueuedUpdate() {
        if (!this.contentUpdateQueued) {
            return;
        }

            // console.log('Processing queued content update...');
        this.contentUpdateQueued = false;
        this.lastContentUpdate = Date.now();
        
        // Save current position to maintain continuity
        const wasPlaying = this.mediaFiles.length > 0;
        const currentMediaId = wasPlaying ? this.mediaFiles[this.currentContentIndex]?.id : null;
        const previousMediaFiles = [...this.mediaFiles]; // Save previous media list for comparison
        
        // Load new content
        await this.loadContent();
        
        // Identify deleted media files and clean them from cache
        await this.cleanupDeletedContent(previousMediaFiles, this.mediaFiles);
        
        // Try to resume from a logical position if content was updated
        if (wasPlaying && currentMediaId && this.mediaFiles.length > 0) {
            // Find if the current media still exists
            const currentMediaIndex = this.mediaFiles.findIndex(m => m.id === currentMediaId);
            if (currentMediaIndex >= 0) {
                // Media still exists, continue from there
                this.currentContentIndex = currentMediaIndex;
            // console.log('Resumed from existing media position');
            } else {
                // Media was removed, start from beginning but smoothly
                this.currentContentIndex = 0;
            // console.log('Current media removed, restarting from beginning');
            }
        }
        
        // Only restart content rotation if we have content and aren't already playing
        if (this.mediaFiles.length > 0 && (!wasPlaying || currentMediaId === null)) {
            this.displayCurrentContent();
        }
    }

    startContentRotation() {
        if (this.mediaFiles.length === 0) {
            // console.log('No content to rotate');
            return;
        }
        // Initial display
        this.displayCurrentContent();
    }

    stopContentRotation() {
        if (this.contentRotationTimer) {
            clearTimeout(this.contentRotationTimer); // Changed from clearInterval to clearTimeout
            this.contentRotationTimer = null;
            // console.log('Content timer stopped.');
        }
    }

    nextContent() {
        if (this.mediaFiles.length === 0) return;
        
        // Prevent rapid successive calls
        if (this.isTransitioning) {
            // console.log('Transition already in progress, skipping...');
            return;
        }
        
        // Check if there's a queued content update before advancing
        if (this.contentUpdateQueued) {
            // console.log('Processing queued content update instead of advancing');
            this.processQueuedUpdate();
            return;
        }
        
        this.currentContentIndex = (this.currentContentIndex + 1) % this.mediaFiles.length;
        this.displayCurrentContent();
    }

    displayCurrentContent() {
        // Prevent rapid successive calls that could cause flickering
        if (this.isTransitioning) {
            // console.log('Display transition already in progress, skipping...');
            return;
        }

        // Clear any existing timer from a previous image
        this.stopContentRotation();

        if (this.mediaFiles.length === 0) {
            this.showWelcomeScreen();
            this.updateStatusIndicator(); // Update status when no content
            return;
        }
        
        this.isTransitioning = true;
        const currentMedia = this.mediaFiles[this.currentContentIndex];
        const contentDisplay = document.getElementById('contentDisplay');
        
            // console.log(`Displaying content: ${currentMedia.name} (Type: ${currentMedia.type})`);
        
        // Background preloading: Start preloading the next few images while current one displays
        this.startBackgroundPreloading();
        
        const transition = this.screenData?.transitionType || 'fade';
        const transitionOutClass = transition === 'slide' ? 'slide-out' : 'fade-out';
        const transitionInClass = transition === 'slide' ? 'slide-in' : 'fade-in';

        const renderNewContent = () => {
            this.renderMediaContent(currentMedia, contentDisplay, transitionInClass);
            // Update status indicator to show "Conectado - Reproduciendo" when content starts
            this.updateStatusIndicator();
            
            // Send current playing content to server for thumbnail display
            this.sendCurrentPlayingContent();
            
            // After rendering, set a timer ONLY if it's an image
            if (currentMedia.type.startsWith('image/')) {
                const duration = (this.screenData?.duration || 10) * 1000;
            // console.log(`Image detected. Starting timer for ${duration}ms.`);
                this.contentRotationTimer = setTimeout(() => {
                    this.trackMediaView(currentMedia, 'end'); // Track image view end
                    
                    // Handle advancement after image duration
                    const advanceToNext = () => {
                        // Check for queued updates before advancing to next content
                        if (this.contentUpdateQueued) {
            // console.log('Image timer ended, processing queued content update');
                            this.processQueuedUpdate();
                        } else {
            // console.log('Image timer ended, advancing to next content');
                            this.nextContent();
                        }
                    };
                    
                    if (this.isTransitioning) {
                        // Wait for transition to complete, then advance
                        let checkCount = 0;
                        const maxChecks = 30; // Maximum 3 seconds (30 * 100ms)
                        const checkTransition = setInterval(() => {
                            checkCount++;
                            if (!this.isTransitioning) {
                                clearInterval(checkTransition);
                                advanceToNext();
                            } else if (checkCount >= maxChecks) {
                                // Failsafe: force advancement after timeout
                                clearInterval(checkTransition);
                                // console.warn('[Display] Transition timeout, forcing advancement');
                                this.isTransitioning = false;
                                advanceToNext();
                            }
                        }, 100);
                    } else {
                        // Transition complete, safe to advance immediately
                        advanceToNext();
                    }
                }, duration);
            } else {
            // console.log('Video detected. Timer will be handled by the "onended" event.');
            }
            // Mark transition as complete after a short delay
            setTimeout(() => {
                this.isTransitioning = false;
            }, 600); // Allow transition animation to complete
        };

        const currentElement = contentDisplay.querySelector('.media-content');
        if (currentElement) {
            currentElement.className = `media-content ${transitionOutClass}`;
            setTimeout(renderNewContent, 500); // Wait for fade out to complete
        } else {
            renderNewContent();
        }
    }

    // Background preloading: Load next few images while current content is displaying
    startBackgroundPreloading() {
        if (this.mediaFiles.length <= 1) return; // No need if only one file
        
        // Preload the next 3-5 media files (both images and videos) in the sequence
        const preloadCount = Math.min(5, this.mediaFiles.length - 1);
        const preloadPromises = [];
        
        for (let i = 1; i <= preloadCount; i++) {
            const nextIndex = (this.currentContentIndex + i) % this.mediaFiles.length;
            const nextMedia = this.mediaFiles[nextIndex];
            
            // Preload both images and videos
            if (nextMedia) {
                // Check if not already cached
                const cacheKey = nextMedia.path;
                if (!this.preloadCache.has(cacheKey) || 
                    Date.now() - this.preloadCache.get(cacheKey).timestamp > this.cacheExpiryTime) {
                    
                    // console.log('[Background] Preloading:', nextMedia.name);
                    preloadPromises.push(this.preloadSingleFile(nextMedia));
                }
            }
        }
        
        // Execute background preloading without blocking current display
        if (preloadPromises.length > 0) {
            Promise.allSettled(preloadPromises).then((results) => {
                const successful = results.filter(result => result.status === 'fulfilled').length;
                // console.log(`[Background] Preloaded ${successful}/${preloadPromises.length} files in background`);
                
                // Save updated cache to localStorage
                this.saveMemoryCache();
            });
        }
    }

    // Clean up video elements to prevent memory leaks
    cleanupVideoElements(container) {
        const videoElements = container.querySelectorAll('video');
        videoElements.forEach(video => {
            // Clear video src and remove event listeners
            video.pause();
            video.removeAttribute('src');
            video.load(); // This helps release resources
        });
    }

    async renderMediaContent(media, container, transitionInClass) {
        // Clean up any existing video elements before clearing container
        this.cleanupVideoElements(container);
        
        container.innerHTML = '';
        
        let mediaElement;
        let mediaUrl;
        
        // Get cached content with intelligent fallback
        if (this.isOfflineMode && media.cachedData) {
            // Use cached base64 data for images (legacy support)
            mediaUrl = media.cachedData;
        } else {
            // Use enhanced caching system
            mediaUrl = await this.getCachedContent(media);
            
            // If video is not yet cached (null returned), skip to next content
            // Download happens in background without blocking the playlist
            if (mediaUrl === null && media.type.startsWith('video/')) {
                // console.log('[Cache] Video not yet cached, skipping to next content while downloading in background');
                
                // Mark transition as complete and move to next content immediately
                this.isTransitioning = false;
                
                // Move to next content without showing loading screen
                setTimeout(() => {
                    this.nextContent();
                }, 100); // Small delay to prevent tight loops
                
                return;
            }
        }
        
        // Track media view start
        this.trackMediaView(media, 'start');
        
        if (media.type.startsWith('image/')) {
            mediaElement = document.createElement('img');
            mediaElement.src = mediaUrl;
            mediaElement.alt = media.name;
        } else if (media.type.startsWith('video/')) {
            mediaElement = document.createElement('video');
            mediaElement.autoplay = true;
            mediaElement.muted = true;
            // Never use loop attribute - handle looping manually via onended
            // This ensures we can check for content updates even with single video
            mediaElement.loop = false;
            
            // Use direct MP4 playback from cached blob URL
            mediaElement.src = mediaUrl;
            
            mediaElement.onended = () => {
                // console.log('Video finished, checking for queued updates...');
                this.trackMediaView(media, 'end');
                
                // If a transition is in progress, wait for it to complete before advancing
                // This handles very short videos that end before the fade-in completes
                const advanceToNext = () => {
                    // Check for queued updates before advancing to next content
                    if (this.contentUpdateQueued) {
                        // console.log('Video ended, processing queued content update');
                        this.processQueuedUpdate();
                    } else {
                        // console.log('Video ended, advancing to next content');
                        // This will loop back to index 0 if there's only one video
                        // ensuring continuous playback even with a single video
                        this.nextContent();
                    }
                };
                
                if (this.isTransitioning) {
                    // Wait for transition to complete, then advance
                    // console.log('Video ended during transition, queuing next content');
                    let checkCount = 0;
                    const maxChecks = 30; // Maximum 3 seconds (30 * 100ms)
                    const checkTransition = setInterval(() => {
                        checkCount++;
                        if (!this.isTransitioning) {
                            clearInterval(checkTransition);
                            advanceToNext();
                        } else if (checkCount >= maxChecks) {
                            // Failsafe: force advancement after timeout
                            clearInterval(checkTransition);
                            // console.warn('[Display] Transition timeout, forcing advancement');
                            this.isTransitioning = false;
                            advanceToNext();
                        }
                    }, 100);
                } else {
                    // Transition complete, safe to advance immediately
                    advanceToNext();
                }
            };
        } else {
            // console.warn('Unsupported media type:', media.type);
            return;
        }
        
        mediaElement.className = `media-content ${transitionInClass}`;
        
        mediaElement.onerror = () => {
            // console.error('Error loading media:', media.name);
            this.showErrorScreen('Error cargando contenido multimedia');
        };
        
        container.appendChild(mediaElement);
    }

    showVideoCachingScreen(videoName) {
        const contentDisplay = document.getElementById('contentDisplay');
        contentDisplay.innerHTML = `
            <div class="welcome-screen">
                <div class="waiting-icon">🎬</div>
                <h1 class="welcome-title waiting-text">Cargando Video</h1>
                <p class="welcome-subtitle">Preparando: ${videoName}</p>
                <div class="waiting-animation">
                    <span>Cacheando</span>
                    <div class="waiting-dots">
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">
                    El video se está descargando para reproducción sin interrupciones
                </p>
            </div>
        `;
    }

    showNoFolderScreen() {
        const contentDisplay = document.getElementById('contentDisplay');
        contentDisplay.innerHTML = `
            <div class="welcome-screen">
                <div class="waiting-icon">📁</div>
                <h1 class="welcome-title waiting-text" style="color: #f59e0b;">Configuración Requerida</h1>
                <p class="welcome-subtitle">Esta pantalla no tiene una carpeta asignada</p>
                <div class="waiting-animation">
                    <span>Esperando</span>
                    <div class="waiting-dots">
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">
                    Configura una carpeta específica desde el CMS para mostrar contenido
                </p>
                <p style="color: #666; font-size: 0.8rem; margin-top: 1rem;">
                    Cada pantalla debe tener una carpeta específica asignada
                </p>
            </div>
        `;
    }

    showEmptyFolderScreen(folderName) {
        const contentDisplay = document.getElementById('contentDisplay');
        contentDisplay.innerHTML = `
            <div class="welcome-screen">
                <div class="waiting-icon">📂</div>
                <h1 class="welcome-title waiting-text">Carpeta Vacía</h1>
                <p class="welcome-subtitle">La carpeta "${folderName}" no tiene contenido</p>
                <div class="waiting-animation">
                    <span>Esperando</span>
                    <div class="waiting-dots">
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">
                    Sube archivos a esta carpeta desde el CMS para comenzar
                </p>
            </div>
        `;
    }

    showWelcomeScreen() {
        const contentDisplay = document.getElementById('contentDisplay');
        contentDisplay.innerHTML = `
            <div class="welcome-screen">
                <div class="waiting-icon">📺</div>
                <h1 class="welcome-title waiting-text">Esperando Contenido</h1>
                <p class="welcome-subtitle">La pantalla está lista para mostrar contenido</p>
                <div class="waiting-animation">
                    <span>Cargando</span>
                    <div class="waiting-dots">
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.8rem; margin-top: 2rem;">
                    Sube contenido desde el CMS para comenzar
                </p>
            </div>
        `;
    }

    showErrorScreen(message) {
        const contentDisplay = document.getElementById('contentDisplay');
        contentDisplay.innerHTML = `
            <div class="welcome-screen">
                <div class="waiting-icon">⚠️</div>
                <h1 class="welcome-title waiting-text" style="color: #ff4444;">Error</h1>
                <p class="welcome-subtitle">${message}</p>
                <div class="waiting-animation">
                    <span>Reintentando</span>
                    <div class="waiting-dots">
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">
                    Verifica la conexión y recarga la página
                </p>
            </div>
        `;
    }

    showOfflineNoContentScreen() {
        const contentDisplay = document.getElementById('contentDisplay');
        contentDisplay.innerHTML = `
            <div class="welcome-screen">
                <div class="waiting-icon">📡</div>
                <h1 class="welcome-title waiting-text">Esperando Conexión</h1>
                <p class="welcome-subtitle">No hay contenido guardado en caché</p>
                <div class="waiting-animation">
                    <span>Esperando</span>
                    <div class="waiting-dots">
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                        <div class="waiting-dot"></div>
                    </div>
                </div>
                <p style="color: #666; font-size: 0.8rem; margin-top: 2rem;">
                    Conecta a internet para cargar contenido
                </p>
            </div>
        `;
    }

    updateStatusIndicator() {
        const indicator = document.getElementById('statusIndicator');
        const hasScreen = this.currentScreenId !== null;
        const hasContent = this.mediaFiles.length > 0;
        const isWebSocketConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
        
        // Check if content is currently playing by looking at the content display
        const contentDisplay = document.getElementById('contentDisplay');
        const hasActiveMedia = contentDisplay && contentDisplay.querySelector('.media-content');
        const isCurrentlyPlaying = hasActiveMedia && hasContent;
        
        // Cache status
        const cacheSize = this.preloadCache.size;
        const cacheHits = this.cacheStats.hits;
        const cacheInfo = cacheSize > 0 ? ` | Cache: ${cacheSize} items` : '';
        const cacheHitInfo = cacheHits > 0 ? ` (${cacheHits} hits)` : '';
        
        let status = '';
        let statusClass = '';
        
        if (this.isOfflineMode) {
            status = `● Modo Offline - Contenido en caché${cacheInfo}`;
            statusClass = 'status-offline';
        } else if (hasScreen && isCurrentlyPlaying && isWebSocketConnected) {
            status = `● Conectado - Reproduciendo${cacheInfo}${cacheHitInfo}`;
            statusClass = 'status-online';
        } else if (hasScreen && hasContent && isWebSocketConnected) {
            status = `● Conectado - Con contenido${cacheInfo}`;
            statusClass = 'status-online';
        } else if (hasScreen && isWebSocketConnected) {
            status = `● Conectado - Sin contenido${cacheInfo}`;
            statusClass = 'status-online';
        } else if (hasScreen && !isWebSocketConnected) {
            status = `● Pantalla configurada - Sin conexión${cacheInfo}`;
            statusClass = 'status-offline';
        } else {
            status = `● No configurado${cacheInfo}`;
            statusClass = 'status-offline';
        }
        
        indicator.innerHTML = `<span class="${statusClass}">${status}</span>`;
        // console.log('Status updated:', status);
    }

    showNotification(message) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background: rgba(0, 102, 204, 0.9);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 6px;
            z-index: 1001;
            font-size: 0.9rem;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    connectWebSocket() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            // Already connected or connecting
            return;
        }

        // Clear any pending reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        try {
            this.ws = new WebSocket(WS_URL);
        } catch (err) {
            // If construction fails, schedule reconnect
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            const isReconnection = this.wasConnected;
            this.wasConnected = true;
            this.reconnectAttempts = 0; // reset attempts on successful connection
            // console.log(`[WS] ✅ Conectado a ${WS_URL} | screenId: ${this.currentScreenId} | reconexión: ${isReconnection}`);

            this.registerWithWebSocket();
            this.updateStatusIndicator();
            this.startHeartbeat();

            if (isReconnection) {
                this.loadContent();
            }
        };

        this.ws.onmessage = (event) => {
            this.handleWebSocketMessage(event);
        };

        this.ws.onclose = (event) => {
            // console.log(`[WS] ❌ Desconectado | code: ${event.code} | reason: ${event.reason || 'sin razón'} | screenId: ${this.currentScreenId}`);
            // Clean up current socket reference
            try { this.ws.onopen = null; } catch (e) {}
            try { this.ws.onmessage = null; } catch (e) {}
            try { this.ws.onclose = null; } catch (e) {}
            try { this.ws.onerror = null; } catch (e) {}
            this.ws = null;

            this.updateStatusIndicator();
            this.stopHeartbeat();
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            // console.error('[WS] ⚠️ Error en WebSocket:', error);
            // On error, ensure status updated and attempt reconnect
            this.updateStatusIndicator();
            // Close socket to trigger onclose and proper cleanup
            try {
                if (this.ws) this.ws.close();
            } catch (e) {}
        };
    }

    scheduleReconnect() {
        // Exponential backoff with cap and jitter
        this.reconnectAttempts = Math.min((this.reconnectAttempts || 0) + 1, 10);
        const base = 1000; // 1s
        const max = 30000; // 30s
        const backoff = Math.min(base * Math.pow(2, this.reconnectAttempts - 1), max);
        // add jitter
        const jitter = Math.floor(Math.random() * 1000);
        const delay = backoff + jitter;

        // console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWebSocket();
        }, delay);
    }

    registerWithWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentScreenId) {
            const sessionId = this.getSessionId();
            // console.log(`[WS] 📡 Registrando display | screenId: ${this.currentScreenId} | sessionId: ${sessionId}`);
            this.ws.send(JSON.stringify({
                type: 'register',
                screenId: this.currentScreenId,
                sessionId: sessionId
            }));
        } else {
            // console.warn('[WS] ⚠️ No se puede registrar:', {
            //     wsAbierto: this.ws && this.ws.readyState === WebSocket.OPEN,
            //     tieneScreenId: !!this.currentScreenId,
            //     screenId: this.currentScreenId
            // });
        }
    }

    handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            // console.log(`[WS] 📨 Mensaje recibido | type: ${message.type}`, message);
            
            switch (message.type) {
                case 'session_registered':
                    // Server confirms session registration
                    if (message.sessionId) {
                        this.sessionId = message.sessionId;
                        localStorage.setItem('display_session_id', message.sessionId);
                        // console.log(`Session registered: ${message.sessionId} for screen ${message.screenId}`);
                    }
                    break;
                    
                case 'pong':
                    // HEARTBEAT: Received pong from server
                    this.lastPongReceived = Date.now();
                    // console.log('Heartbeat: Received pong from server');
                    break;
                    
                case 'media_updated':
            // console.log('Media updated, queueing content reload...');
                    this.queueContentUpdate();
                    break;
                    
                case 'screen_updated':
            // console.log('Screen configuration updated', message.data);
                    // Refresh available screens cache whenever any screen is updated
                    this.fetchAvailableScreens();
                    
                    // Convert WebSocket message ID to number for strict comparison
                    if (parseInt(message.data.id, 10) === this.currentScreenId) {
                        // If my screen was updated, reload everything immediately
                        // Screen updates are rare and important (folder assignments, etc.)
                        this.loadContent();
                    }
                    break;
                    
                case 'display_command':
                    // show_prize broadcasts to ALL screens regardless of screenId
                    if (message.data.command === 'show_prize') {
                        // console.log(`[WS] 🏆 show_prize recibido (todas las pantallas)`, message.data);
                        this.handleDisplayCommand(message.data);
                    } else if (parseInt(message.data.screenId, 10) === this.currentScreenId) {
                        // console.log(`[WS] 🎯 display_command | command: ${message.data.command} | screenId: ${message.data.screenId}`);
                        this.handleDisplayCommand(message.data);
                    }
                    break;
                    
                case 'connection_update':
                    // Update status when connection events occur
                    this.updateStatusIndicator();
                    break;
            }
        } catch (error) {
            // console.error('Error handling WebSocket message:', error);
        }
    }

    // HEARTBEAT: Start sending periodic pings
    startHeartbeat() {
        // Clear any existing heartbeat
        this.stopHeartbeat();
        
        // Initialize last pong timestamp
        this.lastPongReceived = Date.now();
        
        // Send ping every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.sendPing();
        }, 30000); // 30 seconds
        
        // Check for pong timeout every 5 seconds (separate from ping interval)
        // This ensures we check AFTER the server has had time to respond
        this.pongCheckInterval = setInterval(() => {
            this.checkPongTimeout();
        }, 5000); // 5 seconds
        
        // console.log('Heartbeat started');
    }

    // HEARTBEAT: Stop sending pings
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            // console.log('Heartbeat stopped');
        }
        if (this.pongCheckInterval) {
            clearInterval(this.pongCheckInterval);
            this.pongCheckInterval = null;
        }
    }

    // HEARTBEAT: Send ping to server with session info for restoration
    sendPing() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now(),
                screenId: this.currentScreenId,
                sessionId: this.sessionId
            }));
            // console.log('Heartbeat: Sent ping to server with session info');
        }
    }

    // HEARTBEAT: Check if pong timeout exceeded
    checkPongTimeout() {
        const now = Date.now();
        const timeSinceLastPong = now - this.lastPongReceived;
        const PONG_TIMEOUT = 45000; // 45 seconds (30s ping interval + 15s grace period)
        
        if (timeSinceLastPong > PONG_TIMEOUT) {
            // console.warn('Heartbeat: Pong timeout exceeded, connection may be dead');
            // The WebSocket will auto-reconnect via onclose handler
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    handleDisplayCommand(command) {
        // console.log('[WS] ⚡ Ejecutando comando:', command);
        
        switch (command.command) {
            case 'reload_content':
                this.loadContent();
                break;
                
            case 'next_content':
                this.nextContent();
                break;
                
            case 'enter_fullscreen':
                this.enterFullscreen();
                break;
                
            case 'show_prize':
                this.showPrizeOverlay(command.params);
                break;
        }
    }

    enterFullscreen() {
        if (document.fullscreenElement) return;
        
        const element = document.documentElement;
        
        if (element.requestFullscreen) {
            element.requestFullscreen().catch(err => {
                // console.warn('Could not enter fullscreen:', err);
            });
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    showPrizeOverlay(data) {
        this.stopContentRotation();

        // Remove any existing overlay/confetti
        const existing = document.getElementById('prizeOverlay');
        if (existing) existing.remove();
        const existingConf = document.getElementById('prizeConfetti');
        if (existingConf) existingConf.remove();

        // Inject keyframes once
        if (!document.getElementById('casinoKeyframes')) {
            const style = document.createElement('style');
            style.id = 'casinoKeyframes';
            style.textContent = `
                @keyframes prizePulse {
                    0%,100% { transform: scale(1); }
                    50%     { transform: scale(1.04); }
                }
                @keyframes confettiFall {
                    0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(110vh) rotate(400deg); opacity: 0; }
                }
                @keyframes goldShine {
                    0%,100% { color: #FFD700; text-shadow: 0 0 10px #FFA500, 0 0 20px #FF8C00; }
                    50%     { color: #FFFACD; text-shadow: 0 0 20px #FFD700, 0 0 40px #FFA500; }
                }
                @keyframes borderGlow {
                    0%,100% { box-shadow: 0 0 20px #FFD700, 0 0 40px rgba(255,165,0,0.4); border-color: #FFD700; }
                    50%     { box-shadow: 0 0 35px #FFA500, 0 0 70px rgba(255,215,0,0.5); border-color: #FFFACD; }
                }
                @keyframes zoomInOut {
                    0%,100% { transform: scale(1); }
                    50%     { transform: scale(1.15); }
                }
                .zoom { display: inline-block; animation: zoomInOut 1.5s ease-in-out infinite; }
            `;
            document.head.appendChild(style);
        }

        // Confetti — modest amount, falls from top
        const confettiContainer = document.createElement('div');
        confettiContainer.id = 'prizeConfetti';
        confettiContainer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;overflow:hidden;z-index:10001;';
        document.body.appendChild(confettiContainer);

        const confettiColors = ['#FFD700','#FFA500','#FFFACD','#FF6347','#ffffff','#FFD700'];
        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            const size = 7 + Math.random() * 8;
            piece.style.cssText = `
                position:absolute;
                width:${size}px; height:${size}px;
                background:${confettiColors[Math.floor(Math.random() * confettiColors.length)]};
                top:-12px;
                left:${Math.random() * 100}vw;
                opacity:0.9;
                border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
                animation: confettiFall ${3 + Math.random() * 3}s linear ${Math.random() * 2}s infinite;
            `;
            confettiContainer.appendChild(piece);
        }

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'prizeOverlay';
        overlay.style.cssText = `
            position:fixed; top:0; left:0; width:100vw; height:100vh;
            background:rgba(0,0,0,0.88);
            display:flex; align-items:center; justify-content:center;
            z-index:10000; font-family:Arial,sans-serif;
        `;

        overlay.innerHTML = `
            <div style="
                background: linear-gradient(145deg, #1a0800, #2d1200, #1a0800);
                border: 4px solid #FFD700;
                color: #FFD700;
                padding: 40px 50px;
                border-radius: 20px;
                text-align: center;
                max-width: 780px;
                width: 92%;
                animation: prizePulse 2s infinite, borderGlow 2s ease-in-out infinite;
            ">
                <h1 style="font-size:clamp(1.1rem, 3.5vw, 2.2em); white-space:nowrap; margin-bottom:16px; animation: goldShine 1.5s ease-in-out infinite;">
                    🎉 Felicidades al afortunado ganador 🎉
                </h1>
                <p style="font-size:1.6em; margin:12px 0; animation: goldShine 1.8s ease-in-out infinite 0.2s;">
                    <strong>Máquina:</strong> <span class="zoom">${data.maquina || 'N/A'}</span>
                </p>
                <p style="font-size:1.5em; margin:10px 0; color:#FFA500; animation: goldShine 2s ease-in-out infinite 0.4s;">
                    ${data.ubicacion || ''}
                </p>
                <p style="font-size:clamp(1.4rem, 5vw, 2.8em); margin:16px 0; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; animation: goldShine 1.2s ease-in-out infinite, zoomInOut 1.5s ease-in-out infinite;">
                    ${data.montoFormateado || ('$' + (data.monto || 'N/A'))}
                </p>
                <p style="font-size:1.4em; color:#FFA500; letter-spacing:6px; animation: goldShine 1.5s ease-in-out infinite 0.6s;">
                    ★ ★ ★ ★ ★
                </p>
            </div>
        `;

        document.body.appendChild(overlay);

        setTimeout(() => {
            this.hidePrizeOverlay();
            this.startContentRotation();
        }, 45000);
    }

    hidePrizeOverlay() {
        const overlay = document.getElementById('prizeOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        const confetti = document.getElementById('prizeConfetti');
        if (confetti) {
            confetti.remove();
        }
    }

    // Cleanup method
    destroy() {
        this.stopContentRotation();
        
        if (this.clickTimer) {
            clearTimeout(this.clickTimer);
        }
        
        // Clean up any remaining video elements
        const contentDisplay = document.getElementById('contentDisplay');
        if (contentDisplay) {
            this.cleanupVideoElements(contentDisplay);
        }
        
            // console.log('Display App destroyed');
    }

    trackMediaView(media, event) {
        if (!this.currentScreenId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            // Send media tracking event via WebSocket (server will generate timestamp)
            this.ws.send(JSON.stringify({
                type: 'media_view',
                data: {
                    screenId: this.currentScreenId,
                    mediaId: media.id,
                    mediaName: media.name,
                    event: event // 'start' or 'end' - server generates timestamp
                }
            }));
            // console.log(`Tracked media view: ${media.name} - ${event} (server timestamp)`);
        } catch (error) {
            // console.error('Failed to track media view:', error);
        }
    }

    sendCurrentPlayingContent() {
        if (!this.currentScreenId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const currentMedia = this.mediaFiles[this.currentContentIndex];
            this.ws.send(JSON.stringify({
                type: 'content_playing',
                data: {
                    screenId: this.currentScreenId,
                    currentMedia: currentMedia,
                    mediaFiles: this.mediaFiles,
                    contentIndex: this.currentContentIndex
                }
            }));
            // console.log(`Sent current playing content: ${currentMedia?.name || 'none'}`);
        } catch (error) {
            // console.error('Failed to send current playing content:', error);
        }
    }
}

// Initialize the display app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.displayApp = new DisplayApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.displayApp) {
        window.displayApp.destroy();
    }
});