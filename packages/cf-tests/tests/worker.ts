import { DurableObject } from "cloudflare:workers";
import { BaseSession } from "@greybox/durable-object-helpers/BaseSession";
import { BaseWebSocketDO } from "@greybox/durable-object-helpers/BaseWebSocketDO";
import type { DOWithHonoApp } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

// Test implementations for BaseWebSocketDO
interface TestParticipant {
	id: string;
}

export type TestServerMessage =
	| {
			type: "welcome";
			message: string;
	  }
	| {
			type: "error";
			error: string;
	  };

type TestClientMessage =
	| {
			type: "join";
	  }
	| {
			type: "ping";
	  }
	| {
			type: "broadcast";
			message: string;
	  }
	| {
			type: "broadcast-exclude-self";
			message: string;
	  }
	| {
			type: "server-close";
	  }
	| {
			type: "error-trigger";
	  };

type SuperSession = BaseSession<
	TestEnv,
	TestParticipant,
	TestServerMessage,
	TestClientMessage
>;

class TestSession extends BaseSession<
	TestEnv,
	TestParticipant,
	TestServerMessage,
	TestClientMessage
> {
	protected createData: SuperSession["createData"] = (
		_ctx,
	): TestParticipant => ({
		id: crypto.randomUUID(),
	});

	handleMessage: SuperSession["handleMessage"] = async (message) => {
		switch (message.type) {
			case "join": {
				this.send({
					type: "welcome",
					message: "Welcome to the test session!",
				});
				break;
			}
			case "ping": {
				this.send({
					type: "welcome",
					message: "pong",
				});
				break;
			}
			case "broadcast": {
				this.broadcast(
					{
						type: "welcome",
						message: `Broadcast: ${message.message}`,
					},
					false,
				);
				break;
			}
			case "broadcast-exclude-self": {
				this.broadcast(
					{
						type: "welcome",
						message: `Broadcast (excluding self): ${message.message}`,
					},
					true,
				);
				break;
			}
			case "server-close": {
				this.send({
					type: "welcome",
					message: "Server is closing this connection",
				});
				// Close the WebSocket connection from the server side
				this.websocket.close(1000, "Closed by server");
				break;
			}
			case "error-trigger": {
				// First send an error message to the client
				this.send({
					type: "error",
					error: "Error triggered by client request",
				});

				// Then we simulate an error by throwing an exception
				// This will be caught by the base class but won't close the connection
				throw new Error("Simulated error for testing error handling");

				// In a real implementation, we might choose to close the connection on certain errors
				// this.websocket.close(1011, "Error occurred");
			}
		}
	};

	handleBufferMessage: SuperSession["handleBufferMessage"] = async (buffer) => {
		if (buffer.byteLength === 0) {
			this.send({
				type: "welcome",
				message: "Received empty buffer",
			});
			return;
		}

		const view = new Int32Array(buffer);

		if (view.length <= 4) {
			// For small buffers, show all values
			const values = Array.from(view).join(", ");
			this.send({
				type: "welcome",
				message: `Received buffer with values: ${values}`,
			});
		} else {
			// For large buffers, show length and first 10 values
			const first10 = Array.from(view.slice(0, 10)).join(", ");
			this.send({
				type: "welcome",
				message: `Received large buffer (${view.length} values), first 10 values: ${first10}`,
			});
		}
	};

	handleClose: SuperSession["handleClose"] = async () => {
		// Notify other sessions when one is closed, but only if there are other sessions
		// Get all sessions except this one
		const otherSessions = [...this.sessions.values()].filter((s) => s !== this);

		// Only broadcast if there are other sessions
		if (otherSessions.length > 0) {
			this.broadcast(
				{
					type: "welcome",
					message: `A session closed (id: ${this.data.id})`,
				},
				true,
			);
		}
	};
}

export class TestWebsocketDO extends BaseWebSocketDO<TestEnv, TestSession> {
	app = this.getBaseApp().get("/status", (c) => c.text("OK"));

	protected createSession(websocket: WebSocket): TestSession {
		return new TestSession(websocket, this.sessions);
	}
}

export type TestEnv = {
	TEST_DO: DurableObjectNamespace<TestDO>;
	WS_TEST_DO: DurableObjectNamespace<TestWebsocketDO>;
	TEST_VALUE: string;
};

export type TestHonoEnv = {
	Bindings: TestEnv;
};

export class TestDO extends DurableObject<TestEnv> implements DOWithHonoApp {
	constructor(ctx: DurableObjectState, env: TestEnv) {
		super(ctx, env);

		console.log("TestDO constructor", ctx.id);
	}

	app = new Hono<TestHonoEnv>()
		.get("/test", (c) => {
			console.log("GET /test");
			return c.json({ method: "GET", id: this.ctx.id });
		})
		.post("/test", async (c) => {
			const body = await c.req.json();
			return c.json({ method: "POST", body, id: this.ctx.id });
		})
		.put("/test", async (c) => {
			const body = await c.req.json();
			return c.json({ method: "PUT", body, id: this.ctx.id });
		})
		.delete("/test", (c) => c.json({ method: "DELETE", id: this.ctx.id }))
		.patch("/test", async (c) => {
			const body = await c.req.json();
			return c.json({ method: "PATCH", body, id: this.ctx.id });
		})
		.post(
			"/test-json-validated",
			zValidator(
				"json",
				z.object({
					item: z.string(),
					quantity: z.number(),
				}),
			),
			async (c) => {
				const body = c.req.valid("json");
				return c.json({
					method: "POST",
					body,
					id: this.ctx.id,
					validated: "json",
				});
			},
		)
		.post(
			"/test-form-validated",
			zValidator(
				"form",
				z.object({
					item: z.string(),
					quantity: z.coerce.number(),
				}),
			),
			async (c) => {
				const body = c.req.valid("form");
				return c.json({
					method: "POST",
					body,
					id: this.ctx.id,
					validated: "form",
				});
			},
		)
		.post("/test-json-unvalidated", async (c) => {
			const body = await c.req.json();
			return c.json({
				method: "POST",
				body,
				id: this.ctx.id,
				validated: false,
			});
		})
		.post("/test-form-unvalidated", async (c) => {
			const body = await c.req.parseBody();
			return c.json({
				method: "POST",
				body,
				id: this.ctx.id,
				validated: false,
			});
		});

	override async fetch(request: Request) {
		console.log("fetch!?", request.url);
		return this.app.fetch(request);
	}
}

const worker = new Hono<TestHonoEnv>()
	.all("/test/:id/*", async (c) => {
		console.log("all /test/:id/*", c.req.url);

		const id = c.req.param("id");
		const namespace = c.env.TEST_DO;
		const stub = namespace.get(namespace.idFromString(id));
		return stub.fetch(c.req.raw);
	})
	.all("/test-do/:id/*", async (c) => {
		console.log("all /test-do/:id/*", c.req.url);

		const id = c.req.param("id");
		const namespace = c.env.TEST_DO;
		const stub = namespace.get(namespace.idFromString(id));
		return stub.fetch(c.req.raw);
	})
	.all("*", (c) => {
		console.log("all *", c.req.url);
		return c.text(`Interesting path: ${c.req.url}`);
	});

export default worker;
