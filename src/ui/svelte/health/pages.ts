import type { Component } from "svelte";
import type { HealthStatPageId } from "../../../dashboard/health-stats";
import type { HealthStatRoute, Route } from "../../../dashboard/routes";
import type { IndexHistoryProgress, ReadIndex } from "../../../sync/day-index";
import type { DaySeries } from "../../../sync/intraday";
import type { IntradayLoad } from "../../../sync/intraday-registry";
import BodyBatteryPage from "../body-battery/BodyBatteryPage.svelte";
import HealthStatusPage from "../health-status/HealthStatusPage.svelte";
import FitnessAgePage from "../fitness-age/FitnessAgePage.svelte";
import HealthSnapshotPage from "../health-snapshot/HealthSnapshotPage.svelte";
import HeartRatePage from "../heart-rate/HeartRatePage.svelte";
import PulseOxPage from "../pulse-ox/PulseOxPage.svelte";
import AcclimationPage from "../pulse-ox-acclimation/AcclimationPage.svelte";
import RespirationPage from "../respiration/RespirationPage.svelte";
import StressPage from "../stress/StressPage.svelte";
import WeightPage from "../weight/WeightPage.svelte";

/**
 * What every Health Stats page gets from Home, whichever stat it draws: the
 * Sleep and Stats pages' props, plus the day indexes and on-view intraday
 * loads that let a page read any period and any day.
 */
export interface HealthStatPageProps {
	/** The page's route: its stat, range and period, and whatever tab, sub-page or day it keeps. */
	route: HealthStatRoute;
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The account's unit system, as the Activities pages use it. */
	units: "metric" | "imperial";
	/** Signed in: a page may offer to sync its history. */
	canSync: boolean;
	onBack: () => void;
	/** Opens a page on top — a day from a list, a sub-page — that Back returns from. */
	go: (route: Route) => void;
	/** Changes this page — a range, a period, a tab — without adding a step. */
	swap: (route: Route) => void;
	/** Series files for some days, read when the page asks. */
	readSeries: (days: string[]) => Promise<Map<string, DaySeries | null>>;
	/**
	 * A day index's rows, oldest first, and its meta: a registered one by its
	 * kind (`day-indexes.ts`), or the existing `"sleep"` and `"daily-stats"`.
	 * Re-read when `versions[kind]` moves.
	 */
	readIndex: ReadIndex;
	/**
	 * Fetches whatever of `keys` a day's series file lacks — the file's own
	 * `stress`, `bodyBattery`, `heartRate`, `bodyBatteryEvents`, or a
	 * registered extra's key — merges it into the file and resolves with the
	 * day's series. Waits while a sync runs; show the day's summary meanwhile.
	 */
	loadIntraday: (date: string, keys: readonly string[]) => Promise<IntradayLoad>;
	/** Starts a registered index's history walk: the history banner's button. */
	onSyncHistory: (kind: string) => void;
	/** By index kind: moves whenever a file in that index's folder changes. */
	versions: Readonly<Record<string, number>>;
	/** Moves whenever a day's series file changes. */
	seriesVersion: number;
	/** History walks in progress, by index kind. */
	history: Readonly<Record<string, IndexHistoryProgress>>;
}

/**
 * Every Health Stats page built so far, by stat. One line per stat, its page
 * in `src/ui/svelte/<stat>/`:
 *
 *   import StressPage from "../stress/StressPage.svelte";
 *   export const HEALTH_PAGES: … = { stress: StressPage };
 *
 * A stat appears in the Health Stats hub, gets an "Open <stat>" command and
 * opens from its At a Glance card once it is here. Sleep keeps its own route
 * and page, so it has no entry.
 */
export const HEALTH_PAGES: Partial<Record<HealthStatPageId, Component<HealthStatPageProps>>> = {
	stress: StressPage,
	"heart-rate": HeartRatePage,
	"body-battery": BodyBatteryPage,
	respiration: RespirationPage,
	"health-status": HealthStatusPage,
	"fitness-age": FitnessAgePage,
	"health-snapshot": HealthSnapshotPage,
	weight: WeightPage,
	"pulse-ox": PulseOxPage,
	"pulse-ox-acclimation": AcclimationPage,
};
