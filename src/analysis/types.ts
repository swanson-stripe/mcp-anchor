/**
 * Types for code analysis and Data Surface Mapping (DSM)
 */

export interface DSMEntry {
  file: string;
  line: number;
  kind: DataSurfaceKind;
  call: string;
  injectable: 'yes' | 'maybe' | 'no';
  reason: string;
  metadata?: Record<string, any>;
}

export type DataSurfaceKind = 
  | 'fetch'
  | 'axios'
  | 'graphql-request'
  | 'apollo-client'
  | 'supabase'
  | 'prisma'
  | 'drizzle'
  | 'react-query'
  | 'swr'
  | 'unknown';

export interface ScanOptions {
  rootPath: string;
  outputPath?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  verbose?: boolean;
}

export interface ScanResult {
  summary: {
    totalFiles: number;
    scannedFiles: number;
    totalEntries: number;
    byKind: Record<DataSurfaceKind, number>;
    byInjectability: Record<'yes' | 'maybe' | 'no', number>;
  };
  entries: DSMEntry[];
  errors: string[];
}
