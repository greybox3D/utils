import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		test: {
			include: ["packages/**/*.test.ts"],
			exclude: ["packages/cf-tests/**"],
		},
	},
	defineWorkersConfig({
		test: {
			include: ["packages/cf-tests/tests/**/*test.ts"],
			environment: "node",
			forceRerunTriggers: [
				"./packages/cf-tests/tests/**/*.{ts,tsx}",
				"./packages/cf-tests/tests/wrangler.json",
			],
			poolOptions: {
				workers: {
					singleWorker: true,
					wrangler: {
						configPath: "./packages/cf-tests/tests/wrangler.json",
					},
				},
			},
		},
	}),
]);
