import type { LtSeriesId } from "../../../dashboard/running-lactate-threshold-pages";

/**
 * The series' colours, the theme's as Home's At a Glance card tones them
 * (`lactateView` in glance.ts): heart rate red, pace blue, power purple,
 * W/kg pink. Garmin draws both powers #CC1DC1; the twin (430:6126) swaps
 * the last two, and its pink sits close to heart rate's red in Light, so
 * the card's mapping is kept.
 */
export const LT_COLOR: Readonly<Record<LtSeriesId, string>> = {
	hr: "var(--color-red)",
	pace: "var(--color-blue)",
	power: "var(--color-purple)",
	wkg: "var(--color-pink)",
};
