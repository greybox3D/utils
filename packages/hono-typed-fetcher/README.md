# @greybox/hono-typed-fetcher

A TypeScript library for creating type-safe fetchers for Hono apps and Cloudflare Durable Objects.

## Features

- Type-safe fetchers for Hono apps
- Support for Cloudflare Durable Objects
- Flexible fetcher implementations (app-based, direct fetch, and Ky-based)
- Automatic path parameter handling
- JSON and form data support

## Installation

```bash
bun add @greybox/hono-typed-fetcher
```

## Usage

### Creating a Hono Fetcher

```typescript
import { Hono } from 'hono';
import { honoFetcher } from '@greybox/hono-typed-fetcher';

const app = new Hono()
  .get('/users/:id', (c) => {
    const id = c.req.param('id');
    return c.json({ id, name: `User ${id}` });
  })
  .post('/items', async (c) => {
    const { item } = await c.req.json();
    return c.json({ success: true, item });
  });

const fetcher = honoFetcher<typeof app>((request, init) => {
  // Implement your fetch logic here
  return fetch(request, init);
});

// Type-safe GET request
const response = await fetcher.get({
  url: '/users/:id',
  params: { id: '123' }
});
const data = await response.json();
// data: { id: string, name: string }

// Type-safe POST request
const postResponse = await fetcher.post({
  url: '/items',
  body: { item: 'New Item' }
});
const postData = await postResponse.json();
// postData: { success: boolean, item: string }
```

### Using Different Fetcher Implementations

#### App-based Fetcher

```typescript
import { appHonoFetcher } from '@greybox/hono-typed-fetcher/appHonoFetcher';

const fetcher = appHonoFetcher<typeof app>(app);
```

#### Direct Fetch-based Fetcher

```typescript
import { fetchHonoFetcher } from '@greybox/hono-typed-fetcher/fetchHonoFetcher';

const fetcher = fetchHonoFetcher<typeof app>('https://api.example.com');
```

#### Ky-based Fetcher

```typescript
import { kyHonoFetcher } from '@greybox/hono-typed-fetcher/kyHonoFetcher';

const fetcher = kyHonoFetcher<typeof app>('https://api.example.com');
```

### Creating a Durable Object Fetcher

```typescript
import { doFetcherWithName, doFetcherWithId } from '@greybox/hono-typed-fetcher/doFetcher';

// Using name
const nameFetcher = doFetcherWithName(env.MY_DURABLE_OBJECT, 'instance-name');

// Using ID
const idFetcher = doFetcherWithId(env.MY_DURABLE_OBJECT, 'instance-id');

// Type-safe requests to Durable Objects
const response = await nameFetcher.get({ url: '/some-route' });
const data = await response.json();
```

## API

### `honoFetcher<T extends Hono>(fetcher: (request: string, init?: RequestInit) => Promise<Response>): TypedHonoFetcher<T>`

Creates a type-safe fetcher for a Hono app.

### `appHonoFetcher<T extends Hono>(app: T): TypedHonoFetcher<T>`

Creates a type-safe fetcher using a Hono app instance.

### `fetchHonoFetcher<T extends Hono>(baseUrl: string): TypedHonoFetcher<T>`

Creates a type-safe fetcher using the native fetch API.

### `kyHonoFetcher<T extends Hono>(baseUrl: string): TypedHonoFetcher<T>`

Creates a type-safe fetcher using the Ky HTTP client.

### `doFetcherWithName<T extends Rpc.DurableObjectBranded | undefined = undefined>(namespace: DurableObjectNamespace<T>, name: string): TypedFetcher<DurableObjectStub<T>>`

Creates a type-safe fetcher for a Durable Object using its name.

### `doFetcherWithId<T extends Rpc.DurableObjectBranded | undefined = undefined>(namespace: DurableObjectNamespace<T>, id: string): TypedFetcher<DurableObjectStub<T>>`

Creates a type-safe fetcher for a Durable Object using its ID.

## TypeScript Support

This library is written in TypeScript and provides full type safety for your Hono apps and Durable Objects.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
