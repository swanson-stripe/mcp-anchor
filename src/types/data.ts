// Core data types for the synthetic dataset
export interface Customer {
  id: string;
  email?: string;
  name?: string;
  created?: number;
  metadata?: Record<string, any>;
}

export interface Account {
  id: string;
  type?: string;
  status?: string;
  created?: number;
  metadata?: Record<string, any>;
}

export interface Product {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  created?: number;
  metadata?: Record<string, any>;
}

export interface Price {
  id: string;
  product?: string;
  amount?: number;
  currency?: string;
  type?: string;
  created?: number;
  metadata?: Record<string, any>;
}

export interface Transaction {
  id: string;
  amount?: number;
  currency?: string;
  status?: string;
  created?: number;
  customer?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface Transfer {
  id: string;
  amount?: number;
  currency?: string;
  status?: string;
  created?: number;
  destination?: string;
  metadata?: Record<string, any>;
}

export interface Balance {
  id: string;
  amount?: number;
  currency?: string;
  type?: string;
  created?: number;
  metadata?: Record<string, any>;
}

export interface MetricDaily {
  date: string;
  metric: string;
  value: number;
  currency?: string;
  metadata?: Record<string, any>;
}

// Query interfaces
export interface TransactionQuery {
  from?: number;
  to?: number;
  limit?: number;
  cursor?: string;
}

export interface MetricsQuery {
  from?: number;
  to?: number;
}

// Schema validation interface
export interface ValidationResult {
  valid: boolean;
  errors?: any[];
}
