/**
 * Minimal Supabase client emulator backed by fixture routes
 * Provides familiar Supabase API that proxies to REST endpoints
 */
import { createInjectedFetch } from './fetch.js';

interface SupabaseResponse<T = any> {
  data: T[] | null;
  error: any;
  count?: number;
}

interface QueryFilter {
  column: string;
  operator: string;
  value: any;
}

/**
 * Query builder that mimics Supabase's chainable API
 */
class QueryBuilder {
  private tableName: string;
  private selectColumns = '*';
  private filters: QueryFilter[] = [];
  private limitCount?: number;
  private fetch: typeof globalThis.fetch;

  constructor(tableName: string, fetch: typeof globalThis.fetch) {
    this.tableName = tableName;
    this.fetch = fetch;
  }

  /**
   * Select specific columns (or * for all)
   */
  select(columns = '*'): this {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Filter where column equals value
   */
  eq(column: string, value: any): this {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  /**
   * Filter where column is less than or equal to value
   */
  lte(column: string, value: any): this {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  /**
   * Filter where column is greater than or equal to value
   */
  gte(column: string, value: any): this {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  /**
   * Limit number of results
   */
  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  /**
   * Execute the query and return results
   */
  async execute(): Promise<SupabaseResponse> {
    try {
      // Build URL for the REST endpoint
      const url = this.buildRestUrl();
      
      console.log(`🗄️  Supabase query: ${this.tableName} -> ${url}`);
      
      const response = await this.fetch(url);
      
      if (!response.ok) {
        return {
          data: null,
          error: {
            message: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status
          }
        };
      }

      const result: any = await response.json();
      
      // Handle different response formats
      let data: any[] = [];
      
      if (Array.isArray(result)) {
        data = result;
      } else if (result && typeof result === 'object' && result.data && Array.isArray(result.data)) {
        data = result.data;
      } else if (result && typeof result === 'object' && result.data) {
        data = [result.data];
      } else if (result) {
        data = [result];
      }

      // Apply client-side filtering if needed (for filters not supported by REST API)
      data = this.applyClientFilters(data);

      return {
        data,
        error: null,
        count: data.length
      };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        }
      };
    }
  }

  /**
   * Build REST URL based on table and filters
   */
  private buildRestUrl(): string {
    // Map table names to API endpoints
    const tableToEndpoint: Record<string, string> = {
      'customers': '/api/customers',
      'transactions': '/api/transactions',
      'products': '/api/products',
      'prices': '/api/prices',
      'accounts': '/api/accounts',
      'transfers': '/api/transfers',
      'balances': '/api/balances',
      'metrics': '/api/metrics/daily'
    };

    let endpoint = tableToEndpoint[this.tableName] || `/db/${this.tableName}`;
    const params = new URLSearchParams();

    // Add limit parameter
    if (this.limitCount) {
      params.append('limit', this.limitCount.toString());
    }

    // Convert filters to query parameters where possible
    this.filters.forEach(filter => {
      if (filter.operator === 'eq' && filter.column === 'id') {
        // Handle ID filtering specially
        params.append('id', filter.value);
      } else if (filter.operator === 'gte' && (filter.column === 'created' || filter.column === 'created_at')) {
        params.append('from', filter.value);
      } else if (filter.operator === 'lte' && (filter.column === 'created' || filter.column === 'created_at')) {
        params.append('to', filter.value);
      }
      // Other filters will be applied client-side
    });

    const queryString = params.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }

  /**
   * Apply filters that couldn't be handled by the REST API
   */
  private applyClientFilters(data: any[]): any[] {
    return data.filter(item => {
      return this.filters.every(filter => {
        const value = this.getNestedValue(item, filter.column);
        
        switch (filter.operator) {
          case 'eq':
            return value === filter.value;
          case 'lte':
            return value <= filter.value;
          case 'gte':
            return value >= filter.value;
          default:
            return true; // Unknown operator, include item
        }
      });
    });
  }

  /**
   * Get nested object value by dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

/**
 * Minimal Supabase client implementation
 */
class SupabaseClient {
  private fetch: typeof globalThis.fetch;

  constructor(url: string, key: string) {
    // Create injected fetch for fixture routing
    this.fetch = createInjectedFetch({
      enableLogging: process.env.NODE_ENV === 'development' || process.env.DEBUG === '1'
    });

    console.log(`🚀 Supabase fixture client initialized (url: ${url})`);
  }

  /**
   * Create a query builder for a table
   */
  from(tableName: string): QueryBuilder {
    return new QueryBuilder(tableName, this.fetch);
  }

  /**
   * Get current auth user (fixture implementation)
   */
  auth = {
    getUser: async () => ({
      data: {
        user: {
          id: 'fixture-user-id',
          email: 'fixture@example.com',
          role: 'authenticated'
        }
      },
      error: null
    }),
    
    getSession: async () => ({
      data: {
        session: {
          access_token: 'fixture-token',
          user: {
            id: 'fixture-user-id',
            email: 'fixture@example.com'
          }
        }
      },
      error: null
    })
  };

  /**
   * Storage interface (minimal fixture implementation)
   */
  storage = {
    from: (bucket: string) => ({
      list: async () => ({
        data: [
          { name: 'sample-file.jpg', id: 'file-1' },
          { name: 'sample-doc.pdf', id: 'file-2' }
        ],
        error: null
      }),
      
      upload: async (path: string, file: any) => ({
        data: { path, id: 'fixture-upload-id' },
        error: null
      })
    })
  };
}

/**
 * Create a fixture Supabase client
 */
export function createClientFixture(url: string, key: string): SupabaseClient {
  return new SupabaseClient(url, key);
}

/**
 * Type definitions for better TypeScript support
 */
export type SupabaseClientFixture = SupabaseClient;

/**
 * Helper to get the proper createClient function based on environment
 */
export function getCreateClient(realCreateClient: any) {
  return process.env.INJECT_FIXTURES === '1' || process.env.INJECT_FIXTURES === 'true'
    ? createClientFixture
    : realCreateClient;
}
