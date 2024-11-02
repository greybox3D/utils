# @greybox/drizzle-utils

Enhanced batch update functionality for DrizzleORM with PostgreSQL, offering optimized performance through SQL VALUES clause and intelligent update grouping.

## Installation

```bash
bun add @greybox/drizzle-utils
```

## Features

- Optimized batch updates using PostgreSQL's VALUES clause
- Intelligent grouping of heterogeneous updates
- Transaction-safe operations
- Support for PostgreSQL data types:
  - Integer
  - Text
  - UUID
  - JSONB
  - Vector (including high-dimensional)
  - Timestamp
- Automatic type validation for IDs
- Handles camelCase to snake_case field mapping

## Basic Usage

### Batch Update
Uses PostgreSQL's VALUES clause for optimal performance:

```typescript
import { batchUpdate } from '@greybox/drizzle-utils/batchUpdate';
import { pgTable, integer, text } from 'drizzle-orm/pg-core';

const users = pgTable('users', {
  id: integer('id').primaryKey(),
  name: text('name'),
  email: text('email'),
});

await batchUpdate(db, users, [
  {
    id: 1,
    update: { name: 'John', email: 'john@example.com' }
  },
  {
    id: 2,
    update: { name: 'Jane', email: 'jane@example.com' }
  }
]);
```

### Transaction Update
For cases where you need explicit transaction control:

```typescript
import { transactionUpdate } from '@greybox/drizzle-utils';

await transactionUpdate({
  db,
  table: users,
  tasks: [
    { id: 1, update: { name: 'John' } },
    { id: 2, update: { name: 'Jane' } }
  ],
  parallel: true // Optional: run updates in parallel
});
```

## Performance

Benchmarks run on:
- CPU: 12th Gen Intel(R) Core(TM) i7-12700H
- RAM: 15GB
- OS: Linux rog-m16 6.11.1-arch1-1.1-g14 (x86_64)

| Operation Type | Small (10) | Medium (100) | Large (1000) |
|---------------|------------|--------------|--------------|
| Single Field  | 889 ops/s  | 241 ops/s    | 30.23 ops/s  |
| Double Field  | 808 ops/s  | 180 ops/s    | 24.91 ops/s  |
| Mixed Fields  | 442 ops/s  | 142 ops/s    | 27.07 ops/s  |

Compared to traditional updates:
- Small batches: ~2.7x faster
- Medium batches: ~6.4x faster
- Large batches: ~7.5x faster

The performance gains come from:
1. Using PostgreSQL's VALUES clause
2. Automatically grouping similar updates
3. Minimizing the number of queries

## Advanced Usage

### Complex Types

```typescript
const items = pgTable('items', {
  id: uuid('id').primaryKey(),
  metadata: jsonb('metadata'),
  position: vector('position', { dimensions: 3 }),
  createdAt: timestamp('created_at')
});

await batchUpdate(db, items, [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    update: {
      metadata: { key: 'value' },
      position: [1.0, 2.0, 3.0],
      createdAt: new Date()
    }
  }
]);
```

### High-Dimensional Vectors
Efficiently handles large vector operations:

```typescript
const embeddings = pgTable('embeddings', {
  id: integer('id').primaryKey(),
  embedding: vector('embedding', { dimensions: 2000 })
});

await batchUpdate(db, embeddings, [
  {
    id: 1,
    update: {
      embedding: Array.from({ length: 2000 }, (_, i) => i * 0.001)
    }
  }
]);
```

## Implementation Details

- Uses SQL VALUES clause for efficient batch operations
- Automatically groups similar updates to minimize queries
- Validates ID types at runtime
- Handles type conversion for various PostgreSQL types
- Manages transaction safety for heterogeneous updates
- Supports parallel updates within transactions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License 