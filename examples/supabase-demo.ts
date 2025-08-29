#!/usr/bin/env tsx
/**
 * Demo showing Supabase client emulation with fixture data
 * Usage: INJECT_FIXTURES=1 npx tsx examples/supabase-demo.ts
 */

// This is how you'd typically set up Supabase in a real application:
// import { createClient as realCreateClient } from '@supabase/supabase-js'
// import { createClientFixture } from '@app/fixtures-fetch/interceptors/supabase'
// 
// export const createClient = process.env.INJECT_FIXTURES ? createClientFixture : realCreateClient

import { createClientFixture, getCreateClient } from '../src/interceptors/supabase.js';

async function main() {
  console.log('🗄️  Supabase Fixture Demo\n');

  // Check if fixtures are enabled
  const fixturesEnabled = process.env.INJECT_FIXTURES === '1';
  console.log(`📊 Fixtures enabled: ${fixturesEnabled}`);
  
  if (!fixturesEnabled) {
    console.log('❌ Fixture injection is disabled. Set INJECT_FIXTURES=1 to enable.');
    console.log('Example: INJECT_FIXTURES=1 npx tsx examples/supabase-demo.ts');
    process.exit(1);
  }

  // Create Supabase fixture client
  const supabase = createClientFixture(
    process.env.SUPABASE_URL || 'http://localhost:4000',
    process.env.SUPABASE_ANON_KEY || 'fixture-key'
  );

  console.log('\n🔧 Testing Supabase-like API...\n');

  try {
    // Test 1: Get first 2 customers
    console.log('📡 Test 1: Get first 2 customers');
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .limit(2)
      .execute();

    if (customersError) {
      console.log('   ❌ Error:', customersError.message);
    } else {
      console.log(`   ✅ Success: Found ${customers?.length || 0} customers`);
      customers?.forEach((customer, i) => {
        console.log(`   👤 Customer ${i + 1}: ${customer.name} (${customer.email})`);
      });
    }

    console.log();

    // Test 2: Get transactions with limit
    console.log('📡 Test 2: Get transactions with limit');
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, amount, status, customer')
      .limit(3)
      .execute();

    if (transactionsError) {
      console.log('   ❌ Error:', transactionsError.message);
    } else {
      console.log(`   ✅ Success: Found ${transactions?.length || 0} transactions`);
      transactions?.forEach((tx, i) => {
        console.log(`   💳 Transaction ${i + 1}: $${(tx.amount || 0) / 100} (${tx.status})`);
      });
    }

    console.log();

    // Test 3: Filter by status
    console.log('📡 Test 3: Filter transactions by status');
    const { data: succeededTx, error: filterError } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'succeeded')
      .limit(5)
      .execute();

    if (filterError) {
      console.log('   ❌ Error:', filterError.message);
    } else {
      console.log(`   ✅ Success: Found ${succeededTx?.length || 0} succeeded transactions`);
      succeededTx?.forEach((tx, i) => {
        console.log(`   ✅ Transaction ${i + 1}: ${tx.id} - $${(tx.amount || 0) / 100}`);
      });
    }

    console.log();

    // Test 4: Auth methods
    console.log('📡 Test 4: Auth methods');
    const { data: user } = await supabase.auth.getUser();
    console.log(`   👤 Current user: ${user.user?.email}`);

    console.log();

    // Test 5: Storage methods  
    console.log('📡 Test 5: Storage methods');
    const { data: files } = await supabase.storage.from('avatars').list();
    console.log(`   📁 Storage files: ${files?.length || 0} files available`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }

  console.log('\n🎯 Demo completed! The Supabase fixture client:');
  console.log('   • Provided familiar Supabase API');
  console.log('   • Proxied table queries to REST endpoints');
  console.log('   • Supported chainable query building (.from().select().limit())');
  console.log('   • Applied client-side filtering when needed');
  console.log('   • Included auth and storage fixture methods');
}

// Handle async main
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}
