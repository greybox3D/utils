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
	let messages1: TestServerMessage[] = [];

	beforeEach(() => {
		stub = env.WS_TEST_DO.get(env.WS_TEST_DO.idFromName("test"));
		messages1 = [];
	});

	afterEach(() => {
		if (ws1?.readyState === WebSocket.OPEN) ws1.close();
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
});
