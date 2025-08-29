#!/usr/bin/env node

/**
 * Test script for the mcp-fixtures shim package
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Testing mcp-fixtures shim package\n');

try {
  // Test the shim binary
  console.log('1. Testing shim binary directly:');
  const result = execSync('node bin.js --help', { 
    encoding: 'utf8',
    cwd: __dirname
  });
  
  console.log('✅ Shim forwards to mcp-anchor successfully');
  console.log('First few lines of output:');
  console.log(result.split('\n').slice(0, 5).join('\n'));
  
} catch (error) {
  console.error('❌ Shim test failed:');
  console.error(error.message);
  process.exit(1);
}

console.log('\n🎉 Shim package test completed successfully');
console.log('💡 Users can now run: npx mcp-fixtures (after publishing)');
