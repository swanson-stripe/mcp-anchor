#!/usr/bin/env ts-node
/**
 * Simple unit test for data adapter
 * Run with: npm test
 */
import { dataAdapter } from '../adapter/index.js';

// Simple test framework
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running adapter tests...\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error instanceof Error ? error.message : error}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Helper function to assert conditions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// Test cases
const runner = new TestRunner();

runner.test('dataAdapter should initialize successfully', async () => {
  await dataAdapter.initialize();
  const status = dataAdapter.getStatus();
  assert(typeof status.datasetRoot === 'string', 'Dataset root should be a string');
  assert(typeof status.useFallback === 'boolean', 'useFallback should be a boolean');
});

runner.test('getCustomers() should return array with id field', async () => {
  const customers = await dataAdapter.getCustomers();
  assert(Array.isArray(customers), 'getCustomers() should return an array');
  assert(customers.length > 0, 'Should have at least one customer');
  assert(typeof customers[0].id === 'string', 'Customer should have string id');
  assert(customers[0].id.length > 0, 'Customer id should not be empty');
});

runner.test('getAccounts() should return array with id field', async () => {
  const accounts = await dataAdapter.getAccounts();
  assert(Array.isArray(accounts), 'getAccounts() should return an array');
  assert(accounts.length > 0, 'Should have at least one account');
  assert(typeof accounts[0].id === 'string', 'Account should have string id');
});

runner.test('getProducts() should return array with id field', async () => {
  const products = await dataAdapter.getProducts();
  assert(Array.isArray(products), 'getProducts() should return an array');
  assert(products.length > 0, 'Should have at least one product');
  assert(typeof products[0].id === 'string', 'Product should have string id');
});

runner.test('getPrices() should return array with id field', async () => {
  const prices = await dataAdapter.getPrices();
  assert(Array.isArray(prices), 'getPrices() should return an array');
  assert(prices.length > 0, 'Should have at least one price');
  assert(typeof prices[0].id === 'string', 'Price should have string id');
});

runner.test('getTransactions() should support query parameters', async () => {
  const allTransactions = await dataAdapter.getTransactions();
  assert(Array.isArray(allTransactions), 'getTransactions() should return an array');
  
  const limitedTransactions = await dataAdapter.getTransactions({ limit: 1 });
  assert(limitedTransactions.length <= 1, 'Should respect limit parameter');
  
  if (allTransactions.length > 0) {
    assert(typeof allTransactions[0].id === 'string', 'Transaction should have string id');
  }
});

runner.test('getTransfers() should return array', async () => {
  const transfers = await dataAdapter.getTransfers();
  assert(Array.isArray(transfers), 'getTransfers() should return an array');
});

runner.test('getBalances() should return array', async () => {
  const balances = await dataAdapter.getBalances();
  assert(Array.isArray(balances), 'getBalances() should return an array');
});

runner.test('getMetricsDaily() should support query parameters', async () => {
  const allMetrics = await dataAdapter.getMetricsDaily();
  assert(Array.isArray(allMetrics), 'getMetricsDaily() should return an array');
  
  if (allMetrics.length > 0) {
    assert(typeof allMetrics[0].date === 'string', 'Metric should have date string');
    assert(typeof allMetrics[0].metric === 'string', 'Metric should have metric name');
    assert(typeof allMetrics[0].value === 'number', 'Metric should have numeric value');
  }
});

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.run().catch(console.error);
}
