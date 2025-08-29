/**
 * Scenario engine for deterministic, stackable transforms
 */
import { ScenarioConfig, ScenarioDefinition, TransformContext } from './types.js';
import {
  baselineTransform,
  heavyTailTransform,
  fraudSpikeTransform,
  heavyTailCustomerTransform,
  fraudSpikeMetricsTransform
} from './transforms.js';
import type { Transaction, Customer, MetricDaily } from '../types/data.js';

export class ScenarioEngine {
  private currentScenario: ScenarioConfig = { name: 'baseline', seed: 42 };
  private scenarios: Map<string, ScenarioDefinition> = new Map();

  constructor() {
    this.initializeScenarios();
  }

  /**
   * Initialize built-in scenarios
   */
  private initializeScenarios() {
    // Baseline scenario - no transforms
    this.scenarios.set('baseline', {
      name: 'baseline',
      description: 'No transformations applied - original data',
      transforms: {
        transactions: baselineTransform,
        customers: baselineTransform,
        metrics: baselineTransform
      }
    });

    // Heavy tail scenario - Pareto distribution on amounts
    this.scenarios.set('heavyTail', {
      name: 'heavyTail',
      description: 'Pareto distribution applied to transaction amounts and customer values',
      transforms: {
        transactions: heavyTailTransform,
        customers: heavyTailCustomerTransform,
        metrics: baselineTransform
      }
    });

    // Fraud spike scenario - increased decline/dispute rates
    this.scenarios.set('fraudSpike', {
      name: 'fraudSpike', 
      description: 'Increased fraud rates with failure reasons and risk scoring',
      transforms: {
        transactions: fraudSpikeTransform,
        customers: baselineTransform,
        metrics: fraudSpikeMetricsTransform
      }
    });
  }

  /**
   * Set the current scenario
   */
  setScenario(config: ScenarioConfig): boolean {
    if (!this.scenarios.has(config.name)) {
      return false;
    }
    
    this.currentScenario = config;
    console.log(`🎭 Scenario switched to: ${config.name} (seed: ${config.seed})`);
    return true;
  }

  /**
   * Get current scenario configuration
   */
  getCurrentScenario(): ScenarioConfig {
    return { ...this.currentScenario };
  }

  /**
   * Get available scenarios
   */
  getAvailableScenarios(): ScenarioDefinition[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Apply transforms to transactions
   */
  transformTransactions(transactions: Transaction[]): Transaction[] {
    const scenario = this.scenarios.get(this.currentScenario.name);
    if (!scenario || !scenario.transforms.transactions) {
      return transactions;
    }

    return transactions.map((transaction, index) => {
      const context: TransformContext = {
        scenario: this.currentScenario.name,
        seed: this.currentScenario.seed,
        index
      };
      
      const result = scenario.transforms.transactions!(transaction, context);
      return result.data;
    });
  }

  /**
   * Apply transforms to customers
   */
  transformCustomers(customers: Customer[]): Customer[] {
    const scenario = this.scenarios.get(this.currentScenario.name);
    if (!scenario || !scenario.transforms.customers) {
      return customers;
    }

    return customers.map((customer, index) => {
      const context: TransformContext = {
        scenario: this.currentScenario.name,
        seed: this.currentScenario.seed,
        index
      };
      
      const result = scenario.transforms.customers!(customer, context);
      return result.data;
    });
  }

  /**
   * Apply transforms to metrics
   */
  transformMetrics(metrics: MetricDaily[]): MetricDaily[] {
    const scenario = this.scenarios.get(this.currentScenario.name);
    if (!scenario || !scenario.transforms.metrics) {
      return metrics;
    }

    return metrics.map((metric, index) => {
      const context: TransformContext = {
        scenario: this.currentScenario.name,
        seed: this.currentScenario.seed,
        index
      };
      
      const result = scenario.transforms.metrics!(metric, context);
      return result.data;
    });
  }

  /**
   * Get scenario statistics and metadata
   */
  getScenarioStats(data: { transactions?: Transaction[]; customers?: Customer[]; metrics?: MetricDaily[] }) {
    const stats: Record<string, any> = {
      scenario: this.currentScenario.name,
      seed: this.currentScenario.seed,
      timestamp: new Date().toISOString()
    };

    if (data.transactions) {
      const amounts = data.transactions
        .map(t => t.amount)
        .filter((a): a is number => typeof a === 'number');
      
      if (amounts.length > 0) {
        stats.transactions = {
          count: data.transactions.length,
          amounts: {
            min: Math.min(...amounts),
            max: Math.max(...amounts),
            avg: Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length)
          },
          statuses: this.groupBy(data.transactions, 'status')
        };
      }
    }

    if (data.customers) {
      stats.customers = {
        count: data.customers.length,
        segments: this.groupBy(data.customers, 'metadata.segment'),
        tiers: this.groupBy(data.customers, 'metadata.tier')
      };
    }

    if (data.metrics) {
      stats.metrics = {
        count: data.metrics.length,
        types: this.groupBy(data.metrics, 'metric')
      };
    }

    return stats;
  }

  /**
   * Helper to group data by field
   */
  private groupBy(data: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {};
    
    data.forEach(item => {
      let value = item;
      const parts = field.split('.');
      
      for (const part of parts) {
        value = value?.[part];
      }
      
      const key = value || 'unknown';
      groups[key] = (groups[key] || 0) + 1;
    });
    
    return groups;
  }
}

// Singleton instance
export const scenarioEngine = new ScenarioEngine();
