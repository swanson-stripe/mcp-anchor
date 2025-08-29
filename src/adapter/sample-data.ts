/**
 * Embedded sample data for testing when DATASET_ROOT is not available
 */
import type {
  Customer,
  Account,
  Product,
  Price,
  Transaction,
  Transfer,
  Balance,
  MetricDaily
} from '../types/data.js';

export const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: 'cus_sample_001',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    created: Date.now() - 86400000, // 1 day ago
    metadata: { source: 'sample', segment: 'premium' }
  },
  {
    id: 'cus_sample_002', 
    email: 'bob@example.com',
    name: 'Bob Smith',
    created: Date.now() - 172800000, // 2 days ago
    metadata: { source: 'sample', segment: 'standard' }
  },
  {
    id: 'cus_sample_003',
    email: 'carol@example.com', 
    name: 'Carol Brown',
    created: Date.now() - 259200000, // 3 days ago
    metadata: { source: 'sample', segment: 'enterprise' }
  }
];

export const SAMPLE_ACCOUNTS: Account[] = [
  {
    id: 'acct_sample_001',
    type: 'standard',
    status: 'active',
    created: Date.now() - 86400000,
    metadata: { country: 'US', business_type: 'individual' }
  },
  {
    id: 'acct_sample_002',
    type: 'express',
    status: 'active', 
    created: Date.now() - 172800000,
    metadata: { country: 'CA', business_type: 'company' }
  }
];

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod_sample_001',
    name: 'Basic Plan',
    description: 'Basic subscription plan',
    type: 'service',
    created: Date.now() - 604800000, // 1 week ago
    metadata: { category: 'subscription' }
  },
  {
    id: 'prod_sample_002',
    name: 'Premium Plan',
    description: 'Premium subscription with extras',
    type: 'service',
    created: Date.now() - 604800000,
    metadata: { category: 'subscription' }
  }
];

export const SAMPLE_PRICES: Price[] = [
  {
    id: 'price_sample_001',
    product: 'prod_sample_001',
    amount: 999, // $9.99
    currency: 'usd',
    type: 'recurring',
    created: Date.now() - 604800000,
    metadata: { interval: 'month' }
  },
  {
    id: 'price_sample_002',
    product: 'prod_sample_002', 
    amount: 1999, // $19.99
    currency: 'usd',
    type: 'recurring',
    created: Date.now() - 604800000,
    metadata: { interval: 'month' }
  }
];

// Create transactions spread across multiple days for better metrics testing
const now = Date.now();
const dayMs = 86400000; // 24 hours in ms

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  // Day 1 (3 days ago)
  {
    id: 'py_sample_001',
    amount: 999,
    currency: 'usd',
    status: 'succeeded',
    created: now - (3 * dayMs) + 3600000, // 3 days ago + 1 hour
    customer: 'cus_sample_001',
    description: 'Basic Plan subscription',
    metadata: { payment_method: 'card' }
  },
  {
    id: 'py_sample_002',
    amount: 1999,
    currency: 'usd',
    status: 'succeeded',
    created: now - (3 * dayMs) + 7200000, // 3 days ago + 2 hours
    customer: 'cus_sample_002',
    description: 'Premium Plan subscription',
    metadata: { payment_method: 'card' }
  },
  
  // Day 2 (2 days ago)
  {
    id: 'py_sample_003',
    amount: 999,
    currency: 'usd',
    status: 'succeeded',
    created: now - (2 * dayMs) + 1800000, // 2 days ago + 30 minutes
    customer: 'cus_sample_003',
    description: 'Basic Plan subscription',
    metadata: { payment_method: 'bank_transfer' }
  },
  {
    id: 'py_sample_004',
    amount: 2999,
    currency: 'usd',
    status: 'failed',
    created: now - (2 * dayMs) + 5400000, // 2 days ago + 1.5 hours
    customer: 'cus_sample_001',
    description: 'Enterprise Plan subscription',
    metadata: { payment_method: 'card', failure_reason: 'card_declined' }
  },
  
  // Day 3 (1 day ago)
  {
    id: 'py_sample_005',
    amount: 1999,
    currency: 'usd',
    status: 'succeeded',
    created: now - dayMs + 3600000, // 1 day ago + 1 hour
    customer: 'cus_sample_002',
    description: 'Premium Plan subscription renewal',
    metadata: { payment_method: 'card' }
  },
  {
    id: 'py_sample_006',
    amount: -999,
    currency: 'usd',
    status: 'succeeded',
    created: now - dayMs + 7200000, // 1 day ago + 2 hours
    customer: 'cus_sample_001',
    description: 'Refund for Basic Plan',
    metadata: { payment_method: 'card', type: 'refund' }
  },
  
  // Today
  {
    id: 'py_sample_007',
    amount: 4999,
    currency: 'usd',
    status: 'pending',
    created: now - 3600000, // 1 hour ago
    customer: 'cus_sample_003',
    description: 'Enterprise Plan upgrade',
    metadata: { payment_method: 'bank_transfer' }
  },
  {
    id: 'py_sample_008',
    amount: 999,
    currency: 'usd',
    status: 'failed',
    created: now - 1800000, // 30 minutes ago
    customer: 'cus_sample_001',
    description: 'Basic Plan subscription',
    metadata: { payment_method: 'card', failure_reason: 'suspected_fraud' }
  }
];

export const SAMPLE_TRANSFERS: Transfer[] = [
  {
    id: 'tr_sample_001',
    amount: 950, // After fees
    currency: 'usd',
    status: 'paid',
    created: Date.now() - 86400000,
    destination: 'acct_sample_001',
    metadata: { automatic: true }
  }
];

export const SAMPLE_BALANCES: Balance[] = [
  {
    id: 'bal_sample_001',
    amount: 2948, // $29.48
    currency: 'usd',
    type: 'available',
    created: Date.now(),
    metadata: { account: 'acct_sample_001' }
  },
  {
    id: 'bal_sample_002',
    amount: 0,
    currency: 'usd',
    type: 'pending',
    created: Date.now(),
    metadata: { account: 'acct_sample_001' }
  }
];

export const SAMPLE_METRICS_DAILY: MetricDaily[] = [
  {
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    metric: 'revenue',
    value: 2998,
    currency: 'usd',
    metadata: { source: 'sample' }
  },
  {
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0], 
    metric: 'revenue',
    value: 1999,
    currency: 'usd',
    metadata: { source: 'sample' }
  },
  {
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    metric: 'transactions',
    value: 3,
    metadata: { source: 'sample' }
  }
];
