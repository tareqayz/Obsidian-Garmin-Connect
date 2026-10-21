import type GarminPlugin from "../main";
import { rangeStart } from "../sync/datasets";
import { toIsoDate } from "../garmin/endpoints";
import { estimate, formatBytes, formatDuration, type Estimate } from "../sync/estimate";
import type { BackfillProgress } from "../sync/runner";
import { historyStart } from "../sync/scan";
import { VaultSeriesStore, type DiskUsage } from "../sync/series-store";
import type { UpdateLine } from "./setup-flow";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const count = new Intl.NumberFormat();

/**
 * Settings → History's live half: what the vault holds, what is missing for
 * the ranges chosen, and the download in progress. Each row that shows some of
 * it attaches a repaint; the first attach starts listening to the sync and the
 * last detach stops, so a closed settings tab costs nothing.
 */
export class SettingsDataRows {
	usage: DiskUsage;
	progress: BackfillProgress | null;
	updates: UpdateLine[] = [];
	private est: Estimate | null = null;
	private start: string | undefined;
	private readonly painters = new Set<() => void>();
	private unsubscribe: Array<() => void> = [];

	constructor(private readonly plugin: GarminPlugin) {
		this.usage = new VaultSeriesStore(plugin.app, plugin.data.settings.dataFolder).diskUsage();
		this.progress = plugin.sync.backfillProgress;
	}

	/** Paints now and on every change; returns the detach. */
	attach(paint: () => void): () => void {
		this.painters.add(paint);
		paint();
		if (this.painters.size === 1) {
			this.unsubscribe.push(
				this.plugin.sync.onBackfill((next) => {
					this.progress = next;
					// A unit just finished: the sizes and what is left moved.
					void this.refresh();
				}),
				// Deleted, or set up again: everything here moved.
				this.plugin.onDataChanged(() => {
					this.progress = this.plugin.sync.backfillProgress;
					void this.refresh();
				}),
			);
			void this.refresh();
		}
		return () => {
			this.painters.delete(paint);
			if (this.painters.size === 0) {
				this.unsubscribe.forEach((off) => off());
				this.unsubscribe = [];
			}
		};
	}

	/** What is missing for the ranges chosen, from the last scan and what the vault holds. */
	async refresh(): Promise<void> {
		const plugin = this.plugin;
		const s = plugin.data.settings;
		const store = new VaultSeriesStore(plugin.app, s.dataFolder);
		this.usage = store.diskUsage();
		this.updates = await plugin.updateLines("all");
		const scan = await store.readScan();
		if (!scan) {
			this.est = null;
			this.paint();
			return;
		}
		const [index, coverage, detailFiles, charts] = await Promise.all([
			store.readActivities(),
			store.readDayCoverage(s.groups.includes("intraday")),
			store.readDetailCoverage(),
			store.readChartMetas(),
		]);
		this.start = historyStart(scan);
		this.est = estimate({
			today: toIsoDate(),
			groups: s.groups,
			accepted: s.data.accepted,
			dayDetails: s.data.dayDetails,
			activityDetails: s.data.activityDetails,
			...(s.setup ? { since: s.setup.completedAt.slice(0, 10) } : {}),
			scan,
			daySpans: coverage.spans,
			charts,
			activities: index.rows.map((row) => plugin.candidateOf(row)),
			detailFiles,
			budget: plugin.sync.budgetOutlook(),
			now: Date.now(),
		});
		this.paint();
	}

	private paint(): void {
		this.painters.forEach((paint) => paint());
	}

	usageText(): string {
		return `${formatBytes(this.usage.total)} in ${this.plugin.data.settings.dataFolder}.`;
	}

	/** The History row on the main page: what the folder holds, and the download, as the page was drawn. */
	summaryText(): string {
		const size = `${formatBytes(this.usage.total)} in ${this.plugin.data.settings.dataFolder}`;
		const p = this.progress;
		if (!p) return `${size}.`;
		if (p.status === "running" || p.status === "waiting") return `${size} · downloading, ${this.percent}%.`;
		if (p.status === "elsewhere") return `${size} · downloading on ${p.device ?? "another device"}.`;
		return `${size} · download paused.`;
	}

	dayText(): string {
		const s = this.plugin.data.settings;
		if (s.data.dayDetails === "new") return "New days only.";
		const days = this.est?.sets.find((x) => x.id === "day-details");
		const from = rangeStart(s.data.dayDetails, new Date().toISOString().slice(0, 10), this.start);
		const back = from ? `Back to ${day(from)} · ` : "";
		if (days?.units) return `${back}${count.format(days.units)} ${days.units === 1 ? "day" : "days"} left, ≈ ${formatBytes(days.bytes)}.`;
		if (this.est) return from ? `${back}all here.` : "All here.";
		return "New days are always kept.";
	}

	detailText(): string {
		if (this.plugin.data.settings.data.activityDetails === "opened") return "Downloaded when you open one.";
		const details = this.est?.sets.find((x) => x.id === "activity-details");
		return details?.units ? `${count.format(details.units)} left to download.` : "All here.";
	}

	get percent(): number {
		const p = this.progress;
		return p && p.done + p.remaining > 0 ? Math.min(99, Math.round((p.done / (p.done + p.remaining)) * 100)) : 0;
	}

	progressLine(p: BackfillProgress): string {
		const percent = this.percent;
		const what = p.task === "details" ? "Activity details" : p.task === "days" ? "Day details" : "Charts & trends";
		const reached = p.reached ? ` · back to ${monthFormat.format(new Date(`${p.reached}T12:00:00`))}` : "";
		const until = p.until ? timeFormat.format(new Date(p.until)) : "";
		if (p.status === "paused" && p.reason === "user") return `Download paused · ${percent}% · ${what}${reached}`;
		if (p.status === "paused" && p.reason === "sign-in") return "Your Garmin session ended. Sign in to keep downloading.";
		if (p.status === "paused" && p.reason === "rate-limit") return `Garmin asked us to slow down · resumes at ${until}`;
		if (p.status === "paused" && p.reason === "blocked") return `Garmin's bot check refused this device · trying again at ${until}`;
		if (p.status === "paused" && p.reason === "update") return "Another device runs a newer version of the plugin. Update it here to keep downloading.";
		if (p.status === "paused") return `Something went wrong · trying again at ${until}`;
		// The hourly rest is part of the download's pace, not a stop.
		if (p.status === "waiting") return `Downloading ${what}${reached} · ${percent}% · continues at ${until}`;
		if (p.status === "elsewhere") return `Downloading on ${p.device ?? "another device"}. This device leaves it to that one.`;
		return `Downloading ${what}${reached} · ${percent}% · ${formatDuration(p.seconds ?? 0)} left`;
	}
}

function day(date: string | null | undefined): string {
	return date ? dateFormat.format(new Date(`${date}T12:00:00`)) : "";
}
