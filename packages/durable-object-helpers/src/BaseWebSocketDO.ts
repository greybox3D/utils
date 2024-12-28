import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@greybox/hono-typed-fetcher/honoDoFetcher";
import { type Context, Hono } from "hono";
import type { BaseSession, SessionClientMessage } from "./BaseSession";

const textDecoder = new TextDecoder();

export abstract class BaseWebSocketDO<
		TEnv extends object,
		TSession extends BaseSession<TEnv>,
	>
	extends DurableObject<TEnv>
	implements DOWithHonoApp
{
	protected readonly sessions = new Map<WebSocket, TSession>();

	constructor(ctx: DurableObjectState, env: TEnv) {
		super(ctx, env);

		this.ctx.blockConcurrencyWhile(async () => {
			const websockets = this.ctx.getWebSockets();
			for (const websocket of websockets) {
				try {
					const session = this.createSession(websocket);
					session.resume();
					this.sessions.set(websocket, session);
				} catch (error) {
					console.error(`Error during session setup: ${error}`);
					await this.webSocketError(websocket, error);
				}
			}
		});
	}

	protected getBaseApp() {
		return new Hono<{ Bindings: TEnv }>().get(
			"/websocket",
			async (ctx): Promise<Response> => {
				const { req } = ctx;
				if (req.header("Upgrade") !== "websocket") {
					console.error("Expected websocket");
					return ctx.text("Expected websocket", 400);
				}

				const [client, server] = Object.values(new WebSocketPair());

				try {
					await this.handleSession(ctx, server);
					return new Response(null, { status: 101, webSocket: client });
				} catch (error) {
					console.error(error);
					client.accept();
					client.send(
						JSON.stringify({
							error: "Uncaught exception during session setup.",
						}),
					);
					client.close(1011, "Uncaught exception during session setup.");
					return new Response(null, { status: 101, webSocket: client });
				}
			},
		);
	}

	abstract app: Hono<{ Bindings: TEnv }>;

	protected abstract createSession(websocket: WebSocket): TSession;

	async handleSession(
		ctx: Context<{ Bindings: TEnv }>,
		ws: WebSocket,
	): Promise<void> {
		this.ctx.acceptWebSocket(ws);
		try {
			const session = this.createSession(ws);
			session.startFresh(ctx);
			this.sessions.set(ws, session);
		} catch (error) {
			console.error(`Error during session setup: ${error}`);
			this.webSocketError(ws, error);
		}
	}

	override async webSocketMessage(
		ws: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		const session = this.sessions.get(ws);
		if (!session) return;

		try {
			let messageString: string;
			if (message instanceof ArrayBuffer) {
				messageString = textDecoder.decode(message);
			} else {
				messageString = message;
			}

			const parsed = JSON.parse(
				messageString,
			) as SessionClientMessage<TSession>;
			await session.handleMessage(parsed);
		} catch (error) {
			console.error(`Error during session message: ${error}`);
		}
	}

	override async webSocketClose(ws: WebSocket) {
		const session = this.sessions.get(ws);
		if (!session) return;

		try {
			await this.#handleClose(session);
		} catch (error) {
			console.error(`Error during session close: ${error}`);
		}
	}

	override async webSocketError(ws: WebSocket, error: unknown) {
		const session = this.sessions.get(ws);
		if (!session) {
			ws.close(1011, "Error during session setup.");
			return;
		}

		console.error(`Error for session: ${error}`);
		try {
			await this.#handleClose(session);
		} catch (error) {
			console.error(`Error during session close: ${error}`);
		} finally {
			ws.close(1011, "Error during session.");
		}
	}

	async #handleClose(session: TSession) {
		try {
			await session.handleClose();
		} catch (error) {
			console.error(`Error during session close: ${error}`);
		} finally {
			this.sessions.delete(session.websocket);
		}
	}

	override fetch(request: Request): Response | Promise<Response> {
		return this.app.fetch(request, this.env);
	}
}
