// Enhanced Service Worker for Display Caching
// Provides offline support with preloading and intelligent cache management

const CACHE_NAME = 'display-cache-v1';
const API_CACHE_NAME = 'display-api-cache-v1';
const MEDIA_CACHE_NAME = 'display-media-cache-v1';
const PRELOAD_CACHE_NAME = 'display-preload-cache-v1';

// Cache strategies
const CACHE_FIRST = 'cache-first';
const NETWORK_FIRST = 'network-first';
const STALE_WHILE_REVALIDATE = 'stale-while-revalidate';

// URL patterns and their cache strategies
const CACHE_STRATEGIES = {
  // Core display files - cache first for performance
  '/display.html': CACHE_FIRST,
  '/display.js': CACHE_FIRST,
  
  // Media files - cache first with fallback
  '/uploads/': CACHE_FIRST,
  
  // API calls - network first with cache fallback
  '/api/media': NETWORK_FIRST,
  '/api/screens': NETWORK_FIRST,
  '/api/config': NETWORK_FIRST,
  
  // Static assets - cache first
  '/logo-dreams.png': CACHE_FIRST,
  '/logo-dreams.svg': CACHE_FIRST,
};

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Cache essential display files immediately
      const essentialFiles = [
        '/display.html',
        '/display.js',
        '/logo-dreams.png'
      ];
      
      await cache.addAll(essentialFiles);
      console.log('[SW] Essential files cached');
      
      // Skip waiting to activate immediately
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith('display-') && 
        ![CACHE_NAME, API_CACHE_NAME, MEDIA_CACHE_NAME, PRELOAD_CACHE_NAME].includes(name)
      );
      
      await Promise.all(
        oldCaches.map(cacheName => caches.delete(cacheName))
      );
      
      console.log('[SW] Old caches cleaned up');
      
      // Take control of all clients immediately
      self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Determine cache strategy based on URL
  let strategy = NETWORK_FIRST; // default
  for (const [pattern, strategyType] of Object.entries(CACHE_STRATEGIES)) {
    if (url.pathname.includes(pattern)) {
      strategy = strategyType;
      break;
    }
  }
  
  event.respondWith(handleRequest(request, strategy));
});

// Handle different cache strategies
async function handleRequest(request, strategy) {
  const url = new URL(request.url);
  
  try {
    switch (strategy) {
      case CACHE_FIRST:
        return await cacheFirst(request);
      
      case NETWORK_FIRST:
        return await networkFirst(request);
      
      case STALE_WHILE_REVALIDATE:
        return await staleWhileRevalidate(request);
      
      default:
        return await networkFirst(request);
    }
  } catch (error) {
    console.error('[SW] Request failed:', error);
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Cache-first strategy - check cache first, fallback to network
async function cacheFirst(request) {
  const cacheName = getCacheNameForRequest(request);
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached new content:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, no cache available for:', request.url);
    throw error;
  }
}

// Network-first strategy - try network first, fallback to cache
async function networkFirst(request) {
  const cacheName = getCacheNameForRequest(request);
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      console.log('[SW] Network success, cached:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache (network failed):', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale-while-revalidate strategy - serve from cache, update in background
async function staleWhileRevalidate(request) {
  const cacheName = getCacheNameForRequest(request);
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always try to update in background
  const networkResponsePromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
      console.log('[SW] Background update cached:', request.url);
    }
    return response;
  }).catch(error => {
    console.log('[SW] Background update failed:', error);
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    console.log('[SW] Serving from cache (stale-while-revalidate):', request.url);
    return cachedResponse;
  }
  
  // No cache available, wait for network
  return networkResponsePromise;
}

// Get appropriate cache name based on request type
function getCacheNameForRequest(request) {
  const url = new URL(request.url);
  
  if (url.pathname.includes('/api/')) {
    return API_CACHE_NAME;
  } else if (url.pathname.includes('/uploads/')) {
    return MEDIA_CACHE_NAME;
  } else {
    return CACHE_NAME;
  }
}

// Listen for messages from the main thread for cache management
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data);
  
  switch (event.data.type) {
    case 'PRELOAD_MEDIA':
      preloadMedia(event.data.mediaList);
      break;
    
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
    
    case 'REMOVE_DELETED_MEDIA':
      removeDeletedMedia(event.data.deletedFiles);
      break;
    
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
  }
});

