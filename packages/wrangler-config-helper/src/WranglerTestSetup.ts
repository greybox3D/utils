import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getPlatformProxy } from "wrangler";
import { WranglerConfigHelper } from "./WranglerConfigHelper";

export class WranglerTestSetup<Env> {
	// private worker: UnstableDevWorker | null = null;
	private wranglerHelper: WranglerConfigHelper;
	private wranglerProcess: ReturnType<typeof spawn> | null = null;
	private platformProxy: { env: Env } | null = null;
	// private wranglerHelper: WranglerConfigHelper;

	constructor(
		private originalWranglerPath: string,
		private workerPath: string,
		private config: {
			environment?: string;
			skipPatching?: boolean;
		} = {},
	) {
		this.wranglerHelper = new WranglerConfigHelper(originalWranglerPath);
	}

	async setup(abortSignal: AbortSignal): Promise<void> {
		const proxyConfigPath = this.wranglerHelper.prepareEnvironmentConfig(
			this.config.environment,
			this.config.skipPatching,
		);

		abortSignal.addEventListener("abort", () => this.cleanup(), { once: true });

		// check the proxy config path exists
		if (!fs.existsSync(proxyConfigPath)) {
			throw new Error(`Proxy config path does not exist: ${proxyConfigPath}`);
		}

		// this.worker = await unstable_dev(this.workerPath, {
		// 	experimental: { disableExperimentalWarning: true },
		// 	local: true,
		// 	env: this.config.environment,
		// 	config: this.originalWranglerPath,
		// 	persist: false,
		// });

		this.wranglerProcess = spawn(
			"bun",
			[
				"wrangler",
				"dev",
				"-e",
				this.config.environment ?? "",
				"--config",
				this.originalWranglerPath,
			],
			{
				cwd: path.dirname(this.workerPath),
				stdio: "inherit",
			},
		);

		this.platformProxy = await getPlatformProxy<Env>({
			configPath: proxyConfigPath,
			environment: this.config.environment,
			persist: false,
		});
	}

	get env(): Env {
		if (!this.platformProxy) {
			throw new Error(
				"WranglerTestSetup not initialized. Call await setup() first.",
			);
		}
		return this.platformProxy.env;
	}

	async cleanup(): Promise<void> {
		if (this.wranglerProcess) {
			this.wranglerProcess.kill();
		}
		this.wranglerHelper.cleanup();
	}
}
