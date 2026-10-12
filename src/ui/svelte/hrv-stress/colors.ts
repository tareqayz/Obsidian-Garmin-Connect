import type { HrvStressLevel } from "../../../dashboard/hrv-stress-copy";
import { STRESS_COLORS } from "../stress/colors";

/**
 * The levels' colours (twin Score Bar 804:70, Inferred): the Stress page's
 * own stress/low, medium and high, and the theme's red for Very High — as
 * the twin maps Garmin's stress/low, stress/medium, stress/high and red. The
 * Stress custom properties are set on the page's root (the shell's `style`).
 */
export const HRV_STRESS_STYLE = STRESS_COLORS;

export const LEVEL_COLOR: Readonly<Record<HrvStressLevel, string>> = {
	low: "var(--stress-low)",
	moderate: "var(--stress-medium)",
	high: "var(--stress-high)",
	"very-high": "var(--color-red)",
};
