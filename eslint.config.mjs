// The Obsidian Community directory's automated review, run locally: eslint-plugin-obsidianmd's
// "Full scanner-equivalent configuration" (docs/configuration.md#community-plugin-scanner-configuration
// in github.com/obsidianmd/eslint-plugin) plus the stricter layer the scanner adds for a plugin
// submitted today. `npm run lint` runs it with --max-warnings 0, so a warning here is a lost point
// on the listing's scorecard. styles.css has its own check: stylelint.config.mjs.
// Files in src/ are typed through src/tsconfig.json, without Node's globals, as the scanner types them.
// Known gap: the scanner has seen `moment` from "obsidian" as untyped where it is typed here, so
// src/ gives each moment call a local type (src/embeds/core-plugins.ts).
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.*", "stylelint.config.*"],
				},
			},
		},
	},

	...obsidianmd.configs.recommended,

	{
		files: ["**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}"],
		rules: {
			// Security: errors on every layer.
			"no-eval": "error",
			"no-unsanitized/method": "error",
			"no-unsanitized/property": "error",
			"obsidianmd/regex-lookbehind": "error",
			"obsidianmd/no-forbidden-elements": "error",

			// Off on every layer.
			"no-undef": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			"@typescript-eslint/no-base-to-string": "off",
			"import/no-unresolved": "off",
			"obsidianmd/ui/sentence-case": "off",
			"obsidianmd/ui/sentence-case-json": "off",
			"obsidianmd/ui/sentence-case-locale-module": "off",

			// The newest layer: no-unsafe-* and the command-id rules back on, these at error.
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unsafe-assignment": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"obsidianmd/commands/no-command-in-command-id": "warn",
			"obsidianmd/commands/no-plugin-id-in-command-id": "warn",
			"obsidianmd/settings-tab/no-manual-html-headings": "error",
			"obsidianmd/settings-tab/no-problematic-settings-headings": "error",
			"obsidianmd/sample-names": "error",
			"obsidianmd/no-sample-code": "error",
			"obsidianmd/platform": "error",
			"obsidianmd/no-plugin-as-component": "error",
			"obsidianmd/detach-leaves": "error",
			"obsidianmd/no-static-styles-assignment": "error",
			"obsidianmd/no-view-references-in-plugin": "error",
			"obsidianmd/no-unsupported-api": "error",
		},
	},

	// Implied eval, once per call: the core rule in JavaScript, typescript-eslint's in TypeScript.
	{ files: ["**/*.{js,cjs,mjs,jsx}"], rules: { "no-implied-eval": "error" } },
	{ files: ["**/*.{ts,cts,mts,tsx}"], rules: { "@typescript-eslint/no-implied-eval": "error" } },

	// The scanner checks these separately.
	{ files: ["manifest.json"], rules: { "obsidianmd/validate-manifest": "off" } },
	{ files: ["LICENSE"], rules: { "obsidianmd/validate-license": "off" } },

	globalIgnores([
		// This repo's own folders the scanner never sees as source.
		"api", "ref", "brag-output", "types",
		// The scanner's list.
		"main.js",
		"**/*.min.js",
		"**/{dist,build,out,release}/**/*.{js,cjs,mjs,jsx}",
		"node_modules",
		"dist",
		"build",
		"pkg",
		"test-vault",
		".obsidian",
		"**/.obsidian/**",
		"esbuild.config.mjs",
		"version-bump.mjs",
		"**/*.test.*",
		"**/*.tests.*",
		"**/*.spec.*",
		"**/*.specs.*",
		"**/test/**",
		"**/tests/**",
		"**/__tests__/**",
		"**/mocks/**",
		"**/__mocks__/**",
		"**/*.cjs",
		"**/*.mjs",
		"**/*.cts",
		"**/*.mts",
		"**/vite*",
		"**/scripts/**",
		"**/docs/**",
		"**/i18n/**",
		"**/i18next/**",
		"**/locale/**",
		"**/locales/**",
		"**/translations/**",
		"**/l10n/**",
		".pnpm-store",
		"**/*.spec.ts",
		"**/testUtils**",
		"automation/**",
		"**/e2e/**",
		"**/e2e-tests/**",
		"**/*.e2e.*",
		"**/wdio.conf.*",
		"**/wdio.*.conf.*",
		"**/playwright.config.*",
		"**/{astro,babel,commitlint,docusaurus,esbuild,eslint,jest,oxlint,postcss,prettier,rolldown,rollup,stylelint,svelte,tailwind,tsdown,tsup,uno,webpack}.config.*",
		"**/{eslint,jest}.*.config.*",
		"**/jest.setup.*",
		"**/.{babelrc,eslintrc,mocharc,prettierrc}.*",
	]),
]);
