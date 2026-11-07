/**
 * The twin's respiration/* aliases (Figma, Obsidian / Respiration), as
 * Obsidian variables so Light and Dark follow the theme. Low is text-faint
 * and Active base-50 in the twin; they read almost alike, so the low dot
 * keeps text-faint and Active (not drawn yet) would take base-50. Set on the
 * page's root, or a card's.
 */
export const RESPIRATION_COLORS = [
	"--respiration-high: var(--color-blue)",
	"--respiration-low: var(--text-faint)",
	"--respiration-bar: var(--background-modifier-border)",
	"--respiration-active: var(--color-base-50)",
	"--respiration-line: var(--text-normal)",
	"--respiration-sleep: var(--color-blue)",
	"--respiration-awake: var(--color-cyan)",
].join("; ");
