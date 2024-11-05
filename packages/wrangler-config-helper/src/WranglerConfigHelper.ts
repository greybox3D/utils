import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as TOML from "@iarna/toml";

export class WranglerConfigHelper {
	private originalWranglerPath: string;
	private parsedConfig: TOML.JsonMap;
	private tempConfigPath: string | null = null;

	constructor(wranglerPath: string) {
		this.originalWranglerPath = wranglerPath;
		const wranglerContent = fs.readFileSync(this.originalWranglerPath, "utf-8");
		this.parsedConfig = TOML.parse(wranglerContent);
	}

	patchConfig(callback: (config: TOML.JsonMap) => TOML.JsonMap): this {
		this.parsedConfig = callback(JSON.parse(JSON.stringify(this.parsedConfig)));
		return this;
	}

	prepareEnvironmentConfig(environment?: string): string {
		const config = { ...this.parsedConfig };

		if (environment && environment.length > 0) {
			config.name = `${config.name}-${environment}`;
		}

		const fileName = `wrangler-${Date.now()}.toml`;
		this.tempConfigPath = path.join(os.tmpdir(), fileName);

		fs.writeFileSync(this.tempConfigPath, TOML.stringify(config));

		return this.tempConfigPath;
	}

	cleanup(): void {
		if (this.tempConfigPath && fs.existsSync(this.tempConfigPath)) {
			fs.unlinkSync(this.tempConfigPath);
			this.tempConfigPath = null;
		}
	}
}
