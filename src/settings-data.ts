import type { GarminDomain } from "./garmin/constants";
import { DEFAULT_ACTIVITY_DETAILS, DEFAULT_DAY_DETAILS, type ActivityDetailsRange, type ConsentKey, type DayDetailsRange } from "./sync/datasets";
import type { MetricGroup } from "./sync/metrics";
import { ALL_GROUPS } from "./sync/metrics";

/**
 * The settings' shape and defaults, kept apart from the settings tab so the
 * code that only reads them (PluginData, the collectors, tests) pulls in no
 * Obsidian or Svelte.
 *
 * Pure: no Obsidian import.
 */

/**
 * Bumped when a release changes what an existing vault's settings should
 * become: metric groups switched on rather than left to discover, (5) the
 * setup taken as done for a vault synced before it existed, or (6) the sync
 * settings the plugin now decides itself, dropped from the file at once
 * rather than at the next save. See `PluginData.migrate`.
 */
export const SETTINGS_VERSION = 6;

/** The setup, once it ran. */
export interface SetupState {
	/** When it finished, ISO. */
	completedAt: string;
	/** Taken as done on the first load of a release with the setup, for a vault that was already syncing. */
	migrated?: boolean;
}

/**
 * The data sets chosen (see `sync/datasets.ts`) and the consent ledger: the
 * keys of the stores the user said yes or "later" to. A key in neither is
 * asked about once — what a release that adds history data shows.
 */
export interface DataChoices {
	dayDetails: DayDetailsRange;
	activityDetails: ActivityDetailsRange;
	/** Agreed to: their gaps fill without asking. */
	accepted: ConsentKey[];
	/** Put off with Later: listed in Settings → History, not asked about again. */
	deferred: ConsentKey[];
}

export function defaultData(): DataChoices {
	return { dayDetails: DEFAULT_DAY_DETAILS, activityDetails: DEFAULT_ACTIVITY_DETAILS, accepted: [], deferred: [] };
}

export interface GarminSettings {
	/** Absent in anything written before the migration existed, which reads as 1. */
	settingsVersion: number;
	email: string;
	domain: GarminDomain;

	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";

	/** Where every JSON file the sync writes lives. */
	dataFolder: string;

	/**
	 * Sync on its own: when Obsidian starts, and when Home comes into view or
	 * the app comes back, once the last sync is 15 minutes old. A check that
	 * finds nothing new costs two requests and writes nothing.
	 */
	autoSync: boolean;
	/** Null until the setup ran: the wizard then opens on the first enable, and Home offers it. */
	setup: SetupState | null;
	/** What to keep, and the consent ledger. Replaced `downloadRuns`, then `runDetails` (now `activityDetails`). */
	data: DataChoices;
	/**
	 * Draw OpenStreetMap's map under an activity's route. Off, the route is
	 * drawn alone and no tile is ever asked for.
	 */
	mapTiles: boolean;

	logFolder: string;
	autoSaveLog: boolean;
}

export const DEFAULT_SETTINGS: GarminSettings = {
	settingsVersion: SETTINGS_VERSION,
	email: "",
	domain: "garmin.com",

	groups: [...ALL_GROUPS],
	units: "auto",

	// JSON only, in a folder of its own: nothing here touches a note you wrote.
	dataFolder: "Garmin/data",
	// On: keeping the vault current is the point, and a check with nothing new costs two requests.
	autoSync: true,
	setup: null,
	// Narrow on purpose: these also stand in for a saved range that can't be
	// read, which must never widen a download. The setup recommends all of it.
	data: defaultData(),
	// On: a route with no streets or coastline under it is hard to read. The
	// README and the setting say what the tile server sees.
	mapTiles: true,

	logFolder: "Garmin/diagnostics",
	// Off: a log is about your account, and a vault syncs. Save the runs you mean to share.
	autoSaveLog: false,
};
