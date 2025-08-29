/**
 * Data contract drift detection and schema suggestion engine
 */
import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import type {
  DriftDetectionResult,
  FieldDrift,
  TypeDrift,
  SchemaSuggestion,
  FieldDistribution,
  DriftSummary,
  DriftConfig
} from './types.js';

export class DataContractDriftDetector {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private driftHistory: DriftDetectionResult[] = [];
  private fieldSamples: Map<string, any[]> = new Map();
  private config: DriftConfig;

  constructor(config: Partial<DriftConfig> = {}) {
    this.config = {
      enableDetection: true,
      schemaBasePath: '../synthetic-dataset/datasets/core/v1/schemas',
      maxSamples: 100,
      confidenceThreshold: 0.7,
      severityThresholds: {
        missingRequired: 'high',
        extraField: 'low',
        typeChange: 'medium',
      },
      ...config
    };

    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false // Allow additional properties for drift detection
    });
    addFormats(this.ajv);
    
    this.loadSchemas();
  }

  /**
   * Load JSON schemas for validation
   */
  private loadSchemas() {
    if (!this.config.schemaBasePath || !existsSync(this.config.schemaBasePath)) {
      console.warn('⚠️  Schema directory not found, using minimal embedded schemas');
      this.loadEmbeddedSchemas();
      return;
    }

    const schemaFiles = [
      'customers.schema.json',
      'transactions.schema.json',
      'products.schema.json',
      'metrics.schema.json',
      'balances.schema.json',
      'transfers.schema.json'
    ];

    schemaFiles.forEach(schemaFile => {
      try {
        const schemaPath = join(this.config.schemaBasePath!, schemaFile);
        if (existsSync(schemaPath)) {
          const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
          const objectName = schemaFile.replace('.schema.json', '');
          const validator = this.ajv.compile(schema);
          this.validators.set(objectName, validator);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load schema ${schemaFile}:`, error);
      }
    });
  }

  /**
   * Load minimal embedded schemas for basic drift detection
   */
  private loadEmbeddedSchemas() {
    const embeddedSchemas = {
      customers: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: { type: 'string', pattern: '^cus_' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          created: { type: 'number' },
          metadata: { type: 'object' }
        },
        additionalProperties: false
      },
      transactions: {
        type: 'object',
        required: ['id', 'amount', 'currency', 'status'],
        properties: {
          id: { type: 'string', pattern: '^py_' },
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          status: { type: 'string', enum: ['succeeded', 'pending', 'failed'] },
          created: { type: 'number' },
          customer: { type: 'string' },
          description: { type: 'string' },
          metadata: { type: 'object' }
        },
        additionalProperties: false
      },
      metrics: {
        type: 'object',
        required: ['date', 'gross_revenue'],
        properties: {
          date: { type: 'string', format: 'date' },
          gross_revenue: { type: 'number' },
          net_revenue: { type: 'number' },
          auth_rate: { type: 'number', minimum: 0, maximum: 1 },
          settle_rate: { type: 'number', minimum: 0, maximum: 1 },
          refund_rate: { type: 'number', minimum: 0, maximum: 1 },
          dispute_rate: { type: 'number', minimum: 0, maximum: 1 },
          new_customers: { type: 'number', minimum: 0 },
          returning_customers: { type: 'number', minimum: 0 }
        },
        additionalProperties: false
      }
    };

    Object.entries(embeddedSchemas).forEach(([objectName, schema]) => {
      const validator = this.ajv.compile(schema);
      this.validators.set(objectName, validator);
    });
  }

  /**
   * Detect drift in a runtime payload
   */
  async detectDrift(objectName: string, payload: any): Promise<DriftDetectionResult> {
    if (!this.config.enableDetection) {
      return this.createNoDriftResult(objectName, payload);
    }

    const validator = this.validators.get(objectName);
    if (!validator) {
      return this.createUnknownSchemaResult(objectName, payload);
    }

    const isValid = validator(payload);
    const errors = validator.errors || [];

    // Collect field samples for distribution analysis
    this.collectFieldSamples(objectName, payload);

    // Analyze drift
    const drift = this.analyzeDrift(objectName, payload, errors);
    const suggestions = this.generateSuggestions(objectName, drift, payload);

    const result: DriftDetectionResult = {
      objectName,
      isValid,
      drift,
      suggestions,
      payload,
      timestamp: Date.now()
    };

    // Store in history
    this.driftHistory.push(result);
    
    // Keep history manageable
    if (this.driftHistory.length > 1000) {
      this.driftHistory = this.driftHistory.slice(-500);
    }

    return result;
  }

  /**
   * Analyze validation errors to identify drift patterns
   */
  private analyzeDrift(objectName: string, payload: any, errors: ErrorObject[]): {
    missingFields: FieldDrift[];
    extraFields: FieldDrift[];
    typeChanges: TypeDrift[];
  } {
    const missingFields: FieldDrift[] = [];
    const extraFields: FieldDrift[] = [];
    const typeChanges: TypeDrift[] = [];

    errors.forEach(error => {
      const path = error.instancePath || error.schemaPath;
      
      switch (error.keyword) {
        case 'required':
          const missingField = error.params?.missingProperty;
          if (missingField) {
            missingFields.push({
              path: `${path}/${missingField}`,
              description: `Required field '${missingField}' is missing`,
              severity: 'high'
            });
          }
          break;
          
        case 'additionalProperties':
          const extraProp = error.params?.additionalProperty;
          if (extraProp) {
            const actualValue = this.getValueAtPath(payload, `${path}/${extraProp}`);
            extraFields.push({
              path: `${path}/${extraProp}`,
              actualType: this.getValueType(actualValue),
              description: `Extra field '${extraProp}' not in schema`,
              severity: 'low'
            });
          }
          break;
          
        case 'type':
          const expectedType = error.schema;
          const actualValue = this.getValueAtPath(payload, path);
          typeChanges.push({
            path,
            expectedType: String(expectedType),
            actualType: this.getValueType(actualValue),
            description: `Type mismatch: expected ${expectedType}, got ${this.getValueType(actualValue)}`,
            severity: 'medium'
          });
          break;
      }
    });

    return { missingFields, extraFields, typeChanges };
  }

  /**
   * Generate schema suggestions based on drift analysis
   */
  private generateSuggestions(
    objectName: string, 
    drift: any, 
    payload: any
  ): SchemaSuggestion[] {
    const suggestions: SchemaSuggestion[] = [];

    // Suggest adding extra fields to schema
    drift.extraFields.forEach((field: FieldDrift) => {
      const sampleKey = `${objectName}:${field.path}`;
      const samples = this.fieldSamples.get(sampleKey) || [];
      const distribution = this.analyzeFieldDistribution(samples);
      
      suggestions.push({
        action: 'add_field',
        path: field.path,
        suggestedSchema: this.generateFieldSchema(distribution),
        reasoning: `Field '${field.path}' appears in ${samples.length} samples. Consider adding to schema.`,
        confidence: Math.min(samples.length / 10, 1), // Higher confidence with more samples
        sampleDistribution: distribution
      });
    });

    // Suggest making required fields optional if often missing
    drift.missingFields.forEach((field: FieldDrift) => {
      const missCount = this.getMissingFieldCount(objectName, field.path);
      const totalCount = this.getTotalPayloadCount(objectName);
      const missRate = totalCount > 0 ? missCount / totalCount : 0;
      
      if (missRate > 0.2) { // Missing in >20% of payloads
        suggestions.push({
          action: 'make_optional',
          path: field.path,
          suggestedSchema: { required: false },
          reasoning: `Field '${field.path}' is missing in ${(missRate * 100).toFixed(1)}% of payloads. Consider making optional.`,
          confidence: missRate
        });
      }
    });

    // Suggest type updates for consistent type changes
    drift.typeChanges.forEach((change: TypeDrift) => {
      const typeConsistency = this.getTypeConsistency(objectName, change.path, change.actualType);
      
      if (typeConsistency > this.config.confidenceThreshold) {
        suggestions.push({
          action: 'update_type',
          path: change.path,
          suggestedSchema: { type: change.actualType },
          reasoning: `Field '${change.path}' consistently appears as ${change.actualType} (${(typeConsistency * 100).toFixed(1)}% of samples)`,
          confidence: typeConsistency
        });
      }
    });

    return suggestions.filter(s => s.confidence >= this.config.confidenceThreshold);
  }

  /**
   * Analyze field distribution for schema generation
   */
  private analyzeFieldDistribution(samples: any[]): FieldDistribution {
    if (samples.length === 0) {
      return {
        type: 'unknown',
        sampleValues: [],
        nullable: false
      };
    }

    const nonNullSamples = samples.filter(s => s !== null && s !== undefined);
    const nullable = nonNullSamples.length < samples.length;
    
    if (nonNullSamples.length === 0) {
      return { type: 'null', sampleValues: [], nullable: true };
    }

    const firstType = this.getValueType(nonNullSamples[0]);
    const isConsistentType = nonNullSamples.every(s => this.getValueType(s) === firstType);
    
    const distribution: FieldDistribution = {
      type: isConsistentType ? firstType : 'mixed',
      sampleValues: samples.slice(0, 10), // Keep first 10 samples
      nullable
    };

    // Add type-specific analysis
    if (firstType === 'string' && isConsistentType) {
      const lengths = nonNullSamples.map(s => String(s).length);
      distribution.minLength = Math.min(...lengths);
      distribution.maxLength = Math.max(...lengths);
      
      // Detect potential formats
      if (nonNullSamples.every(s => /^\d{4}-\d{2}-\d{2}$/.test(s))) {
        distribution.format = 'date';
      } else if (nonNullSamples.every(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) {
        distribution.format = 'email';
      }
    } else if (firstType === 'number' && isConsistentType) {
      distribution.min = Math.min(...nonNullSamples);
      distribution.max = Math.max(...nonNullSamples);
    }

    return distribution;
  }

  /**
   * Generate JSON schema for a field based on its distribution
   */
  private generateFieldSchema(distribution: FieldDistribution): any {
    const schema: any = {
      type: distribution.type === 'mixed' ? ['string', 'number', 'boolean'] : distribution.type
    };

    if (distribution.nullable) {
      schema.type = Array.isArray(schema.type) ? 
        [...schema.type, 'null'] : 
        [schema.type, 'null'];
    }

    if (distribution.type === 'string') {
      if (distribution.minLength !== undefined) {
        schema.minLength = distribution.minLength;
      }
      if (distribution.maxLength !== undefined) {
        schema.maxLength = distribution.maxLength;
      }
      if (distribution.format) {
        schema.format = distribution.format;
      }
    }

    if (distribution.type === 'number') {
      if (distribution.min !== undefined) {
        schema.minimum = distribution.min;
      }
      if (distribution.max !== undefined) {
        schema.maximum = distribution.max;
      }
    }

    return schema;
  }

  /**
   * Collect field samples for distribution analysis
   */
  private collectFieldSamples(objectName: string, payload: any) {
    this.collectSamplesRecursive(objectName, '', payload);
  }

  private collectSamplesRecursive(objectName: string, basePath: string, obj: any) {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj).forEach(([key, value]) => {
        const fullPath = basePath ? `${basePath}/${key}` : key;
        const sampleKey = `${objectName}:${fullPath}`;
        
        // Collect sample for this field
        let samples = this.fieldSamples.get(sampleKey) || [];
        samples.push(value);
        
        // Keep samples manageable
        if (samples.length > this.config.maxSamples) {
          samples = samples.slice(-this.config.maxSamples);
        }
        
        this.fieldSamples.set(sampleKey, samples);
        
        // Recurse into objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          this.collectSamplesRecursive(objectName, fullPath, value);
        }
      });
    }
  }

  /**
   * Get drift summary for reporting
   */
  getDriftSummary(): DriftSummary {
    const totalPayloads = this.driftHistory.length;
    const validPayloads = this.driftHistory.filter(r => r.isValid).length;
    const driftingPayloads = totalPayloads - validPayloads;
    const driftRate = totalPayloads > 0 ? driftingPayloads / totalPayloads : 0;

    // Aggregate drift paths
    const driftPaths: Map<string, { count: number; severity: string; lastSeen: number }> = new Map();
    
    this.driftHistory.forEach(result => {
      [...result.drift.missingFields, ...result.drift.extraFields, ...result.drift.typeChanges]
        .forEach(drift => {
          const existing = driftPaths.get(drift.path) || { count: 0, severity: 'low', lastSeen: 0 };
          existing.count++;
          existing.lastSeen = Math.max(existing.lastSeen, result.timestamp);
          existing.severity = this.maxSeverity(existing.severity, drift.severity);
          driftPaths.set(drift.path, existing);
        });
    });

    // Get top drift paths
    const topDriftPaths = Array.from(driftPaths.entries())
      .map(([path, data]) => ({ path, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Aggregate suggestions
    const allSuggestions = this.driftHistory.flatMap(r => r.suggestions);
    const suggestionMap = new Map<string, SchemaSuggestion>();
    
    allSuggestions.forEach(suggestion => {
      const key = `${suggestion.action}:${suggestion.path}`;
      const existing = suggestionMap.get(key);
      if (!existing || suggestion.confidence > existing.confidence) {
        suggestionMap.set(key, suggestion);
      }
    });

    return {
      totalPayloads,
      validPayloads,
      driftingPayloads,
      driftRate,
      topDriftPaths,
      suggestions: Array.from(suggestionMap.values())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 20)
    };
  }

  /**
   * Save drift history to file
   */
  saveDriftHistory(filePath: string = './drift.json') {
    const summary = this.getDriftSummary();
    const output = {
      summary,
      timestamp: new Date().toISOString(),
      recentDrift: this.driftHistory.slice(-50), // Last 50 drift detections
      config: this.config
    };
    
    writeFileSync(filePath, JSON.stringify(output, null, 2));
  }

  // Helper methods
  private createNoDriftResult(objectName: string, payload: any): DriftDetectionResult {
    return {
      objectName,
      isValid: true,
      drift: { missingFields: [], extraFields: [], typeChanges: [] },
      suggestions: [],
      payload,
      timestamp: Date.now()
    };
  }

  private createUnknownSchemaResult(objectName: string, payload: any): DriftDetectionResult {
    return {
      objectName,
      isValid: false,
      drift: { 
        missingFields: [],
        extraFields: [],
        typeChanges: [{
          path: '',
          expectedType: 'unknown',
          actualType: this.getValueType(payload),
          description: `No schema found for object type '${objectName}'`,
          severity: 'low'
        }]
      },
      suggestions: [{
        action: 'add_field',
        path: '',
        suggestedSchema: { type: 'object', description: `Schema for ${objectName}` },
        reasoning: `No existing schema found for '${objectName}'. Consider creating one.`,
        confidence: 0.5
      }],
      payload,
      timestamp: Date.now()
    };
  }

  private getValueAtPath(obj: any, path: string): any {
    if (!path) return obj;
    return path.split('/').filter(Boolean).reduce((current, key) => current?.[key], obj);
  }

  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private getMissingFieldCount(objectName: string, path: string): number {
    return this.driftHistory
      .filter(r => r.objectName === objectName)
      .filter(r => r.drift.missingFields.some(f => f.path === path))
      .length;
  }

  private getTotalPayloadCount(objectName: string): number {
    return this.driftHistory.filter(r => r.objectName === objectName).length;
  }

  private getTypeConsistency(objectName: string, path: string, expectedType: string): number {
    const relevantResults = this.driftHistory
      .filter(r => r.objectName === objectName)
      .filter(r => this.getValueAtPath(r.payload, path) !== undefined);
    
    if (relevantResults.length === 0) return 0;
    
    const matchingType = relevantResults
      .filter(r => this.getValueType(this.getValueAtPath(r.payload, path)) === expectedType)
      .length;
    
    return matchingType / relevantResults.length;
  }

  private maxSeverity(a: string, b: string): string {
    const order = { low: 0, medium: 1, high: 2 };
    return order[a as keyof typeof order] >= order[b as keyof typeof order] ? a : b;
  }
}
