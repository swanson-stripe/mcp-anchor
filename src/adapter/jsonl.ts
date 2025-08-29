import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { access, constants } from 'fs/promises';

/**
 * Stream and parse large JSONL files efficiently
 */
export class JSONLReader {
  constructor(private filePath: string) {}

  /**
   * Check if the JSONL file exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stream and parse JSONL file, yielding parsed objects
   */
  async *stream<T = any>(): AsyncGenerator<T, void, unknown> {
    if (!(await this.exists())) {
      return;
    }

    const fileStream = createReadStream(this.filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            yield JSON.parse(trimmed) as T;
          } catch (error) {
            console.warn(`Failed to parse JSONL line: ${line}`, error);
            // Continue processing other lines
          }
        }
      }
    } finally {
      rl.close();
      fileStream.close();
    }
  }

  /**
   * Load all records from JSONL file into memory
   * Use with caution for large files
   */
  async loadAll<T = any>(): Promise<T[]> {
    const records: T[] = [];
    for await (const record of this.stream<T>()) {
      records.push(record);
    }
    return records;
  }

  /**
   * Load records with pagination support
   */
  async loadWithPagination<T = any>(options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<T[]> {
    const { limit = 100, offset = 0 } = options;
    const records: T[] = [];
    let count = 0;
    let skipped = 0;

    for await (const record of this.stream<T>()) {
      if (skipped < offset) {
        skipped++;
        continue;
      }

      records.push(record);
      count++;

      if (count >= limit) {
        break;
      }
    }

    return records;
  }

  /**
   * Find records matching a predicate
   */
  async find<T = any>(
    predicate: (record: T) => boolean,
    limit = 100
  ): Promise<T[]> {
    const matches: T[] = [];
    
    for await (const record of this.stream<T>()) {
      if (predicate(record)) {
        matches.push(record);
        if (matches.length >= limit) {
          break;
        }
      }
    }

    return matches;
  }

  /**
   * Count total records in the file
   */
  async count(): Promise<number> {
    let count = 0;
    for await (const _ of this.stream()) {
      count++;
    }
    return count;
  }
}
