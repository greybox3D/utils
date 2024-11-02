# @greybox/hono-typed-fetcher

Type-safe fetcher for Hono apps and Cloudflare Durable Objects.

## Installation

```bash
bun add @greybox/hono-typed-fetcher
```

## Features

- Type-safe fetchers for Hono apps
- Support for Cloudflare Durable Objects
- Multiple fetcher implementations:
  - App-based
  - Direct fetch
  - Ky-based
- Automatic path parameter handling
- JSON and form data support with type validation
- Full TypeScript support with inferred response types

## Basic Usage

### GET Request

```typescript
import { Hono } from 'hono';
import { honoFetcher } from '@greybox/hono-typed-fetcher';

const app = new Hono()
  .get('/users/:id', (c) => {
    const id = c.req.param('id');
    return c.json({ id, name: `User ${id}` });
  });

const fetcher = honoFetcher<typeof app>((request, init) => {
  return fetch(request, init);
});

// Type-safe GET request
const response = await fetcher.get({
  url: '/users/:id',
  params: { id: '123' }
});
const data = await response.json();
// data is typed as { id: string, name: string }
```

### POST Request with JSON Body

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono()
  .post('/items', 
    zValidator('json', z.object({
      item: z.string()
    })),
    async (c) => {
      const body = c.req.valid('json');
      return c.json({ success: true, body });
    }
  );

const fetcher = honoFetcher<typeof app>(app.request);

// Type-safe POST request with JSON body
const response = await fetcher.post({
  url: '/items',
  body: { item: 'newItem' }
});
const data = await response.json();
// data is typed as { success: boolean, body: { item: string } }
```

### POST Request with Form Data

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono()
  .post('/items-form',
    zValidator('form', z.object({
      item: z.string(),
      quantity: z.coerce.number()
    })),
    async (c) => {
      const body = c.req.valid('form');
      return c.json({ success: true, body });
    }
  );

const fetcher = honoFetcher<typeof app>(app.request);

// Type-safe POST request with form data
const response = await fetcher.post({
  url: '/items-form',
  form: {
    item: 'newItem',
    quantity: '5'  // Will be coerced to number
  }
});
const data = await response.json();
// data is typed as { success: boolean, body: { item: string, quantity: number } }
```

## Fetcher Types

### App-based Fetcher

```typescript
import { appHonoFetcher } from '@greybox/hono-typed-fetcher/appHonoFetcher';

const fetcher = appHonoFetcher<typeof app>(app);
```

### Direct Fetch

```typescript
import { fetchHonoFetcher } from '@greybox/hono-typed-fetcher/fetchHonoFetcher';

const fetcher = fetchHonoFetcher<typeof app>('https://api.example.com');
```

### Durable Objects

```typescript
import { doFetcherWithName } from '@greybox/hono-typed-fetcher/doFetcher';

const fetcher = doFetcherWithName(env.MY_DURABLE_OBJECT, 'instance-name');
```

### Ky-based Fetcher

```typescript
import { honoKyFetcher } from '@greybox/hono-typed-fetcher/honoKyFetcher';

const fetcher = honoKyFetcher<typeof app>('https://api.example.com');
```

## API Documentation

Full API documentation is available in the source code and type definitions.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License
