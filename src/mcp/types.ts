/**
 * MCP tool types and interfaces
 */
export interface ScanCodebaseArgs {
  root: string;
}

export interface ScanCodebaseResult {
  summary: {
    totalFiles: number;
    scannedFiles: number;
    totalEntries: number;
    byKind: Record<string, number>;
    byInjectability: Record<'yes' | 'maybe' | 'no', number>;
  };
  entries: Array<{
    file: string;
    line: number;
    kind: string;
    call: string;
    injectable: 'yes' | 'maybe' | 'no';
    reason: string;
  }>;
  errors: string[];
}

export interface StartFixtureServerArgs {
  datasetRoot?: string;
  scenario?: string;
  port?: number;
}

export interface StartFixtureServerResult {
  url: string;
  port: number;
  scenario: string;
  datasetRoot: string;
  status: 'started' | 'already_running';
}

export interface InjectDatasetArgs {
  mapPath?: string;
  scenario?: string;
}

export interface InjectDatasetResult {
  ok: boolean;
  message: string;
  mapPath: string;
  scenario: string;
  injectionEnabled: boolean;
}

export interface ReportInjectabilityArgs {
  format?: 'table' | 'markdown' | 'json';
  verbose?: boolean;
  includeRuntime?: boolean;
  includeStatic?: boolean;
}

export interface ReportInjectabilityResult {
  report: string;
  format: string;
  timestamp: string;
  summary: {
    totalIssues: number;
    autoFixable: number;
    manualReview: number;
  };
}
