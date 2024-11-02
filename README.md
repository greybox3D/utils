# Greybox Utils

A collection of utility packages for Cloudflare Workers, DrizzleORM, and related technologies. Set up as a monorepo using Bun and Turborepo for efficient management and building.

## Packages

- `@greybox/biome-config`: Shared Biome (linter/formatter) configuration
- `@greybox/drizzle-utils`: Enhanced batch update functionality for DrizzleORM with PostgreSQL
- `@greybox/hono-typed-fetcher`: Type-safe fetcher for Hono apps and Durable Objects
- `@greybox/shared-tsconfig`: Shared TypeScript configuration
- `@greybox/wrangler-config-helper`: Utilities for Wrangler configuration management

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- [Bun](https://bun.sh/) (latest version)

This project uses Bun and Turborepo. While npm or Yarn may work, they are not officially supported.

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```

## Available Scripts

In the project directory, you can run:

### `bun run test`

Runs tests for all packages.

### `bun run test:watch`

Runs tests in watch mode.

### `bun run lint`

Runs Biome linter across all packages.

### `bun run lint:fix`

Runs Biome linter and fixes errors.

## Publishing

### Prerequisites

1. Create an NPM account if needed
2. Generate an NPM access token:
   - Go to npmjs.com → Your profile → Access Tokens
   - Create a new "Automation" token
3. Add your NPM token to `.env`:
   ```
   NPM_CONFIG_TOKEN=your-npm-token-here
   ```

### Publishing Process

1. Create a changeset for each meaningful change:
   ```bash
   bun changeset
   ```
   - Select modified packages
   - Choose version bump type
   - Describe changes

2. When ready to publish:
   ```bash
   # Update versions and changelogs
   bun changeset version

   # Publish to NPM
   bun publish-package
   ```

The `publish-package` command will:
- Verify NPM token
- Build packages
- Publish updates to NPM

Note: Commit changes before running `changeset version` as it creates version update commits.

## Learn More

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [DrizzleORM](https://orm.drizzle.team/)
- [Turborepo](https://turbo.build/repo)
- [Biome](https://biomejs.dev/)
- [Vitest](https://vitest.dev/)
- [Hono](https://hono.dev/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
