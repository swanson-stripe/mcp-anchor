#!/usr/bin/env tsx
/**
 * Demo showing fetch injection for fixture data
 * Usage: INJECT_FIXTURES=1 FIXTURE_URL=http://localhost:4000 npx tsx examples/node-fetch-demo.ts
 */
import { createDebugFetch, getInjectionInfo } from '../src/interceptors/fetch.js';

async function main() {
  console.log('🎭 Fetch Injection Demo\n');
  
  // Show injection configuration
  const info = getInjectionInfo();
  console.log('📊 Injection Info:', {
    enabled: info.enabled,
    fixtureUrl: info.fixtureUrl,
    environment: info.environment
  });
  console.log();
  
  if (!info.enabled) {
    console.log('❌ Fixture injection is disabled. Set INJECT_FIXTURES=1 to enable.');
    console.log('Example: INJECT_FIXTURES=1 FIXTURE_URL=http://localhost:4000 npx tsx examples/node-fetch-demo.ts');
    process.exit(1);
  }
  
  // Create injected fetch with debug logging
  const fetch = createDebugFetch();
  
  console.log('🔧 Testing fixture endpoints...\n');
  
  const endpoints = [
    '/api/customers',
    '/api/transactions?limit=3',
    '/api/metrics/daily',
    '/api/status',
    'https://api.external.com/data' // This should pass through (not intercepted)
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing: ${endpoint}`);
      
      const response = await fetch(endpoint);
      
      if (response.ok) {
        const data = await response.json();
        
        if (endpoint.includes('external.com')) {
          console.log(`   ✅ Pass-through (expected to fail in demo)`);
        } else {
          // Show sample of the response
          if (Array.isArray(data)) {
            console.log(`   ✅ Success: Array with ${data.length} items`);
            if (data.length > 0) {
              console.log(`   📋 Sample:`, JSON.stringify(data[0], null, 2).substring(0, 200) + '...');
            }
          } else if (data && typeof data === 'object') {
            const keys = Object.keys(data);
            console.log(`   ✅ Success: Object with keys [${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}]`);
            console.log(`   📋 Sample:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
          } else {
            console.log(`   ✅ Success:`, data);
          }
        }
      } else {
        console.log(`   ❌ Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (endpoint.includes('external.com')) {
        console.log(`   ✅ Pass-through failed as expected (no fixture server for external URLs)`);
      } else {
        console.log(`   ❌ Request failed:`, error instanceof Error ? error.message : error);
      }
    }
    
    console.log();
  }
  
  console.log('🎯 Demo completed! The injected fetch:');
  console.log('   • Intercepted fixture routes and proxied to fixture server');
  console.log('   • Passed through external URLs unchanged');
  console.log('   • Provided debug logging for transparency');
}

// Handle async main
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}
