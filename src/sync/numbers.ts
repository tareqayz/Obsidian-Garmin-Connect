/**
 * Garmin sends `null`, a missing key or now and then a string where a number
 * should be; these are the two checks every reader of its payloads makes.
 *
 * Pure: no Obsidian import.
 */

/** A finite number, or undefined for anything else. */
export function num(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Whether a value is a finite number. */
export function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}
