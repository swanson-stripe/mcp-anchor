/**
 * Types for report generation and analysis
 */
import type { DSMEntry } from '../analysis/types.js';
import type { RuntimeStats, RequestLog } from '../analysis/tracer.js';

export interface CombinedAnalysis {
  static: {
    summary: {
      totalFiles: number;
      scannedFiles: number;
      totalEntries: number;
      byKind: Record<string, number>;
      byInjectability: Record<'yes' | 'maybe' | 'no', number>;
    };
    entries: DSMEntry[];
    errors: string[];
  };
  runtime: {
    summary: {
      totalRequests: number;
      fixtureHits: number;
      fixtureHitRate: string;
      uniqueRoutes: number;
      averageLatency: number;
      drift?: any; // Drift summary data
    };
    stats: RuntimeStats[];
    recentLogs: RequestLog[];
  };
}

export interface ReportOptions {
  format: 'table' | 'markdown' | 'json';
  includeRuntime?: boolean;
  includeStatic?: boolean;
  verbose?: boolean;
  outputFile?: string;
}

export interface FixableIssue {
  file: string;
  line: number;
  type: 'fetch-boundary' | 'missing-error-handling' | 'hardcoded-url';
  description: string;
  suggestion: string;
  autoFixable: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface RecommendationSummary {
  totalIssues: number;
  autoFixable: number;
  manualReview: number;
  byType: Record<string, number>;
  byConfidence: Record<string, number>;
  topRecommendations: string[];
}

export interface ComprehensiveReport {
  analysis: CombinedAnalysis;
  recommendations: RecommendationSummary;
  fixableIssues: FixableIssue[];
  timestamp: string;
  projectRoot: string;
}
