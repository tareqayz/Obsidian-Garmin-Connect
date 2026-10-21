import type GarminPlugin from "../main";
import type { QueuedRange } from "../sync/backfill";
import { rangeStart } from "../sync/datasets";
import { estimate, formatBytes, formatDuration, type Estimate } from "../sync/estimate";
import type { BackfillProgress } from "../sync/runner";
import { historyStart } from "../sync/scan";
import { VaultSeriesStore, type DiskUsage } from "../sync/series-store";
import { Coalesced } from "./coalesced";
import { updateLinesOf, type UpdateLine } from "./setup-flow";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const count = new Intl.NumberFormat();

/**
 * Settings → History's live half: what the vault holds, what is missing for
 * the ranges chosen, the download in progress and the date ranges queued for
 * it. Each row that shows some of it attaches a repaint; the first attach
 * starts listening to the sync and the last detach stops, so a closed
 * settings tab costs nothing.
 */
export class SettingsDataRows {
	usage: DiskUsage;
	progress: BackfillProgress | null;
	updates: UpdateLine[] = [];
	/** Date ranges waiting for the download (`SyncRunner.queueRange`), oldest asked first. */
	ranges: QueuedRange[] = [];
	private est: Estimate | null = null;
	private start: string | undefined;
	private readonly painters = new Set<() => void>();
	private unsubscribe: Array<() => void> = [];
	/** During a download the progress moves every few seconds: one refresh at a time, at most every 3 s. */
	private readonly refreshing = new Coalesced(() => this.load(), 3_000);

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
	refresh(): Promise<void> {
		return this.refreshing.run();
	}

	/** One read of the vault for the update lines and the estimate both. */
	private async load(): Promise<void> {
		const plugin = this.plugin;
		const s = plugin.data.settings;
		this.usage = new VaultSeriesStore(plugin.app, s.dataFolder).diskUsage();
		const input = await plugin.historyInput();
		this.updates = input && s.setup ? updateLinesOf(input, "all") : [];
		this.ranges = input?.ranges ? [...input.ranges] : [];
		if (!input?.scan) {
			this.est = null;
			this.paint();
			return;
		}
		this.start = historyStart(input.scan);
		this.est = estimate(input);
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

	/** "Oct 21, 2024 – Oct 21, 2026". */
	rangeDates(range: QueuedRange): string {
		return `${day(range.from)} – ${day(range.to)}`;
	}

	/** How far the download has got with a range: it walks back from the end. */
	rangeState(range: QueuedRange): string {
		return range.next >= range.to ? "waiting" : `back to ${monthFormat.format(new Date(`${range.next}T12:00:00`))}`;
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
