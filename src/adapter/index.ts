import { join } from 'path';
import { JSONLReader } from './jsonl.js';
import { SchemaValidator } from './validator.js';
import { scenarioEngine } from '../scenario/engine.js';
import { metricsDerivation } from '../metrics/derive.js';
import {
  SAMPLE_CUSTOMERS,
  SAMPLE_ACCOUNTS, 
  SAMPLE_PRODUCTS,
  SAMPLE_PRICES,
  SAMPLE_TRANSACTIONS,
  SAMPLE_TRANSFERS,
  SAMPLE_BALANCES,
  SAMPLE_METRICS_DAILY
} from './sample-data.js';
import type {
  Customer,
  Account,
  Product,
  Price,
  Transaction,
  Transfer,
  Balance,
  MetricDaily,
  TransactionQuery,
  MetricsQuery
} from '../types/data.js';

/**
 * Data adapter for loading synthetic datasets with typed readers
 */
export class DataAdapter {
  private datasetRoot: string;
  private validator: SchemaValidator;
  private useFallback: boolean = false;

  constructor() {
    // Default to relative path or use env variable
    this.datasetRoot = process.env.DATASET_ROOT || '../synthetic-dataset/datasets/core/v1';
    this.validator = new SchemaValidator(this.datasetRoot);
    
    console.log(`📁 Dataset root: ${this.datasetRoot}`);
  }

  /**
   * Initialize the adapter and load schemas
   */
  async initialize(): Promise<void> {
    try {
      await this.validator.initialize();
      
      // Test if we can access the dataset
      const customersReader = new JSONLReader(join(this.datasetRoot, 'customers.jsonl'));
      const hasDataset = await customersReader.exists();
      
      if (!hasDataset) {
        console.warn('⚠️  Dataset not found, falling back to embedded sample data');
        this.useFallback = true;
      } else {
        console.log('✅ Dataset found, using external data');
      }
    } catch (error) {
      console.warn('⚠️  Failed to initialize dataset, using fallback:', error);
      this.useFallback = true;
    }
  }

  /**
   * Get customers with optional validation and scenario transforms
   */
  async getCustomers(): Promise<Customer[]> {
    let customers: Customer[];
    
    if (this.useFallback) {
      customers = SAMPLE_CUSTOMERS;
    } else {
      try {
        const reader = new JSONLReader(join(this.datasetRoot, 'customers.jsonl'));
        const rawCustomers = await reader.loadAll<Customer>();
        customers = this.validator.validateAll('customers', rawCustomers);
      } catch (error) {
        console.warn('⚠️  Failed to load customers, using fallback:', error);
        customers = SAMPLE_CUSTOMERS;
      }
    }

    // Apply scenario transforms
    return scenarioEngine.transformCustomers(customers);
  }

