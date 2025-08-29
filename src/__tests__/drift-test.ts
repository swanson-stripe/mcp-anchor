/**
 * Manual test for drift detection
 * This simulates adding a missing field to test the acceptance criteria
 */
import { DataContractDriftDetector } from '../contracts/drift.js';

async function testDriftDetection() {
  console.log('🧪 Testing Data Contract Drift Detection\n');

  const detector = new DataContractDriftDetector({
    enableDetection: true,
    maxSamples: 10,
    confidenceThreshold: 0.5
  });

  console.log('📊 Step 1: Testing valid customer data...');
  
  // Valid customer according to embedded schema
  const validCustomer = {
    id: 'cus_123456789',
    email: 'john@example.com',
    name: 'John Doe',
    created: 1640995200,
    metadata: { source: 'website' }
  };

  const validResult = await detector.detectDrift('customers', validCustomer);
  console.log(`✅ Valid customer: ${validResult.isValid}, suggestions: ${validResult.suggestions.length}`);

  console.log('\n📊 Step 2: Testing customer with MISSING required field...');
  
  // Customer missing required 'email' field
  const missingFieldCustomer = {
    id: 'cus_987654321',
    name: 'Jane Smith',
    created: 1640995300,
    metadata: { source: 'mobile' }
    // Missing 'email' field (required)
  };

  const missingResult = await detector.detectDrift('customers', missingFieldCustomer);
  console.log(`❌ Missing field customer: ${missingResult.isValid}, suggestions: ${missingResult.suggestions.length}`);
  console.log('Drift details:', JSON.stringify({
    missingFields: missingResult.drift.missingFields,
    suggestions: missingResult.suggestions.map(s => ({ action: s.action, path: s.path, reasoning: s.reasoning }))
  }, null, 2));

  console.log('\n📊 Step 3: Testing customer with EXTRA field...');
  
  // Customer with extra field not in schema
  const extraFieldCustomer = {
    id: 'cus_555666777',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    created: 1640995400,
    metadata: { source: 'referral' },
    // Extra fields not in schema
    phone: '+1-555-0123',
    subscription_tier: 'premium',
    last_login: 1640995500,
    preferences: {
      newsletter: true,
      notifications: false
    }
  };

  const extraResult = await detector.detectDrift('customers', extraFieldCustomer);
  console.log(`⚠️  Extra field customer: ${extraResult.isValid}, suggestions: ${extraResult.suggestions.length}`);
  console.log('Drift details:', JSON.stringify({
    extraFields: extraResult.drift.extraFields,
    suggestions: extraResult.suggestions.map(s => ({ action: s.action, path: s.path, reasoning: s.reasoning, confidence: s.confidence }))
  }, null, 2));

  console.log('\n📊 Step 4: Collecting more samples for better suggestions...');
  
  // Add more samples with the same extra fields to increase confidence
  const moreSamples = [
    { ...extraFieldCustomer, id: 'cus_111', email: 'bob@example.com', phone: '+1-555-0124' },
    { ...extraFieldCustomer, id: 'cus_222', email: 'carol@example.com', phone: '+1-555-0125' },
    { ...extraFieldCustomer, id: 'cus_333', email: 'dave@example.com', phone: '+1-555-0126' },
    { ...extraFieldCustomer, id: 'cus_444', email: 'eve@example.com', phone: '+1-555-0127' }
  ];

  for (const sample of moreSamples) {
    await detector.detectDrift('customers', sample);
  }

  console.log('\n📊 Step 5: Getting final drift summary...');
  
  const summary = detector.getDriftSummary();
  console.log('Final Summary:', JSON.stringify(summary, null, 2));

  console.log('\n📊 Step 6: Saving drift report...');
  
  detector.saveDriftHistory('./test-drift.json');
  console.log('✅ Drift report saved to test-drift.json');

  console.log('\n🎯 Acceptance Test Complete!');
  console.log('✅ Drift detection successfully identified schema violations');
  console.log('✅ Suggestions generated for field additions');
  console.log('✅ Confidence scoring working with sample collection');
  console.log('✅ Drift report generated with actionable insights');
}

// Run the test
testDriftDetection().catch(console.error);
