<script lang="ts">
	import type { Route } from "../../../dashboard/routes";
	import {
		historyView,
		sleepDayView,
		sleepPeriodView,
		sleepSeriesDays,
		type HistoryView,
		type SleepData,
		type SleepFactorId,
	} from "../../../dashboard/sleep-pages";
	import type { DaySeries } from "../../../sync/intraday";
	import type { SleepHistoryProgress } from "../../../sync/runner";
	import HistoryBanner from "../activities/HistoryBanner.svelte";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";
	import RangeControl from "../stats/RangeControl.svelte";
	import CoachTab from "./CoachTab.svelte";
	import PeriodView from "./PeriodView.svelte";
	import ScoreTab from "./ScoreTab.svelte";

	/**
	 * Garmin Connect's Sleep page: a night's Sleep Score and Sleep Coach, or a
	 * week, four weeks or a year of nights. The bar with the range, the period
	 * and, for a night, the two tabs stays put while the rest scrolls.
	 */
	type SleepRoute = Extract<Route, { page: "sleep" }>;

	interface Props {
		route: SleepRoute;
		data: SleepData;
		today: string;
		history: SleepHistoryProgress | null;
		canSync: boolean;
		onBack: () => void;
		go: (route: Route) => void;
		swap: (route: Route) => void;
		onSyncHistory: () => void;
		/** Opens the Sleep History sheet. */
		onHistory: (view: HistoryView) => void;
		readSeries: (days: string[]) => Promise<Map<string, DaySeries | null>>;
	}

	let { route, data, today, history, canSync, onBack, go, swap, onSyncHistory, onHistory, readSeries }: Props = $props();

	/* A night's page reads that day's series file, and again after a sync changes the index. */
	let days = $derived(sleepSeriesDays(route, today));
	let series = $state<DaySeries | null>(null);
	$effect(() => {
		const wanted = days;
		void data;
		let live = true;
		if (!wanted.length) series = null;
		else
			readSeries(wanted).then(
				(map) => {
					if (live) series = map.get(wanted[0]!) ?? null;
				},
				() => {},
			);
		return () => {
			live = false;
		};
	});

	let day = $derived(route.range === "1d" ? sleepDayView({ data, route, today, series }) : null);
	let period = $derived(route.range === "1d" ? null : sleepPeriodView({ data, route, today }));
	let label = $derived(day?.label ?? period?.label ?? "");
	let canGoBack = $derived(day?.canGoBack ?? period?.canGoBack ?? false);

	function set(change: Partial<SleepRoute>) {
		swap({ ...route, ...change });
	}

	function offsetOf(date: string): number {
		return Math.min(0, Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000));
	}

	/** A night or a week in a list opens on its own page; Back comes back to the list. */
	function openDay(date: string) {
		go({ page: "sleep", range: "1d", offset: offsetOf(date), tab: "score" });
	}

	function openWeek(weekEnd: string) {
		go({ page: "sleep", range: "7d", offset: Math.round(offsetOf(weekEnd) / 7), tab: "score" });
	}

	function openFactor(factor: SleepFactorId) {
		if (day) go({ page: "sleep-factor", factor, date: day.date });
	}

	let banner = $derived.by(() => {
		if (history) {
			const reached = history.reached
				? new Date(`${history.reached.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
				: null;
			return { title: "Fetching sleep history…", detail: reached ? `Back to ${reached}` : "Starting…" };
		}
		return {
			title: "Sleep history isn’t synced",
			detail: "Charts cover only what’s synced. A year of history takes about 14 requests.",
		};
	});
</script>

<div class="sleep-page sleep-colors">
	<div class="sticky">
		<PageBar title="Sleep" {onBack} />
		<div class="controls">
			<RangeControl value={route.range} onChange={(range) => set({ range, offset: 0 })} />
			<div class="period">
				<button class="step" aria-label="Previous period" disabled={!canGoBack} onclick={() => set({ offset: route.offset - 1 })}>
					<span use:lucide={"chevron-left"}></span>
				</button>
				<strong>{label}</strong>
				<button class="step" class:hidden={route.offset === 0} aria-label="Next period" disabled={route.offset === 0} onclick={() => set({ offset: route.offset + 1 })}>
					<span use:lucide={"chevron-right"}></span>
				</button>
			</div>
		</div>
		{#if day}
			<div class="day-tabs">
				<button class:on={route.tab === "score"} aria-pressed={route.tab === "score"} onclick={() => set({ tab: "score" })}>Sleep Score</button>
				<button class:on={route.tab === "coach"} aria-pressed={route.tab === "coach"} onclick={() => set({ tab: "coach" })}>Sleep Coach</button>
			</div>
		{/if}
	</div>

	{#if history || !data.complete}
		<div class="banner"><HistoryBanner title={banner.title} detail={banner.detail} busy={history !== null} {canSync} onSync={onSyncHistory} /></div>
	{/if}

	{#if day}
		{#if day.state === "empty"}
			<div class="empty">No sleep was recorded for this night.</div>
		{:else if route.tab === "coach"}
			<CoachTab view={day} onHistory={(key) => onHistory(historyView(data, day.date, key))} />
		{:else}
			<ScoreTab view={day} {openFactor} />
		{/if}
	{:else if period}
		<PeriodView view={period} {openDay} {openWeek} />
	{/if}
</div>

<style>
	.sleep-colors {
		--gcs-deep: color-mix(in srgb, var(--color-blue) 80%, #000);
		--gcs-light: color-mix(in srgb, var(--color-blue) 60%, #fff);
	}
	.sticky {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--background-primary);
	}
	/* The pane's scroller has top padding that the header sticks below, so
	   without a cover the page scrolls through that strip above it. */
	.sticky::before {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 100%;
		height: 48px;
		background: var(--background-primary);
	}
	button {
		font: inherit;
		color: inherit;
		margin: 0;
		height: auto;
		border: none;
		box-shadow: none;
		background: none;
		cursor: pointer;
	}
	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		height: 128.3px;
		padding-top: 22.3px;
	}
	.period {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) 20px;
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		margin-top: 25.9px;
		padding: 0 16px;
	}
	.period strong {
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border-radius: 50%;
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}
	.step :global(svg) {
		width: 14px;
		height: 14px;
	}
	.step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.step.hidden {
		visibility: hidden;
	}
	.day-tabs {
		display: flex;
		justify-content: center;
		gap: 46px;
		height: 50px;
		box-sizing: border-box;
		padding-top: 13.8px;
		border-top: 1px solid var(--background-modifier-border);
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.day-tabs button {
		height: 34.2px;
		padding: 0;
		border-bottom: 1px solid transparent;
		border-radius: 0;
		font-size: 16px;
		line-height: 20px;
		color: var(--text-muted);
		display: flex;
		align-items: flex-start;
	}
	.day-tabs button.on {
		border-bottom-color: var(--text-normal);
		color: var(--text-normal);
		font-weight: 600;
	}
	.banner {
		padding: 12.3px 16px 0;
	}
	.empty {
		padding: 48px 16px;
		text-align: center;
		color: var(--text-muted);
	}

	@container (min-width: 640px) {
		.banner {
			max-width: 1126px;
			margin: 0 auto;
			padding: 16px 32px 0;
		}
	}

	/* One row of controls, the range on the left and the period on the right,
	   and the tabs on a row of their own under it. */
	@container (min-width: 1000px) {
		.controls {
			flex-direction: row;
			justify-content: space-between;
			height: 72px;
			padding: 0 32px;
			border-bottom: 1px solid var(--background-modifier-border);
		}
		.period {
			display: flex;
			gap: 12px;
			width: auto;
			margin: 0;
			padding: 0;
		}
		.period .step.hidden {
			display: none;
		}
		.day-tabs {
			border-top: none;
		}
	}
</style>
