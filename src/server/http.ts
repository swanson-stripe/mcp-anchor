import Fastify from 'fastify';
import { dataAdapter } from '../adapter/index.js';
import { loadConfig, getRouteConfig } from '../config/loader.js';
import { scenarioEngine } from '../scenario/engine.js';
import { 
  parsePaginationParams, 
  parseDateRangeParams, 
  createPaginatedResult 
} from './pagination.js';

const fastify = Fastify({
  logger: true,
});

// Add fixture server headers to all responses
fastify.addHook('onSend', async (request, reply, payload) => {
  reply.header('x-fixture-server', 'dataset-injector');
  reply.header('x-powered-by', 'Fastify/dataset-injector');
});

// Initialize data adapter
await dataAdapter.initialize();

// Load configuration
const config = await loadConfig();

// Health check endpoint
fastify.get('/health', async () => {
  return { ok: true };
});

// API Routes

// GET /api/customers
fastify.get('/api/customers', async (request, reply) => {
  try {
    const customers = await dataAdapter.getCustomers();
    const paginationParams = parsePaginationParams(request.query as Record<string, any>);
    const result = createPaginatedResult(customers, paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch customers', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/accounts  
fastify.get('/api/accounts', async (request, reply) => {
  try {
    const accounts = await dataAdapter.getAccounts();
    const paginationParams = parsePaginationParams(request.query as Record<string, any>);
    const result = createPaginatedResult(accounts, paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch accounts', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/products
fastify.get('/api/products', async (request, reply) => {
  try {
    const products = await dataAdapter.getProducts();
    const paginationParams = parsePaginationParams(request.query as Record<string, any>);
    const result = createPaginatedResult(products, paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch products', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/prices
fastify.get('/api/prices', async (request, reply) => {
  try {
    const prices = await dataAdapter.getPrices();
    const paginationParams = parsePaginationParams(request.query as Record<string, any>);
    const result = createPaginatedResult(prices, paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch prices', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/transactions (supports from, to, limit, cursor)
fastify.get('/api/transactions', async (request, reply) => {
  try {
    const query = request.query as Record<string, any>;
    const dateParams = parseDateRangeParams(query);
    const paginationParams = parsePaginationParams(query);
    
    // Build transaction query
    const transactionQuery = {
      ...dateParams,
      limit: paginationParams.limit,
      cursor: paginationParams.cursor
    };
    
    const transactions = await dataAdapter.getTransactions(transactionQuery);
    
    // For transactions, we let the adapter handle pagination internally
    // But we still wrap it in our standard format for consistency
    reply.send({
      data: transactions,
      pagination: {
        hasMore: transactions.length === (paginationParams.limit || 50),
        count: transactions.length
      }
    });
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch transactions', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/transfers
fastify.get('/api/transfers', async (request, reply) => {
  try {
    const transfers = await dataAdapter.getTransfers();
    const paginationParams = parsePaginationParams(request.query as Record<string, any>);
    const result = createPaginatedResult(transfers, paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch transfers', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/balances
fastify.get('/api/balances', async (request, reply) => {
  try {
    const balances = await dataAdapter.getBalances();
    const paginationParams = parsePaginationParams(request.query as Record<string, any>);
    const result = createPaginatedResult(balances, paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch balances', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/metrics/daily (supports from, to)
fastify.get('/api/metrics/daily', async (request, reply) => {
  try {
    const query = request.query as Record<string, any>;
    const dateParams = parseDateRangeParams(query);
    
    const metrics = await dataAdapter.getMetricsDaily(dateParams);
    const paginationParams = parsePaginationParams(query);
    const result = createPaginatedResult(metrics, paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to fetch daily metrics', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/status - Show adapter and configuration status
fastify.get('/api/status', async (request, reply) => {
  try {
    const adapterStatus = dataAdapter.getStatus();
    const configStatus = {
      routes: Object.keys(config.routes),
      globalConfig: config.config
    };
    const scenarioStatus = {
      current: scenarioEngine.getCurrentScenario(),
      available: scenarioEngine.getAvailableScenarios().map(s => ({ name: s.name, description: s.description }))
    };
    
    reply.send({
      adapter: adapterStatus,
      config: configStatus,
      scenario: scenarioStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    reply.status(500).send({ 
      error: 'Failed to get status', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /__scenario - Set scenario configuration
fastify.post('/__scenario', async (request, reply) => {
  try {
    const body = request.body as any;
    
    if (!body || typeof body.name !== 'string') {
      reply.status(400).send({
        error: 'Invalid request body',
        message: 'Request must include scenario name'
      });
      return;
    }
    
    const scenarioConfig = {
      name: body.name,
      seed: typeof body.seed === 'number' ? body.seed : 42
    };
    
    const success = scenarioEngine.setScenario(scenarioConfig);
    
    if (!success) {
      const available = scenarioEngine.getAvailableScenarios().map(s => s.name);
      reply.status(400).send({
        error: 'Invalid scenario',
        message: `Scenario '${body.name}' not found`,
        available
      });
      return;
    }
    
    reply.send({
      success: true,
      scenario: scenarioEngine.getCurrentScenario(),
      message: `Scenario switched to ${scenarioConfig.name}`,
      available: scenarioEngine.getAvailableScenarios().map(s => ({ name: s.name, description: s.description }))
    });
  } catch (error) {
    reply.status(500).send({
      error: 'Failed to set scenario',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /__scenario - Get current scenario and available options
fastify.get('/__scenario', async (request, reply) => {
  try {
    reply.send({
      current: scenarioEngine.getCurrentScenario(),
      available: scenarioEngine.getAvailableScenarios()
    });
  } catch (error) {
    reply.status(500).send({
      error: 'Failed to get scenario info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/metrics/derived - Get raw derived metrics structure for testing
fastify.get('/api/metrics/derived', async (request, reply) => {
  try {
    const query = request.query as Record<string, any>;
    const dateParams = parseDateRangeParams(query);
    
    // Force derived metrics calculation
    const originalEnv = process.env.USE_DERIVED_METRICS;
    process.env.USE_DERIVED_METRICS = 'true';
    
    const metrics = await dataAdapter.getMetricsDaily(dateParams);
    
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.USE_DERIVED_METRICS = originalEnv;
    } else {
      delete process.env.USE_DERIVED_METRICS;
    }
    
    // Group metrics by date for easier reading
    const groupedMetrics: Record<string, any> = {};
    
    metrics.forEach(metric => {
      if (!groupedMetrics[metric.date]) {
        groupedMetrics[metric.date] = {};
      }
      groupedMetrics[metric.date][metric.metric] = {
        value: metric.value,
        ...(metric.currency && { currency: metric.currency }),
        metadata: metric.metadata
      };
    });
    
    const paginationParams = parsePaginationParams(query);
    const result = createPaginatedResult(Object.entries(groupedMetrics).map(([date, metrics]) => ({
      date,
      metrics
    })), paginationParams);
    
    reply.send(result);
  } catch (error) {
    reply.status(500).send({
      error: 'Failed to get derived metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 4000;
    const host = process.env.HOST || 'localhost';
    
    await fastify.listen({ port, host });
    console.log(`🚀 Server running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    await fastify.close();
    console.log('Server closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { fastify, start };
