/**
 * Response cache for fixture data with TTL and LRU eviction
 */
import type { CacheEntry, CacheKey, PerformanceMetrics } from './types.js';

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: PerformanceMetrics;

  constructor(options: {
    maxEntries?: number;
    defaultTtlMs?: number;
    cleanupIntervalMs?: number;
  } = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.defaultTtlMs = options.defaultTtlMs || 5 * 60 * 1000; // 5 minutes default
    
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      timeoutHits: 0,
      passthroughCount: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      cacheHitRate: 0,
      timeoutRate: 0
    };

    // Start cleanup interval
    if (options.cleanupIntervalMs) {
      this.startCleanup(options.cleanupIntervalMs);
    }
  }

  /**
   * Generate cache key from request parameters
   */
  private generateKey(cacheKey: CacheKey): string {
    const normalized = {
      route: this.normalizeRoute(cacheKey.route),
      params: this.normalizeParams(cacheKey.params),
      scenario: cacheKey.scenario || 'baseline',
      seed: cacheKey.seed || 42
    };
    
    return `${normalized.route}:${normalized.params}:${normalized.scenario}:${normalized.seed}`;
  }

  /**
   * Normalize route for consistent caching
   */
  private normalizeRoute(route: string): string {
    // Remove query parameters and normalize path
    return route.split('?')[0].toLowerCase().replace(/\/+/g, '/');
  }

  /**
   * Normalize parameters for consistent caching
   */
  private normalizeParams(params: string): string {
    if (!params) return '';
    
    try {
      // Parse and sort query parameters for consistent key generation
      const urlParams = new URLSearchParams(params);
      const sortedParams = new URLSearchParams();
      
      // Sort parameters alphabetically
      Array.from(urlParams.keys()).sort().forEach(key => {
        sortedParams.set(key, urlParams.get(key) || '');
      });
      
      return sortedParams.toString();
    } catch {
      return params;
    }
  }

  /**
   * Get cached response if valid and not expired
   */
  get(cacheKey: CacheKey): any | null {
    const key = this.generateKey(cacheKey);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.cacheMisses++;
      return null;
    }

    const now = Date.now();
    
    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccess = now;
    this.metrics.cacheHits++;
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data;
  }

  /**
   * Store response in cache
   */
  set(cacheKey: CacheKey, data: any, ttlMs?: number): void {
    const key = this.generateKey(cacheKey);
    const now = Date.now();
    
    const entry: CacheEntry = {
      data,
      timestamp: now,
      ttl: ttlMs || this.defaultTtlMs,
      route: cacheKey.route,
      params: cacheKey.params,
      scenario: cacheKey.scenario,
      seed: cacheKey.seed,
      hitCount: 0,
      lastAccess: now
    };

    // Evict LRU entries if cache is full
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  /**
   * Stop cleanup and clear cache
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  /**
   * Get current cache statistics
   */
  getStats() {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    
    return {
      ...this.metrics,
      totalRequests,
      cacheHitRate: totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0,
      timeoutRate: totalRequests > 0 ? this.metrics.timeoutHits / totalRequests : 0,
      cacheSize: this.cache.size,
      maxEntries: this.maxEntries
    };
  }

  /**
   * Update performance metrics
   */
  updateMetrics(update: Partial<PerformanceMetrics>): void {
    Object.assign(this.metrics, update);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      timeoutHits: 0,
      passthroughCount: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      cacheHitRate: 0,
      timeoutRate: 0
    };
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Check if cache contains key
   */
  has(cacheKey: CacheKey): boolean {
    const key = this.generateKey(cacheKey);
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}
