# Supabase Integration

Replace your Supabase client with fixture data during development and testing.

## Usage

```typescript
// In your database client setup file (e.g., lib/supabase.ts)
import { createClient as realCreateClient } from '@supabase/supabase-js'
import { createClientFixture } from '@app/fixtures-fetch/interceptors/supabase'

// Automatically switch between real and fixture client based on environment
export const createClient = process.env.INJECT_FIXTURES ? createClientFixture : realCreateClient

// Use your normal Supabase client setup
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

## Supported API

The fixture client supports a subset of the Supabase API:

### Query Builder
```typescript
// All of these work with fixture data:
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .eq('status', 'active')
  .gte('created_at', '2023-01-01')
  .lte('created_at', '2023-12-31')
  .limit(10)
  .execute()
```

### Auth
```typescript
const { data: user } = await supabase.auth.getUser()
const { data: session } = await supabase.auth.getSession()
```

### Storage
```typescript
const { data: files } = await supabase.storage.from('avatars').list()
const { data: upload } = await supabase.storage.from('avatars').upload('path', file)
```

## Table Mapping

Tables are automatically mapped to REST endpoints:

- `customers` → `/api/customers`
- `transactions` → `/api/transactions`
- `products` → `/api/products`
- `prices` → `/api/prices`
- `accounts` → `/api/accounts`
- `transfers` → `/api/transfers`
- `balances` → `/api/balances`
- `metrics` → `/api/metrics/daily`
- Other tables → `/db/{table}` (fallback)

## Environment Variables

```bash
# Enable Supabase fixture mode
INJECT_FIXTURES=1

# Set fixture server URL (default: http://localhost:4000)
FIXTURE_URL=http://localhost:4000

# Your app will now use fixture data instead of real Supabase
npm start
```

## Example

See `examples/supabase-demo.ts` for a complete working example:

```bash
INJECT_FIXTURES=1 npx tsx examples/supabase-demo.ts
```
