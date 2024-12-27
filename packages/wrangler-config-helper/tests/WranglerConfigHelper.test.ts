import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WranglerConfigHelper } from "../src/WranglerConfigHelper";

describe("WranglerConfigHelper", () => {
	const fixturesPath = path.join(__dirname, "fixtures");
	const wranglerTomlPath = path.join(fixturesPath, "wrangler.toml");
	const wranglerJsonPath = path.join(fixturesPath, "wrangler.json");

	let configHelper: WranglerConfigHelper;

	afterEach(() => {
		if (configHelper) {
			configHelper.cleanup();
		}
	});

	describe("TOML config", () => {
		it("should load and parse TOML config correctly", () => {
			configHelper = new WranglerConfigHelper(wranglerTomlPath);
			const tempPath = configHelper.prepareEnvironmentConfig();

			expect(fs.existsSync(tempPath)).toBe(true);
			const content = fs.readFileSync(tempPath, "utf-8");
			expect(content).toContain('name = "test-worker"');
			expect(content).toContain('TEST_VAR = "test-value"');
		});

		it("should modify config name for environment", () => {
			configHelper = new WranglerConfigHelper(wranglerTomlPath);
			const tempPath = configHelper.prepareEnvironmentConfig("dev");

			expect(fs.existsSync(tempPath)).toBe(true);
			const content = fs.readFileSync(tempPath, "utf-8");
			expect(content).toContain('name = "test-worker-dev"');
		});

		it("should not modify config when skipPatching is true", () => {
			configHelper = new WranglerConfigHelper(wranglerTomlPath);
			const configPath = configHelper.prepareEnvironmentConfig(undefined, true);

			expect(configPath).toBe(wranglerTomlPath);
		});

		it("should patch config using callback", () => {
			configHelper = new WranglerConfigHelper(wranglerTomlPath);
			configHelper.patchConfig((config) => {
				config.name = "modified-worker";
				return config;
			});

			const tempPath = configHelper.prepareEnvironmentConfig();
			const content = fs.readFileSync(tempPath, "utf-8");
			expect(content).toContain('name = "modified-worker"');
		});

		it("should cleanup temporary files", () => {
			configHelper = new WranglerConfigHelper(wranglerTomlPath);
			const tempPath = configHelper.prepareEnvironmentConfig();

			expect(fs.existsSync(tempPath)).toBe(true);
			configHelper.cleanup();
			expect(fs.existsSync(tempPath)).toBe(false);
		});
	});

	describe("JSON config", () => {
		it("should load and parse JSON config correctly", () => {
			configHelper = new WranglerConfigHelper(wranglerJsonPath);
			const tempPath = configHelper.prepareEnvironmentConfig();

			expect(fs.existsSync(tempPath)).toBe(true);
			const content = fs.readFileSync(tempPath, "utf-8");
			const config = JSON.parse(content);
			expect(config.name).toBe("test-worker");
			expect(config.vars.TEST_VAR).toBe("test-value");
		});

		it("should modify config name for environment", () => {
			configHelper = new WranglerConfigHelper(wranglerJsonPath);
			const tempPath = configHelper.prepareEnvironmentConfig("dev");

			expect(fs.existsSync(tempPath)).toBe(true);
			const content = fs.readFileSync(tempPath, "utf-8");
			const config = JSON.parse(content);
			expect(config.name).toBe("test-worker-dev");
		});

		it("should patch config using callback", () => {
			configHelper = new WranglerConfigHelper(wranglerJsonPath);
			configHelper.patchConfig((config) => {
				config.name = "modified-worker";
				return config;
			});

			const tempPath = configHelper.prepareEnvironmentConfig();
			const content = fs.readFileSync(tempPath, "utf-8");
			const parsedConfig = JSON.parse(content);
			expect(parsedConfig.name).toBe("modified-worker");
		});
	});
});
