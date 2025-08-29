/**
 * API client boundary layer with fixture injection
 * Uses the withInjection utility from mcp-anchor
 */

// Type-safe API client with fixture injection support
class ApiClient {
  private baseURL: string;
  private fetch: typeof globalThis.fetch;

  constructor(baseURL = '') {
    this.baseURL = baseURL;
    
    // Use injected fetch if available, otherwise regular fetch
    this.fetch = this.createInjectedFetch();
  }

  /**
   * Create fetch function with injection support
   */
  private createInjectedFetch(): typeof globalThis.fetch {
    // In a real app, this would import from mcp-anchor
    // For demo purposes, we'll create a simplified version
    
    const originalFetch = globalThis.fetch;
    
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : 
                  input instanceof URL ? input.href : 
                  (input as Request).url;

      // Check if injection is enabled
      if (process.env.NODE_ENV === 'development' && 
          (globalThis as any).__INJECT_FIXTURES) {
        
        // Log injection for demo visibility
        console.log(`🎯 API Client: ${init?.method || 'GET'} ${url} (injection enabled)`);
        
        // Add injection headers for tracking
        const enhancedInit = {
          ...init,
          headers: {
            ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {}),
            'X-Demo-App': 'prototype-injection-test',
            'X-Injection-Enabled': 'true'
          }
        };
        
        return originalFetch(input, enhancedInit);
      } else {
        console.log(`🌐 API Client: ${init?.method || 'GET'} ${url} (passthrough)`);
        return originalFetch(input, init);
      }
    };
  }

  /**
   * Get customers with type safety
   */
  async getCustomers(): Promise<Customer[]> {
    const response = await this.fetch('/api/customers');
    if (!response.ok) {
      throw new Error(`Failed to fetch customers: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get daily metrics with date range support
   */
  async getMetricsDaily(options?: {
    from?: string;
    to?: string;
  }): Promise<MetricDaily[]> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    
    const url = `/api/metrics/daily${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get transactions with pagination
   */
  async getTransactions(options?: {
    limit?: number;
    from?: string;
    to?: string;
  }): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    
    const url = `/api/transactions${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.status}`);
    }
    return response.json();
  }
}

// Types for API responses
export interface Customer {
  id: string;
  email: string;
  name: string;
  created: number;
  metadata?: any;
}

export interface MetricDaily {
  date: string;
  gross_revenue: number;
  net_revenue: number;
  auth_rate: number;
  settle_rate: number;
  refund_rate: number;
  dispute_rate: number;
  new_customers: number;
  returning_customers: number;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer?: string;
  description?: string;
  metadata?: any;
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
