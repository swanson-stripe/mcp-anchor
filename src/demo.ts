#!/usr/bin/env ts-node
/**
 * Demo script showing data adapter functionality
 */
import { dataAdapter } from './adapter/index.js';

async function main() {
  console.log('🚀 Dataset Injector Demo\n');
  
  // Initialize the adapter
  await dataAdapter.initialize();
  
  console.log('📊 Adapter Status:');
  console.log(dataAdapter.getStatus());
  console.log();
  
  // Demo all the typed getters
  console.log('👥 Customers:');
  const customers = await dataAdapter.getCustomers();
  console.log(`Found ${customers.length} customers`);
  if (customers.length > 0) {
    console.log('Sample:', customers[0]);
  }
  console.log();
  
  console.log('🏦 Accounts:');
  const accounts = await dataAdapter.getAccounts();
  console.log(`Found ${accounts.length} accounts`);
  console.log();
  
  console.log('📦 Products:');
  const products = await dataAdapter.getProducts();
  console.log(`Found ${products.length} products`);
  console.log();
  
  console.log('💰 Prices:');
  const prices = await dataAdapter.getPrices();
  console.log(`Found ${prices.length} prices`);
  console.log();
  
  console.log('💳 Transactions:');
  const transactions = await dataAdapter.getTransactions({ limit: 5 });
  console.log(`Found ${transactions.length} transactions (limited to 5)`);
  if (transactions.length > 0) {
    console.log('Sample:', transactions[0]);
  }
  console.log();
  
  console.log('🔄 Transfers:');
  const transfers = await dataAdapter.getTransfers();
  console.log(`Found ${transfers.length} transfers`);
  console.log();
  
  console.log('⚖️  Balances:');
  const balances = await dataAdapter.getBalances();
  console.log(`Found ${balances.length} balances`);
  console.log();
  
  console.log('📈 Daily Metrics:');
  const metrics = await dataAdapter.getMetricsDaily();
  console.log(`Found ${metrics.length} daily metrics`);
  if (metrics.length > 0) {
    console.log('Sample:', metrics[0]);
  }
  
  console.log('\n✅ Demo complete!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
