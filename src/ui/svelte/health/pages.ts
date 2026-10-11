import type { Component } from "svelte";
import type { ActivitiesData } from "../../../dashboard/activities";
import type { HealthStatPageId } from "../../../dashboard/health-stats";
import type { HealthStatRoute, Route, StatRoute } from "../../../dashboard/routes";
import type { DayRow } from "../../../dashboard/series";
import type { AccountInfo } from "../../../sync/account";
import type { IndexHistoryProgress, ReadIndex } from "../../../sync/day-index";
import type { DaySeries } from "../../../sync/intraday";
import type { IntradayLoad } from "../../../sync/intraday-registry";
import type { OpenSheet } from "../../sheet-modal";
import BloodPressurePage from "../blood-pressure/BloodPressurePage.svelte";
import BodyBatteryPage from "../body-battery/BodyBatteryPage.svelte";
import HealthStatusPage from "../health-status/HealthStatusPage.svelte";
import FitnessAgePage from "../fitness-age/FitnessAgePage.svelte";
import HealthSnapshotPage from "../health-snapshot/HealthSnapshotPage.svelte";
import HeartRatePage from "../heart-rate/HeartRatePage.svelte";
import LifestyleLoggingPage from "../lifestyle-logging/LifestyleLoggingPage.svelte";
import PulseOxPage from "../pulse-ox/PulseOxPage.svelte";
import AcclimationPage from "../pulse-ox-acclimation/AcclimationPage.svelte";
import RespirationPage from "../respiration/RespirationPage.svelte";
import StressPage from "../stress/StressPage.svelte";
import WeightPage from "../weight/WeightPage.svelte";

/**
 * What every stat page gets from Home, Health Stats' and Performance Stats'
 * alike, whichever stat it draws: the Sleep and Stats pages' props, plus the
 * day indexes and on-view intraday loads that let a page read any period and
 * any day, the day files and account.json, the activity index, and the
 * sheets. Home builds one of these and hands it to both sections' pages.
 */
export interface StatPageProps<R extends StatRoute = StatRoute> {
	/** The page's route: its stat, range and period, and whatever tab, sub-page or day it keeps. */
	route: R;
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
	/**
	 * By index kind: moves whenever a file in that index's folder changes;
	 * `"#days"` when a day file does, `"#account"` when account.json does.
	 */
	versions: Readonly<Record<string, number>>;
	/** Moves whenever a day's series file changes. */
	seriesVersion: number;
	/** History walks in progress, by index kind. */
	history: Readonly<Record<string, IndexHistoryProgress>>;
	/** Opens one of Garmin's sheets: a bottom sheet on a phone, a dialog in a pane. */
	openSheet: OpenSheet;
	/** Every synced day's properties, oldest first. Re-read when `versions["#days"]` moves. */
	readDays: () => Promise<DayRow[]>;
	/** account.json: the latest values Garmin keeps no history of. Re-read when `versions["#account"]` moves. */
	readAccount: () => Promise<AccountInfo | null>;
	/** The activity index, as the Activities pages get it. */
	activities: ActivitiesData;
}

/** A Health Stats page's props. */
export type HealthStatPageProps = StatPageProps<HealthStatRoute>;

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
	"blood-pressure": BloodPressurePage,
	"lifestyle-logging": LifestyleLoggingPage,
};
