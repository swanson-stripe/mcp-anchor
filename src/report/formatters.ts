/**
 * Report formatters for combining static DSM + runtime tracer data
 */
// @ts-ignore - cli-table3 doesn't have proper types
import Table from 'cli-table3';
import chalk from 'chalk';
import type { 
  CombinedAnalysis, 
  ReportOptions, 
  FixableIssue, 
  RecommendationSummary, 
  ComprehensiveReport 
} from './types.js';
import type { DSMEntry } from '../analysis/types.js';
import type { RuntimeStats } from '../analysis/tracer.js';

export class ReportFormatter {
  
  /**
   * Format comprehensive report based on options
   */
  static format(report: ComprehensiveReport, options: ReportOptions): string {
    switch (options.format) {
      case 'table':
        return this.formatTable(report, options);
      case 'markdown':
        return this.formatMarkdown(report, options);
      case 'json':
        return this.formatJSON(report, options);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Format as table output
   */
  private static formatTable(report: ComprehensiveReport, options: ReportOptions): string {
    const output: string[] = [];
    
    // Header
    output.push(chalk.bold.blue('🔍 Dataset Injector - Analysis Report'));
    output.push(chalk.gray(`Generated: ${report.timestamp}`));
    output.push(chalk.gray(`Project: ${report.projectRoot}`));
    output.push('');

    // Static Analysis Summary
    if (options.includeStatic !== false && report.analysis.static) {
      output.push(chalk.bold.yellow('📊 Static Analysis Summary'));
      
      const staticTable = new Table({
        head: ['Metric', 'Value'],
        colWidths: [25, 15]
      });
      
      staticTable.push(
        ['Files Scanned', `${report.analysis.static.summary.scannedFiles}/${report.analysis.static.summary.totalFiles}`],
        ['Data Surface Calls', report.analysis.static.summary.totalEntries.toString()],
        ['Injectable (Yes)', report.analysis.static.summary.byInjectability.yes.toString()],
        ['Injectable (Maybe)', report.analysis.static.summary.byInjectability.maybe.toString()],
        ['Not Injectable', report.analysis.static.summary.byInjectability.no.toString()]
      );
      
      output.push(staticTable.toString());
      output.push('');

      // Data Surface Breakdown
      const surfaceTable = new Table({
        head: ['Data Surface Type', 'Count', 'Injectable %'],
        colWidths: [20, 8, 15]
      });
      
      Object.entries(report.analysis.static.summary.byKind).forEach(([kind, count]) => {
        if (count > 0) {
          const entries = report.analysis.static.entries.filter(e => e.kind === kind);
          const injectable = entries.filter(e => e.injectable === 'yes').length;
          const percentage = count > 0 ? `${Math.round((injectable / count) * 100)}%` : '0%';
          
          surfaceTable.push([kind, count.toString(), percentage]);
        }
      });
      
      output.push(chalk.bold('🎯 Data Surface Breakdown'));
      output.push(surfaceTable.toString());
      output.push('');
    }

    // Runtime Analysis Summary
    if (options.includeRuntime !== false && report.analysis.runtime) {
      output.push(chalk.bold.green('🚀 Runtime Analysis Summary'));
      
      const runtimeTable = new Table({
        head: ['Metric', 'Value'],
        colWidths: [25, 15]
      });
      
      runtimeTable.push(
        ['Total Requests', report.analysis.runtime.summary.totalRequests.toString()],
        ['Fixture Hits', `${report.analysis.runtime.summary.fixtureHits} (${report.analysis.runtime.summary.fixtureHitRate}%)`],
        ['Unique Routes', report.analysis.runtime.summary.uniqueRoutes.toString()],
        ['Avg Latency', `${report.analysis.runtime.summary.averageLatency}ms`]
      );
      
      output.push(runtimeTable.toString());
      output.push('');

      // Top Routes
      if (report.analysis.runtime.stats.length > 0) {
        const routesTable = new Table({
          head: ['Route', 'Requests', 'Fixture %', 'Avg Latency', 'Status'],
          colWidths: [30, 10, 12, 12, 8]
        });
        
        report.analysis.runtime.stats.slice(0, 10).forEach(stat => {
          const fixtureRate = stat.totalRequests > 0 ? 
            `${Math.round((stat.fixtureHits / stat.totalRequests) * 100)}%` : '0%';
          
          const latency = stat.averageLatency < 1000 ? 
            `${Math.round(stat.averageLatency)}ms` : 
            `${(stat.averageLatency / 1000).toFixed(1)}s`;
          
          const rate = stat.totalRequests > 0 ? (stat.fixtureHits / stat.totalRequests) : 0;
          const status = rate >= 0.8 ? '🟢' : rate >= 0.5 ? '🟡' : rate > 0 ? '🟠' : '🔴';
          
          routesTable.push([
            stat.route.slice(0, 28),
            stat.totalRequests.toString(),
            fixtureRate,
            latency,
            status
          ]);
        });
        
        output.push(chalk.bold('📈 Top Active Routes'));
        output.push(routesTable.toString());
        output.push('');
      }
    }

    // Recommendations Summary
    output.push(chalk.bold.magenta('💡 Recommendations Summary'));
    
    const recTable = new Table({
      head: ['Category', 'Count'],
      colWidths: [25, 10]
    });
    
    recTable.push(
      ['Total Issues Found', report.recommendations.totalIssues.toString()],
      ['Auto-fixable', chalk.green(report.recommendations.autoFixable.toString())],
      ['Manual Review', chalk.yellow(report.recommendations.manualReview.toString())]
    );
    
    output.push(recTable.toString());
    output.push('');

    // Top Recommendations
    if (report.recommendations.topRecommendations.length > 0) {
      output.push(chalk.bold('🎯 Top Recommendations'));
      report.recommendations.topRecommendations.forEach((rec, i) => {
        output.push(`${i + 1}. ${rec}`);
      });
      output.push('');
    }

    // Fixable Issues (if verbose)
    if (options.verbose && report.fixableIssues.length > 0) {
      output.push(chalk.bold.red('🔧 Fixable Issues'));
      
      const issuesTable = new Table({
        head: ['File', 'Line', 'Type', 'Confidence', 'Auto-fix'],
        colWidths: [30, 6, 15, 12, 10]
      });
      
      report.fixableIssues.slice(0, 20).forEach(issue => {
        const confidence = issue.confidence === 'high' ? chalk.green('High') :
                          issue.confidence === 'medium' ? chalk.yellow('Medium') :
                          chalk.red('Low');
        
        const autoFix = issue.autoFixable ? chalk.green('Yes') : chalk.red('No');
        
        issuesTable.push([
          issue.file.slice(-28),
          issue.line.toString(),
          issue.type,
          confidence,
          autoFix
        ]);
      });
      
      output.push(issuesTable.toString());
      
      if (report.fixableIssues.length > 20) {
        output.push(chalk.gray(`... and ${report.fixableIssues.length - 20} more issues`));
      }
      output.push('');
    }

    // Footer
    output.push(chalk.bold('🚀 Next Steps'));
    output.push('• Run with --verbose to see detailed fixable issues');
    output.push('• Use `mcp-fixtures patch --fix fetch-boundary` to auto-fix fetch patterns');
    output.push('• Review manual issues for custom optimization opportunities');
    
    return output.join('\n');
  }

  /**
   * Format as markdown
   */
  private static formatMarkdown(report: ComprehensiveReport, options: ReportOptions): string {
    const output: string[] = [];
    
    // Header
    output.push('# 🔍 Dataset Injector - Analysis Report');
    output.push('');
    output.push(`**Generated:** ${report.timestamp}`);
    output.push(`**Project:** ${report.projectRoot}`);
    output.push('');

    // Static Analysis
    if (options.includeStatic !== false && report.analysis.static) {
      output.push('## 📊 Static Analysis Summary');
      output.push('');
      output.push('| Metric | Value |');
      output.push('|--------|-------|');
      output.push(`| Files Scanned | ${report.analysis.static.summary.scannedFiles}/${report.analysis.static.summary.totalFiles} |`);
      output.push(`| Data Surface Calls | ${report.analysis.static.summary.totalEntries} |`);
      output.push(`| Injectable (Yes) | ${report.analysis.static.summary.byInjectability.yes} |`);
      output.push(`| Injectable (Maybe) | ${report.analysis.static.summary.byInjectability.maybe} |`);
      output.push(`| Not Injectable | ${report.analysis.static.summary.byInjectability.no} |`);
      output.push('');

      // Data Surface Breakdown
      output.push('### 🎯 Data Surface Breakdown');
      output.push('');
      output.push('| Type | Count | Injectable % |');
      output.push('|------|-------|-------------|');
      
      Object.entries(report.analysis.static.summary.byKind).forEach(([kind, count]) => {
        if (count > 0) {
          const entries = report.analysis.static.entries.filter(e => e.kind === kind);
          const injectable = entries.filter(e => e.injectable === 'yes').length;
          const percentage = count > 0 ? `${Math.round((injectable / count) * 100)}%` : '0%';
          
          output.push(`| ${kind} | ${count} | ${percentage} |`);
        }
      });
      output.push('');
    }

    // Runtime Analysis
    if (options.includeRuntime !== false && report.analysis.runtime) {
      output.push('## 🚀 Runtime Analysis Summary');
      output.push('');
      output.push('| Metric | Value |');
      output.push('|--------|-------|');
      output.push(`| Total Requests | ${report.analysis.runtime.summary.totalRequests} |`);
      output.push(`| Fixture Hits | ${report.analysis.runtime.summary.fixtureHits} (${report.analysis.runtime.summary.fixtureHitRate}%) |`);
      output.push(`| Unique Routes | ${report.analysis.runtime.summary.uniqueRoutes} |`);
      output.push(`| Avg Latency | ${report.analysis.runtime.summary.averageLatency}ms |`);
      output.push('');

      if (report.analysis.runtime.stats.length > 0) {
        output.push('### 📈 Top Active Routes');
        output.push('');
        output.push('| Route | Requests | Fixture % | Avg Latency | Status |');
        output.push('|-------|----------|-----------|-------------|--------|');
        
        report.analysis.runtime.stats.slice(0, 10).forEach(stat => {
          const fixtureRate = stat.totalRequests > 0 ? 
            `${Math.round((stat.fixtureHits / stat.totalRequests) * 100)}%` : '0%';
          
          const latency = stat.averageLatency < 1000 ? 
            `${Math.round(stat.averageLatency)}ms` : 
            `${(stat.averageLatency / 1000).toFixed(1)}s`;
          
          const rate = stat.totalRequests > 0 ? (stat.fixtureHits / stat.totalRequests) : 0;
          const status = rate >= 0.8 ? '🟢' : rate >= 0.5 ? '🟡' : rate > 0 ? '🟠' : '🔴';
          
          output.push(`| ${stat.route} | ${stat.totalRequests} | ${fixtureRate} | ${latency} | ${status} |`);
        });
        output.push('');
      }
    }

    // Recommendations
    output.push('## 💡 Recommendations Summary');
    output.push('');
    output.push('| Category | Count |');
    output.push('|----------|-------|');
    output.push(`| Total Issues Found | ${report.recommendations.totalIssues} |`);
    output.push(`| Auto-fixable | ${report.recommendations.autoFixable} |`);
    output.push(`| Manual Review | ${report.recommendations.manualReview} |`);
    output.push('');

    if (report.recommendations.topRecommendations.length > 0) {
      output.push('### 🎯 Top Recommendations');
      output.push('');
      report.recommendations.topRecommendations.forEach((rec, i) => {
        output.push(`${i + 1}. ${rec}`);
      });
      output.push('');
    }

    // Fixable Issues
    if (options.verbose && report.fixableIssues.length > 0) {
      output.push('## 🔧 Fixable Issues');
      output.push('');
      output.push('| File | Line | Type | Confidence | Auto-fix | Description |');
      output.push('|------|------|------|------------|----------|-------------|');
      
      report.fixableIssues.slice(0, 20).forEach(issue => {
        const autoFix = issue.autoFixable ? '✅' : '❌';
        output.push(`| ${issue.file} | ${issue.line} | ${issue.type} | ${issue.confidence} | ${autoFix} | ${issue.description} |`);
      });
      
      if (report.fixableIssues.length > 20) {
        output.push(`\n_... and ${report.fixableIssues.length - 20} more issues_`);
      }
      output.push('');
    }

    // Footer
    output.push('## 🚀 Next Steps');
    output.push('');
    output.push('- Run with `--verbose` to see detailed fixable issues');
    output.push('- Use `mcp-fixtures patch --fix fetch-boundary` to auto-fix fetch patterns');
    output.push('- Review manual issues for custom optimization opportunities');
    
    return output.join('\n');
  }

  /**
   * Format as JSON
   */
  private static formatJSON(report: ComprehensiveReport, options: ReportOptions): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate recommendations based on analysis
   */
  static generateRecommendations(
    staticEntries: DSMEntry[], 
    runtimeStats: RuntimeStats[]
  ): { recommendations: RecommendationSummary; fixableIssues: FixableIssue[] } {
    const fixableIssues: FixableIssue[] = [];
    const recommendations: string[] = [];

    // Analyze static entries for fetch boundary issues
    const directFetches = staticEntries.filter(entry => 
      entry.kind === 'fetch' && 
      entry.injectable !== 'no' &&
      !entry.call.includes('apiClient') &&
      !entry.call.includes('client.fetch')
    );

    directFetches.forEach(entry => {
      fixableIssues.push({
        file: entry.file,
        line: entry.line,
        type: 'fetch-boundary',
        description: 'Direct fetch call could be moved to API boundary layer',
        suggestion: 'Replace with apiClient.fetch() for better testability and fixture injection',
        autoFixable: true,
        confidence: entry.injectable === 'yes' ? 'high' : 'medium'
      });
    });

    // Runtime analysis recommendations
    const lowFixtureRoutes = runtimeStats.filter(stat => 
      stat.totalRequests > 5 && 
      (stat.fixtureHits / stat.totalRequests) < 0.5
    );

    if (lowFixtureRoutes.length > 0) {
      recommendations.push(`${lowFixtureRoutes.length} active routes have low fixture coverage - consider adding fixture mappings`);
    }

    if (directFetches.length > 0) {
      recommendations.push(`${directFetches.length} direct fetch calls could be centralized in API boundary layer`);
    }

    const highLatencyRoutes = runtimeStats.filter(stat => stat.averageLatency > 1000);
    if (highLatencyRoutes.length > 0) {
      recommendations.push(`${highLatencyRoutes.length} routes have high latency (>1s) - fixtures could improve development speed`);
    }

    if (staticEntries.filter(e => e.injectable === 'maybe').length > 0) {
      recommendations.push('Several "maybe" injectable calls need manual review for fixture compatibility');
    }

    // Summary
    const summary: RecommendationSummary = {
      totalIssues: fixableIssues.length,
      autoFixable: fixableIssues.filter(i => i.autoFixable).length,
      manualReview: fixableIssues.filter(i => !i.autoFixable).length,
      byType: fixableIssues.reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byConfidence: fixableIssues.reduce((acc, issue) => {
        acc[issue.confidence] = (acc[issue.confidence] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      topRecommendations: recommendations.slice(0, 5)
    };

    return { recommendations: summary, fixableIssues };
  }
}
