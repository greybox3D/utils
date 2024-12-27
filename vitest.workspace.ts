import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		test: {
			include: ["packages/**/*.test.ts"],
			exclude: ["packages/hono-typed-fetcher-cf-tests/**"],
		},
	},
	defineWorkersConfig({
		test: {
			include: ["packages/hono-typed-fetcher-cf-tests/tests/**/*test.ts"],
			environment: "node",
			// Add any other Vitest configurations you need
			forceRerunTriggers: [
				"./packages/hono-typed-fetcher-cf-tests/tests/**/*.{ts,tsx}",
				"./packages/hono-typed-fetcher-cf-tests/tests/wrangler.json",
			],
			poolOptions: {
				workers: {
					singleWorker: true,
					wrangler: {
						configPath:
							"./packages/hono-typed-fetcher-cf-tests/tests/wrangler.json",
					},
				},
			},
		},
	}),
]);
