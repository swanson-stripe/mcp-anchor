/**
 * Main entry point for mcp-anchor package
 * Exports core functionality for programmatic usage
 */

// Core data adapter and server
export * from './adapter/index.js';
export * from './server/http.js';

// Interceptors for fetch and database clients
export * from './interceptors/fetch.js';
export * from './interceptors/supabase.js';

// Scenario engine and transforms
export * from './scenario/engine.js';
export * from './scenario/transforms.js';

// Analytics and metrics
export * from './metrics/derive.js';

// Analysis tools
export * from './analysis/scanner.js';
export * from './analysis/tracer.js';

// Performance utilities
export * from './performance/cache.js';
export * from './performance/timeout.js';
export * from './performance/manager.js';

// Contract drift detection
export * from './contracts/drift.js';

// MCP server
export * from './mcp/server.js';

// Types
export * from './types/index.js';

// Version info
export const VERSION = '0.1.0';
export const PACKAGE_NAME = 'mcp-anchor';
