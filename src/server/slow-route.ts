/**
 * Test route with artificial delay for performance testing
 */
import type { FastifyInstance } from 'fastify';

export function addSlowRoutes(fastify: FastifyInstance) {
  // Add artificial delay route for testing timeout behavior
  fastify.get('/api/slow/:delayMs', async (request, reply) => {
    const { delayMs } = request.params as { delayMs: string };
    const delay = parseInt(delayMs, 10) || 1000;
    
    console.log(`⏳ Simulating ${delay}ms delay...`);
    
    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    reply.header('x-delay-simulated', delay.toString());
    
    return {
      message: `Response delayed by ${delay}ms`,
      timestamp: new Date().toISOString(),
      delay: delay
    };
  });

  // Add slow customers endpoint for realistic testing
  fastify.get('/api/customers/slow', async (request, reply) => {
    const delayMs = 100; // Always slow
    
    console.log(`🐌 Slow customers endpoint (${delayMs}ms delay)...`);
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    reply.header('x-slow-endpoint', 'true');
    
    return [
      { id: 'cus_slow_001', email: 'slow1@example.com', name: 'Slow User 1' },
      { id: 'cus_slow_002', email: 'slow2@example.com', name: 'Slow User 2' }
    ];
  });

  console.log('🐌 Added slow test routes: /api/slow/:delayMs, /api/customers/slow');
}
