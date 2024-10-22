# @greybox/wrangler-config-helper

A utility package to simplify the configuration process for Cloudflare Workers using Wrangler, particularly for managing environment-specific configurations and setting up tests.

## Installation

Install the package using npm:

```bash
npm install @greybox/wrangler-config-helper
```

Or using yarn:

```bash
yarn add @greybox/wrangler-config-helper
```

## Usage

This package provides two main classes: `WranglerConfigHelper` for managing Wrangler configurations, and `WranglerTestSetup` for setting up test environments.

### WranglerConfigHelper

Import the `WranglerConfigHelper` class:

```ts
import { WranglerConfigHelper } from '@greybox/wrangler-config-helper';
```

Create an instance and use it to prepare environment-specific configurations:

```ts
const configHelper = new WranglerConfigHelper('./wrangler.toml');
const configPath = configHelper.prepareEnvironmentConfig('staging');

// After you're done, clean up the temporary files:
configHelper.cleanup();
```

### WranglerTestSetup

Import the `WranglerTestSetup` class for setting up test environments:

```ts
import { WranglerTestSetup } from '@greybox/wrangler-config-helper';
```

Create an instance and use it to set up a test environment:

```ts
const testSetup = new WranglerTestSetup<MyEnv>(
  './wrangler.toml',
  './src/worker.ts',
  { environment: 'test' }
);

// In your test setup
const abortController = new AbortController();
await testSetup.setup(abortController.signal);

// Access the environment
const env = testSetup.env;

// In your test teardown
await testSetup.cleanup();
```

## Features

- Reads and parses existing Wrangler TOML configuration files
- Creates temporary environment-specific configurations
- Appends environment name to the Worker name for easy identification
- Provides cleanup method to remove temporary files
- Simplifies setup of test environments for Cloudflare Workers

## Example: Deployment Script

Here's an example of how you might use `WranglerConfigHelper` in a deployment script:

```ts
import { WranglerConfigHelper } from '@greybox/wrangler-config-helper';
import { execSync } from 'child_process';

const deploy = (environment: string) => {
  const configHelper = new WranglerConfigHelper('./wrangler.toml');
  
  try {
    const configPath = configHelper.prepareEnvironmentConfig(environment);
    
    // Use the generated config file with Wrangler
    execSync(`wrangler deploy --config ${configPath}`, { stdio: 'inherit' });
  } finally {
    // Clean up temporary files
    configHelper.cleanup();
  }
};

// Deploy to staging
deploy('staging');
```

## Example: Setting Up Tests

Here's an example of how you might use `WranglerTestSetup` in your tests:

```ts
import { WranglerTestSetup } from '@greybox/wrangler-config-helper';

describe('My Worker Tests', () => {
  let testSetup: WranglerTestSetup<MyEnv>;
  let abortController: AbortController;

  beforeAll(async () => {
    testSetup = new WranglerTestSetup<MyEnv>(
      './wrangler.toml',
      './src/worker.ts',
      { environment: 'test' }
    );
    abortController = new AbortController();
    await testSetup.setup(abortController.signal);
  });

  afterAll(async () => {
    await testSetup.cleanup();
    abortController.abort();
  });

  it('should access environment variables', () => {
    const env = testSetup.env;
    expect(env.MY_SECRET).toBeDefined();
  });

  // Add more tests here
});
```

## Benefits

- Simplifies management of environment-specific Wrangler configurations
- Avoids the need for multiple Wrangler configuration files
- Ensures consistent base configuration across environments
- Automatically handles temporary file creation and cleanup
- Facilitates easy setup of test environments for Cloudflare Workers

## TODO

- [ ] Add tests
      - Improve test coverage
      - Create a Wrangler config with an environment variable
      - Verify that the environment variable has the correct value

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
