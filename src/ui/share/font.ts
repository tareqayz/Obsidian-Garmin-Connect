import latin from "./fonts/oswald-latin.woff2";
import latinExt from "./fonts/oswald-latin-ext.woff2";

/**
 * The share images' face: Oswald (SIL Open Font License 1.1, see
 * `src/ui/share/fonts/OFL.txt`), the variable font's Latin and Latin
 * Extended subsets, bundled so an image looks the same from every device and
 * nothing is fetched. Garmin's images use a condensed bold face of their own.
 */
export const SHARE_FAMILY = "Garmin Connect Share";

/** The face, then what a script it lacks falls back to. */
export const SHARE_FONT_STACK = `"${SHARE_FAMILY}", "Arial Narrow", system-ui, sans-serif`;

/** Google Fonts' ranges for the two subsets. */
const LATIN_RANGE =
	"U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT_RANGE =
	"U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

/** Each document (the main window, a pop-out) gets the faces once. */
const loaded = new WeakMap<Document, Promise<void>>();

/**
 * Adds the face to `doc` and waits until it can draw. A face that fails to
 * load leaves the fallback stack to draw: the image still comes out.
 */
export function loadShareFont(doc: Document): Promise<void> {
	let done = loaded.get(doc);
	if (!done) {
		const faces = [
			new FontFace(SHARE_FAMILY, latin, { weight: "200 700", unicodeRange: LATIN_RANGE }),
			new FontFace(SHARE_FAMILY, latinExt, { weight: "200 700", unicodeRange: LATIN_EXT_RANGE }),
		];
		done = Promise.all(
			faces.map(async (face) => {
				await face.load();
				doc.fonts.add(face);
			}),
		).then(
			() => undefined,
			() => undefined,
		);
		loaded.set(doc, done);
	}
	return done;
}
