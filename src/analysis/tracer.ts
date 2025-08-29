/**
 * Runtime request tracer for observing actual traffic and fixture interception
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DataContractDriftDetector } from '../contracts/drift.js';
import type { DriftDetectionResult } from '../contracts/types.js';

export interface RequestLog {
  url: string;
  method: string;
  hitFixture: boolean;
  latencyMs: number;
  timestamp: number;
  userAgent?: string;
  drift?: DriftDetectionResult;
  performance?: {
    fromCache: boolean;
    timedOut: boolean;
    source: 'cache' | 'fixture' | 'passthrough';
    budgetExceeded: boolean;
  };
}

export interface RuntimeStats {
  route: string;
  totalRequests: number;
  fixtureHits: number;
  averageLatency: number;
  lastSeen: number;
}

/**
 * Runtime request tracer that patches global fetch and axios
 */
export class RuntimeTracer {
  private logs: RequestLog[] = [];
  private originalFetch?: typeof globalThis.fetch;
  private originalAxios?: any;
  private outputPath: string;
  private isEnabled = false;
  private stats = new Map<string, RuntimeStats>();
  private driftDetector: DataContractDriftDetector;

  constructor(outputPath = './dsm-runtime.json') {
    this.outputPath = outputPath;
    this.driftDetector = new DataContractDriftDetector({
      enableDetection: process.env.ENABLE_DRIFT_DETECTION !== 'false',
      maxSamples: 50,
      confidenceThreshold: 0.6
    });
    this.loadExistingLogs();
  }

  /**
   * Load existing logs from file if present
   */
  private loadExistingLogs(): void {
    try {
      if (existsSync(this.outputPath)) {
        const data = readFileSync(this.outputPath, 'utf8');
        this.logs = JSON.parse(data);
        this.rebuildStats();
        console.log(`📊 Loaded ${this.logs.length} existing request logs`);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load existing logs:', error);
      this.logs = [];
    }
  }

  /**
   * Rebuild stats from existing logs
   */
  private rebuildStats(): void {
    this.stats.clear();
    this.logs.forEach(log => {
      this.updateStats(log);
    });
  }

  /**
   * Update statistics for a request
   */
  private updateStats(log: RequestLog): void {
    const route = this.extractRoute(log.url);
    const existing = this.stats.get(route) || {
      route,
      totalRequests: 0,
      fixtureHits: 0,
      averageLatency: 0,
      lastSeen: 0
    };

    existing.totalRequests++;
    if (log.hitFixture) existing.fixtureHits++;
    existing.averageLatency = (existing.averageLatency * (existing.totalRequests - 1) + log.latencyMs) / existing.totalRequests;
    existing.lastSeen = log.timestamp;

    this.stats.set(route, existing);
  }

  /**
   * Extract route pattern from URL
   */
  private extractRoute(url: string): string {
    try {
      if (url.startsWith('/')) {
        return url.split('?')[0]; // Remove query params
      }
      const urlObj = new URL(url);
      return urlObj.pathname.split('?')[0];
    } catch {
      return url;
    }
  }

  /**
   * Install Node.js require hook to patch fetch and axios
   */
  nodeRequireHook(): void {
    if (this.isEnabled) {
      console.log('⚠️  Tracer already enabled');
      return;
    }

    console.log('🔗 Installing runtime request hooks...');

    // Patch global fetch
    this.patchGlobalFetch();

    // Try to patch axios if available
    this.patchAxios();

    this.isEnabled = true;
    console.log('✅ Runtime tracer enabled');
  }

  /**
   * Patch global fetch function
   */
  private patchGlobalFetch(): void {
    if (!globalThis.fetch) {
      console.warn('⚠️  Global fetch not available to patch');
      return;
    }

    this.originalFetch = globalThis.fetch;
    
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const startTime = Date.now();
      const url = typeof input === 'string' ? input : 
                  input instanceof URL ? input.href : 
                  (input as Request).url;
      const method = init?.method || 'GET';

      try {
        const response = await this.originalFetch!(input, init);
        const endTime = Date.now();
        
        // Check if response came from fixture server
        const hitFixture = this.isFixtureResponse(response, url);
        
        this.logRequest({
          url,
          method,
          hitFixture,
          latencyMs: endTime - startTime,
          timestamp: Date.now(),
          userAgent: typeof init?.headers === 'object' && init.headers && 'User-Agent' in init.headers ? 
            init.headers['User-Agent'] as string : undefined
        });

        return response;
      } catch (error) {
        const endTime = Date.now();
        
        this.logRequest({
          url,
          method,
          hitFixture: false,
          latencyMs: endTime - startTime,
          timestamp: Date.now()
        });

        throw error;
      }
    };
  }

