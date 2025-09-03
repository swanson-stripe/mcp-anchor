/**
 * Init command for mcp-anchor
 * Sets up project with synthetic dataset integration
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export interface InitOptions {
  withDataset?: boolean;
  business?: string;
  stage?: string;
  target?: string;
}

export async function initCommand(options: InitOptions = {}) {
  const targetDir = options.target || process.cwd();
  
  console.log(chalk.blue('🚀 Initializing MCP Anchor with Synthetic Dataset\n'));
  
  try {
    // Step 1: Clone synthetic dataset if requested
    if (options.withDataset) {
      await cloneSyntheticDataset(targetDir);
    }
    
    // Step 2: Create MCP configuration
    await createMcpConfig(targetDir, options);
    
    // Step 3: Create API client template
    await createApiClientTemplate(targetDir);
    
    // Step 4: Create React hook for easy data access
    await createReactHook(targetDir);
    
    // Step 5: Generate Cursor prompts file
    await createCursorPrompts(targetDir, options);
    
    // Step 6: Create quick start script
    await createQuickStartScript(targetDir);
    
    console.log(chalk.green('✅ MCP Anchor initialization complete!\n'));
    
    console.log(chalk.yellow('📋 Next Steps:'));
    console.log('1. Open your project in Cursor');
    console.log('2. Copy a prompt from cursor-prompts.md');
    console.log('3. Paste in Cursor chat');
    console.log('4. Your app now has realistic data!\n');
    
    console.log(chalk.blue('🎯 Quick Commands:'));
    console.log('• npx mcp-anchor serve     # Start data server');
    console.log('• npx mcp-anchor dev       # Development mode with tracing');
    console.log('• npx mcp-anchor scenario  # Switch business personas\n');
    
  } catch (error) {
    console.error(chalk.red('❌ Initialization failed:'));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function cloneSyntheticDataset(targetDir: string) {
  console.log(chalk.blue('📥 Downloading synthetic dataset repository...'));
  
  const datasetDir = join(targetDir, 'synthetic-dataset');
  
  if (existsSync(datasetDir)) {
    console.log(chalk.yellow('⚠️  Dataset already exists, skipping clone'));
    return;
  }
  
  try {
    execSync('git clone https://github.com/swanson-stripe/synthetic-dataset.git', {
      cwd: targetDir,
      stdio: 'inherit'
    });
    console.log(chalk.green('✅ Synthetic dataset downloaded'));
  } catch (error) {
    throw new Error('Failed to clone synthetic dataset repository');
  }
}

async function createMcpConfig(targetDir: string, options: InitOptions) {
  console.log(chalk.blue('⚙️  Creating MCP configuration...'));
  
  const config = {
    mcpServers: {
      "mcp-anchor": {
        command: "npx",
        args: ["mcp-anchor", "mcp"],
        env: {
          DATASET_ROOT: "./synthetic-dataset/docs",
          DEFAULT_BUSINESS: options.business || "modaic",
          DEFAULT_STAGE: options.stage || "growth"
        }
      }
    }
  };
  
  const configPath = join(targetDir, '.cursorrules');
  const cursorrules = `# MCP Anchor Integration
# This file configures realistic synthetic data for prototyping

## Available Business Personas:
# - modaic: Fashion e-commerce
# - mindora: Online education  
# - keynest: Property management
# - pulseon: Fitness subscriptions
# - fluxly: Creator platform
# - brightfund: Non-profit fundraising
# - procura: B2B medical supplies
# - stratus: Cloud infrastructure
# - forksy: Food delivery

## Available Stages:
# - early: Startup phase
# - growth: Scaling business  
# - mature: Established company

## Quick Data Access:
# Use the useDataset() hook for instant realistic data
# Change business/stage to switch entire dataset
`;
  
  writeFileSync(configPath, cursorrules);
  
  const mcpConfigPath = join(targetDir, 'mcp-config.json');
  writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
  
  console.log(chalk.green('✅ MCP configuration created'));
}

async function createApiClientTemplate(targetDir: string) {
  console.log(chalk.blue('🔧 Creating API client template...'));
  
  const apiDir = join(targetDir, 'src', 'lib');
  mkdirSync(apiDir, { recursive: true });
  
  const apiClientCode = `/**
 * Auto-generated API client with MCP Anchor synthetic data
 * Ready to use with realistic business data
 */

