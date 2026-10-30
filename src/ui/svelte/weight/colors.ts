/**
 * The twin's weight/* aliases (Figma, Obsidian / Weight), as Obsidian
 * variables so Light and Dark follow the theme. Set on the page's root, or a
 * card's: the chart's line, its BMI and its high-low bars read them.
 */
export const WEIGHT_COLORS = [
	"--weight-line: var(--color-blue)",
	"--weight-bmi: var(--color-yellow)",
	"--weight-high-low: var(--background-modifier-border-hover)",
].join("; ");
