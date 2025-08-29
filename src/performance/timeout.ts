/**
 * Timeout budget management for fixture requests with passthrough fallback
 */
import type { TimeoutBudget } from './types.js';

export class TimeoutManager {
  private config: TimeoutBudget;
  private timeoutHits: number = 0;
  private totalRequests: number = 0;

  constructor(config: Partial<TimeoutBudget> = {}) {
    this.config = {
      fixtureTimeoutMs: parseInt(process.env.FIXTURE_TIMEOUT_MS || '35', 10),
      enablePassthrough: process.env.FIXTURE_PASSTHROUGH !== 'false',
      logTimeouts: process.env.LOG_FIXTURE_TIMEOUTS !== 'false',
      ...config
    };
  }

  /**
   * Execute fetch with timeout budget
   */
  async fetchWithTimeout<T>(
    fetchFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
    context?: { url?: string; method?: string }
  ): Promise<{ result: T; timedOut: boolean; source: 'fixture' | 'passthrough' }> {
    this.totalRequests++;
    
    const timeoutMs = this.config.fixtureTimeoutMs;
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Fixture timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between fetch and timeout
      const result = await Promise.race([
        fetchFn(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      if (this.config.logTimeouts && duration > timeoutMs * 0.8) {
        console.warn(`⚠️  Fixture request slow (${duration}ms): ${context?.method || 'GET'} ${context?.url || 'unknown'}`);
      }

      return { result, timedOut: false, source: 'fixture' };

    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      
      if (isTimeout) {
        this.timeoutHits++;
        
        if (this.config.logTimeouts) {
          console.warn(`⏱️  Fixture timeout (${duration}ms) - falling back to passthrough: ${context?.method || 'GET'} ${context?.url || 'unknown'}`);
        }

        // Use passthrough fallback if available and enabled
        if (this.config.enablePassthrough && fallbackFn) {
          try {
            const fallbackResult = await fallbackFn();
            return { result: fallbackResult, timedOut: true, source: 'passthrough' };
          } catch (fallbackError) {
            if (this.config.logTimeouts) {
              console.error(`❌ Passthrough fallback failed: ${fallbackError}`);
            }
            throw fallbackError;
          }
        }
      }
      
      throw error;
    }
  }

  /**
   * Execute multiple requests with timeout budget
   */
  async fetchMultipleWithTimeout<T>(
    requests: Array<() => Promise<T>>,
    fallbacks?: Array<() => Promise<T>>,
    context?: { urls?: string[]; method?: string }
  ): Promise<Array<{ result: T; timedOut: boolean; source: 'fixture' | 'passthrough' }>> {
    const results = await Promise.allSettled(
      requests.map((fetchFn, index) => 
        this.fetchWithTimeout(
          fetchFn,
          fallbacks?.[index],
          {
            url: context?.urls?.[index],
            method: context?.method
          }
        )
      )
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Return failed request as passthrough with error
        return {
          result: null as T,
          timedOut: true,
          source: 'passthrough' as const
        };
      }
    });
  }

  /**
   * Get timeout statistics
   */
  getStats() {
    return {
      timeoutHits: this.timeoutHits,
      totalRequests: this.totalRequests,
      timeoutRate: this.totalRequests > 0 ? this.timeoutHits / this.totalRequests : 0,
      timeoutBudgetMs: this.config.fixtureTimeoutMs,
      passthroughEnabled: this.config.enablePassthrough
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.timeoutHits = 0;
    this.totalRequests = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TimeoutBudget>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): TimeoutBudget {
    return { ...this.config };
  }
}

/**
 * Create a promise that rejects after a timeout
 */
export function createTimeoutPromise(timeoutMs: number, message?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Wrap any async function with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([
    fn(),
    createTimeoutPromise(timeoutMs, timeoutMessage)
  ]);
}

/**
 * Utility function to check if error is a timeout error
 */
export function isTimeoutError(error: any): boolean {
  return error instanceof Error && 
         (error.message.includes('timeout') || 
          error.message.includes('timed out') ||
          error.name === 'TimeoutError');
}
