import { DurableObject } from "cloudflare:workers";
import { BaseSession } from "@greybox/durable-object-helpers/BaseSession";
import { BaseWebSocketDO } from "@greybox/durable-object-helpers/BaseWebSocketDO";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { DOWithHonoApp } from "../../hono-typed-fetcher/src/honoDoFetcher";

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
		}
	};

	handleClose: SuperSession["handleClose"] = async () => {
		// Nothing to do on close for test
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
