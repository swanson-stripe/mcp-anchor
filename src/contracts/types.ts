/**
 * Types for data contract drift detection
 */
export interface DriftDetectionResult {
  objectName: string;
  isValid: boolean;
  drift: {
    missingFields: FieldDrift[];
    extraFields: FieldDrift[];
    typeChanges: TypeDrift[];
  };
  suggestions: SchemaSuggestion[];
  payload: any;
  timestamp: number;
}

export interface FieldDrift {
  path: string;
  expectedType?: string;
  actualType?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface TypeDrift {
  path: string;
  expectedType: string;
  actualType: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SchemaSuggestion {
  action: 'add_field' | 'update_type' | 'make_optional' | 'add_validation';
  path: string;
  suggestedSchema: any;
  reasoning: string;
  confidence: number; // 0-1
  sampleDistribution?: FieldDistribution;
}

export interface FieldDistribution {
  type: string;
  sampleValues: any[];
  nullable: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  format?: string;
}

export interface DriftSummary {
  totalPayloads: number;
  validPayloads: number;
  driftingPayloads: number;
  driftRate: number;
  topDriftPaths: Array<{
    path: string;
    count: number;
    severity: string;
    lastSeen: number;
  }>;
  suggestions: SchemaSuggestion[];
}

export interface DriftConfig {
  enableDetection: boolean;
  schemaBasePath?: string;
  maxSamples: number;
  confidenceThreshold: number;
  severityThresholds: {
    missingRequired: 'high';
    extraField: 'low' | 'medium';
    typeChange: 'medium' | 'high';
  };
}
