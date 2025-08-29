/**
 * Consolidated type exports for mcp-anchor
 */

// Adapter types
export interface Customer {
  id: string;
  email: string;
  name: string;
  created: number;
  metadata?: any;
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

export interface Product {
  id: string;
  name: string;
  description?: string;
  metadata?: any;
}

export interface Price {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  recurring?: {
    interval: string;
    interval_count: number;
  };
  metadata?: any;
}

export interface Account {
  id: string;
  email: string;
  country: string;
  created: number;
  metadata?: any;
}

export interface Transfer {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  created: number;
  metadata?: any;
}

export interface Balance {
  available: Array<{
    amount: number;
    currency: string;
  }>;
  pending: Array<{
    amount: number;
    currency: string;
  }>;
}

// Scenario types
export interface ScenarioConfig {
  name: string;
  seed: number;
}

export interface Transform {
  name: string;
  apply: (data: any[], config: ScenarioConfig) => any[];
}

// API types
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface DateRangeOptions {
  from?: string;
  to?: string;
}

// MCP types
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}
