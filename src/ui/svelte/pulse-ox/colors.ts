/**
 * The twin's spo2/* aliases (Figma, Obsidian / Pulse Ox): the bands of the
 * gauge and the charts, and their empty grey, as Obsidian variables so Light
 * and Dark follow the theme. Set on the page's root, or a card's.
 */
export const SPO2_COLORS = [
	"--spo2-high: var(--color-green)",
	"--spo2-mid: var(--color-yellow)",
	"--spo2-low: var(--color-orange)",
	"--spo2-poor: var(--color-red)",
	"--spo2-none: var(--text-faint)",
].join("; ");
