#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// Check for deprecation warning
const invoked = basename(process.argv[1] || "");
if (invoked === "mcp-fixtures") {
  console.warn("[deprecation] `mcp-fixtures` is now `mcp-anchor`. The alias will keep working.");
}
import { CodeScanner } from './analysis/scanner.js';
import { runtimeTracer } from './analysis/tracer.js';
import { startTUI, createSimpleTable } from './analysis/tui.js';
import { ReportGenerator } from './report/generator.js';
import { PatchManager } from './codemods/manager.js';
import { initCommand } from './commands/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packagePath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const program = new Command();

program
  .name('dataset-injector')
  .description('A TypeScript platform for dataset injection')
  .version(packageJson.version);

program
  .command('serve')
  .description('Start the HTTP server')
  .option('-p, --port <port>', 'Port to run server on', '4000')
  .option('-h, --host <host>', 'Host to bind server to', 'localhost')
  .action(async (options) => {
    console.log(`Starting server on ${options.host}:${options.port}`);
    process.env.PORT = options.port;
    process.env.HOST = options.host;
    
    const { start } = await import('./server/http.js');
    await start();
  });

program
  .command('inject')
  .description('Inject dataset (placeholder)')
  .argument('<dataset>', 'Dataset to inject')
  .option('-f, --format <format>', 'Output format', 'json')
  .action((dataset, options) => {
    console.log(`Injecting dataset: ${dataset} in format: ${options.format}`);
    console.log('📝 This is a placeholder - inject functionality not yet implemented');
  });

