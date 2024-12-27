#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Handlebars from "handlebars";

interface PackageData {
	name: string;
	description: string;
	directory: string;
}

const templates = {
	packageJson: `{
  "name": "@greybox/{{name}}",
  "version": "0.0.1",
  "private": false,
  "description": "{{description}}",
  "repository": {
    "url": "git@github.com:greybox3D/utils.git",
    "directory": "packages/{{directory}}"
  },
  "type": "module",
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "publish-package": "bun publish"
  },
  "dependencies": {},
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@changesets/cli": "^2.27.11",
    "@types/bun": "^1.1.14",
    "vitest": "2.1.8"
  },
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "files": [
    "src"
  ],
  "publishConfig": {
    "access": "public"
  }
}`,

	biomeJson: `{
  "$schema": "https://biomejs.dev/schemas/1.9.2/schema.json",
  "extends": ["../biome-config/biome.json"]
}`,

	tsconfig: `{
  "extends": "@greybox/shared-tsconfig/tsconfig.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "types": ["bun"],
    "baseUrl": "."
  }
}`,

	readme: `# @greybox/{{name}}

{{description}}

## Installation

\`\`\`bash
bun add @greybox/{{name}}
# or
npm install @greybox/{{name}}
# or
yarn add @greybox/{{name}}
# or
pnpm add @greybox/{{name}}
\`\`\`

## Usage

\`\`\`typescript
import { something } from '@greybox/{{name}}';

// Add usage examples here
\`\`\`

## License

MIT
`,

	vitestConfig: `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});`,

	indexTs: `// Add your code here
export const something = () => {
  return "Hello from @greybox/{{name}}!";
};
`,

	gitignore: `.turbo
node_modules`,

	testFile: `import { expect, test } from "vitest";
import { something } from "../src";

test("basic test", () => {
  expect(something()).toBe("Hello from @greybox/{{name}}!");
});
`,
};

// Compile templates
const compiledTemplates = Object.fromEntries(
	Object.entries(templates).map(([key, template]) => [
		key,
		Handlebars.compile(template),
	]),
);

async function createPackage(data: PackageData) {
	const packagePath = join(process.cwd(), "packages", data.directory);

	// Create directory structure
	await mkdir(packagePath, { recursive: true });
	await mkdir(join(packagePath, "src"), { recursive: true });
	await mkdir(join(packagePath, "tests"), { recursive: true });

	// Create files
	const files = {
		"package.json": compiledTemplates.packageJson(data),
		"biome.json": compiledTemplates.biomeJson(data),
		"tsconfig.json": compiledTemplates.tsconfig(data),
		"README.md": compiledTemplates.readme(data),
		"vitest.config.ts": compiledTemplates.vitestConfig(data),
		"src/index.ts": compiledTemplates.indexTs(data),
		".gitignore": compiledTemplates.gitignore(data),
		"tests/index.test.ts": compiledTemplates.testFile(data),
	};

	for (const [filename, content] of Object.entries(files)) {
		await writeFile(join(packagePath, filename), content);
	}

	console.log(`✨ Created package @greybox/${data.name} in ${packagePath}`);
}

// Get package info from command line arguments
const name = process.argv[2];
const description =
	process.argv[3] || "A new package in the greybox utils collection";
const directory = name;

if (!name) {
	console.error("Please provide a package name");
	process.exit(1);
}

await createPackage({ name, description, directory });
