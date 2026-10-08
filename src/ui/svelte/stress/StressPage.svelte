<script lang="ts">
	import type { HealthStatRoute } from "../../../dashboard/routes";
	import {
		dayCardRoute,
		dayOf,
		stepRoute,
		stressDayView,
		stressPeriodView,
		switchRange,
		weekCardRoute,
		type StressData,
		type StressRange,
		type StressRoute,
	} from "../../../dashboard/stress-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import type { SleepRow } from "../../../sync/sleep-index";
	import { STRESS_DAY, stressDayIn, type StressDay, type StressRow } from "../../../sync/stress-index";
	import HistoryBanner from "../activities/HistoryBanner.svelte";
	import type { HealthStatPageProps } from "../health/pages";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";
	import RangeControl from "../stats/RangeControl.svelte";
	import DayBody from "./DayBody.svelte";
	import PeriodBody from "./PeriodBody.svelte";

	/**
	 * Garmin Connect's Stress page: a day's ring, tiles and timeline, or a
	 * week, four weeks or a year of daily or weekly averages. The bar with the
	 * range and the period stays put while the rest scrolls. A day or week
	 * card switches this page in place, as the app does, so Back still returns
	 * to Health Stats.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history }: HealthStatPageProps = $props();

	/* The stress index, read again whenever a file in its folder changes. */
	let rows = $state<StressRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions.stress;
		let live = true;
		readIndex<StressRow>("stress").then(
			(index) => {
				if (!live) return;
				rows = index.rows;
				meta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* When each night ended, for the clock on a day's timeline. */
	let wakes = $state<Map<string, number>>(new Map());
	$effect(() => {
		void versions.sleep;
		let live = true;
		readIndex<SleepRow>("sleep").then(
			(index) => {
				if (live) wakes = new Map(index.rows.flatMap((r) => (r.wake !== undefined ? [[r.date, r.wake] as [string, number]] : [])));
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let stressRoute: StressRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let day = $derived(stressRoute.range === "1d" ? dayOf(stressRoute, today) : null);

	/*
	 * A day's readings load on view, fetched if its series file lacks them,
	 * and again when a sync rewrites the file. Until they are in, the
	 * timeline shows its axes; a day Garmin had none for stays that way.
	 */
	let loaded = $state<{ date: string; readings: StressDay | null } | null>(null);
	$effect(() => {
		const date = day;
		void seriesVersion;
		if (!date) return;
		let live = true;
		loadIntraday(date, [STRESS_DAY.key]).then(
			(load) => {
				if (live) loaded = { date, readings: stressDayIn(load.series) };
			},
			() => {
				if (live) loaded = { date, readings: null };
			},
		);
		return () => {
			live = false;
		};
	});
	let readings = $derived(day && loaded?.date === day ? loaded.readings : undefined);

	let data: StressData = $derived({ rows, complete: meta?.complete ?? false });
	let dayView = $derived(day ? stressDayView({ data, route: stressRoute, today, readings, wake: wakes.get(day) }) : null);
	let periodView = $derived(day ? null : stressPeriodView({ data, route: stressRoute, today }));
	let label = $derived(dayView?.label ?? periodView?.label ?? "");
	let canGoBack = $derived(dayView?.canGoBack ?? periodView?.canGoBack ?? false);
	let canGoForward = $derived(stressRoute.offset < 0);

	/* The twin's panes start at 1000pt, where the charts take their pane frames. */
	let width = $state(0);
	let pane = $derived(width >= 1000);

	/** This page, moved: a range, a period, a card. Never a new step. */
	function move(next: StressRoute) {
		const target: HealthStatRoute = { page: "health-stat", stat: "stress", range: next.range, offset: next.offset };
		if (next.date) target.date = next.date;
		swap(target);
	}

	let banner = $derived.by(() => {
		const walk = history.stress;
		if (walk) {
			const reached = walk.reached
				? new Date(`${walk.reached.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
				: null;
			return { title: "Fetching stress history…", detail: reached ? `Back to ${reached}` : "Starting…" };
		}
		return {
			title: "Stress history isn’t synced",
			detail: "Charts cover only what’s synced. A year of history takes about 14 requests.",
		};
	});
</script>

<div class="stress-page" bind:clientWidth={width}>
	<div class="sticky">
		<PageBar title="Stress" {onBack} />
		<div class="controls">
			<RangeControl value={stressRoute.range} onChange={(range: StressRange) => move(switchRange(stressRoute, range, today))} />
			<div class="period">
				<button class="step" aria-label="Previous period" disabled={!canGoBack} onclick={() => move(stepRoute(stressRoute, -1))}>
					<span use:lucide={"chevron-left"}></span>
				</button>
				<strong>{label}</strong>
				<button class="step" class:hidden={!canGoForward} aria-label="Next period" disabled={!canGoForward} onclick={() => move(stepRoute(stressRoute, 1))}>
					<span use:lucide={"chevron-right"}></span>
				</button>
			</div>
		</div>
	</div>

	<div class="body">
		{#if history.stress || !meta?.complete}
			<div class="banner">
				<HistoryBanner title={banner.title} detail={banner.detail} busy={history.stress !== undefined} {canSync} onSync={() => onSyncHistory("stress")} />
			</div>
		{/if}

		{#if dayView}
			<DayBody view={dayView} {pane} />
		{:else if periodView}
			<PeriodBody
				view={periodView}
				{pane}
				openDay={(date) => move(dayCardRoute(date, today))}
				openWeek={(weekEnd) => move(weekCardRoute(stressRoute, weekEnd, today))}
			/>
		{/if}
	</div>
</div>

<style>
	/* The twin's stress/* colours: Home's stress card, as Obsidian variables. */
	.stress-page {
		--stress-rest: var(--color-blue);
		--stress-low: color-mix(in srgb, var(--color-orange) 60%, transparent);
		--stress-medium: var(--color-orange);
		--stress-high: color-mix(in srgb, var(--color-orange) 70%, var(--color-red));
		--stress-none: var(--text-faint);
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
		height: 121px;
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
	.banner {
		padding: 12.3px 16px 0;
	}

	@container (min-width: 640px) {
		/* Content-box: Obsidian makes everything border-box, which would take the padding out of the 1126. */
		.body {
			box-sizing: content-box;
			max-width: 1126px;
			margin: 0 auto;
			padding: 0 32px 32px;
		}
		.banner {
			padding: 16px 0 0;
		}
	}

	/* One row of controls: the range on the left, the period on the right. */
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
	}
</style>
