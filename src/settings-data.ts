import type { GarminDomain } from "./garmin/constants";
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
 * Bumped when a release adds metric groups that an existing vault should get
 * switched on rather than have to discover. See `PluginData.migrate`.
 */
export const SETTINGS_VERSION = 4;

export interface GarminSettings {
	/** Absent in anything written before the migration existed, which reads as 1. */
	settingsVersion: number;
	email: string;
	domain: GarminDomain;

	/** How many days back a "sync recent days" run covers. */
	syncDays: number;
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";

	/** Where every JSON file the sync writes lives. */
	dataFolder: string;

	syncOnStartup: boolean;
	/**
	 * Download every run's page — samples, laps, route — in the background
	 * after a sync, newest first, rather than only the ones opened.
	 */
	downloadRuns: boolean;
	/**
	 * Draw OpenStreetMap's map under an activity's route. Off, the route is
	 * drawn alone and no tile is ever asked for.
	 */
	mapTiles: boolean;
	pauseBetweenDays: number;
	stopAfterEmptyDays: number;

	logFolder: string;
	autoSaveLog: boolean;
}

export const DEFAULT_SETTINGS: GarminSettings = {
	settingsVersion: SETTINGS_VERSION,
	email: "",
	domain: "garmin.com",

	// Garmin backfills a day for a while after it ends — sleep is finalised late,
	// and a watch that synced this morning rewrites yesterday.
	syncDays: 3,
	groups: [...ALL_GROUPS],
	units: "auto",

	// JSON only, in a folder of its own: nothing here touches a note you wrote.
	dataFolder: "Garmin/data",
	syncOnStartup: false,
	// Off: ten requests a run, every run in the history, is a lot to ask of
	// Garmin unprompted. A run's page downloads it when it opens either way.
	downloadRuns: false,
	// On: a route with no streets or coastline under it is hard to read. The
	// README and the setting say what the tile server sees.
	mapTiles: true,
	pauseBetweenDays: 250,
	// A backfill that reaches past the start of your Garmin history would
	// otherwise keep asking, four requests a day, until Garmin rate-limits it.
	stopAfterEmptyDays: 45,

	logFolder: "Garmin/diagnostics",
	autoSaveLog: true,
};