export class DatasetApiClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  async getCustomers() {
    const response = await fetch(\`\${this.baseUrl}/api/customers\`);
    return response.json();
  }

  async getMetrics(dateRange?: { from?: string; to?: string }) {
    const params = new URLSearchParams(dateRange || {});
    const response = await fetch(\`\${this.baseUrl}/api/metrics/daily?\${params}\`);
    return response.json();
  }

  async getTransactions(options?: { limit?: number; from?: string; to?: string }) {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(options || {}).map(([k, v]) => [k, String(v)]))
    );
    const response = await fetch(\`\${this.baseUrl}/api/transactions?\${params}\`);
    return response.json();
  }

  async switchBusiness(business: string, stage: string) {
    const response = await fetch(\`\${this.baseUrl}/__scenario\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: \`\${business}_\${stage}\`, seed: 42 })
    });
    return response.json();
  }
}

export const apiClient = new DatasetApiClient();
`;

  writeFileSync(join(apiDir, 'dataset-api.ts'), apiClientCode);
  console.log(chalk.green('✅ API client template created'));
}

async function createReactHook(targetDir: string) {
  console.log(chalk.blue('⚛️  Creating React hook for easy data access...'));
  
  const hooksDir = join(targetDir, 'src', 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  
  const hookCode = `/**
 * React hook for instant access to realistic synthetic data
 * Auto-generated by MCP Anchor
 */

import { useState, useEffect } from 'react';
import { apiClient } from '../lib/dataset-api';

export interface UseDatasetOptions {
  business?: 'modaic' | 'mindora' | 'keynest' | 'pulseon' | 'fluxly' | 'brightfund' | 'procura' | 'stratus' | 'forksy';
  stage?: 'early' | 'growth' | 'mature';
  autoLoad?: boolean;
}

export interface DatasetResult {
  customers: any[];
  metrics: any[];
  transactions: any[];
  loading: boolean;
  error: string | null;
  switchBusiness: (business: string, stage: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useDataset(options: UseDatasetOptions = {}): DatasetResult {
  const [customers, setCustomers] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { business = 'modaic', stage = 'growth', autoLoad = true } = options;

  const loadData = async (newBusiness?: string, newStage?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Switch business scenario if specified
      if (newBusiness && newStage) {
        await apiClient.switchBusiness(newBusiness, newStage);
      }
      
      // Load all data types
      const [customersData, metricsData, transactionsData] = await Promise.all([
        apiClient.getCustomers(),
        apiClient.getMetrics(),
        apiClient.getTransactions({ limit: 100 })
      ]);
      
      setCustomers(customersData.data || customersData);
      setMetrics(metricsData.data || metricsData);
      setTransactions(transactionsData.data || transactionsData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Dataset loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const switchBusiness = async (newBusiness: string, newStage: string) => {
    await loadData(newBusiness, newStage);
  };

  const reload = async () => {
    await loadData();
  };

  useEffect(() => {
    if (autoLoad) {
      loadData(business, stage);
    }
  }, [autoLoad, business, stage]);

  return {
    customers,
    metrics,
    transactions,
    loading,
    error,
    switchBusiness,
    reload
  };
}

// Convenience hooks for specific data types
export function useCustomers(options?: UseDatasetOptions) {
  const { customers, loading, error } = useDataset(options);
  return { customers, loading, error };
}

export function useMetrics(options?: UseDatasetOptions) {
  const { metrics, loading, error } = useDataset(options);
  return { metrics, loading, error };
}

export function useTransactions(options?: UseDatasetOptions) {
  const { transactions, loading, error } = useDataset(options);
  return { transactions, loading, error };
}
`;

  writeFileSync(join(hooksDir, 'useDataset.ts'), hookCode);
  console.log(chalk.green('✅ React hook created'));
}

async function createCursorPrompts(targetDir: string, options: InitOptions) {
  console.log(chalk.blue('📝 Creating Cursor prompts...'));
  
  const promptsContent = `# 🎯 **Ready-to-Use Cursor Prompts for Realistic Data**

Copy these prompts into Cursor to instantly add realistic synthetic data to your prototype.

## **Prompt 1: Basic Data Integration**

\`\`\`
Add realistic synthetic data to my React app using the MCP Anchor setup. I want:

- Customer list component showing realistic names, emails, and details
- Revenue metrics dashboard with cards showing key numbers  
- Transaction history table with realistic payment data
- Business type: ${options.business || 'modaic'} (fashion e-commerce)
- Growth stage: ${options.stage || 'growth'} (scaling business)

Use the useDataset hook that's already configured. Style it simply but professionally.
\`\`\`

## **Prompt 2: Switch Business Scenarios**

\`\`\`
Switch my app to show data for a different business type:

- Change to [mindora/keynest/pulseon/fluxly/brightfund/procura/stratus/forksy] business
- Use [early/growth/mature] stage data
- Update the components to reflect this business type's patterns
- Keep the same UI structure but show industry-specific metrics

The data should automatically reflect the new business's realistic patterns.
\`\`\`

## **Prompt 3: Advanced Dashboard**

\`\`\`
Create a comprehensive analytics dashboard using the synthetic data:

- Revenue chart showing growth over time
- Customer acquisition metrics  
- Payment method breakdown
- Geographic distribution (if available)
- Key performance indicators relevant to the business type
- Responsive design that works on mobile

Use Chart.js or Recharts for visualizations.
\`\`\`

## **Prompt 4: Customer Management Interface**

\`\`\`
Build a customer management interface with the realistic customer data:

- Searchable customer list with pagination
- Customer detail pages showing payment history
- Filters by customer type, date ranges, payment status
- Export functionality for customer lists
- Add/edit customer form (saving to local state)

Make it feel like a real SaaS admin interface.
\`\`\`

## **Prompt 5: Payment Processing Flow**

\`\`\`
Create a payment processing interface showing realistic transaction flows:

- Payment form with realistic validation
- Transaction status tracking (pending, succeeded, failed)
- Refund processing interface
- Payment method management
- Transaction dispute handling

Use the realistic transaction data to populate status examples.
\`\`\`

## **Business Types Available:**

- **modaic**: Fashion e-commerce (seasonal patterns, returns)
- **mindora**: Online education (course purchases, subscriptions)  
- **keynest**: Property management (rent payments, deposits)
- **pulseon**: Fitness subscriptions (monthly plans, trials)
- **fluxly**: Creator platform (tips, subscriptions, payouts)
- **brightfund**: Non-profit (donations, recurring gifts)
- **procura**: B2B medical supplies (bulk orders, net terms)
- **stratus**: Cloud infrastructure (usage billing, enterprise)
- **forksy**: Food delivery (split payments, tips)

## **Growth Stages:**

- **early**: Startup phase with initial traction
- **growth**: Scaling business with increasing volume  
- **mature**: Established company with complex patterns

## **Quick Data Commands:**

\`\`\`bash
# Start the data server
npx mcp-anchor serve

# Switch business scenarios
npx mcp-anchor scenario switch --business=pulseon --stage=mature

# View available data
npx mcp-anchor report --format=table
\`\`\`

## **Example Code Snippets:**

### React Component with Data:
\`\`\`typescript
import { useDataset } from './hooks/useDataset';

function Dashboard() {
  const { customers, metrics, transactions, loading } = useDataset({
    business: 'modaic',
    stage: 'growth'
  });

  if (loading) return <div>Loading realistic data...</div>;

  return (
    <div>
      <MetricCards data={metrics} />
      <CustomerList customers={customers} />
      <RecentTransactions transactions={transactions} />
    </div>
  );
}
\`\`\`

### Business Switching:
\`\`\`typescript
const { switchBusiness } = useDataset();

// Switch to fitness business in mature stage
await switchBusiness('pulseon', 'mature');
// Data automatically updates with fitness industry patterns
\`\`\`

**Ready to prototype with realistic data!** 🚀
`;

  writeFileSync(join(targetDir, 'cursor-prompts.md'), promptsContent);
  console.log(chalk.green('✅ Cursor prompts created'));
}

async function createQuickStartScript(targetDir: string) {
  console.log(chalk.blue('🚀 Creating quick start script...'));
  
  const scriptContent = `#!/bin/bash

# MCP Anchor Quick Start Script
# Automatically generated setup

echo "🚀 Starting MCP Anchor with Synthetic Dataset"
echo ""

# Start the data server in background
echo "📊 Starting data server..."
npx mcp-anchor serve --port 4000 &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "✅ Data server running on http://localhost:4000"
echo ""

echo "🎯 Next steps:"
echo "1. Open this project in Cursor"
echo "2. Copy a prompt from cursor-prompts.md"  
echo "3. Paste in Cursor chat"
echo "4. Your app now has realistic data!"
echo ""

echo "📋 Available commands:"
echo "• npx mcp-anchor scenario switch --business=pulseon"
echo "• npx mcp-anchor report --format=table"
echo "• curl http://localhost:4000/api/customers"
echo ""

echo "Press Ctrl+C to stop the server"
wait $SERVER_PID
`;

  writeFileSync(join(targetDir, 'quick-start.sh'), scriptContent);
  
  // Make executable
  try {
    execSync('chmod +x quick-start.sh', { cwd: targetDir });
  } catch (error) {
    // Ignore chmod errors on Windows
  }
  
  console.log(chalk.green('✅ Quick start script created'));
}
