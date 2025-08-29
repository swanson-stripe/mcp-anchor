/**
 * Types for performance optimization and caching
 */
export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  route: string;
  params: string;
  scenario: string;
  seed: number;
  hitCount: number;
  lastAccess: number;
}

export interface CacheKey {
  route: string;
  params: string;
  scenario: string;
  seed: number;
}

export interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  timeoutHits: number;
  passthroughCount: number;
  averageResponseTime: number;
  totalRequests: number;
  cacheHitRate: number;
  timeoutRate: number;
}

export interface TimeoutBudget {
  fixtureTimeoutMs: number;
  enablePassthrough: boolean;
  logTimeouts: boolean;
}

export interface PerformanceConfig {
  cache: {
    enabled: boolean;
    maxEntries: number;
    defaultTtlMs: number;
    cleanupIntervalMs: number;
  };
  timeout: TimeoutBudget;
  metrics: {
    enableCollection: boolean;
    reportingIntervalMs: number;
  };
}
