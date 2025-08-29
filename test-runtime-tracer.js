#!/usr/bin/env node

// Simple script to test runtime tracer by making internal fetch requests
import { runtimeTracer } from './dist/analysis/tracer.js';

async function testRuntimeTracer() {
  console.log('🧪 Testing Runtime Tracer...\n');
  
  // Initialize the tracer
  runtimeTracer.nodeRequireHook();
  
  console.log('📡 Making fetch requests that will be captured...\n');
  
  try {
    // Make some requests that will be captured by the tracer
    console.log('🌐 GET /api/customers');
    const response1 = await fetch('http://localhost:4000/api/customers');
    const customers = await response1.json();
    console.log(`   ✅ Got ${customers.length} customers\n`);
    
    console.log('🌐 GET /api/transactions');
    const response2 = await fetch('http://localhost:4000/api/transactions?limit=3');
    const transactions = await response2.json();
    console.log(`   ✅ Got ${transactions.data.length} transactions\n`);
    
    console.log('🌐 GET /api/status');
    const response3 = await fetch('http://localhost:4000/api/status');
    const status = await response3.json();
    console.log(`   ✅ Server status: ${status.ok ? 'OK' : 'ERROR'}\n`);
    
    // Give a moment for logs to process
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Show the captured statistics
    console.log('📊 Captured Request Statistics:');
    const summary = runtimeTracer.getSummary();
    console.log(`   Total Requests: ${summary.totalRequests}`);
    console.log(`   Fixture Hits: ${summary.fixtureHits} (${summary.fixtureHitRate}%)`);
    console.log(`   Average Latency: ${summary.averageLatency}ms\n`);
    
    const stats = runtimeTracer.getStats();
    if (stats.length > 0) {
      console.log('📈 Route Breakdown:');
      stats.forEach(stat => {
        const hitRate = stat.totalRequests > 0 ? ((stat.fixtureHits / stat.totalRequests) * 100).toFixed(1) : '0.0';
        console.log(`   ${stat.route}: ${stat.totalRequests} req, ${hitRate}% fixtures, ${Math.round(stat.averageLatency)}ms avg`);
      });
    }
    
    // Show recent logs
    console.log('\n📋 Recent Request Logs:');
    const recentLogs = runtimeTracer.getRecentLogs(5);
    recentLogs.forEach(log => {
      const fixtureIcon = log.hitFixture ? '🎯' : '🌐';
      console.log(`   ${fixtureIcon} ${log.method} ${log.url} (${log.latencyMs}ms)`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRuntimeTracer().then(() => {
  console.log('\n✅ Runtime tracer test completed!');
}).catch(error => {
  console.error('❌ Runtime tracer test failed:', error);
  process.exit(1);
});
