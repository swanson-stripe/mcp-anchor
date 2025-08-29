/**
 * Performance manager integrating cache and timeout management
 */
import { ResponseCache } from './cache.js';
import { TimeoutManager } from './timeout.js';
import { scenarioEngine } from '../scenario/engine.js';
import type { CacheKey, PerformanceConfig, PerformanceMetrics } from './types.js';

export class PerformanceManager {
  private cache: ResponseCache;
  private timeoutManager: TimeoutManager;
  private config: PerformanceConfig;
  private startTime: number;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.startTime = Date.now();
    
    this.config = {
      cache: {
        enabled: process.env.FIXTURE_CACHE_ENABLED !== 'false',
        maxEntries: parseInt(process.env.FIXTURE_CACHE_MAX_ENTRIES || '1000', 10),
        defaultTtlMs: parseInt(process.env.FIXTURE_CACHE_TTL_MS || '300000', 10), // 5 minutes
        cleanupIntervalMs: parseInt(process.env.FIXTURE_CACHE_CLEANUP_MS || '60000', 10), // 1 minute
      },
      timeout: {
        fixtureTimeoutMs: parseInt(process.env.FIXTURE_TIMEOUT_MS || '35', 10),
        enablePassthrough: process.env.FIXTURE_PASSTHROUGH !== 'false',
        logTimeouts: process.env.LOG_FIXTURE_TIMEOUTS !== 'false',
      },
      metrics: {
        enableCollection: process.env.FIXTURE_METRICS_ENABLED !== 'false',
        reportingIntervalMs: parseInt(process.env.FIXTURE_METRICS_INTERVAL_MS || '30000', 10), // 30 seconds
      },
      ...config
    };

    this.cache = new ResponseCache({
      maxEntries: this.config.cache.maxEntries,
      defaultTtlMs: this.config.cache.defaultTtlMs,
      cleanupIntervalMs: this.config.cache.cleanupIntervalMs,
    });

    this.timeoutManager = new TimeoutManager(this.config.timeout);
  }

  /**
   * Execute fixture request with full performance optimization
   */
  async executeFixtureRequest<T>(
    fixtureRequestFn: () => Promise<T>,
    passthroughFn: () => Promise<T>,
    options: {
      url: string;
      method?: string;
      params?: string;
      enableCache?: boolean;
      ttlMs?: number;
    }
  ): Promise<{ 
    result: T; 
    fromCache: boolean; 
    timedOut: boolean; 
    source: 'cache' | 'fixture' | 'passthrough';
    latencyMs: number;
  }> {
    const startTime = Date.now();
    const method = options.method || 'GET';
    
    // Generate cache key
    const scenario = scenarioEngine.getCurrentScenario();
    const cacheKey: CacheKey = {
      route: options.url,
      params: options.params || '',
      scenario: scenario.name,
      seed: scenario.seed || 42
    };

    // Check cache first if enabled
    if (this.config.cache.enabled && options.enableCache !== false) {
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult !== null) {
        const latencyMs = Date.now() - startTime;
        return {
          result: cachedResult,
          fromCache: true,
          timedOut: false,
          source: 'cache',
          latencyMs
        };
      }
    }

    // Execute with timeout budget
    try {
      const { result, timedOut, source } = await this.timeoutManager.fetchWithTimeout(
        fixtureRequestFn,
        passthroughFn,
        { url: options.url, method }
      );

      const latencyMs = Date.now() - startTime;

      // Cache successful fixture responses
      if (this.config.cache.enabled && 
          source === 'fixture' && 
          !timedOut && 
          options.enableCache !== false) {
        this.cache.set(cacheKey, result, options.ttlMs);
      }

      // Update cache metrics for timeout hits
      if (timedOut) {
        this.cache.updateMetrics({ timeoutHits: this.cache.getStats().timeoutHits + 1 });
      }

      return {
        result,
        fromCache: false,
        timedOut,
        source: source === 'fixture' ? 'fixture' : 'passthrough',
        latencyMs
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      // Log performance issues
      if (this.config.timeout.logTimeouts) {
        console.error(`❌ Fixture request failed (${latencyMs}ms): ${method} ${options.url}`, error);
      }
      
      throw error;
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics & {
    cache: any;
    timeout: any;
    uptime: number;
  } {
    const cacheStats = this.cache.getStats();
    const timeoutStats = this.timeoutManager.getStats();
    const uptime = Date.now() - this.startTime;

    return {
      cacheHits: cacheStats.cacheHits,
      cacheMisses: cacheStats.cacheMisses,
      timeoutHits: timeoutStats.timeoutHits,
      passthroughCount: cacheStats.passthroughCount,
      averageResponseTime: cacheStats.averageResponseTime,
      totalRequests: timeoutStats.totalRequests,
      cacheHitRate: cacheStats.cacheHitRate,
      timeoutRate: timeoutStats.timeoutRate,
      cache: {
        size: cacheStats.cacheSize,
        maxEntries: cacheStats.maxEntries,
        hitRate: cacheStats.cacheHitRate
      },
      timeout: {
        budgetMs: timeoutStats.timeoutBudgetMs,
        hitRate: timeoutStats.timeoutRate,
        passthroughEnabled: timeoutStats.passthroughEnabled
      },
      uptime
    };
  }

  /**
   * Clear all caches and reset metrics
   */
  reset(): void {
    this.cache.clear();
    this.timeoutManager.reset();
    this.startTime = Date.now();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.timeout) {
      this.timeoutManager.updateConfig(config.timeout);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Destroy and cleanup resources
   */
  destroy(): void {
    this.cache.destroy();
  }

  /**
   * Force cache cleanup
   */
  cleanup(): void {
    this.cache.cleanup();
  }
}

// Export singleton instance
export const performanceManager = new PerformanceManager();
