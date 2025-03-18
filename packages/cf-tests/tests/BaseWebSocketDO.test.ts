import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestServerMessage, TestWebsocketDO } from "./worker";

import { env } from "cloudflare:test";

declare module "cloudflare:test" {
	interface ProvidedEnv {
		WS_TEST_DO: DurableObjectNamespace<TestWebsocketDO>;
	}
}

describe("BaseWebSocketDO", () => {
	let stub: DurableObjectStub;
	let ws1: WebSocket;
	let ws2: WebSocket;
	let messages1: TestServerMessage[] = [];
	let messages2: TestServerMessage[] = [];

	beforeEach(() => {
		stub = env.WS_TEST_DO.get(env.WS_TEST_DO.idFromName("test"));
		messages1 = [];
		messages2 = [];
	});

	afterEach(() => {
		if (ws1?.readyState === WebSocket.OPEN) ws1.close();
		if (ws2?.readyState === WebSocket.OPEN) ws2.close();
	});

	async function setupWebSocket(response: Response): Promise<WebSocket> {
		expect(response.status).toBe(101);
		const ws = (response as unknown as { webSocket: WebSocket }).webSocket;
		expect(ws).toBeDefined();
		expect(ws).not.toBeNull();
		expect(ws.readyState).toBe(WebSocket.OPEN);
		ws.accept();
		return ws;
	}

	it("should handle HTTP requests", async () => {
		const res = await stub.fetch("http://localhost/status");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	it("should establish WebSocket connection", async () => {
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});

		ws1 = await setupWebSocket(response);
		ws1.addEventListener("message", (event) => {
			messages1.push(JSON.parse(event.data.toString()));
		});
	});

	it("should handle WebSocket messages", async () => {
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});

		ws1 = await setupWebSocket(response);
		ws1.addEventListener("message", (event) => {
			messages1.push(JSON.parse(event.data.toString()));
		});

		// Send join message
		ws1.send(JSON.stringify({ type: "join" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify welcome message
		expect(messages1[0]).toEqual({
			type: "welcome",
			message: "Welcome to the test session!",
		});

		// Send ping message
		ws1.send(JSON.stringify({ type: "ping" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify pong response
		expect(messages1[1]).toEqual({
			type: "welcome",
			message: "pong",
		});

		// Test array buffer message
		const buffer = new ArrayBuffer(4);
		const view = new Int32Array(buffer);
		view[0] = 42;
		ws1.send(buffer);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify buffer response
		expect(messages1[2]).toEqual({
			type: "welcome",
			message: "Received buffer with values: 42",
		});
	});

	it("should handle invalid WebSocket upgrade requests", async () => {
		const res = await stub.fetch("http://localhost/websocket");
		expect(res.status).toBe(400);
		expect(await res.text()).toBe("Expected websocket");
	});

	it("should handle WebSocket disconnection", async () => {
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});

		ws1 = await setupWebSocket(response);
		ws1.addEventListener("message", (event) => {
			messages1.push(JSON.parse(event.data.toString()));
		});

		// Test connection and basic message
		ws1.send(JSON.stringify({ type: "join" }));
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(messages1.length).toBe(1);
		expect(messages1[0]).toEqual({
			type: "welcome",
			message: "Welcome to the test session!",
		});

		// Close connection
		ws1.close();
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Try sending message after close
		try {
			ws1.send(JSON.stringify({ type: "ping" }));
		} catch (error) {
			expect(error).toBeDefined();
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBe(
				"Can't call WebSocket send() after close().",
			);
		}
	});

	it("should handle various WebSocket array buffer messages", async () => {
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});

		ws1 = await setupWebSocket(response);
		ws1.addEventListener("message", (event) => {
			messages1.push(JSON.parse(event.data.toString()));
		});

		// Test empty array buffer
		const emptyBuffer = new ArrayBuffer(0);
		ws1.send(emptyBuffer);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(messages1[0]).toEqual({
			type: "welcome",
			message: "Received empty buffer",
		});

		// Test small array buffer with multiple values
		const smallBuffer = new ArrayBuffer(16);
		const smallView = new Int32Array(smallBuffer);
		smallView[0] = 42;
		smallView[1] = -123;
		smallView[2] = 999;
		smallView[3] = 0;
		ws1.send(smallBuffer);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(messages1[1]).toEqual({
			type: "welcome",
			message: "Received buffer with values: 42, -123, 999, 0",
		});

		// Test large array buffer
		const largeBuffer = new ArrayBuffer(1024);
		const largeView = new Int32Array(largeBuffer);
		for (let i = 0; i < largeView.length; i++) {
			largeView[i] = i * 2;
		}
		ws1.send(largeBuffer);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(messages1[2]).toEqual({
			type: "welcome",
			message: `Received large buffer (${largeView.length} values), first 10 values: 0, 2, 4, 6, 8, 10, 12, 14, 16, 18`,
		});
	});

	it("should handle multiple sessions and broadcasts", async () => {
		// Setup first WebSocket
		const response1 = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws1 = await setupWebSocket(response1);
		ws1.addEventListener("message", (event) => {
			messages1.push(JSON.parse(event.data.toString()));
		});

		// Setup second WebSocket
		const response2 = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws2 = await setupWebSocket(response2);
		ws2.addEventListener("message", (event) => {
			messages2.push(JSON.parse(event.data.toString()));
		});

		// Send join messages for both connections
		ws1.send(JSON.stringify({ type: "join" }));
		ws2.send(JSON.stringify({ type: "join" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify welcome messages
		expect(messages1[0]).toEqual({
			type: "welcome",
			message: "Welcome to the test session!",
		});
		expect(messages2[0]).toEqual({
			type: "welcome",
			message: "Welcome to the test session!",
		});

		// Test broadcast from first client
		ws1.send(
			JSON.stringify({ type: "broadcast", message: "Hello from client 1!" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Both clients should receive the broadcast
		expect(messages1[1]).toEqual({
			type: "welcome",
			message: "Broadcast: Hello from client 1!",
		});
		expect(messages2[1]).toEqual({
			type: "welcome",
			message: "Broadcast: Hello from client 1!",
		});

		// Test broadcast from second client
		ws2.send(
			JSON.stringify({ type: "broadcast", message: "Hello from client 2!" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Both clients should receive the second broadcast
		expect(messages1[2]).toEqual({
			type: "welcome",
			message: "Broadcast: Hello from client 2!",
		});
		expect(messages2[2]).toEqual({
			type: "welcome",
			message: "Broadcast: Hello from client 2!",
		});

		// Close one connection and verify broadcasts still work for remaining client
		ws1.close();
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Clear any messages that might have been sent during closure
		messages2 = [];

		ws2.send(
			JSON.stringify({ type: "broadcast", message: "After disconnect!" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Only the remaining client should receive this message
		expect(messages2[0]).toEqual({
			type: "welcome",
			message: "Broadcast: After disconnect!",
		});
		expect(messages1.length).toBe(3); // First client should not receive any more messages
	});

	// Helper function to check if a WebSocket is effectively closed
	function isEffectivelyClosed(ws: WebSocket): boolean {
		return (
			ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED
		);
	}

	// Helper function to wait for a WebSocket to fully close, with timeout
	async function waitForClose(
		ws: WebSocket,
		timeoutMs = 5000,
	): Promise<boolean> {
		if (ws.readyState === WebSocket.CLOSED) return true;

		return new Promise<boolean>((resolve) => {
			const closeListener = () => {
				cleanup();
				resolve(true);
			};

			// Set up timeout
			const timeoutId = setTimeout(() => {
				cleanup();
				resolve(false);
			}, timeoutMs);

			// Clean up function to remove listeners
			const cleanup = () => {
				ws.removeEventListener("close", closeListener);
				clearTimeout(timeoutId);
			};

			// Add close listener
			ws.addEventListener("close", closeListener);

			// Handle case where WebSocket is already closed
			if (ws.readyState === WebSocket.CLOSED) {
				cleanup();
				resolve(true);
			}
		});
	}

	it("should handle broadcasts with self-exclusion", async () => {
		// Setup first WebSocket
		const response1 = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws1 = await setupWebSocket(response1);
		ws1.addEventListener("message", (event) => {
			messages1.push(JSON.parse(event.data.toString()));
		});

		// Setup second WebSocket
		const response2 = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws2 = await setupWebSocket(response2);
		ws2.addEventListener("message", (event) => {
			messages2.push(JSON.parse(event.data.toString()));
		});

		// Send join messages for both connections
		ws1.send(JSON.stringify({ type: "join" }));
		ws2.send(JSON.stringify({ type: "join" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Clear welcome messages
		messages1 = [];
		messages2 = [];

		// Test broadcast with self-exclusion from first client
		ws1.send(
			JSON.stringify({
				type: "broadcast-exclude-self",
				message: "Hello from client 1!",
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Only the second client should receive the broadcast
		expect(messages1.length).toBe(0); // Sender should not receive the message
		expect(messages2[0]).toEqual({
			type: "welcome",
			message: "Broadcast (excluding self): Hello from client 1!",
		});

		// Test broadcast with self-exclusion from second client
		ws2.send(
			JSON.stringify({
				type: "broadcast-exclude-self",
				message: "Hello from client 2!",
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Only the first client should receive the broadcast
		expect(messages1[0]).toEqual({
			type: "welcome",
			message: "Broadcast (excluding self): Hello from client 2!",
		});
		expect(messages2.length).toBe(1); // Second client should not receive its own message

		// Compare with regular broadcast
		ws1.send(
			JSON.stringify({
				type: "broadcast",
				message: "Regular broadcast",
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Both clients should receive the regular broadcast
		expect(messages1[1]).toEqual({
			type: "welcome",
			message: "Broadcast: Regular broadcast",
		});
		expect(messages2[1]).toEqual({
			type: "welcome",
			message: "Broadcast: Regular broadcast",
		});
	});

	it("should properly close WebSocket connections", async () => {
		// Setup WebSocket
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws1 = await setupWebSocket(response);

		// Send join message to establish the session
		ws1.send(JSON.stringify({ type: "join" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify connection is open
		expect(ws1.readyState).toBe(WebSocket.OPEN);

		// Close the WebSocket from the client side
		ws1.close(1000, "Normal client closure");

		// Wait for a moment to allow close processing
		await new Promise((resolve) => setTimeout(resolve, 300));

		// Verify WebSocket is closing or closed
		expect(isEffectivelyClosed(ws1)).toBe(true);

		// Sending a message after close should fail
		try {
			ws1.send(JSON.stringify({ type: "ping" }));
			// If we get here, the test should fail
			expect(true).toBe(false);
		} catch (error) {
			expect(error).toBeDefined();
			expect(error).toBeInstanceOf(Error);
		}
	});

	it("should handle server-initiated WebSocket closure", async () => {
		// Setup WebSocket
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws1 = await setupWebSocket(response);

		let closeCode = 0;
		let closeReason = "";

		ws1.addEventListener("close", (event) => {
			closeCode = event.code;
			closeReason = event.reason;
		});

		// Verify connection is open
		expect(ws1.readyState).toBe(WebSocket.OPEN);

		// Send a message that triggers server-side close
		ws1.send(JSON.stringify({ type: "server-close" }));

		// Wait for a moment to allow close processing
		await new Promise((resolve) => setTimeout(resolve, 300));

		// Verify the WebSocket is closing or closed
		expect(isEffectivelyClosed(ws1)).toBe(true);

		// If a close event fired, verify the code and reason
		if (closeCode !== 0) {
			expect(closeCode).toBe(1000);
			expect(closeReason).toBe("Closed by server");
		}
	});

	it("should handle WebSockets that are already closing", async () => {
		// Setup WebSocket
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws1 = await setupWebSocket(response);

		// First, send a join message
		ws1.send(JSON.stringify({ type: "join" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Initiate client-side closing
		ws1.close(1000, "Client initiated close");

		// Try to send another message right after closing
		// This should fail with an error
		try {
			ws1.send(JSON.stringify({ type: "ping" }));
			// If we get here, the test should fail
			expect(true).toBe(false);
		} catch (error) {
			// This is expected behavior
			expect(error).toBeDefined();
		}

		// Wait for a moment to allow close processing
		await new Promise((resolve) => setTimeout(resolve, 300));

		// Verify the WebSocket is closing or closed
		expect(isEffectivelyClosed(ws1)).toBe(true);
	});

	it("should handle errors on WebSockets properly", async () => {
		// Setup WebSocket
		const response = await stub.fetch("http://localhost/websocket", {
			headers: { upgrade: "websocket" },
		});
		ws1 = await setupWebSocket(response);

		interface ResponseMessage {
			type: string;
			[key: string]: unknown;
		}

		const receivedMessages: ResponseMessage[] = [];
		ws1.addEventListener("message", (event) => {
			receivedMessages.push(JSON.parse(event.data.toString()));
		});

		// First, send a join message to establish the session
		ws1.send(JSON.stringify({ type: "join" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify connection is open
		expect(ws1.readyState).toBe(WebSocket.OPEN);

		// Send a message that triggers an error on the server
		ws1.send(JSON.stringify({ type: "error-trigger" }));

		// Wait for error handling to complete and message to be received
		await new Promise((resolve) => setTimeout(resolve, 150));

		// We should receive an error message from the server
		expect(receivedMessages.some((msg) => msg.type === "error")).toBe(true);

		// The WebSocket should remain open despite the error
		expect(ws1.readyState).toBe(WebSocket.OPEN);

		// We should be able to continue sending messages
		ws1.send(JSON.stringify({ type: "ping" }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		// And we should receive a response
		expect(
			receivedMessages.some(
				(msg) => msg.type === "welcome" && msg.message === "pong",
			),
		).toBe(true);
	});
});