  /**
   * Patch axios if it's available
   */
  private patchAxios(): void {
    try {
      // Try to require axios if it's available
      const axios = require('axios');
      
      // Add request interceptor
      axios.interceptors.request.use((config: any) => {
        config.metadata = { startTime: Date.now() };
        return config;
      });

      // Add response interceptor
      axios.interceptors.response.use(
        (response: any) => {
          const endTime = Date.now();
          const startTime = response.config.metadata?.startTime || endTime;
          
          this.logRequest({
            url: response.config.url,
            method: response.config.method?.toUpperCase() || 'GET',
            hitFixture: this.isFixtureResponse(response, response.config.url),
            latencyMs: endTime - startTime,
            timestamp: Date.now(),
            userAgent: response.config.headers?.['User-Agent']
          });

          return response;
        },
        (error: any) => {
          const endTime = Date.now();
          const startTime = error.config?.metadata?.startTime || endTime;
          
          this.logRequest({
            url: error.config?.url || 'unknown',
            method: error.config?.method?.toUpperCase() || 'GET',
            hitFixture: false,
            latencyMs: endTime - startTime,
            timestamp: Date.now()
          });

          return Promise.reject(error);
        }
      );

      console.log('✅ Axios interceptors installed');
    } catch (error) {
      console.log('ℹ️  Axios not available, skipping axios patching');
    }
  }

