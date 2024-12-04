import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as TOML from "@iarna/toml";

export class WranglerConfigHelper {
	private originalWranglerPath: string;
	private parsedConfig: TOML.JsonMap;
	private tempConfigPath: string | null = null;
	private isToml: boolean;

	constructor(wranglerPath: string) {
		this.originalWranglerPath = wranglerPath;
		this.isToml = wranglerPath.endsWith(".toml");
		const wranglerContent = fs.readFileSync(this.originalWranglerPath, "utf-8");
		this.parsedConfig = this.isToml
			? TOML.parse(wranglerContent)
			: JSON.parse(wranglerContent);
	}

	patchConfig(callback: (config: TOML.JsonMap) => TOML.JsonMap): this {
		this.parsedConfig = callback(JSON.parse(JSON.stringify(this.parsedConfig)));
		return this;
	}

	prepareEnvironmentConfig(
		environment?: string,
		skipPatching?: boolean,
	): string {
		if (skipPatching) {
			return this.originalWranglerPath;
		}

		const config = { ...this.parsedConfig };

		if (environment && environment.length > 0) {
			config.name = `${config.name}-${environment}`;
		}

		const extension = this.isToml ? "toml" : "json";
		const fileName = `wrangler-${Date.now()}.${extension}`;
		this.tempConfigPath = path.join(os.tmpdir(), fileName);

		const content = this.isToml
			? TOML.stringify(config)
			: JSON.stringify(config, null, 2);
		fs.writeFileSync(this.tempConfigPath, content);

		return this.tempConfigPath;
	}

	cleanup(): void {
		if (this.tempConfigPath && fs.existsSync(this.tempConfigPath)) {
			fs.unlinkSync(this.tempConfigPath);
			this.tempConfigPath = null;
		}
	}
}
