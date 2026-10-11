/**
 * The state the Performance Stats controls keep, kept out of their
 * components: which chips are on.
 *
 * Pure.
 */

/** How a set of chips behaves: several on at once (Race Predictor's distances), or one (LT's Pace / Power / W/kg). */
export interface ChipRule {
	multi?: boolean;
	/** At least one stays on: tapping the last one on does nothing. */
	required?: boolean;
}

/** The chips on after tapping `id`. */
export function toggleChip(selected: readonly string[], id: string, rule: ChipRule = {}): string[] {
	const on = selected.includes(id);
	if (rule.multi) {
		if (!on) return [...selected, id];
		return rule.required && selected.length === 1 ? [...selected] : selected.filter((s) => s !== id);
	}
	if (on) return rule.required ? [id] : [];
	return [id];
}