// Preload media files for offline use
async function preloadMedia(mediaList) {
  console.log('[SW] Preloading media files:', mediaList.length);
  
  const cache = await caches.open(PRELOAD_CACHE_NAME);
  const preloadPromises = [];
  
  for (const media of mediaList) {
    if (media.path) {
      const preloadPromise = fetch(media.path)
        .then(response => {
          if (response.ok) {
            cache.put(media.path, response.clone());
            console.log('[SW] Preloaded:', media.path);
          }
          return response;
        })
        .catch(error => {
          console.warn('[SW] Failed to preload:', media.path, error);
        });
      
      preloadPromises.push(preloadPromise);
    }
  }
  
  try {
    await Promise.allSettled(preloadPromises);
    console.log('[SW] Preloading complete');
    
    // Notify the main thread that preloading is done
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PRELOAD_COMPLETE',
          count: mediaList.length
        });
      });
    });
  } catch (error) {
    console.error('[SW] Preloading failed:', error);
  }
}

// Clear all caches
async function clearAllCaches() {
  console.log('[SW] Clearing all caches...');
  
  const cacheNames = [CACHE_NAME, API_CACHE_NAME, MEDIA_CACHE_NAME, PRELOAD_CACHE_NAME];
  
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  
  console.log('[SW] All caches cleared');
}

// Remove deleted media files from service worker caches
async function removeDeletedMedia(deletedFiles) {
  console.log('[SW] Removing', deletedFiles.length, 'deleted media files from caches');
  
  if (!deletedFiles || deletedFiles.length === 0) {
    return;
  }
  
  const cacheNames = [MEDIA_CACHE_NAME, PRELOAD_CACHE_NAME, CACHE_NAME];
  let totalRemoved = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const cacheKeys = await cache.keys();
    
    let removedFromThisCache = 0;
    
    for (const deletedFile of deletedFiles) {
      if (deletedFile.path) {
        // Check different possible URL formats
        const urlsToCheck = [
          deletedFile.path,
          `${self.location.origin}${deletedFile.path}`,
          deletedFile.filePath, // Alternative path property
          deletedFile.url // If URL is provided
        ].filter(Boolean);
        
        for (const url of urlsToCheck) {
          const matchingKeys = cacheKeys.filter(request => 
            request.url.includes(url) || 
            request.url.endsWith(deletedFile.name) ||
            request.url.includes(deletedFile.id?.toString())
          );
          
          for (const key of matchingKeys) {
            const deleted = await cache.delete(key);
            if (deleted) {
              console.log('[SW] Removed from cache:', key.url);
              removedFromThisCache++;
              totalRemoved++;
            }
          }
        }
      }
    }
    
    if (removedFromThisCache > 0) {
      console.log(`[SW] Removed ${removedFromThisCache} items from ${cacheName}`);
    }
  }
  
  console.log(`[SW] Total cache cleanup complete: ${totalRemoved} items removed`);
  
  // Notify the main thread that cleanup is complete
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_CLEANUP_COMPLETE',
        removedCount: totalRemoved
      });
    });
  });
}

// Get cache status information
async function getCacheStatus() {
  const cacheNames = [CACHE_NAME, API_CACHE_NAME, MEDIA_CACHE_NAME, PRELOAD_CACHE_NAME];
  const status = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    status[cacheName] = {
      name: cacheName,
      count: keys.length,
      urls: keys.map(req => req.url)
    };
  }
  
  return status;
}