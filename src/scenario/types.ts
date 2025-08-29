/**
 * Types for scenario engine and transforms
 */

export interface ScenarioConfig {
  name: string;
  seed: number;
}

export interface TransformContext {
  scenario: string;
  seed: number;
  index: number; // Record index for deterministic behavior
}

export interface TransformResult<T> {
  data: T;
  metadata?: Record<string, any>;
}

export type Transform<T> = (data: T, context: TransformContext) => TransformResult<T>;

export interface ScenarioDefinition {
  name: string;
  description: string;
  transforms: {
    transactions?: Transform<any>;
    customers?: Transform<any>;
    metrics?: Transform<any>;
  };
}

// Pseudo-random number generator for deterministic behavior
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Generate random number in range [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Generate random integer in range [min, max]
   */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Generate Pareto-distributed number (for heavy tail)
   * α = shape parameter (smaller = heavier tail)
   */
  pareto(scale: number = 1, shape: number = 1.16): number {
    const u = this.next();
    return scale / Math.pow(u, 1 / shape);
  }

  /**
   * Generate boolean with given probability
   */
  boolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }
}
