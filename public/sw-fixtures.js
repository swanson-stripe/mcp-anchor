/**
 * Service Worker for intercepting fetch requests in browser environments
 * Redirects mapped routes to fixture server when INJECT_FIXTURES is enabled
 */

const SW_VERSION = '1.0.0';
const CACHE_NAME = `fixtures-sw-${SW_VERSION}`;
const CONFIG_URL = '/fixtures-config.json';

let fixturesConfig = null;
let routeMapping = null;

/**
 * Install event - cache essential files
 */
self.addEventListener('install', event => {
  console.log('🔧 SW Fixtures: Installing service worker v' + SW_VERSION);
  
  event.waitUntil(
    Promise.resolve().then(() => {
      console.log('✅ SW Fixtures: Service worker installed');
      self.skipWaiting(); // Immediately activate
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', event => {
  console.log('🚀 SW Fixtures: Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Take control of all clients immediately
      self.clients.claim(),
      
      // Load fixtures configuration
      loadFixturesConfig()
    ]).then(() => {
      console.log('✅ SW Fixtures: Service worker activated and ready');
    })
  );
});

/**
 * Load fixtures configuration from server
 */
async function loadFixturesConfig() {
  try {
    const response = await fetch(CONFIG_URL, { cache: 'no-cache' });
    
    if (response.ok) {
      fixturesConfig = await response.json();
      routeMapping = fixturesConfig.routes || {};
      
      console.log('📋 SW Fixtures: Configuration loaded', {
        enabled: fixturesConfig.enabled,
        fixtureUrl: fixturesConfig.fixtureUrl,
        routes: Object.keys(routeMapping).length
      });
    } else {
      console.log('ℹ️  SW Fixtures: No configuration found, fixtures disabled');
      fixturesConfig = { enabled: false };
    }
  } catch (error) {
    console.log('⚠️  SW Fixtures: Failed to load configuration:', error.message);
    fixturesConfig = { enabled: false };
  }
}

/**
 * Fetch event - intercept requests and redirect to fixtures if configured
 */
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) {
    return; // Let browser handle external requests normally
  }
  
  // Skip service worker requests
  if (url.pathname === CONFIG_URL || url.pathname.includes('sw-fixtures.js')) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

/**
 * Handle intercepted requests
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Ensure config is loaded
  if (!fixturesConfig) {
    await loadFixturesConfig();
  }
  
  // Check if fixtures are enabled and route is mapped
  if (fixturesConfig && fixturesConfig.enabled && routeMapping) {
    const mappedRoute = findMappedRoute(pathname);
    
    if (mappedRoute) {
      return await handleFixtureRequest(request, mappedRoute);
    }
  }
  
  // Default: pass through to original server
  return await handleOriginalRequest(request);
}

/**
 * Find if pathname matches any configured route
 */
function findMappedRoute(pathname) {
  // Check for exact matches first
  if (routeMapping[pathname]) {
    return pathname;
  }
  
  // Check for pattern matches
  for (const route of Object.keys(routeMapping)) {
    if (matchesRoute(pathname, route)) {
      return route;
    }
  }
  
  return null;
}

/**
 * Check if pathname matches route pattern
 */
function matchesRoute(pathname, route) {
  // Simple pattern matching - can be enhanced
  if (route.includes('*')) {
    const pattern = route.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(pathname);
  }
  
  return pathname === route;
}

/**
 * Handle request through fixture server
 */
async function handleFixtureRequest(request, mappedRoute) {
  const originalUrl = new URL(request.url);
  const fixtureBaseUrl = fixturesConfig.fixtureUrl || 'http://localhost:4000';
  
  try {
    // Construct fixture URL
    const fixtureUrl = new URL(originalUrl.pathname + originalUrl.search, fixtureBaseUrl);
    
    console.log('🎯 SW Fixtures: Redirecting to fixture server', {
      original: originalUrl.href,
      fixture: fixtureUrl.href,
      route: mappedRoute
    });
    
    // Create new request to fixture server
    const fixtureRequest = new Request(fixtureUrl.href, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'X-Fixture-Request': 'true',
        'X-Original-URL': originalUrl.href
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });
    
    const response = await fetch(fixtureRequest);
    
    // Add fixture headers to response
    const fixtureResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'X-Fixture-Intercepted': 'true',
        'X-Fixture-Route': mappedRoute,
        'X-Fixture-Server': fixtureBaseUrl
      }
    });
    
    console.log('✅ SW Fixtures: Fixture response received', {
      status: response.status,
      route: mappedRoute
    });
    
    return fixtureResponse;
    
  } catch (error) {
    console.error('❌ SW Fixtures: Fixture request failed:', error);
    
    // Fallback to original request
    console.log('🔄 SW Fixtures: Falling back to original request');
    return await handleOriginalRequest(request);
  }
}

/**
 * Handle original request (pass-through)
 */
async function handleOriginalRequest(request) {
  try {
    const response = await fetch(request);
    
    // Add header to indicate this went through SW but wasn't intercepted
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'X-SW-Passthrough': 'true'
      }
    });
    
  } catch (error) {
    console.error('❌ SW Fixtures: Original request failed:', error);
    
    // Return error response
    return new Response(JSON.stringify({
      error: 'Network request failed',
      message: error.message
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Message handler for communication with main thread
 */
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'RELOAD_CONFIG':
      console.log('🔄 SW Fixtures: Reloading configuration...');
      loadFixturesConfig().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'GET_STATUS':
      event.ports[0]?.postMessage({
        version: SW_VERSION,
        config: fixturesConfig,
        routes: routeMapping ? Object.keys(routeMapping) : []
      });
      break;
      
    default:
      console.warn('⚠️  SW Fixtures: Unknown message type:', type);
  }
});

console.log('📦 SW Fixtures: Service worker script loaded v' + SW_VERSION);
