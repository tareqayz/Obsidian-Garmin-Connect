import type { StressPart } from "../../../dashboard/stress-pages";

/**
 * The twin's stress/* colours (Figma 271:51 and 271:67): Home's stress card,
 * as Obsidian variables, so Light and Dark follow the theme. Set on the
 * page's root; the ring, the tiles and the timeline read them.
 */
export const STRESS_COLORS = [
	"--stress-rest: var(--color-blue)",
	"--stress-low: color-mix(in srgb, var(--color-orange) 60%, transparent)",
	"--stress-medium: var(--color-orange)",
	"--stress-high: color-mix(in srgb, var(--color-orange) 70%, var(--color-red))",
	"--stress-none: var(--text-faint)",
].join("; ");

/** A category's colour, for a tile's dot. */
export const PART_COLOR: Readonly<Record<StressPart, string>> = {
	rest: "var(--stress-rest)",
	low: "var(--stress-low)",
	medium: "var(--stress-medium)",
	high: "var(--stress-high)",
};
