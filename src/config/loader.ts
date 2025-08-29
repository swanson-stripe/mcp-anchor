import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RouteConfig {
  method: string;
  description: string;
  cacheTtl: number;
  queryParams?: string[];
}

export interface AppConfig {
  routes: Record<string, RouteConfig>;
  config: {
    defaultLimit: number;
    maxLimit: number;
    enableCaching: boolean;
    enableLogging: boolean;
  };
}

let cachedConfig: AppConfig | null = null;

/**
 * Load and parse the route configuration from YAML
 */
export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = join(__dirname, 'map.yaml');
    const configContent = await readFile(configPath, 'utf-8');
    const parsed = yaml.load(configContent) as AppConfig;
    
    if (!parsed || !parsed.routes || !parsed.config) {
      throw new Error('Invalid configuration format');
    }
    
    cachedConfig = parsed;
    console.log('✅ Configuration loaded successfully');
    return parsed;
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    
    // Return default configuration as fallback
    const defaultConfig: AppConfig = {
      routes: {
        '/api/customers': { method: 'getCustomers', description: 'Customer data', cacheTtl: 300 },
        '/api/accounts': { method: 'getAccounts', description: 'Account data', cacheTtl: 300 },
        '/api/products': { method: 'getProducts', description: 'Product catalog', cacheTtl: 600 },
        '/api/prices': { method: 'getPrices', description: 'Pricing information', cacheTtl: 600 },
        '/api/transactions': { 
          method: 'getTransactions', 
          description: 'Transaction records', 
          cacheTtl: 60,
          queryParams: ['from', 'to', 'limit', 'cursor']
        },
        '/api/transfers': { method: 'getTransfers', description: 'Transfer records', cacheTtl: 300 },
        '/api/balances': { method: 'getBalances', description: 'Balance information', cacheTtl: 30 },
        '/api/metrics/daily': { 
          method: 'getMetricsDaily', 
          description: 'Daily metrics', 
          cacheTtl: 900,
          queryParams: ['from', 'to']
        }
      },
      config: {
        defaultLimit: 50,
        maxLimit: 1000,
        enableCaching: true,
        enableLogging: true
      }
    };
    
    cachedConfig = defaultConfig;
    return defaultConfig;
  }
}

/**
 * Get configuration for a specific route
 */
export async function getRouteConfig(route: string): Promise<RouteConfig | null> {
  const config = await loadConfig();
  return config.routes[route] || null;
}

/**
 * Get global configuration
 */
export async function getGlobalConfig() {
  const config = await loadConfig();
  return config.config;
}
