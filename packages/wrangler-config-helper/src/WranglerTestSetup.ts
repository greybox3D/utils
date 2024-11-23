import {
	type UnstableDevWorker,
	getPlatformProxy,
	unstable_dev,
} from "wrangler";
import { WranglerConfigHelper } from "./WranglerConfigHelper";

export class WranglerTestSetup<Env> {
	private worker: UnstableDevWorker | null = null;
	private platformProxy: { env: Env } | null = null;
	private wranglerHelper: WranglerConfigHelper;

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

		this.worker = await unstable_dev(this.workerPath, {
			experimental: { disableExperimentalWarning: true },
			local: true,
			env: this.config.environment,
			config: this.originalWranglerPath,
			persist: false,
		});

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
		await this.worker?.stop();
		this.wranglerHelper.cleanup();
	}
}
