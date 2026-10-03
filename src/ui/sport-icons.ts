import { addIcon } from "obsidian";
import type { SportGlyph } from "../dashboard/activities";

/**
 * Sport figures for the Activities pages, registered as Obsidian icons.
 *
 * Lucide, which Obsidian ships, has no runner, swimmer or treadmill, so these
 * are Tabler Icons outlines (MIT, https://tabler.io/icons), the same 24px grid
 * and 2px round stroke as Lucide, so they sit beside Obsidian's own icons
 * without looking borrowed. The Figma file draws the same paths.
 */
const TABLER: Record<Exclude<SportGlyph, "activity">, string> = {
	run: '<path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M4 17l5 1l.75 -1.5"/><path d="M15 21l0 -4l-4 -3l1 -6"/><path d="M7 12l0 -3l5 -1l3 3l3 1"/>',
	treadmill: '<path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M3 14l4 1l.5 -.5"/><path d="M12 18v-3l-3 -2.923l.75 -5.077"/><path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5"/><path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1"/><path d="M18 21l1 -11l2 -1"/>',
	swimming: '<path d="M16 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M6 11l4 -2l3.5 3l-1.5 2"/><path d="M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25"/>',
	bike: '<path d="M5 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M19 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M12 19l0 -4l-3 -3l5 -4l2 3l3 0"/><path d="M17 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
	barbell: '<path d="M2 12h1"/><path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2"/><path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z"/><path d="M9 12h6"/><path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z"/><path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2"/><path d="M22 12h-1"/>',
	yoga: '<path d="M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M4 20h4l1.5 -3"/><path d="M17 20l-1 -5h-5l1 -7"/><path d="M4 10l4 -1l4 -1l4 1.5l4 1.5"/>',
	"stairs-up": '<path d="M22 6h-5v5h-5v5h-5v5h-5"/><path d="M6 10v-7"/><path d="M3 6l3 -3l3 3"/>',
	stretching: '<path d="M16 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M5 20l5 -.5l1 -2"/><path d="M18 20v-5h-5.5l2.5 -6.5l-5.5 1l1.5 2"/>',
	trekking: '<path d="M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M7 21l2 -4"/><path d="M13 21v-4l-3 -3l1 -6l3 4l3 2"/><path d="M10 14l-1.827 -1.218a2 2 0 0 1 -.831 -2.15l.28 -1.117a2 2 0 0 1 1.939 -1.515h1.439l4 1l3 -2"/><path d="M17 12v9"/><path d="M16 20h2"/>',
	walk: '<path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M7 21l3 -4"/><path d="M16 21l-2 -4l-3 -3l1 -6"/><path d="M6 12l2 -3l4 -1l3 3l3 1"/>',
	medal: '<path d="M12 4v3m-4 -3v6m8 -6v6"/><path d="M12 18.5l-3 1.5l.5 -3.5l-2 -2l3 -.5l1.5 -3l1.5 3l3 .5l-2 2l.5 3.5z"/>',
	shoe: '<path d="M4 6h5.426a1 1 0 0 1 .863 .496l1.064 1.823a3 3 0 0 0 1.896 1.407l4.677 1.114a4 4 0 0 1 3.074 3.89v2.27a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1z"/><path d="M14 13l1 -2"/><path d="M8 18v-1a4 4 0 0 0 -4 -4h-1"/><path d="M10 12l1.5 -3"/>',
};

/** The Obsidian icon id for a glyph. `activity` is Lucide's own. */
export function sportIcon(glyph: SportGlyph): string {
	return glyph === "activity" ? "activity" : `garmin-sport-${glyph}`;
}

/**
 * Obsidian draws registered icons in a 100-unit box. Scaling the 24-unit
 * paths would scale their stroke too, so the stroke is kept at 2px on screen
 * whatever size the icon is drawn at.
 */
export function registerSportIcons(): void {
	for (const [name, body] of Object.entries(TABLER)) {
		const paths = body.replace(/<path /g, '<path vector-effect="non-scaling-stroke" ');
		addIcon(
			`garmin-sport-${name}`,
			`<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`,
		);
	}
}
