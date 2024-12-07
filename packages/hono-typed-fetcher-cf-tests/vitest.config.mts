import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		environment: "node",
		// Add any other Vitest configurations you need
		forceRerunTriggers: ["./tests/**/*.{ts,tsx}", "./wrangler.toml"],
		poolOptions: {
			workers: {
				singleWorker: true,
				wrangler: { configPath: "./tests/wrangler.toml" },
			},
		},
	},
});
