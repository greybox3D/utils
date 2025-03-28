# @greybox/wrangler-config-helper

## 3.1.2

### Patch Changes

- Another version bump

## 3.1.1

### Patch Changes

- Fix up versioning?

## 3.1.0

### Minor Changes

- Trying to bump with publish

## 3.0.0

### Major Changes

- Update dependencies and enhance WebSocket handling

  - Updated package versions across multiple packages, including:
    - @cloudflare/vitest-pool-workers to ^0.8.1
    - turbo to ^2.4.4
    - typescript to ^5.8.2
    - @changesets/cli to ^2.28.1
    - Various other dependencies in @greybox packages
  - Improved WebSocket handling in BaseWebSocketDO with better error management and closure handling
  - Refactored test cases in cf-tests to validate new WebSocket features and ensure robust session management
  - Updated linting scripts to use TypeScript compiler checks alongside biome checks for improved code quality

## 2.2.0

### Minor Changes

- Update dependencies

## 2.1.2

### Patch Changes

- Update dependencies

## 2.1.1

### Patch Changes

- Update dependencies

## 2.1.0

### Minor Changes

- 6806630: Make dependencies peer deps
- 1f169ca: Update dependencies

## 2.0.1

### Patch Changes

- Simplify exports

## 2.0.0

### Major Changes

- Upgrade to latest CF

## 1.5.1

### Patch Changes

- Adds JSON config file support alongside TOML

  • Extends configuration handling to support both TOML and JSON formats
  • Determines file format based on extension
  • Updates file reading and writing logic to handle both formats appropriately
  • Maintains backward compatibility with existing TOML configs

  Improves flexibility by allowing developers to use their preferred config format

## 1.5.0

### Minor Changes

- Update dependencies

## 1.4.1

### Patch Changes

- Improve tsconfigs

## 1.4.0

### Minor Changes

- Update dependencies, fix some issues

## 1.3.0

### Minor Changes

- Add patchConfig functionality

## 1.2.2

### Patch Changes

- Fix publish configs

## 1.2.1

### Patch Changes

- Update READMEs

## 1.2.0

### Minor Changes

- Upgrade dependencies

## 1.1.4

### Patch Changes

- Try individual publish

## 1.1.3

### Patch Changes

- Use directory for repository

## 1.1.2

### Patch Changes

- Moved to new repo

## 1.1.1

### Patch Changes

- Lint

## 1.1.0

### Minor Changes

- Added linting support with Biome and improved package configuration:
  - Added lint and lint:fix scripts using Biome
  - Included additional files in the package (tsconfig.json, README.md, LICENSE)
  - Added @biomejs/biome as a trusted dependency
  - Minor code formatting improvements
