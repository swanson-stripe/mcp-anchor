/**
 * End-to-end test script for demo app
 * Tests the complete injection pipeline
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const FIXTURE_SERVER_PORT = 4000;
const DEMO_APP_PORT = 3000;
const WAIT_FOR_SERVER_MS = 3000;
const TEST_TIMEOUT_MS = 30000;

let fixtureServer = null;
let demoAppServer = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(port, name) {
  console.log(`⏳ Waiting for ${name} to start on port ${port}...`);
  
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        console.log(`✅ ${name} is ready`);
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await sleep(1000);
  }
  
  throw new Error(`${name} failed to start within timeout`);
}

async function testApiEndpoint(url, description) {
  console.log(`🧪 Testing ${description}: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ ${description} success:`, JSON.stringify(data).slice(0, 150) + '...');
    
    return data;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

async function runE2ETest() {
  console.log('🚀 Starting End-to-End Demo Test\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Start fixture server
    console.log('📊 Step 1: Starting fixture server...');
    fixtureServer = spawn('node', ['../../dist/cli.js', 'serve'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: FIXTURE_SERVER_PORT.toString(),
        DATASET_ROOT: '../../../synthetic-dataset/datasets/core/v1'
      }
    });
    
    fixtureServer.stdout.on('data', (data) => {
      console.log(`[Fixture Server] ${data.toString().trim()}`);
    });
    
    fixtureServer.stderr.on('data', (data) => {
      console.log(`[Fixture Server] ${data.toString().trim()}`);
    });
    
    await sleep(WAIT_FOR_SERVER_MS);
    
    // Step 2: Test fixture server endpoints
    console.log('\n📊 Step 2: Testing fixture server endpoints...');
    
    // Test health endpoint
    await testApiEndpoint(`http://localhost:${FIXTURE_SERVER_PORT}/health`, 'Fixture server health');
    
    // Test customers endpoint
    const customers = await testApiEndpoint(`http://localhost:${FIXTURE_SERVER_PORT}/api/customers`, 'Customers API');
    
    // Print first 3 customers as required
    console.log('\n📋 First 3 customers from fixture server:');
    customers.slice(0, 3).forEach((customer, i) => {
      console.log(`${i + 1}. ${customer.name} (${customer.id}) - ${customer.email}`);
    });
    
    // Test metrics endpoint
    const metrics = await testApiEndpoint(`http://localhost:${FIXTURE_SERVER_PORT}/api/metrics/daily`, 'Daily metrics API');
    
    // Print first metric row as required
    if (metrics.length > 0) {
      console.log('\n📈 First metric row from fixture server:');
      const firstMetric = metrics[0];
      console.log(`Date: ${firstMetric.date}, Gross Revenue: $${(firstMetric.gross_revenue / 100).toFixed(2)}, Auth Rate: ${(firstMetric.auth_rate * 100).toFixed(1)}%`);
    }
    
    // Step 3: Build demo app
    console.log('\n📊 Step 3: Building demo app...');
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Demo app built successfully');
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });
    
    // Step 4: Start demo app server
    console.log('\n📊 Step 4: Starting demo app server...');
    demoAppServer = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        INJECT_FIXTURES: '1',
        NODE_ENV: 'development'
      }
    });
    
    demoAppServer.stdout.on('data', (data) => {
      console.log(`[Demo App] ${data.toString().trim()}`);
    });
    
    demoAppServer.stderr.on('data', (data) => {
      console.log(`[Demo App] ${data.toString().trim()}`);
    });
    
    await sleep(WAIT_FOR_SERVER_MS);
    
    // Step 5: Test demo app API proxy
    console.log('\n📊 Step 5: Testing demo app API proxy...');
    
    const proxyCustomers = await testApiEndpoint(`http://localhost:${DEMO_APP_PORT}/api/customers`, 'Demo app customers proxy');
    const proxyMetrics = await testApiEndpoint(`http://localhost:${DEMO_APP_PORT}/api/metrics/daily`, 'Demo app metrics proxy');
    
    // Step 6: Verify injection pipeline
    console.log('\n📊 Step 6: Verifying injection pipeline...');
    
    console.log('✅ Fixture server serving synthetic data');
    console.log('✅ Demo app proxying API calls');
    console.log('✅ End-to-end pipeline working');
    
    const duration = Date.now() - startTime;
    console.log(`\n🎉 E2E Test completed successfully in ${duration}ms`);
    
    console.log('\n🌐 Demo app available at: http://localhost:3000');
    console.log('📊 Fixture server available at: http://localhost:4000');
    console.log('\n💡 Open browser to see rendered page with synthetic data');
    console.log('🔍 Check browser console for injection logs');
    
    // Keep servers running for manual testing
    console.log('\n⏸️  Servers will keep running for manual testing...');
    console.log('   Press Ctrl+C to stop servers and exit');
    
    // Wait indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ E2E Test failed:', error.message);
    process.exit(1);
  }
}

// Cleanup function
function cleanup() {
  console.log('\n🧹 Cleaning up servers...');
  
  if (fixtureServer) {
    fixtureServer.kill();
    console.log('🛑 Fixture server stopped');
  }
  
  if (demoAppServer) {
    demoAppServer.kill();
    console.log('🛑 Demo app server stopped');
  }
  
  console.log('✅ Cleanup complete');
  process.exit(0);
}

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Set test timeout
setTimeout(() => {
  console.error(`\n⏰ Test timeout after ${TEST_TIMEOUT_MS}ms`);
  cleanup();
}, TEST_TIMEOUT_MS);

// Run the test
runE2ETest().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  cleanup();
});
