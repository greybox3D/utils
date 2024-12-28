# @greybox/durable-object-helpers

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
