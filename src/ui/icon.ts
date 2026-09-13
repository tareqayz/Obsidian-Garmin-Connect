import { addIcon } from "obsidian";

/** Icon id for the Garmin Connect logo, registered with Obsidian's icon registry. */
export const GARMIN_ICON = "garmin-connect";

/**
 * Source art (assets/garminconnect.svg) is a 48x48 viewBox; Obsidian renders
 * registered icons in a 0 0 100 100 viewport, so scale it up to fill.
 */
const GARMIN_ICON_SVG = `<g transform="scale(2.0833)" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M45,15.38a22.15,22.15,0,0,0-8.4-10A22.29,22.29,0,0,0,9.8,7.78,21.74,21.74,0,0,0,3,20.88h7.4A14.72,14.72,0,0,1,20.7,9.78c7.1-1.9,12.6.7,16.1,5.6Z"/><path d="M45,32.58a22,22,0,0,1-39.4,2.2A19.48,19.48,0,0,1,3,27h7.4a14.66,14.66,0,0,0,26.3,5.5Z"/></g>`;

export function registerGarminIcon(): void {
	addIcon(GARMIN_ICON, GARMIN_ICON_SVG);
}