  /**
   * Check if response came from fixture server
   */
  private isFixtureResponse(response: any, url: string): boolean {
    // Check for fixture server indicators
    const fixtureHeaders = [
      'x-fixture-server',
      'x-powered-by',
      'server'
    ];

    // Check response headers for fixture indicators
    if (response.headers) {
      for (const header of fixtureHeaders) {
        const value = response.headers.get ? response.headers.get(header) : response.headers[header];
        if (value && (
          value.includes('fastify') ||
          value.includes('fixture') ||
          value.includes('dataset-injector')
        )) {
          return true;
        }
      }
    }

    // Check if URL points to localhost fixture server
    if (url.includes('localhost:4000') || url.includes('127.0.0.1:4000')) {
      return true;
    }

    // Check for fixture-specific response patterns
    if (response.data || response.json) {
      try {
        const data = response.data || response.json;
        if (data && typeof data === 'object' && data.metadata?.source === 'fixture') {
          return true;
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return false;
  }

  /**
   * Log a request
   */
  private logRequest(log: RequestLog): void {
    this.logs.push(log);
    this.updateStats(log);
    this.saveToFile();
    
    const fixtureStatus = log.hitFixture ? '🎯' : '🌐';
    const driftStatus = log.drift ? (log.drift.isValid ? '📊' : '⚠️') : '';
    const perfStatus = log.performance ? 
      (log.performance.fromCache ? '⚡' : 
       log.performance.timedOut ? '⏱️' : 
       log.performance.source === 'passthrough' ? '🔄' : '') : '';
    
    console.log(`${fixtureStatus}${driftStatus}${perfStatus} ${log.method} ${log.url} (${log.latencyMs}ms)`);
  }

  /**
   * Log a request with response payload for drift detection
   */
  async logRequestWithPayload(log: RequestLog, responsePayload?: any): Promise<void> {
    // Detect drift if this is a fixture response with JSON data
    if (log.hitFixture && responsePayload) {
      try {
        const objectName = this.extractObjectNameFromUrl(log.url);
        if (objectName) {
          // Handle array responses (like /api/customers returning array of customers)
          const payloads = Array.isArray(responsePayload) ? responsePayload : [responsePayload];
          
          for (const payload of payloads.slice(0, 3)) { // Limit to first 3 items
            const driftResult = await this.driftDetector.detectDrift(objectName, payload);
            if (!driftResult.isValid || driftResult.suggestions.length > 0) {
              log.drift = driftResult;
              break; // Use first drift result found
            }
          }
        }
      } catch (error) {
        console.warn('⚠️  Drift detection failed:', error);
      }
    }
    
    this.logRequest(log);
  }

  /**
   * Save logs to file
   */
  private saveToFile(): void {
    try {
      const data = {
        logs: this.logs,
        stats: this.getStats(),
        summary: this.getSummary(),
        drift: this.getDriftSummary(),
        timestamp: new Date().toISOString()
      };
      
      writeFileSync(this.outputPath, JSON.stringify(data, null, 2));
      
      // Also save detailed drift data
      this.driftDetector.saveDriftHistory('./drift.json');
    } catch (error) {
      console.error('❌ Failed to save runtime logs:', error);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): RuntimeStats[] {
    return Array.from(this.stats.values()).sort((a, b) => b.totalRequests - a.totalRequests);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit = 50): RequestLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * Clear all logs and stats
   */
  clear(): void {
    this.logs = [];
    this.stats.clear();
    this.saveToFile();
    console.log('🧹 Cleared all runtime logs');
  }

  /**
   * Disable tracer and restore original functions
   */
  disable(): void {
    if (!this.isEnabled) return;

    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
    }

    this.isEnabled = false;
    console.log('🔌 Runtime tracer disabled');
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const total = this.logs.length;
    const fixtureHits = this.logs.filter(log => log.hitFixture).length;
    const uniqueRoutes = this.stats.size;
    const avgLatency = total > 0 ? this.logs.reduce((sum, log) => sum + log.latencyMs, 0) / total : 0;
    
    // Performance metrics
    const cacheHits = this.logs.filter(log => log.performance?.fromCache).length;
    const timeoutHits = this.logs.filter(log => log.performance?.timedOut).length;
    const passthroughHits = this.logs.filter(log => log.performance?.source === 'passthrough').length;

    return {
      totalRequests: total,
      fixtureHits,
      fixtureHitRate: total > 0 ? (fixtureHits / total * 100).toFixed(1) : '0.0',
      uniqueRoutes,
      averageLatency: Math.round(avgLatency),
      performance: {
        cacheHits,
        cacheHitRate: total > 0 ? (cacheHits / total * 100).toFixed(1) : '0.0',
        timeoutHits,
        timeoutRate: total > 0 ? (timeoutHits / total * 100).toFixed(1) : '0.0',
        passthroughHits,
        passthroughRate: total > 0 ? (passthroughHits / total * 100).toFixed(1) : '0.0'
      }
    };
  }

  /**
   * Get drift detection summary
   */
  getDriftSummary() {
    const driftSummary = this.driftDetector.getDriftSummary();
    const requestsWithDrift = this.logs.filter(log => log.drift).length;
    
    return {
      ...driftSummary,
      requestsWithDrift,
      driftDetectionRate: this.logs.length > 0 ? requestsWithDrift / this.logs.length : 0
    };
  }

  /**
   * Extract object name from API URL for drift detection
   */
  private extractObjectNameFromUrl(url: string): string | null {
    // Extract object name from common API patterns
    const patterns = [
      /\/api\/([^/?]+)/,        // /api/customers -> customers
      /\/([^/?]+)\.json/,       // /customers.json -> customers
      /\/([^/?]+)$/             // /customers -> customers
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        // Normalize to singular form for schema lookup
        const objectName = match[1].toLowerCase();
        const singularMap: Record<string, string> = {
          customers: 'customers',
          transactions: 'transactions',
          products: 'products',
          metrics: 'metrics',
          balances: 'balances',
          transfers: 'transfers',
          // Add daily suffix removal
          'metrics/daily': 'metrics'
        };
        
        return singularMap[objectName] || objectName;
      }
    }

    return null;
  }
}

// Export singleton instance
export const runtimeTracer = new RuntimeTracer();
