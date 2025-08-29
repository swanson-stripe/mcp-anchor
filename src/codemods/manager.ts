/**
 * Patch manager for applying codemods and fixes
 */
import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { glob } from 'glob';
import { generateApiClient } from './api-client-template.js';

export interface PatchOptions {
  root: string;
  fix: string;
  files?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export class PatchManager {
  
  /**
   * Apply patches based on fix type
   */
  static async applyPatches(options: PatchOptions): Promise<{
    success: boolean;
    filesChanged: number;
    errors: string[];
    summary: string[];
  }> {
    const result = {
      success: false,
      filesChanged: 0,
      errors: [] as string[],
      summary: [] as string[]
    };

    try {
      switch (options.fix) {
        case 'fetch-boundary':
          return await this.applyFetchBoundaryFix(options);
        default:
          result.errors.push(`Unknown fix type: ${options.fix}`);
          return result;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * Apply fetch boundary fix using jscodeshift
   */
  private static async applyFetchBoundaryFix(options: PatchOptions): Promise<{
    success: boolean;
    filesChanged: number;
    errors: string[];
    summary: string[];
  }> {
    const result = {
      success: false,
      filesChanged: 0,
      errors: [] as string[],
      summary: [] as string[]
    };

    try {
      // 1. Create or update apiClient.ts
      const apiClientPath = join(options.root, 'src/api-client.ts');
      const apiClientExists = existsSync(apiClientPath);
      
      if (!apiClientExists) {
        if (!options.dryRun) {
          // Ensure directory exists
          const srcDir = dirname(apiClientPath);
          if (!existsSync(srcDir)) {
            execSync(`mkdir -p "${srcDir}"`);
          }
          
          const apiClientContent = generateApiClient({
            typescript: true,
            includeHelpers: true
          });
          
          writeFileSync(apiClientPath, apiClientContent);
        }
        
        result.summary.push(`${options.dryRun ? '[DRY RUN] ' : ''}Created ${apiClientPath}`);
        result.filesChanged++;
      } else {
        result.summary.push(`API client already exists at ${apiClientPath}`);
      }

      // 2. Find files to transform
      const filePattern = options.files || 'src/**/*.{ts,tsx,js,jsx}';
      const files = await glob(filePattern, {
        cwd: options.root,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/api-client.ts']
      });

      if (files.length === 0) {
        result.errors.push(`No files found matching pattern: ${filePattern}`);
        return result;
      }

      result.summary.push(`Found ${files.length} files to analyze`);

      // 3. Apply jscodeshift transformation
      const transformPath = join(process.cwd(), 'src/codemods/fetch-boundary.cjs');
      
      if (!existsSync(transformPath)) {
        result.errors.push(`Transform not found at ${transformPath}. Run 'npm run build' first.`);
        return result;
      }

      // Build jscodeshift command
      const jscodeshiftCmd = [
        'npx jscodeshift',
        `--transform="${transformPath}"`,
        options.dryRun ? '--dry' : '',
        options.verbose ? '--verbose=2' : '',
        '--parser=tsx',
        '--extensions=ts,tsx,js,jsx',
        `"${files.join('" "')}"`
      ].filter(Boolean).join(' ');

      if (options.verbose) {
        result.summary.push(`Running: ${jscodeshiftCmd}`);
      }

      // Execute transformation
      const output = execSync(jscodeshiftCmd, { 
        cwd: options.root,
        encoding: 'utf8'
      });

      // Parse jscodeshift output
      const outputLines = output.split('\n').filter(line => line.trim());
      let transformedFiles = 0;
      
      outputLines.forEach(line => {
        if (line.includes('✅ Transformed')) {
          transformedFiles++;
        }
        if (options.verbose) {
          result.summary.push(line);
        }
      });

      // Parse standard jscodeshift stats
      const statsMatch = output.match(/(\d+) files? skipped|(\d+) ok/g);
      if (statsMatch) {
        result.summary.push(`jscodeshift: ${statsMatch.join(', ')}`);
      }

      result.filesChanged += transformedFiles;
      result.success = true;
      
      if (transformedFiles > 0) {
        result.summary.push(
          `${options.dryRun ? '[DRY RUN] ' : ''}Transformed ${transformedFiles} files to use apiClient.fetch()`
        );
      } else {
        result.summary.push('No fetch calls needed transformation');
      }

      // 4. Summary recommendations
      result.summary.push('');
      result.summary.push('🎯 Next steps:');
      result.summary.push('• Review transformed files for correctness');
      result.summary.push('• Test that fixture injection works with new apiClient');
      result.summary.push('• Consider updating imports if apiClient location changes');

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Validate that required tools are available
   */
  static validateEnvironment(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    try {
      execSync('npx jscodeshift --version', { stdio: 'ignore' });
    } catch {
      missing.push('jscodeshift (install with: npm install -g jscodeshift)');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}
