/**
 * FTP wording the API doesn't carry, verbatim from the web report's Help
 * (ref/performance-stats/ftp/web/text-help.txt). The phone keeps its Help
 * behind a ⋮ menu, left out as on Training Status, so only the part the
 * Current page's link needs is here.
 *
 * Pure.
 */

/** A sheet of the Help: its section, the heading and the paragraph under it. */
export interface FtpHelpSheet {
	title: string;
	heading: string;
	body: string;
}

/**
 * What "Learn how to update your … FTP" opens (Inferred: the phone's link
 * target wasn't captured): the Help's "How to Get a Measurement".
 */
export const MEASUREMENT_SHEET: FtpHelpSheet = {
	title: "How to Get a Measurement",
	heading: "Receiving a Reading",
	body:
		"There are a few different ways to get an FTP reading in Garmin Connect. If you have a Garmin device with automatic FTP " +
		"detection, you can turn on that setting to record FTP during your rides. You can also manually enter your FTP if you " +
		"know it. Refer to your device owner’s manual for more information on how to receive a reading on your specific device.",
};
