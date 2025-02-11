# @greybox/durable-object-helpers

## 2.2.0

### Minor Changes

- Update dependencies

### Patch Changes

- Updated dependencies
  - @greybox/hono-typed-fetcher@2.2.0

## 2.1.1

### Patch Changes

- Update dependencies
- Updated dependencies
  - @greybox/hono-typed-fetcher@2.1.2

## 2.1.0

### Minor Changes

- Refactor WebSocket session handling for improved concurrency and error management

  - Updated the session creation process in BaseWebSocketDO to utilize Promise.all for concurrent handling of multiple WebSocket sessions.
  - Modified the createSession method to return a Promise, allowing for asynchronous session initialization.
  - Enhanced error handling during session setup to ensure proper logging and error management across WebSocket connections.

## 2.0.0

### Major Changes

- Enhance WebSocket handling and buffer message processing in tests

  - Added support for handling various WebSocket array buffer messages in BaseWebSocketDO tests, including empty, small, and large buffers.
  - Implemented broadcasting functionality with self-exclusion for multiple WebSocket sessions, ensuring clients can send and receive messages appropriately.
  - Updated the BaseSession and BaseWebSocketDO classes to handle new message types: "broadcast" and "broadcast-exclude-self".
  - Improved buffer message handling to provide detailed responses based on buffer content.
  - Refactored test cases to validate new WebSocket features and ensure robust testing of session management.

## 1.1.0

### Minor Changes

- Enhance error handling in BaseWebSocketDO class

  - Wrapped session creation, message handling, and session closure in try-catch blocks to improve error management.
  - Added console error logging for better debugging and tracking of issues during WebSocket operations.
  - Ensured that sessions are properly closed and cleaned up in case of errors, maintaining application stability.

## 1.0.0

### Major Changes

- Initial Version
