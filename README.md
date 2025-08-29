# @app/fixtures-fetch

A TypeScript package for intercepting fetch requests and proxying them to fixture servers during development and testing.

## Features

- 🎭 **Fetch Interception**: Transparently proxy API calls to fixture servers
- 🗺️ **Route Mapping**: YAML-based configuration for endpoint mapping
- 🔧 **Environment Control**: Enable/disable via environment variables
- 📊 **Debug Logging**: Optional request/response logging
- 🚀 **Zero Config**: Works out of the box with sensible defaults

## Quick Start

### Installation

```bash
npm install @app/fixtures-fetch
```

### Basic Usage

```typescript
import { withInjection, createInjectedFetch } from '@app/fixtures-fetch';

// Option 1: Wrap existing fetch
const fetch = withInjection(globalThis.fetch);

// Option 2: Create pre-configured fetch
const fetch = createInjectedFetch();

// Use as normal fetch - will proxy to fixture server when INJECT_FIXTURES=1
const response = await fetch('/api/customers');
const customers = await response.json();
```

### Environment Configuration

```bash
# Enable fixture injection
export INJECT_FIXTURES=1

# Set fixture server URL (default: http://localhost:4000)  
export FIXTURE_URL=http://localhost:4000

# Run your application
npm start
```

## API Reference

### Fetch Interception

#### `withInjection(fetch, options)`

Wraps an existing fetch function with fixture injection capabilities.

```typescript
interface InjectionOptions {
  mapPath?: string;           // Path to route mapping YAML
  fixtureUrl?: string;        // Fixture server URL
  enableLogging?: boolean;    // Enable debug logging
}
```

### Supabase Emulation

#### `createClientFixture(url, key)`

Creates a Supabase-compatible client that uses fixture data.

```typescript
import { createClient as realCreateClient } from '@supabase/supabase-js'
import { createClientFixture } from '@app/fixtures-fetch/interceptors/supabase'

export const createClient = process.env.INJECT_FIXTURES ? createClientFixture : realCreateClient
```

Supports chainable queries: `.from(table).select().eq().lte().gte().limit()`

### `createInjectedFetch(options)`

Creates a new fetch function with injection enabled.

### `createDebugFetch(options)`

Creates a fetch function with debug logging enabled.

### `getInjectionInfo()`

Returns current injection status and configuration.

## Route Mapping

Create a `config/map.yaml` file to define which routes should be intercepted:

```yaml
routes:
  "/api/customers":
    method: "getCustomers"
    description: "Customer data"
    
  "/api/transactions":
    method: "getTransactions" 
    description: "Transaction records"
    queryParams:
      - "from"
      - "to"
      - "limit"
```

## Examples

See `examples/node-fetch-demo.ts` for a complete demonstration:

```bash
INJECT_FIXTURES=1 FIXTURE_URL=http://localhost:4000 npx tsx examples/node-fetch-demo.ts
```

## Development

```bash
# Build the package
npm run build

# Run demo
npm run demo:fetch

# Start fixture server
npm run dev
```

## License

MIT