  /**
   * Get accounts with optional validation
   */
  async getAccounts(): Promise<Account[]> {
    if (this.useFallback) {
      return SAMPLE_ACCOUNTS;
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'accounts.jsonl'));
      const accounts = await reader.loadAll<Account>();
      return this.validator.validateAll('accounts', accounts);
    } catch (error) {
      console.warn('⚠️  Failed to load accounts, using fallback:', error);
      return SAMPLE_ACCOUNTS;
    }
  }

  /**
   * Get products with optional validation
   */
  async getProducts(): Promise<Product[]> {
    if (this.useFallback) {
      return SAMPLE_PRODUCTS;
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'products.jsonl'));
      const products = await reader.loadAll<Product>();
      return this.validator.validateAll('products', products);
    } catch (error) {
      console.warn('⚠️  Failed to load products, using fallback:', error);
      return SAMPLE_PRODUCTS;
    }
  }

  /**
   * Get prices with optional validation
   */
  async getPrices(): Promise<Price[]> {
    if (this.useFallback) {
      return SAMPLE_PRICES;
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'prices.jsonl'));
      const prices = await reader.loadAll<Price>();
      return this.validator.validateAll('prices', prices);
    } catch (error) {
      console.warn('⚠️  Failed to load prices, using fallback:', error);
      return SAMPLE_PRICES;
    }
  }

  /**
   * Get transactions with query support and scenario transforms
   */
  async getTransactions(query: TransactionQuery = {}): Promise<Transaction[]> {
    const { from, to, limit = 100, cursor } = query;
    let transactions: Transaction[];

    if (this.useFallback) {
      transactions = SAMPLE_TRANSACTIONS;
      
      // Apply time filters
      if (from) {
        transactions = transactions.filter(t => (t.created || 0) >= from);
      }
      if (to) {
        transactions = transactions.filter(t => (t.created || 0) <= to);
      }
      
      // Apply limit
      transactions = transactions.slice(0, limit);
    } else {
      try {
        const reader = new JSONLReader(join(this.datasetRoot, 'transactions.jsonl'));
        
        if (from || to) {
          // Use streaming for filtered queries
          const filtered = await reader.find<Transaction>(
            (transaction) => {
              const created = transaction.created || 0;
              if (from && created < from) return false;
              if (to && created > to) return false;
              return true;
            },
            limit
          );
          transactions = this.validator.validateAll('transactions', filtered);
        } else {
          // Simple pagination
          const rawTransactions = await reader.loadWithPagination<Transaction>({ 
            limit,
            offset: cursor ? parseInt(cursor, 10) : 0
          });
          transactions = this.validator.validateAll('transactions', rawTransactions);
        }
      } catch (error) {
        console.warn('⚠️  Failed to load transactions, using fallback:', error);
        // Use fallback data with same query logic
        transactions = SAMPLE_TRANSACTIONS;
        if (from) {
          transactions = transactions.filter(t => (t.created || 0) >= from);
        }
        if (to) {
          transactions = transactions.filter(t => (t.created || 0) <= to);
        }
        transactions = transactions.slice(0, limit);
      }
    }

    // Apply scenario transforms
    return scenarioEngine.transformTransactions(transactions);
  }

  /**
   * Get transfers with optional validation
   */
  async getTransfers(): Promise<Transfer[]> {
    if (this.useFallback) {
      return SAMPLE_TRANSFERS;
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'transfers.jsonl'));
      const transfers = await reader.loadAll<Transfer>();
      return this.validator.validateAll('transfers', transfers);
    } catch (error) {
      console.warn('⚠️  Failed to load transfers, using fallback:', error);
      return SAMPLE_TRANSFERS;
    }
  }

  /**
   * Get balances with optional validation
   */
  async getBalances(): Promise<Balance[]> {
    if (this.useFallback) {
      return SAMPLE_BALANCES;
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'balances.jsonl'));
      const balances = await reader.loadAll<Balance>();
      return this.validator.validateAll('balances', balances);
    } catch (error) {
      console.warn('⚠️  Failed to load balances, using fallback:', error);
      return SAMPLE_BALANCES;
    }
  }

  /**
   * Get daily metrics with query support and scenario transforms
   * Can derive metrics from transaction data if USE_DERIVED_METRICS=true or no metrics file exists
   */
  async getMetricsDaily(query: MetricsQuery = {}): Promise<MetricDaily[]> {
    const { from, to } = query;
    const useDerivedMetrics = process.env.USE_DERIVED_METRICS === 'true';
    
    // Try to use derived metrics first if forced or if no metrics file exists
    if (useDerivedMetrics || await this.shouldUseDerivedMetrics()) {
      console.log('📊 Using derived metrics from transaction data');
      return await this.getDerivedMetrics(query);
    }

    let metrics: MetricDaily[];

    if (this.useFallback) {
      metrics = SAMPLE_METRICS_DAILY;
      
      if (from || to) {
        const fromDate = from ? new Date(from).toISOString().split('T')[0] : null;
        const toDate = to ? new Date(to).toISOString().split('T')[0] : null;
        
        metrics = metrics.filter(m => {
          if (fromDate && m.date < fromDate) return false;
          if (toDate && m.date > toDate) return false;
          return true;
        });
      }
    } else {
      try {
        const reader = new JSONLReader(join(this.datasetRoot, 'metrics_daily.jsonl'));
        
        if (from || to) {
          const fromDate = from ? new Date(from).toISOString().split('T')[0] : null;
          const toDate = to ? new Date(to).toISOString().split('T')[0] : null;
          
          const filtered = await reader.find<MetricDaily>(
            (metric) => {
              if (fromDate && metric.date < fromDate) return false;
              if (toDate && metric.date > toDate) return false;
              return true;
            },
            1000 // Higher limit for metrics
          );
          metrics = this.validator.validateAll('metrics', filtered);
        } else {
          const rawMetrics = await reader.loadAll<MetricDaily>();
          metrics = this.validator.validateAll('metrics', rawMetrics);
        }
      } catch (error) {
        console.warn('⚠️  Failed to load metrics, trying derived metrics:', error);
        return await this.getDerivedMetrics(query);
      }
    }

    // Apply scenario transforms
    return scenarioEngine.transformMetrics(metrics);
  }

  /**
   * Check if we should use derived metrics (when no metrics file exists)
   */
  private async shouldUseDerivedMetrics(): Promise<boolean> {
    if (this.useFallback) {
      return false; // Use sample data instead
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'metrics_daily.jsonl'));
      return !(await reader.exists());
    } catch {
      return true;
    }
  }

  /**
   * Get metrics derived from transaction data
   */
  private async getDerivedMetrics(query: MetricsQuery = {}): Promise<MetricDaily[]> {
    try {
      // Get transaction and customer data for derivation
      const transactions = await this.getTransactionsRaw(query);
      const customers = await this.getCustomersRaw();

      // Derive metrics
      const derivedMetrics = await metricsDerivation.deriveMetrics(
        transactions,
        customers,
        { from: query.from, to: query.to }
      );

      // Convert to MetricDaily format
      const metrics: MetricDaily[] = [];
      
      derivedMetrics.forEach(derived => {
        // Add multiple metric entries for each derived metric
        metrics.push(
          {
            date: derived.date,
            metric: 'gross_revenue',
            value: derived.gross_revenue,
            currency: 'usd',
            metadata: { source: 'derived', type: 'revenue' }
          },
          {
            date: derived.date,
            metric: 'net_revenue', 
            value: derived.net_revenue,
            currency: 'usd',
            metadata: { source: 'derived', type: 'revenue' }
          },
          {
            date: derived.date,
            metric: 'auth_rate',
            value: derived.auth_rate,
            metadata: { source: 'derived', type: 'rate', unit: 'percent' }
          },
          {
            date: derived.date,
            metric: 'settle_rate',
            value: derived.settle_rate,
            metadata: { source: 'derived', type: 'rate', unit: 'percent' }
          },
          {
            date: derived.date,
            metric: 'refund_rate',
            value: derived.refund_rate,
            metadata: { source: 'derived', type: 'rate', unit: 'percent' }
          },
          {
            date: derived.date,
            metric: 'dispute_rate',
            value: derived.dispute_rate,
            metadata: { source: 'derived', type: 'rate', unit: 'percent' }
          },
          {
            date: derived.date,
            metric: 'new_customers',
            value: derived.new_customers,
            metadata: { source: 'derived', type: 'count' }
          },
          {
            date: derived.date,
            metric: 'returning_customers',
            value: derived.returning_customers,
            metadata: { source: 'derived', type: 'count' }
          }
        );
      });

      // Apply scenario transforms
      return scenarioEngine.transformMetrics(metrics);
    } catch (error) {
      console.warn('⚠️  Failed to derive metrics, using fallback:', error);
      
      // Generate sample derived metrics for the date range if specified
      if (query.from && query.to) {
        const fromDate = new Date(query.from);
        const toDate = new Date(query.to);
        const derived = metricsDerivation.generateSampleMetrics(fromDate, toDate);
        
        const metrics: MetricDaily[] = [];
        derived.forEach(d => {
          metrics.push({
            date: d.date,
            metric: 'gross_revenue',
            value: d.gross_revenue,
            currency: 'usd',
            metadata: { source: 'sample_derived' }
          });
        });
        
        return scenarioEngine.transformMetrics(metrics);
      }
      
      return scenarioEngine.transformMetrics(SAMPLE_METRICS_DAILY);
    }
  }

  /**
   * Get raw transactions without scenario transforms (for metrics derivation)
   */
  private async getTransactionsRaw(query: MetricsQuery = {}): Promise<Transaction[]> {
    const transactionQuery = {
      from: query.from,
      to: query.to,
      limit: 10000 // Higher limit for metrics calculation
    };

    if (this.useFallback) {
      let transactions = SAMPLE_TRANSACTIONS;
      
      if (query.from) {
        transactions = transactions.filter(t => (t.created || 0) >= query.from!);
      }
      if (query.to) {
        transactions = transactions.filter(t => (t.created || 0) <= query.to!);
      }
      
      return transactions;
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'transactions.jsonl'));
      
      if (query.from || query.to) {
        const filtered = await reader.find<Transaction>(
          (transaction) => {
            const created = transaction.created || 0;
            if (query.from && created < query.from) return false;
            if (query.to && created > query.to) return false;
            return true;
          },
          10000
        );
        return this.validator.validateAll('transactions', filtered);
      } else {
        const transactions = await reader.loadAll<Transaction>();
        return this.validator.validateAll('transactions', transactions);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load raw transactions:', error);
      return SAMPLE_TRANSACTIONS;
    }
  }

  /**
   * Get raw customers without scenario transforms (for metrics derivation)
   */
  private async getCustomersRaw(): Promise<Customer[]> {
    if (this.useFallback) {
      return SAMPLE_CUSTOMERS;
    }

    try {
      const reader = new JSONLReader(join(this.datasetRoot, 'customers.jsonl'));
      const customers = await reader.loadAll<Customer>();
      return this.validator.validateAll('customers', customers);
    } catch (error) {
      console.warn('⚠️  Failed to load raw customers:', error);
      return SAMPLE_CUSTOMERS;
    }
  }

  /**
   * Get adapter status and configuration
   */
  getStatus() {
    return {
      datasetRoot: this.datasetRoot,
      useFallback: this.useFallback,
      hasValidator: !!this.validator
    };
  }
}

// Create singleton instance
export const dataAdapter = new DataAdapter();
