import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Add any other Vitest configurations you need
		forceRerunTriggers: ["./tests/**/*.{ts,tsx}", "./wrangler.toml"],
	},
});
