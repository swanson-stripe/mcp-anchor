#!/usr/bin/env tsx
/**
 * Tiny static server for serving browser fixtures demo
 * Serves static files with proper MIME types and CORS headers
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 5173;
const STATIC_ROOT = join(__dirname, '../..');

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function isDirectory(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function findIndexFile(dirPath: string): string | null {
  const indexFiles = ['index.html', 'index.htm'];
  
  for (const indexFile of indexFiles) {
    const indexPath = join(dirPath, indexFile);
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }
  
  return null;
}

function serveFile(filePath: string): { content: Buffer; mimeType: string } | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    
    if (isDirectory(filePath)) {
      const indexPath = findIndexFile(filePath);
      if (indexPath) {
        return serveFile(indexPath);
      }
      return null;
    }
    
    const content = readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    
    return { content, mimeType };
  } catch (error) {
    console.error('Error serving file:', error);
    return null;
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);
  
  // Security: prevent directory traversal
  if (pathname.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Invalid path');
    return;
  }
  
  // Map common routes
  let filePath: string;
  
  if (pathname === '/') {
    // Serve browser demo by default
    filePath = join(__dirname, 'index.html');
  } else if (pathname === '/sw-fixtures.js') {
    // Serve service worker from public directory
    filePath = join(STATIC_ROOT, 'public/sw-fixtures.js');
  } else if (pathname === '/fixtures-config.json') {
    // Serve fixtures config
    filePath = join(__dirname, 'fixtures-config.json');
  } else if (pathname.startsWith('/examples/')) {
    // Serve from examples directory
    filePath = join(STATIC_ROOT, pathname.slice(1));
  } else if (pathname.startsWith('/public/')) {
    // Serve from public directory
    filePath = join(STATIC_ROOT, pathname.slice(1));
  } else {
    // Try to serve from current directory first, then static root
    filePath = join(__dirname, pathname);
    if (!existsSync(filePath)) {
      filePath = join(STATIC_ROOT, pathname.slice(1));
    }
  }
  
  console.log(`${req.method} ${pathname} -> ${filePath}`);
  
  const result = serveFile(filePath);
  
  if (result) {
    // Set CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Fixture-Request, X-Original-URL');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Set content headers
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.content.length);
    
    // Cache control for static assets
    if (result.mimeType.startsWith('text/') || result.mimeType === 'application/javascript') {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    
    res.writeHead(200);
    res.end(result.content);
    
  } else {
    // 404 Not Found
    const notFoundHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>404 - Not Found</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        h1 { color: #e74c3c; }
    </style>
</head>
<body>
    <h1>404 - Not Found</h1>
    <p>The requested file <code>${pathname}</code> was not found.</p>
    <p><a href="/">← Back to Browser Demo</a></p>
</body>
</html>`;
    
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(notFoundHtml);
  }
});

server.listen(PORT, () => {
  console.log('🚀 Static server started!');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📁 Serving: ${STATIC_ROOT}`);
  console.log('');
  console.log('🎯 Available routes:');
  console.log(`   http://localhost:${PORT}/                    → Browser fixtures demo`);
  console.log(`   http://localhost:${PORT}/sw-fixtures.js      → Service worker script`);
  console.log(`   http://localhost:${PORT}/fixtures-config.json → Fixtures configuration`);
  console.log('');
  console.log('💡 Open the browser demo and check DevTools Network tab to see intercepted requests!');
  console.log('🔧 Make sure to start the fixture server: node dist/cli.js serve');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down static server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down static server...');
  server.close(() => {
    process.exit(0);
  });
});
