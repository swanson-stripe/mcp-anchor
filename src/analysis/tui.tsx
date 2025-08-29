/**
 * TUI interface for displaying runtime request statistics
 */
// @ts-ignore - cli-table3 doesn't have proper types
import Table from 'cli-table3';
import { RuntimeTracer, type RuntimeStats } from './tracer.js';

/**
 * Start the TUI with given tracer (simplified non-React version)
 */
export function startTUI(tracer: RuntimeTracer, options: { refreshInterval?: number } = {}): void {
  console.log('🖥️  Starting TUI interface...');
  console.log('💡 TUI disabled - using simple table mode instead');
  
  // Fall back to simple table mode
  const showStats = () => {
    const stats = tracer.getStats();
    const summary = tracer.getSummary();
    
    console.clear();
    console.log('🔍 Dataset Injector - Runtime Request Tracer\n');
    console.log(`📊 Total: ${summary.totalRequests} requests | 🎯 Fixtures: ${summary.fixtureHits} (${summary.fixtureHitRate}%) | ⚡ Avg: ${summary.averageLatency}ms\n`);
    
    if (stats.length > 0) {
      console.log(createSimpleTable(stats));
    } else {
      console.log('No requests captured yet...');
    }
    
    console.log('\n💡 Make some curl requests to http://localhost:4000/api/* to see data');
    console.log('🔄 Auto-refreshing every 5 seconds... (Ctrl+C to quit)');
  };
  
  showStats();
  const interval = setInterval(showStats, options.refreshInterval || 5000);
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n👋 Shutting down TUI...');
    process.exit(0);
  });
}

/**
 * Create a simple CLI table (fallback when React/Ink isn't working)
 */
export function createSimpleTable(stats: RuntimeStats[]): string {
  const table = new Table({
    head: ['Route', 'Requests', 'Fixture %', 'Avg Latency', 'Status'],
    colWidths: [35, 10, 12, 12, 8],
    style: {
      head: ['cyan', 'bold'],
      border: ['gray']
    }
  });

  stats.slice(0, 10).forEach(stat => {
    const fixtureRate = stat.totalRequests > 0 ? 
      `${((stat.fixtureHits / stat.totalRequests) * 100).toFixed(1)}%` : '0.0%';
    
    const latency = stat.averageLatency < 1000 ? 
      `${Math.round(stat.averageLatency)}ms` : 
      `${(stat.averageLatency / 1000).toFixed(1)}s`;

    const rate = stat.totalRequests > 0 ? (stat.fixtureHits / stat.totalRequests) : 0;
    const status = rate >= 0.8 ? '🟢' : rate >= 0.5 ? '🟡' : rate > 0 ? '🟠' : '🔴';

    table.push([
      stat.route.slice(0, 32),
      stat.totalRequests.toString(),
      fixtureRate,
      latency,
      status
    ]);
  });

  return table.toString();
}