program
  .command('dev')
  .description('Start fixture server with runtime request tracing')
  .option('-p, --port <port>', 'Server port', '4000')
  .option('--no-tui', 'Disable TUI interface, use simple table output')
  .option('--refresh <interval>', 'TUI refresh interval in seconds', '2')
  .action(async (options) => {
    try {
      console.log('🚀 Starting development mode with request tracing...');
      
      // Install runtime hooks first
      runtimeTracer.nodeRequireHook();
      
      // Start the fixture server
      console.log('🔥 Starting fixture server...');
      const { start } = await import('./server/http.js');
      // Set port via environment variable since start() doesn't accept parameters
      process.env.PORT = options.port;
      const serverPromise = start();
      
      // Give server a moment to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`✅ Fixture server running on http://localhost:${options.port}`);
      console.log('📡 Request tracing enabled - make some requests to see data!');
      
      if (options.tui) {
        // Start TUI interface
        startTUI(runtimeTracer, {
          refreshInterval: parseInt(options.refresh) * 1000
        });
      } else {
        // Simple table mode - refresh every few seconds
        console.log('\n📊 Request Statistics (refreshing every 5s, press Ctrl+C to quit):\n');
        
        const showStats = () => {
          const stats = runtimeTracer.getStats();
          const summary = runtimeTracer.getSummary();
          
          console.clear();
          console.log('🔍 Dataset Injector - Runtime Request Tracer\n');
          console.log(`📊 Total: ${summary.totalRequests} requests | 🎯 Fixtures: ${summary.fixtureHits} (${summary.fixtureHitRate}%) | ⚡ Avg: ${summary.averageLatency}ms\n`);
          
          if (stats.length > 0) {
            console.log(createSimpleTable(stats));
          } else {
            console.log('No requests captured yet...');
          }
          
          console.log('\n💡 Make some curl requests to http://localhost:4000/api/* to see data');
          console.log('🔄 Auto-refreshing every 5 seconds...');
        };
        
        showStats();
        const interval = setInterval(showStats, 5000);
        
        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          clearInterval(interval);
          console.log('\n👋 Shutting down...');
          process.exit(0);
        });
      }
      
    } catch (error) {
      console.error('❌ Dev mode failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate comprehensive analysis report combining static and runtime data')
  .option('-f, --format <format>', 'Output format: table, markdown, json', 'table')
  .option('-r, --root <path>', 'Project root path to analyze', '.')
  .option('-o, --out <file>', 'Output file (default: stdout)')
  .option('--no-static', 'Skip static analysis')
  .option('--no-runtime', 'Skip runtime analysis')
  .option('--runtime-logs <path>', 'Path to runtime logs file', './dsm-runtime.json')
  .option('-v, --verbose', 'Include detailed fixable issues')
  .action(async (options) => {
    try {
      console.log('📊 Generating comprehensive analysis report...');
      
      const reportOptions = {
        format: options.format as 'table' | 'markdown' | 'json',
        projectRoot: options.root,
        includeStatic: options.static,
        includeRuntime: options.runtime,
        runtimeLogsPath: options.runtimeLogs,
        verbose: options.verbose,
        outputFile: options.out
      };
      
      const report = await ReportGenerator.generateFormattedReport(reportOptions);
      
      if (options.out) {
        writeFileSync(options.out, report);
        console.log(`✅ Report saved to: ${options.out}`);
      } else {
        console.log('\n' + report);
      }
      
    } catch (error) {
      console.error('❌ Report generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('patch')
  .description('Apply automated fixes to code')
  .option('-r, --root <path>', 'Project root path', '.')
  .option('--fix <type>', 'Fix type to apply: fetch-boundary')
  .option('--files <pattern>', 'File pattern to process', 'src/**/*.{ts,tsx,js,jsx}')
  .option('--dry-run', 'Show what would be changed without making changes')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      if (!options.fix) {
        console.error('❌ --fix option is required. Available fixes: fetch-boundary');
        process.exit(1);
      }
      
      console.log(`🔧 Applying ${options.fix} fix...`);
      if (options.dryRun) {
        console.log('🧪 DRY RUN - No files will be modified');
      }
      
      // Validate environment
      const validation = PatchManager.validateEnvironment();
      if (!validation.valid) {
        console.error('❌ Missing required tools:');
        validation.missing.forEach(tool => console.error(`   - ${tool}`));
        process.exit(1);
      }
      
      const patchOptions = {
        root: options.root,
        fix: options.fix,
        files: options.files,
        dryRun: options.dryRun,
        verbose: options.verbose
      };
      
      const result = await PatchManager.applyPatches(patchOptions);
      
      if (result.success) {
        console.log(`✅ Patch applied successfully`);
        console.log(`📁 Files changed: ${result.filesChanged}`);
        
        if (result.summary.length > 0) {
          console.log('\n📋 Summary:');
          result.summary.forEach(line => console.log(`   ${line}`));
        }
      } else {
        console.error('❌ Patch failed');
        result.errors.forEach(error => console.error(`   ${error}`));
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Patch operation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('Scan project for data surface usage patterns')
  .option('-r, --root <path>', 'Project root path to scan', '.')
  .option('-o, --out <file>', 'Output file for Data Surface Map (DSM)')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log('🔍 Starting code analysis...');
      
      const scanner = new CodeScanner({
        rootPath: options.root,
        outputPath: options.out,
        verbose: options.verbose
      });
      
      const result = await scanner.scan();
      
      console.log('\n📊 Scan Results:');
      console.log(`   Files: ${result.summary.scannedFiles}/${result.summary.totalFiles} scanned`);
      console.log(`   Entries: ${result.summary.totalEntries} data surface calls found`);
      console.log(`   Injectable: ${result.summary.byInjectability.yes} yes, ${result.summary.byInjectability.maybe} maybe, ${result.summary.byInjectability.no} no`);
      
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length} files failed to parse`);
        if (options.verbose) {
          result.errors.forEach(error => console.log(`     ❌ ${error}`));
        }
      }
      
      console.log('\n🎯 Data Surface Breakdown:');
      Object.entries(result.summary.byKind).forEach(([kind, count]) => {
        if (count > 0) {
          console.log(`   ${kind}: ${count}`);
        }
      });
      
      if (options.out) {
        writeFileSync(options.out, JSON.stringify(result.entries, null, 2));
        console.log(`\n💾 DSM saved to: ${options.out}`);
      } else {
        console.log('\n📄 Top 5 entries:');
        result.entries.slice(0, 5).forEach((entry, i) => {
          console.log(`   ${i + 1}. ${entry.file}:${entry.line} - ${entry.kind} (${entry.injectable})`);
        });
        console.log('\n💡 Use --out <file> to save full Data Surface Map');
      }
      
    } catch (error) {
      console.error('❌ Scan failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Add init command
program
  .command('init')
  .description('Initialize project with synthetic dataset integration')
  .option('--with-dataset', 'Download synthetic dataset repository', true)
  .option('--business <name>', 'Default business persona', 'modaic')
  .option('--stage <name>', 'Default growth stage', 'growth')
  .option('--target <path>', 'Target directory', '.')
  .action(async (options) => {
    await initCommand(options);
  });

program.parse();
