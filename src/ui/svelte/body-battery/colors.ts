/**
 * The twin's Body Battery colours (Figma 333:6797), as Obsidian variables so
 * Light and Dark follow the theme. Set on the page's root.
 */
export const BATTERY_COLORS = [
	"--battery-high: var(--color-blue)",
	"--battery-low: var(--text-normal)",
	"--battery-track: var(--background-modifier-border)",
	"--battery-bar: var(--background-modifier-border)",
	"--battery-area: color-mix(in srgb, var(--text-faint) 45%, transparent)",
	"--battery-sleep: color-mix(in srgb, var(--text-faint) 18%, transparent)",
	"--battery-line: var(--text-normal)",
	"--stress-rest: var(--color-blue)",
	"--stress-medium: var(--color-orange)",
].join("; ");
