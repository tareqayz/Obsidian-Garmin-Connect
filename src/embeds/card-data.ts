import type { App } from "obsidian";
import { todayItemRoute } from "../dashboard/card-routes";
import { ACCOUNT, ACTIVITIES, DataVersions, DAYS, keysOfPath, SERIES, seriesKey } from "../dashboard/data-versions";
import { dayToShow, homeModel, type HomeModel, type TodayItem } from "../dashboard/home";
import { rebuildAt } from "../dashboard/rebuild-schedule";
import { allRoute, type Route } from "../dashboard/routes";
import { toIsoDate } from "../garmin/endpoints";
import type { SyncRunner } from "../sync/runner";
import { forgetParsedDays, VaultSeriesStore } from "../sync/series-store";
import { Coalesced } from "../ui/coalesced";

/** One day as a card block draws it. */
export interface CardDay {
	/** The day shown: a live block's is Home's day to show. */
	date: string;
	model: HomeModel;
	/** The first and last synced days. */
	first?: string;
	last?: string;
	/** The day has a synced row. */
	hasRow: boolean;
}

/** What the card blocks need of the plugin: read live, since signing in again replaces the runner. */
export interface CardHost {
	app: App;
	dataFolder(): string;
	sync(): SyncRunner;
	/** Whether a Garmin Home view is open, whose reads share the parsed day files. */
	homeOpen(): boolean;
}

/** How long the reads stay after the last block goes: a hover preview closing and opening again. */
const GRACE_MS = 30_000;
/** The days whose models are kept, newest asked last. */
const REMEMBERED_DAYS = 12;

/**
 * What every card block in every note reads, read once per version for all
 * of them: the day files, a day's series file and `account.json`, with Home's
 * model built once per day and version. It never asks Garmin for anything.
 *
 * Files change under it as a sync writes, from this device or another. Each
 * change moves the version of what it touches, held while a sync or the
 * history download writes as Home's are (`rebuildAt`), and then the blocks
 * read again. A day's series file counts only for a day a block shows.
 *
 * Blocks `acquire` it while they are on screen. Once the last goes, the reads
 * stay for `GRACE_MS`, then go, and with them the parsed day files unless
 * Home still reads them.
 */
export class CardData {
	private versions: DataVersions;
	private notify: Coalesced;
	private listeners = new Set<() => void>();
	private users = 0;
	private grace = 0;
	private clock = 0;
	private day0 = toIsoDate();
	/** Home's model by day, with the versions it was built from, oldest asked first. */
	private memo = new Map<string, { key: string; day: CardDay }>();
	/** The day each live block showed last, for `peek`. */
	private liveDay: string | null = null;
	/** Days a block shows: only their series files are watched. */
	private watched = new Set<string>();
	private unbind: (() => void) | null = null;
	private blocks = new Set<{ teardown(): void }>();

	constructor(private readonly host: CardHost) {
		this.notify = new Coalesced(() => {
			for (const listener of [...this.listeners]) listener();
			return Promise.resolve();
		}, 300);
		this.versions = new DataVersions({
			holdUntil: (last) => {
				const sync = host.sync();
				return rebuildAt(last, { syncingSince: sync.syncingSince, backfilling: sync.backfillProgress?.status === "running" });
			},
			moved: () => void this.notify.run(),
			now: () => Date.now(),
			setTimeout: (run, ms) => window.setTimeout(run, ms),
			clearTimeout: (id) => window.clearTimeout(id),
		});
		this.bindRunner();
	}

	get inUse(): boolean {
		return this.users > 0;
	}

	/** A block came on screen. */
	acquire(): void {
		this.users++;
		window.clearTimeout(this.grace);
		this.grace = 0;
		if (!this.clock) this.clock = window.setInterval(() => this.checkDay(), 60_000);
	}

	/** A block went. */
	release(): void {
		this.users = Math.max(0, this.users - 1);
		if (this.users || this.grace) return;
		this.grace = window.setTimeout(() => {
			this.grace = 0;
			if (!this.users) this.forget();
		}, GRACE_MS);
	}

	/** Whatever a block reads changed: it reads again. */
	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** A block to put back to its source when the plugin goes. */
	track(block: { teardown(): void }): () => void {
		this.blocks.add(block);
		return () => this.blocks.delete(block);
	}

