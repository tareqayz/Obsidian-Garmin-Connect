// The Community directory's review also checks styles.css, which ESLint doesn't: browser features
// Obsidian's Chromium supports only partly or not at all ("… is only partially supported by
// Obsidian 1.11.4"), `!important`, and a declaration a later one in the same rule overrides.
// `npm run lint:css` runs the same checks. Chrome 120 (Electron 28) is the oldest Obsidian installer
// still about. The scanner skips this file by its name.
export default {
	plugins: ["stylelint-no-unsupported-browser-features"],
	rules: {
		"plugin/no-unsupported-browser-features": [true, { browsers: ["chrome >= 120"], severity: "warning" }],
		"declaration-no-important": true,
		"declaration-block-no-duplicate-properties": true,
	},
};
