/**
 * MCP (Model Context Protocol) Server for Dataset Injection Tools
 * Exposes key capabilities as standardized MCP tools
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Import our existing modules
import { CodeScanner } from '../analysis/scanner.js';
import { ReportGenerator } from '../report/generator.js';
import { start as startHttpServer } from '../server/http.js';
import { DataAdapter } from '../adapter/index.js';
import { ScenarioEngine } from '../scenario/engine.js';
import { loadConfig } from '../config/loader.js';

// Import types
import type {
  ScanCodebaseArgs,
  ScanCodebaseResult,
  StartFixtureServerArgs,
  StartFixtureServerResult,
  InjectDatasetArgs,
  InjectDatasetResult,
  ReportInjectabilityArgs,
  ReportInjectabilityResult,
} from './types.js';

class DatasetInjectionMcpServer {
  private server: Server;
  private fixtureServerInstance: any = null;

  constructor() {
    this.server = new Server({
      name: 'dataset-injector',
      version: '1.0.0',
    });

    this.setupToolHandlers();
    this.setupErrorHandlers();
  }

  private setupToolHandlers() {
    // Register list_tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'scan_codebase',
            description: 'Scan a codebase for data surface usage patterns and injectable calls',
            inputSchema: {
              type: 'object',
              properties: {
                root: {
                  type: 'string',
                  description: 'Root path of the project to scan',
                  default: '.',
                },
              },
              required: ['root'],
            },
          },
          {
            name: 'start_fixture_server',
            description: 'Start the fixture server with dataset and scenario configuration',
            inputSchema: {
              type: 'object',
              properties: {
                datasetRoot: {
                  type: 'string',
                  description: 'Path to the dataset root directory',
                  default: '../synthetic-dataset/datasets/core/v1',
                },
                scenario: {
                  type: 'string',
                  description: 'Scenario name to apply (baseline, heavyTail, fraudSpike)',
                  default: 'baseline',
                },
                port: {
                  type: 'number',
                  description: 'Port to run the server on',
                  default: 4000,
                },
              },
              required: [],
            },
          },
          {
            name: 'inject_dataset',
            description: 'Configure dataset injection with mapping and scenario settings',
            inputSchema: {
              type: 'object',
              properties: {
                mapPath: {
                  type: 'string',
                  description: 'Path to the route mapping configuration',
                  default: 'src/config/map.yaml',
                },
                scenario: {
                  type: 'string',
                  description: 'Scenario to apply to the data',
                  default: 'baseline',
                },
              },
              required: [],
            },
          },
          {
            name: 'report_injectability',
            description: 'Generate comprehensive analysis report of data surface injectability',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['table', 'markdown', 'json'],
                  description: 'Output format for the report',
                  default: 'table',
                },
                verbose: {
                  type: 'boolean',
                  description: 'Include detailed fixable issues in the report',
                  default: false,
                },
                includeRuntime: {
                  type: 'boolean',
                  description: 'Include runtime analysis data',
                  default: true,
                },
                includeStatic: {
                  type: 'boolean',
                  description: 'Include static code analysis data',
                  default: true,
                },
              },
              required: [],
            },
          },
        ],
      };
    });

    // Register call_tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'scan_codebase':
            return await this.handleScanCodebase(args as unknown as ScanCodebaseArgs);
          
          case 'start_fixture_server':
            return await this.handleStartFixtureServer(args as unknown as StartFixtureServerArgs);
          
          case 'inject_dataset':
            return await this.handleInjectDataset(args as unknown as InjectDatasetArgs);
          
          case 'report_injectability':
            return await this.handleReportInjectability(args as unknown as ReportInjectabilityArgs);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupErrorHandlers() {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };

    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down MCP server...');
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Handle scan_codebase tool
   */
  private async handleScanCodebase(args: ScanCodebaseArgs): Promise<{ content: [{ type: 'text'; text: string }] }> {
    const { root } = args;

    const scanner = new CodeScanner({
      rootPath: root,
      verbose: false,
    });

    const result = await scanner.scan();

    const mcpResult: ScanCodebaseResult = {
      summary: result.summary,
      entries: result.entries,
      errors: result.errors,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(mcpResult, null, 2),
        },
      ],
    };
  }

  /**
   * Handle start_fixture_server tool
   */
  private async handleStartFixtureServer(args: StartFixtureServerArgs): Promise<{ content: [{ type: 'text'; text: string }] }> {
    const {
      datasetRoot = '../synthetic-dataset/datasets/core/v1',
      scenario = 'baseline',
      port = 4000,
    } = args;

    // Check if server is already running
    if (this.fixtureServerInstance) {
      const result: StartFixtureServerResult = {
        url: `http://localhost:${port}`,
        port,
        scenario,
        datasetRoot,
        status: 'already_running',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    // Set environment variables
    process.env.DATASET_ROOT = datasetRoot;
    process.env.PORT = port.toString();

    // Initialize data adapter and scenario
    const dataAdapter = new DataAdapter();
    const scenarioEngine = new ScenarioEngine();
    await scenarioEngine.setScenario({ name: scenario, seed: 42 }); // Use fixed seed for consistency

    try {
      // Start the fixture server
      this.fixtureServerInstance = await startHttpServer();
      
      const result: StartFixtureServerResult = {
        url: `http://localhost:${port}`,
        port,
        scenario,
        datasetRoot,
        status: 'started',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to start fixture server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle inject_dataset tool
   */
  private async handleInjectDataset(args: InjectDatasetArgs): Promise<{ content: [{ type: 'text'; text: string }] }> {
    const {
      mapPath = 'src/config/map.yaml',
      scenario = 'baseline',
    } = args;

    try {
      // Enable injection environment variable
      process.env.INJECT_FIXTURES = '1';
      process.env.FIXTURE_URL = 'http://localhost:4000';

      // Load and validate mapping configuration
      await loadConfig();

      // Set scenario if different from current
      const scenarioEngine = new ScenarioEngine();
      await scenarioEngine.setScenario({ name: scenario, seed: 42 });

      const result: InjectDatasetResult = {
        ok: true,
        message: 'Dataset injection configured successfully',
        mapPath,
        scenario,
        injectionEnabled: true,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const result: InjectDatasetResult = {
        ok: false,
        message: `Failed to configure injection: ${error instanceof Error ? error.message : String(error)}`,
        mapPath,
        scenario,
        injectionEnabled: false,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Handle report_injectability tool
   */
  private async handleReportInjectability(args: ReportInjectabilityArgs): Promise<{ content: [{ type: 'text'; text: string }] }> {
    const {
      format = 'table',
      verbose = false,
      includeRuntime = true,
      includeStatic = true,
    } = args;

    try {
      const reportOptions = {
        format: format as 'table' | 'markdown' | 'json',
        verbose,
        includeRuntime,
        includeStatic,
        projectRoot: process.cwd(),
      };

      const report = await ReportGenerator.generateFormattedReport(reportOptions);
      const comprehensiveReport = await ReportGenerator.generateReport(reportOptions);

      const result: ReportInjectabilityResult = {
        report,
        format,
        timestamp: new Date().toISOString(),
        summary: {
          totalIssues: comprehensiveReport.recommendations.totalIssues,
          autoFixable: comprehensiveReport.recommendations.autoFixable,
          manualReview: comprehensiveReport.recommendations.manualReview,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: format === 'json' ? JSON.stringify(result, null, 2) : result.report,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Start the MCP server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('🚀 Dataset Injection MCP Server started');
    console.error('📋 Available tools:');
    console.error('   • scan_codebase - Analyze code for injectable patterns');
    console.error('   • start_fixture_server - Launch fixture server with datasets');
    console.error('   • inject_dataset - Configure dataset injection');
    console.error('   • report_injectability - Generate comprehensive analysis reports');
    console.error('');
    console.error('💡 Ready to accept MCP tool calls...');
  }

  /**
   * Stop the MCP server
   */
  async stop() {
    if (this.fixtureServerInstance) {
      // Stop fixture server if running
      console.error('🛑 Stopping fixture server...');
      this.fixtureServerInstance = null;
    }
    
    await this.server.close();
    console.error('✅ MCP server stopped');
  }
}

/**
 * Export function to start MCP server
 */
export async function startMcpServer() {
  const server = new DatasetInjectionMcpServer();
  await server.start();
  return server;
}

/**
 * Main entry point when run directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer().catch((error) => {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  });
}
