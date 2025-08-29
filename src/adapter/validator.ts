import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ValidationResult } from '../types/data.js';

/**
 * Schema validator using AJV for soft-fail validation
 */
export class SchemaValidator {
  private ajv: Ajv;
  private schemas: Map<string, any> = new Map();
  private schemaPath: string;

  constructor(datasetRoot: string) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.schemaPath = join(datasetRoot, 'schemas');
  }

  /**
   * Load schema from file system
   */
  async loadSchema(entityType: string): Promise<boolean> {
    try {
      const schemaFile = join(this.schemaPath, `${entityType}.schema.json`);
      const schemaContent = await readFile(schemaFile, 'utf-8');
      const schema = JSON.parse(schemaContent);
      
      this.schemas.set(entityType, schema);
      this.ajv.addSchema(schema, entityType);
      
      console.log(`✅ Loaded schema for ${entityType}`);
      return true;
    } catch (error) {
      console.warn(`⚠️  No schema found for ${entityType}:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Validate a record against its schema (soft-fail)
   */
  validate<T = any>(entityType: string, record: T): ValidationResult {
    const schema = this.schemas.get(entityType);
    
    if (!schema) {
      // No schema available, assume valid
      return { valid: true };
    }

    const valid = this.ajv.validate(entityType, record);
    
    if (!valid) {
      const errors = this.ajv.errors;
      console.warn(`⚠️  Validation failed for ${entityType}:`, {
        record: JSON.stringify(record).substring(0, 100) + '...',
        errors: errors?.map(err => `${err.instancePath} ${err.message}`).join(', ')
      });
      
      return { valid: false, errors: errors || [] };
    }

    return { valid: true };
  }

  /**
   * Validate an array of records, continuing on failures
   */
  validateAll<T = any>(entityType: string, records: T[]): T[] {
    return records.filter(record => {
      const result = this.validate(entityType, record);
      return result.valid; // Only keep valid records
    });
  }

  /**
   * Check if schema exists for entity type
   */
  hasSchema(entityType: string): boolean {
    return this.schemas.has(entityType);
  }

  /**
   * Initialize validator by loading all available schemas
   */
  async initialize(): Promise<void> {
    const entityTypes = [
      'customers',
      'accounts', 
      'products',
      'prices',
      'transactions',
      'transfers',
      'balances',
      'metrics'
    ];

    await Promise.all(
      entityTypes.map(entityType => this.loadSchema(entityType))
    );
  }
}
