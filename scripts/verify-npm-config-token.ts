import { execSync } from "node:child_process";

function verifyNpmToken() {
	try {
		const npmToken = process.env.NPM_CONFIG_TOKEN;

		if (!npmToken) {
			console.error(
				"\x1b[31mError: NPM_CONFIG_TOKEN environment variable is not set.\x1b[0m",
			);
			console.error(
				"Please set the NPM_CONFIG_TOKEN environment variable with your NPM token.",
			);
			process.exit(1);
		}

		// Verify the token by making a request to NPM whoami
		try {
			execSync("npm whoami", {
				stdio: "pipe",
				env: {
					...process.env,
					"npm_config_//registry.npmjs.org/:_authToken": npmToken,
				},
			});
			console.log("\x1b[32mNPM token verification successful!\x1b[0m");
		} catch (error) {
			console.error(`\x1b[31mError: Invalid NPM token "${npmToken}".\x1b[0m`);
			console.error(
				"Please ensure your NPM_CONFIG_TOKEN contains a valid token with the correct permissions.",
			);
			process.exit(1);
		}
	} catch (error) {
		console.error("\x1b[31mError: Failed to verify NPM token.\x1b[0m");
		console.error(error);
		process.exit(1);
	}
}

verifyNpmToken();
