# Greybox Utils

This project is a collection of utility packages for Cloudflare Workers and related technologies. It's set up as a monorepo using Bun and Turborepo for efficient management and building.

## Project Structure

The project is organized as follows:

- `packages/`:
  - `@greybox/biome-config`: Biome (linter/formatter) configuration
  - `@greybox/hono-typed-fetcher`: Type-safe fetcher for Hono apps and Durable Objects
  - `@greybox/shared-tsconfig`: Shared TypeScript configuration
  - `@greybox/wrangler-config-helper`: Utilities for Wrangler configuration

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- [Bun](https://bun.sh/) (latest version)

This project is set up to use Bun and Turborepo. While it may be possible to use npm or Yarn, this is not officially supported.

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```
   bun install
   ```

## Available Scripts

In the project directory, you can run:

### `bun run test`

Runs tests for all packages.

### `bun run test:watch`

Runs tests for all packages in watch mode.

### `bun run lint`

Runs the linter (Biome) across all packages.

### `bun run lint:fix`

Runs the linter (Biome) across all packages and fixes the linting errors.

## Features

- TypeScript support
- Biome for linting and formatting
- Vitest for testing
- Hono for API routing in Durable Objects
- Custom type-safe fetcher for Hono apps and Durable Objects
- Wrangler configuration helpers

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects)
- [Turborepo](https://turbo.build/repo)
- [Biome](https://biomejs.dev/)
- [Vitest](https://vitest.dev/)
- [Hono](https://hono.dev/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Publishing

### Prerequisites

1. Create an NPM account if you don't have one
2. Generate an NPM access token:
   - Go to npmjs.com → Your profile → Access Tokens
   - Create a new token with "Automation" type
3. Create a `.env` file in the root directory and add your NPM token:
   ```
   NPM_CONFIG_TOKEN=your-npm-token-here
   ```

### Publishing Process

1. Make your changes to the codebase
2. For each meaningful change, create a changeset:
   ```bash
   bun changeset
   ```
   - Select the packages that were modified
   - Choose the appropriate version bump (major/minor/patch)
   - Provide a description of the changes

3. Once all changes are ready to publish:
   ```bash
   # Update package versions and changelogs
   bun changeset version

   # Publish packages to NPM
   bun publish-package
   ```

The `publish-package` command will:
- Verify your NPM token is valid
- Build all packages
- Publish updated packages to NPM

Note: Make sure your changes are committed before running `changeset version` as it will create new commits for the version updates.

## License

This project is open source and available under the [MIT License](LICENSE).