	/** A file in the vault was written, created, deleted or renamed. */
	onFile(path: string): void {
		if (!this.users && !this.grace) return;
		for (const key of keysOfPath(this.store(), path).keys) {
			if (key.startsWith(`${SERIES}:`)) {
				if (this.watched.has(key.slice(SERIES.length + 1))) this.versions.bump(key);
			} else if (key === DAYS || key === ACCOUNT || key === ACTIVITIES) this.versions.bump(key);
		}
	}

	/** Another day began, or the app came back to the front on one: the blocks move on. */
	checkDay(): void {
		const today = toIsoDate();
		if (today === this.day0) return;
		this.day0 = today;
		if (this.users) void this.notify.run();
	}

	/** The data folder moved, or its files went: every read again. */
	reset(): void {
		this.versions.forget();
		this.memo.clear();
		this.liveDay = null;
		void this.notify.run();
	}

	/** Home's layout changed: a `day` block draws it again. */
	homeChanged(): void {
		if (this.users) void this.notify.run();
	}

	/** Signing in again replaced the runner: hold and flush on the new one. */
	bindRunner(): void {
		this.unbind?.();
		this.unbind = this.host.sync().onSyncing((startedAt) => {
			if (!startedAt) this.versions.syncEnded();
		});
	}

	/**
	 * Home's model for a day. A live block asks for today and gets Home's day
	 * to show: the newest synced day until today has synced.
	 */
	async day(want: string, live: boolean): Promise<CardDay> {
		const rows = await this.versions.cached(DAYS, () => this.store().readDays());
		const date = live ? dayToShow(rows, toIsoDate()) : want;
		if (live) this.liveDay = date;
		this.watched.add(date);
		const key = this.keyOf(date);
		const held = this.memo.get(date);
		if (held?.key === key) {
			this.memo.delete(date);
			this.memo.set(date, held);
			return held.day;
		}
		const [series, account] = await Promise.all([
			this.versions.cached(seriesKey(date), () => this.store().read(date)),
			this.versions.cached(ACCOUNT, () => this.store().readAccount()),
		]);
		const day: CardDay = {
			date,
			model: homeModel({ date, rows, series, account }),
			first: rows[0]?.date,
			last: rows[rows.length - 1]?.date,
			hasRow: rows.some((r) => r.date === date),
		};
		this.memo.delete(date);
		this.memo.set(date, { key, day });
		for (const oldest of this.memo.keys()) {
			if (this.memo.size <= REMEMBERED_DAYS) break;
			this.memo.delete(oldest);
		}
		return day;
	}

	/** A day already built and still current, at once: a block coming back paints without a flash. */
	peek(want: string, live: boolean): CardDay | null {
		const date = live ? this.liveDay : want;
		if (!date) return null;
		const held = this.memo.get(date);
		return held && held.key === this.keyOf(date) ? held.day : null;
	}

	/** The page a day's activity opens: its own, or All Activities on that day when the index doesn't hold it yet. */
	async activityRoute(item: TodayItem, date: string): Promise<Route> {
		const index = await this.versions.cached(ACTIVITIES, () => this.store().readActivities());
		return todayItemRoute(item, index.rows) ?? allRoute({ from: date, to: date });
	}

	/** The plugin is going: every block shows its source again, and nothing waits on a timer. */
	dispose(): void {
		for (const block of [...this.blocks]) block.teardown();
		this.blocks.clear();
		this.unbind?.();
		this.unbind = null;
		window.clearTimeout(this.grace);
		window.clearInterval(this.clock);
		this.grace = 0;
		this.clock = 0;
		this.versions.dispose();
		this.listeners.clear();
		this.memo.clear();
	}

	private keyOf(date: string): string {
		return [this.versions.version(DAYS), this.versions.version(seriesKey(date)), this.versions.version(ACCOUNT)].join(":");
	}

	private forget(): void {
		window.clearInterval(this.clock);
		this.clock = 0;
		this.versions.forget();
		this.memo.clear();
		this.watched.clear();
		this.liveDay = null;
		if (!this.host.homeOpen()) forgetParsedDays();
	}

	/** A store per read: a long-lived one would hold every series file it ever read. */
	private store(): VaultSeriesStore {
		return new VaultSeriesStore(this.host.app, this.host.dataFolder());
	}
}
