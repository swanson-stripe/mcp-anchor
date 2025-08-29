/**
 * Performance test for timeout budget and passthrough fallback
 * Tests the acceptance criteria: simulate delay, confirm passthrough activates
 */
import { PerformanceManager } from '../performance/manager.js';
import { TimeoutManager } from '../performance/timeout.js';
import { ResponseCache } from '../performance/cache.js';

async function testTimeoutBudget() {
  console.log('🧪 Testing Performance Timeout Budget & Passthrough\n');

  // Set strict timeout for testing
  process.env.FIXTURE_TIMEOUT_MS = '50'; // 50ms budget
  process.env.LOG_FIXTURE_TIMEOUTS = 'true';

  const timeoutManager = new TimeoutManager();
  const performanceManager = new PerformanceManager();

  console.log('📊 Step 1: Testing normal fast response...');
  
  // Fast fixture response (should succeed)
  const fastResult = await timeoutManager.fetchWithTimeout(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay
      return { data: 'fast response', timestamp: Date.now() };
    },
    async () => {
      return { data: 'passthrough fallback', timestamp: Date.now() };
    },
    { url: '/api/customers', method: 'GET' }
  );

  console.log(`✅ Fast response: source=${fastResult.source}, timedOut=${fastResult.timedOut}`);
  console.log(`   Result:`, JSON.stringify(fastResult.result, null, 2));

  console.log('\n📊 Step 2: Testing SLOW response (should timeout and fallback)...');
  
  // Slow fixture response (should timeout and use passthrough)
  const slowResult = await timeoutManager.fetchWithTimeout(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay > 50ms budget
      return { data: 'slow fixture response', timestamp: Date.now() };
    },
    async () => {
      console.log('🔄 Executing passthrough fallback...');
      await new Promise(resolve => setTimeout(resolve, 10)); // Fast fallback
      return { data: 'passthrough success', timestamp: Date.now() };
    },
    { url: '/api/transactions', method: 'GET' }
  );

  console.log(`⏱️  Slow response: source=${slowResult.source}, timedOut=${slowResult.timedOut}`);
  console.log(`   Result:`, JSON.stringify(slowResult.result, null, 2));

  console.log('\n📊 Step 3: Testing timeout without fallback...');
  
  try {
    await timeoutManager.fetchWithTimeout(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return { data: 'will not complete', timestamp: Date.now() };
      },
      undefined, // No fallback
      { url: '/api/metrics', method: 'GET' }
    );
    console.log('❌ Should have thrown timeout error');
  } catch (error) {
    console.log(`✅ Timeout error caught: ${error instanceof Error ? error.message : error}`);
  }

  console.log('\n📊 Step 4: Testing cache performance...');
  
  const cache = new ResponseCache({ maxEntries: 10, defaultTtlMs: 1000 });
  
  // Cache miss
  const cacheKey = { route: '/api/users', params: 'limit=5', scenario: 'baseline', seed: 42 };
  const cached1 = cache.get(cacheKey);
  console.log(`Cache miss: ${cached1 === null ? 'true' : 'false'}`);
  
  // Store in cache
  cache.set(cacheKey, { users: [{ id: 1, name: 'Test' }] });
  
  // Cache hit
  const cached2 = cache.get(cacheKey);
  console.log(`Cache hit: ${cached2 !== null ? 'true' : 'false'}`);
  console.log(`Cached data:`, JSON.stringify(cached2, null, 2));

  console.log('\n📊 Step 5: Testing PerformanceManager integration...');
  
  const integratedResult = await performanceManager.executeFixtureRequest(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 80)); // Will timeout
      return { data: 'fixture response' };
    },
    async () => {
      return { data: 'integrated passthrough' };
    },
    {
      url: '/api/products',
      method: 'GET',
      params: 'category=electronics',
      enableCache: true
    }
  );

  console.log(`🔄 Integrated result:`);
  console.log(`   Source: ${integratedResult.source}`);
  console.log(`   From cache: ${integratedResult.fromCache}`);
  console.log(`   Timed out: ${integratedResult.timedOut}`);
  console.log(`   Latency: ${integratedResult.latencyMs}ms`);
  console.log(`   Data:`, JSON.stringify(integratedResult.result, null, 2));

  console.log('\n📊 Step 6: Getting performance metrics...');
  
  const timeoutStats = timeoutManager.getStats();
  const perfMetrics = performanceManager.getMetrics();
  
  console.log('Timeout Stats:', JSON.stringify(timeoutStats, null, 2));
  console.log('Performance Metrics:', JSON.stringify({
    cache: perfMetrics.cache,
    timeout: perfMetrics.timeout,
    uptime: perfMetrics.uptime
  }, null, 2));

  console.log('\n🎯 Acceptance Criteria Verification:');
  console.log(`✅ Timeout budget enforced: ${timeoutStats.timeoutHits > 0 ? 'YES' : 'NO'}`);
  console.log(`✅ Passthrough fallback activated: ${slowResult.source === 'passthrough' ? 'YES' : 'NO'}`);
  console.log(`✅ Budget hits logged: ${timeoutStats.timeoutHits > 0 ? 'YES' : 'NO'}`);
  console.log(`✅ Cache functionality: ${cached2 !== null ? 'YES' : 'NO'}`);

  // Cleanup
  performanceManager.destroy();

  console.log('\n✅ Performance test complete!');
}

// Run the test
testTimeoutBudget().catch(console.error);
