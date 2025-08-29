import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fastify } from '../server/http.js';

describe('HTTP Server', () => {
  beforeAll(async () => {
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return health check', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ ok: true });
  });

  it('should handle 404 for unknown routes', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/unknown',
    });

    expect(response.statusCode).toBe(404);
  });
});
