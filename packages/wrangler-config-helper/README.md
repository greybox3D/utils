# @greybox/wrangler-config-helper

Utilities for managing Wrangler configurations and test environments for Cloudflare Workers.

## Installation

```bash
bun add @greybox/wrangler-config-helper
```

## Features

- Environment-specific configuration management
- Test environment setup helpers
- Automatic cleanup of temporary files
- TypeScript support

## Basic Usage

### Configuration Management

```typescript
import { WranglerConfigHelper } from '@greybox/wrangler-config-helper';

const configHelper = new WranglerConfigHelper('./wrangler.toml');
const configPath = configHelper.prepareEnvironmentConfig('staging');

// Clean up when done
configHelper.cleanup();
```

## API Documentation

Full API documentation is available in the source code and type definitions.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License
