/**
 * Fetch interceptor for proxying requests to fixture server
 * @app/fixtures-fetch
 */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RouteMapping {
  [path: string]: {
    method: string;
    description: string;
    cacheTtl?: number;
    queryParams?: string[];
  };
}

interface ConfigMap {
  routes: RouteMapping;
}

interface InjectionOptions {
  mapPath?: string;
  fixtureUrl?: string;
  enableLogging?: boolean;
}

/**
 * Load route mapping configuration
 */
async function loadRouteMapping(mapPath?: string): Promise<RouteMapping> {
  try {
    const configPath = mapPath || join(__dirname, '../../src/config/map.yaml');
    const configContent = await readFile(configPath, 'utf-8');
    const config = yaml.load(configContent) as ConfigMap;
    
    return config.routes || {};
  } catch (error) {
    console.warn('⚠️  Failed to load route mapping, using empty mapping:', error instanceof Error ? error.message : error);
    return {};
  }
}

/**
 * Check if a URL path matches any configured route
 */
function matchesConfiguredRoute(url: string, routes: RouteMapping): string | null {
  try {
    let pathname: string;
    
    // Handle relative URLs by extracting the path
    if (url.startsWith('/')) {
      pathname = url.split('?')[0]; // Remove query params for matching
    } else {
      const urlObj = new URL(url);
      pathname = urlObj.pathname;
    }
    
    // Check for exact matches first
    if (routes[pathname]) {
      return pathname;
    }
    
    // Check for pattern matches (basic wildcard support)
    for (const routePath of Object.keys(routes)) {
      if (routePath.includes('*')) {
        const pattern = routePath.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(pathname)) {
          return routePath;
        }
      }
    }
    
    return null;
  } catch (error) {
    // Invalid URL, no match
    return null;
  }
}

/**
 * Create URL for fixture server
 */
function createFixtureUrl(originalUrl: string, fixtureBaseUrl: string): string {
  try {
    const fixtureBaseUrlObj = new URL(fixtureBaseUrl);
    
    // Handle relative URLs
    if (originalUrl.startsWith('/')) {
      return `${fixtureBaseUrlObj.origin}${originalUrl}`;
    }
    
    // Handle absolute URLs
    const originalUrlObj = new URL(originalUrl);
    return `${fixtureBaseUrlObj.origin}${originalUrlObj.pathname}${originalUrlObj.search}`;
  } catch (error) {
    console.warn('⚠️  Failed to create fixture URL:', error);
    return originalUrl;
  }
}

/**
 * Wrap fetch function with fixture injection capabilities
 */
export function withInjection(
  originalFetch: typeof fetch,
  options: InjectionOptions = {}
): typeof fetch {
  const {
    mapPath,
    fixtureUrl = process.env.FIXTURE_URL || 'http://localhost:4000',
    enableLogging = false
  } = options;

  // Check if injection is enabled
  const isEnabled = process.env.INJECT_FIXTURES === '1' || process.env.INJECT_FIXTURES === 'true';
  
  if (!isEnabled) {
    if (enableLogging) {
      console.log('🔧 Fixture injection disabled (INJECT_FIXTURES not set)');
    }
    return originalFetch;
  }

  let routeMapping: RouteMapping | null = null;

  // Create wrapped fetch function
  const wrappedFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : 
                input instanceof URL ? input.href : 
                (input as Request).url;
    
    // Load route mapping on first use
    if (routeMapping === null) {
      routeMapping = await loadRouteMapping(mapPath);
      if (enableLogging) {
        console.log(`🗺️  Loaded ${Object.keys(routeMapping).length} route mappings`);
      }
    }
    
    // Check if this URL should be proxied
    const matchedRoute = matchesConfiguredRoute(url, routeMapping);
    
    if (matchedRoute) {
      const fixtureUrlForRequest = createFixtureUrl(url, fixtureUrl);
      
      if (enableLogging) {
        console.log(`🎭 Proxying ${url} → ${fixtureUrlForRequest}`);
      }
      
      // Proxy to fixture server
      return originalFetch(fixtureUrlForRequest, init);
    }
    
    if (enableLogging) {
      console.log(`⚡ Pass-through ${url}`);
    }
    
    // Pass through to original URL
    return originalFetch(input, init);
  };

  return wrappedFetch;
}

/**
 * Create a pre-configured injected fetch function
 */
export function createInjectedFetch(options: InjectionOptions = {}): typeof fetch {
  // Use global fetch or node-fetch equivalent
  const baseFetch = globalThis.fetch || (async (...args: any[]) => {
    throw new Error('No fetch implementation available. Please provide one or use in a fetch-enabled environment.');
  });
  
  return withInjection(baseFetch, options);
}

/**
 * Get current injection status and configuration
 */
export function getInjectionInfo(): {
  enabled: boolean;
  fixtureUrl: string;
  environment: Record<string, string | undefined>;
} {
  return {
    enabled: process.env.INJECT_FIXTURES === '1' || process.env.INJECT_FIXTURES === 'true',
    fixtureUrl: process.env.FIXTURE_URL || 'http://localhost:4000',
    environment: {
      INJECT_FIXTURES: process.env.INJECT_FIXTURES,
      FIXTURE_URL: process.env.FIXTURE_URL
    }
  };
}

/**
 * Create a debug-enabled fetch for testing
 */
export function createDebugFetch(options: InjectionOptions = {}): typeof fetch {
  return createInjectedFetch({
    ...options,
    enableLogging: true
  });
}
