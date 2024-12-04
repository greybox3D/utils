# @greybox/wrangler-config-helper

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
