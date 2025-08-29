#!/usr/bin/env node

/**
 * Deprecation shim for mcp-fixtures
 * Forwards all commands to mcp-anchor by spawning the process
 */

const { spawn } = require('child_process');
const path = require('path');

console.warn("[deprecation] Use `npx mcp-anchor` instead; forwarding…");

try {
  // Find the mcp-anchor CLI path
  let cliPath;
  try {
    // Try the exports path first
    cliPath = require.resolve("mcp-anchor/dist/cli.js");
  } catch {
    // Fallback: try to find it relative to the main module
    const mainPath = require.resolve("mcp-anchor");
    cliPath = path.join(path.dirname(mainPath), 'cli.js');
  }
  
  // Spawn the mcp-anchor CLI with all arguments
  const args = process.argv.slice(2); // Remove 'node' and script name
  const child = spawn('node', [cliPath, ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  // Forward exit code
  child.on('close', (code) => {
    process.exit(code || 0);
  });
  
  child.on('error', (error) => {
    console.error("\n❌ Failed to spawn mcp-anchor CLI:");
    console.error(error.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error("\n❌ Failed to forward to mcp-anchor:");
  
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error("mcp-anchor package not found. Please install it:");
    console.error("  npm install -g mcp-anchor");
    console.error("  # or");
    console.error("  npx mcp-anchor");
    console.error("\nFor development, ensure mcp-anchor is built:");
    console.error("  cd path/to/mcp-anchor && npm run build");
  } else {
    console.error(error.message);
  }
  
  process.exit(1);
}
