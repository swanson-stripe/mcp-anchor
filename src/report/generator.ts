/**
 * Report generator that combines static analysis with runtime data
 */
import { existsSync } from 'fs';
import { CodeScanner } from '../analysis/scanner.js';
import { runtimeTracer } from '../analysis/tracer.js';
import { ReportFormatter } from './formatters.js';
import type { CombinedAnalysis, ReportOptions, ComprehensiveReport } from './types.js';

export class ReportGenerator {
  
  /**
   * Generate comprehensive report combining static and runtime analysis
   */
  static async generate(options: {
    projectRoot?: string;
    includeRuntime?: boolean;
    includeStatic?: boolean;
    runtimeLogsPath?: string;
  }): Promise<CombinedAnalysis> {
    const projectRoot = options.projectRoot || '.';
    const analysis: CombinedAnalysis = {
      static: {
        summary: {
          totalFiles: 0,
          scannedFiles: 0,
          totalEntries: 0,
          byKind: {},
          byInjectability: { yes: 0, maybe: 0, no: 0 }
        },
        entries: [],
        errors: []
      },
      runtime: {
        summary: {
          totalRequests: 0,
          fixtureHits: 0,
          fixtureHitRate: '0.0',
          uniqueRoutes: 0,
          averageLatency: 0
        },
        stats: [],
        recentLogs: []
      }
    };

    // Static analysis
    if (options.includeStatic !== false) {
      try {
        console.log('🔍 Running static analysis...');
        const scanner = new CodeScanner({
          rootPath: projectRoot,
          verbose: false
        });
        
        const staticResult = await scanner.scan();
        analysis.static = staticResult;
        
        console.log(`✅ Static analysis complete: ${staticResult.summary.totalEntries} data surface calls found`);
      } catch (error) {
        console.warn('⚠️  Static analysis failed:', error);
        analysis.static.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // Runtime analysis
    if (options.includeRuntime !== false) {
      try {
        console.log('📊 Collecting runtime data...');
        
        // Use provided logs path or default
        const logsPath = options.runtimeLogsPath || './dsm-runtime.json';
        
        if (existsSync(logsPath)) {
          // Load existing runtime data
          const stats = runtimeTracer.getStats();
          const summary = runtimeTracer.getSummary();
          const recentLogs = runtimeTracer.getRecentLogs(50);
          const drift = runtimeTracer.getDriftSummary();
          
          analysis.runtime = {
            summary: { ...summary, drift },
            stats,
            recentLogs
          };
          
          console.log(`✅ Runtime analysis complete: ${summary.totalRequests} requests analyzed`);
        } else {
          console.log('ℹ️  No runtime logs found, runtime analysis skipped');
        }
      } catch (error) {
        console.warn('⚠️  Runtime analysis failed:', error);
      }
    }

    return analysis;
  }

  /**
   * Generate and format comprehensive report
   */
  static async generateReport(reportOptions: ReportOptions & {
    projectRoot?: string;
    runtimeLogsPath?: string;
  }): Promise<ComprehensiveReport> {
    
    // Generate combined analysis
    const analysis = await this.generate({
      projectRoot: reportOptions.projectRoot,
      includeRuntime: reportOptions.includeRuntime,
      includeStatic: reportOptions.includeStatic,
      runtimeLogsPath: reportOptions.runtimeLogsPath
    });

    // Generate recommendations
    const { recommendations, fixableIssues } = ReportFormatter.generateRecommendations(
      analysis.static.entries,
      analysis.runtime.stats
    );

    // Create comprehensive report
    const report: ComprehensiveReport = {
      analysis,
      recommendations,
      fixableIssues,
      timestamp: new Date().toISOString(),
      projectRoot: reportOptions.projectRoot || process.cwd()
    };

    return report;
  }

  /**
   * Generate and format report as string
   */
  static async generateFormattedReport(reportOptions: ReportOptions & {
    projectRoot?: string;
    runtimeLogsPath?: string;
  }): Promise<string> {
    
    const report = await this.generateReport(reportOptions);
    return ReportFormatter.format(report, reportOptions);
  }
}
