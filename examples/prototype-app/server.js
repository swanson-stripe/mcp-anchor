/**
 * Simple Express server for serving the built demo app
 */
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')));

// API proxy to fixture server
app.use('/api', (req, res) => {
  // Proxy to fixture server running on port 4000
  const fixtureUrl = `http://localhost:4000${req.url}`;
  
  console.log(`🔄 Proxying ${req.method} ${req.url} → ${fixtureUrl}`);
  
  // Simple proxy implementation
  fetch(fixtureUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      'X-Demo-App-Proxy': 'true'
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  })
  .then(response => response.json())
  .then(data => {
    console.log(`✅ Proxy response: ${JSON.stringify(data).slice(0, 100)}...`);
    res.json(data);
  })
  .catch(error => {
    console.error(`❌ Proxy error: ${error.message}`);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Demo app server running on http://localhost:${PORT}`);
  console.log(`🎯 Proxying /api/* to http://localhost:4000`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down demo app server...');
  server.close(() => {
    console.log('✅ Demo app server closed');
    process.exit(0);
  });
});
