/**
 * Types for derived metrics and calculations
 */

export interface DerivedMetrics {
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

export interface DailyBucket {
  date: string;
  transactions: {
    total: number;
    authorized: number;
    settled: number;
    failed: number;
    refunded: number;
    disputed: number;
  };
  revenue: {
    gross: number;
    net: number;
    refunds: number;
    disputes: number;
  };
  customers: {
    total: Set<string>;
    new: Set<string>;
    returning: Set<string>;
  };
}

export interface MetricsDerivationOptions {
  from?: number;
  to?: number;
  includeToday?: boolean;
}
