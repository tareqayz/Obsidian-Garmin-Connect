/**
 * Garmin's Performance Stats colours as the Obsidian twin binds them
 * (`performance/*` → the theme's colours), for the data that carries one:
 * a Training Status, a training benefit, a race distance.
 */

export type PerformanceStatus =
	| "productive"
	| "peaking"
	| "maintaining"
	| "recovery"
	| "unproductive"
	| "detraining"
	| "strained"
	| "overreaching";

/** Training Status by status (performance/status/*). Home's In Focus card keeps its own (`home/tones.ts`). */
export const PERFORMANCE_STATUS_COLOR: Readonly<Record<PerformanceStatus, string>> = {
	productive: "var(--color-green)",
	peaking: "var(--color-purple)",
	maintaining: "var(--color-yellow)",
	recovery: "var(--color-blue)",
	unproductive: "var(--color-orange)",
	detraining: "var(--color-base-50)",
	strained: "var(--color-pink)",
	overreaching: "var(--color-red)",
};

/** Training benefit (performance/benefit/*): Load Focus's bars, Training Effect's. */
export const BENEFIT_COLOR = {
	anaerobic: "var(--color-purple)",
	highAerobic: "var(--color-orange)",
	lowAerobic: "var(--color-cyan)",
} as const;

/** Race Predictor's series (performance/race/*). */
export const RACE_COLOR = {
	"5k": "var(--color-blue)",
	"10k": "var(--color-green)",
	half: "var(--color-orange)",
	marathon: "var(--color-red)",
} as const;
