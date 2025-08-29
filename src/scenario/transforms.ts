/**
 * Transform implementations for different scenarios
 */
import { Transform, TransformContext, TransformResult, SeededRandom } from './types.js';
import type { Transaction, Customer, MetricDaily } from '../types/data.js';

/**
 * Baseline transform - no-op, returns data unchanged
 */
export const baselineTransform: Transform<any> = (data, context) => {
  return { data };
};

/**
 * Heavy tail transform - applies Pareto distribution to transaction amounts
 * Creates realistic "whale" transactions with heavy-tailed distribution
 */
export const heavyTailTransform: Transform<Transaction> = (transaction, context) => {
  const rng = new SeededRandom(context.seed + context.index);
  
  if (!transaction.amount || typeof transaction.amount !== 'number') {
    return { data: transaction };
  }

  // Apply Pareto multiplier to create heavy tail
  // Shape parameter 1.16 creates realistic heavy tail (80/20 rule)
  const baseAmount = transaction.amount;
  const paretoMultiplier = rng.pareto(1, 1.16);
  
  // Cap the multiplier to avoid extreme outliers
  const cappedMultiplier = Math.min(paretoMultiplier, 50);
  const newAmount = Math.round(baseAmount * cappedMultiplier);
  
  const transformedTransaction = {
    ...transaction,
    amount: newAmount,
    metadata: {
      ...transaction.metadata,
      transform: 'heavyTail',
      originalAmount: baseAmount,
      multiplier: cappedMultiplier
    }
  };

  return {
    data: transformedTransaction,
    metadata: { transform: 'heavyTail', multiplier: cappedMultiplier }
  };
};

/**
 * Fraud spike transform - increases decline/dispute rates and adds failure reasons
 * Simulates periods of increased fraud activity
 */
export const fraudSpikeTransform: Transform<Transaction> = (transaction, context) => {
  const rng = new SeededRandom(context.seed + context.index);
  
  // Fraud spike parameters
  const fraudRate = 0.15; // 15% fraud rate during spike
  const declineRate = 0.08; // 8% decline rate
  
  const isFraud = rng.boolean(fraudRate);
  const isDeclined = rng.boolean(declineRate);
  
  let newStatus = transaction.status;
  let failureReason: string | undefined;
  
  if (isFraud) {
    newStatus = 'failed';
    failureReason = rng.pick([
      'fraudulent',
      'suspected_fraud', 
      'stolen_card',
      'account_closed',
      'do_not_honor'
    ]);
  } else if (isDeclined) {
    newStatus = 'failed';
    failureReason = rng.pick([
      'insufficient_funds',
      'card_declined',
      'expired_card',
      'incorrect_cvc',
      'processing_error'
    ]);
  }
  
  const transformedTransaction = {
    ...transaction,
    status: newStatus,
    metadata: {
      ...transaction.metadata,
      transform: 'fraudSpike',
      ...(failureReason && { failure_reason: failureReason }),
      ...(isFraud && { fraud_score: rng.range(0.7, 1.0) }),
      risk_level: isFraud ? 'high' : isDeclined ? 'medium' : 'low'
    }
  };

  return {
    data: transformedTransaction,
    metadata: { 
      transform: 'fraudSpike', 
      isFraud, 
      isDeclined, 
      failureReason 
    }
  };
};

/**
 * Customer behavior transform for heavy tail scenario
 * Adjusts customer segments and value tiers
 */
export const heavyTailCustomerTransform: Transform<Customer> = (customer, context) => {
  const rng = new SeededRandom(context.seed + context.index);
  
  // Create customer value tiers for heavy tail distribution
  const tierRoll = rng.next();
  let tier: string;
  let lifetimeValue: number;
  
  if (tierRoll < 0.05) { // Top 5% - whales
    tier = 'whale';
    lifetimeValue = rng.range(50000, 500000);
  } else if (tierRoll < 0.20) { // Next 15% - high value
    tier = 'high_value';
    lifetimeValue = rng.range(10000, 50000);
  } else if (tierRoll < 0.50) { // Next 30% - medium value  
    tier = 'medium_value';
    lifetimeValue = rng.range(1000, 10000);
  } else { // Bottom 50% - standard
    tier = 'standard';
    lifetimeValue = rng.range(100, 1000);
  }
  
  const transformedCustomer = {
    ...customer,
    metadata: {
      ...customer.metadata,
      transform: 'heavyTail',
      tier,
      estimated_lifetime_value: lifetimeValue,
      risk_profile: tier === 'whale' ? 'vip' : tier === 'high_value' ? 'priority' : 'standard'
    }
  };

  return {
    data: transformedCustomer,
    metadata: { transform: 'heavyTail', tier, lifetimeValue }
  };
};

/**
 * Metrics transform for fraud spike scenario
 * Adjusts success rates and fraud metrics
 */
export const fraudSpikeMetricsTransform: Transform<MetricDaily> = (metric, context) => {
  const rng = new SeededRandom(context.seed + context.index);
  
  if (metric.metric === 'revenue') {
    // Reduce revenue due to increased failures
    const reductionFactor = rng.range(0.85, 0.95);
    const adjustedValue = Math.round(metric.value * reductionFactor);
    
    return {
      data: {
        ...metric,
        value: adjustedValue,
        metadata: {
          ...metric.metadata,
          transform: 'fraudSpike',
          original_value: metric.value,
          reduction_factor: reductionFactor
        }
      },
      metadata: { transform: 'fraudSpike', reductionFactor }
    };
  } else if (metric.metric === 'transactions') {
    // Add fraud-related metrics
    const fraudCount = Math.round(metric.value * 0.15);
    
    return {
      data: {
        ...metric,
        metadata: {
          ...metric.metadata,
          transform: 'fraudSpike',
          fraud_attempts: fraudCount,
          success_rate: 0.85
        }
      },
      metadata: { transform: 'fraudSpike', fraudCount }
    };
  }
  
  return { data: metric };
};
