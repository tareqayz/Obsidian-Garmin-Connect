// The rules the Obsidian Community directory's automated review runs on every release
// (eslint-plugin-obsidianmd's recommended set). The ignores mirror the scanner's own list,
// so `npm run lint` passing means the directory's Source code check passes too. Files in src/
// are typed through src/tsconfig.json, without Node's globals, as the scanner types them.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{
		ignores: [
			"node_modules", "main.js", "api", "docs", "scripts", "tests", "ref",
			"**/*.mjs", "**/*.cjs",
		],
	},
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.*"],
				},
			},
		},
	},
]);
