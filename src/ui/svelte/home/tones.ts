import type { Tone } from "../../../dashboard/glance";
import type { StatusTone } from "../../../dashboard/home";

/** A named tone as the theme's own colour, which is what the Figma twin binds to. */
export function toneColor(tone: Tone | undefined): string | undefined {
	return tone ? `var(--color-${tone})` : undefined;
}

/** Training Status colours, shared by its In Focus and At a Glance cards. */
export const STATUS_TONE: Record<StatusTone, string> = {
	productive: "var(--color-green)",
	peaking: "var(--color-purple)",
	maintaining: "var(--color-yellow)",
	recovery: "var(--color-blue)",
	unproductive: "var(--color-orange)",
	strained: "var(--color-red)",
	detraining: "var(--text-faint)",
	none: "var(--background-modifier-border)",
};
