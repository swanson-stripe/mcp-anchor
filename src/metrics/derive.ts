/**
 * Realistic metrics derivation from transaction data
 */
import type { Transaction, Customer } from '../types/data.js';
import type { DerivedMetrics, DailyBucket, MetricsDerivationOptions } from './types.js';

export class MetricsDerivation {
  private customerHistory: Map<string, number> = new Map(); // customer_id -> first_seen_timestamp

  /**
   * Derive daily metrics from transaction and customer data
   */
  async deriveMetrics(
    transactions: Transaction[],
    customers: Customer[],
    options: MetricsDerivationOptions = {}
  ): Promise<DerivedMetrics[]> {
    // Initialize customer history
    this.initializeCustomerHistory(customers);

    // Group transactions into daily buckets
    const dailyBuckets = this.groupTransactionsByDay(transactions, options);

    // Convert buckets to metrics
    const metrics = this.convertBucketsToMetrics(dailyBuckets);

    // Sort by date
    return metrics.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Initialize customer history to track new vs returning customers
   */
  private initializeCustomerHistory(customers: Customer[]) {
    this.customerHistory.clear();
    
    customers.forEach(customer => {
      if (customer.id && customer.created) {
        this.customerHistory.set(customer.id, customer.created);
      }
    });
  }

  /**
   * Group transactions into daily buckets for aggregation
   */
  private groupTransactionsByDay(
    transactions: Transaction[],
    options: MetricsDerivationOptions
  ): Map<string, DailyBucket> {
    const buckets = new Map<string, DailyBucket>();

    // Filter transactions by date range if specified
    const filteredTransactions = transactions.filter(transaction => {
      if (!transaction.created) return false;
      
      if (options.from && transaction.created < options.from) return false;
      if (options.to && transaction.created > options.to) return false;
      
      return true;
    });

    filteredTransactions.forEach(transaction => {
      if (!transaction.created) return;

      const date = new Date(transaction.created).toISOString().split('T')[0];
      
      if (!buckets.has(date)) {
        buckets.set(date, this.createEmptyBucket(date));
      }

      const bucket = buckets.get(date)!;
      this.addTransactionToBucket(bucket, transaction);
    });

    return buckets;
  }

  /**
   * Create an empty daily bucket
   */
  private createEmptyBucket(date: string): DailyBucket {
    return {
      date,
      transactions: {
        total: 0,
        authorized: 0,
        settled: 0,
        failed: 0,
        refunded: 0,
        disputed: 0
      },
      revenue: {
        gross: 0,
        net: 0,
        refunds: 0,
        disputes: 0
      },
      customers: {
        total: new Set(),
        new: new Set(),
        returning: new Set()
      }
    };
  }

  /**
   * Add a transaction to the appropriate bucket
   */
  private addTransactionToBucket(bucket: DailyBucket, transaction: Transaction) {
    const amount = transaction.amount || 0;
    const status = transaction.status || 'unknown';
    const customerId = transaction.customer;

    // Count transactions by status
    bucket.transactions.total++;

    switch (status) {
      case 'succeeded':
        bucket.transactions.authorized++;
        bucket.transactions.settled++;
        bucket.revenue.gross += amount;
        bucket.revenue.net += amount;
        break;
      
      case 'pending':
        bucket.transactions.authorized++;
        bucket.revenue.gross += amount;
        // Note: net revenue only counted when settled
        break;
      
      case 'failed':
        bucket.transactions.failed++;
        break;
      
      case 'canceled':
        bucket.transactions.failed++;
        break;
      
      default:
        // Handle unknown statuses as failed
        bucket.transactions.failed++;
        break;
    }

    // Handle refunds and disputes (detected via metadata)
    if (this.isRefund(transaction)) {
      bucket.transactions.refunded++;
      bucket.revenue.refunds += amount;
      bucket.revenue.net -= amount; // Reduce net revenue
    }

    if (this.isDispute(transaction)) {
      bucket.transactions.disputed++;
      bucket.revenue.disputes += amount;
      bucket.revenue.net -= amount; // Reduce net revenue for disputes
    }

    // Track customers
    if (customerId) {
      bucket.customers.total.add(customerId);
      
      const customerFirstSeen = this.customerHistory.get(customerId);
      const transactionDate = new Date(transaction.created!).getTime();
      
      if (customerFirstSeen && Math.abs(customerFirstSeen - transactionDate) < 86400000) {
        // Customer first seen within 24 hours of this transaction = new customer
        bucket.customers.new.add(customerId);
      } else if (customerFirstSeen) {
        // Existing customer making another transaction
        bucket.customers.returning.add(customerId);
      }
    }
  }

  /**
   * Detect if transaction is a refund
   */
  private isRefund(transaction: Transaction): boolean {
    const description = transaction.description?.toLowerCase() || '';
    const metadata = transaction.metadata || {};
    
    return (
      description.includes('refund') ||
      description.includes('return') ||
      metadata.type === 'refund' ||
      metadata.refunded === true ||
      Boolean(transaction.amount && transaction.amount < 0)
    );
  }

  /**
   * Detect if transaction is disputed
   */
  private isDispute(transaction: Transaction): boolean {
    const description = transaction.description?.toLowerCase() || '';
    const metadata = transaction.metadata || {};
    const failureReason = metadata.failure_reason || '';
    
    return (
      description.includes('dispute') ||
      description.includes('chargeback') ||
      metadata.type === 'dispute' ||
      metadata.disputed === true ||
      failureReason.includes('dispute') ||
      failureReason === 'fraudulent' ||
      failureReason === 'suspected_fraud'
    );
  }

  /**
   * Convert daily buckets to standardized metrics
   */
  private convertBucketsToMetrics(buckets: Map<string, DailyBucket>): DerivedMetrics[] {
    const metrics: DerivedMetrics[] = [];

    buckets.forEach(bucket => {
      const totalTransactions = bucket.transactions.total;
      
      // Calculate rates (as percentages)
      const authRate = totalTransactions > 0 
        ? (bucket.transactions.authorized / totalTransactions) * 100 
        : 0;
      
      const settleRate = bucket.transactions.authorized > 0
        ? (bucket.transactions.settled / bucket.transactions.authorized) * 100
        : 0;
      
      const refundRate = totalTransactions > 0
        ? (bucket.transactions.refunded / totalTransactions) * 100
        : 0;
      
      const disputeRate = totalTransactions > 0
        ? (bucket.transactions.disputed / totalTransactions) * 100
        : 0;

      metrics.push({
        date: bucket.date,
        gross_revenue: this.roundCents(bucket.revenue.gross),
        net_revenue: this.roundCents(bucket.revenue.net),
        auth_rate: this.roundPercent(authRate),
        settle_rate: this.roundPercent(settleRate),
        refund_rate: this.roundPercent(refundRate),
        dispute_rate: this.roundPercent(disputeRate),
        new_customers: bucket.customers.new.size,
        returning_customers: bucket.customers.returning.size
      });
    });

    return metrics;
  }

  /**
   * Round currency amounts to cents
   */
  private roundCents(amount: number): number {
    return Math.round(amount);
  }

  /**
   * Round percentages to 2 decimal places
   */
  private roundPercent(percent: number): number {
    return Math.round(percent * 100) / 100;
  }

  /**
   * Generate sample metrics for a date range when no transaction data exists
   */
  generateSampleMetrics(from: Date, to: Date): DerivedMetrics[] {
    const metrics: DerivedMetrics[] = [];
    const current = new Date(from);

    while (current <= to) {
      const date = current.toISOString().split('T')[0];
      
      // Generate realistic sample metrics
      const baseRevenue = Math.floor(Math.random() * 50000) + 10000; // $100-$600
      const refundRate = Math.random() * 3; // 0-3%
      const disputeRate = Math.random() * 1; // 0-1%
      
      metrics.push({
        date,
        gross_revenue: baseRevenue,
        net_revenue: Math.round(baseRevenue * (1 - (refundRate + disputeRate) / 100)),
        auth_rate: 92 + Math.random() * 6, // 92-98%
        settle_rate: 96 + Math.random() * 3, // 96-99%
        refund_rate: this.roundPercent(refundRate),
        dispute_rate: this.roundPercent(disputeRate),
        new_customers: Math.floor(Math.random() * 50) + 10, // 10-60
        returning_customers: Math.floor(Math.random() * 200) + 50 // 50-250
      });

      current.setDate(current.getDate() + 1);
    }

    return metrics;
  }
}

// Export singleton instance
export const metricsDerivation = new MetricsDerivation();
