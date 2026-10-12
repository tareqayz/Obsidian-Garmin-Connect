<script lang="ts">
	import type { FtpRange } from "../../../dashboard/ftp-charts";
	import { ftpView, movedRoute, withFtpUnit } from "../../../dashboard/ftp-pages";
	import type { StatRoute } from "../../../dashboard/routes";
	import type { TrainingSegment } from "../../../dashboard/training-load-copy";
	import type { AccountInfo } from "../../../sync/account";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { FTP_INDEX, type FtpRow } from "../../../sync/ftp-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatTabs from "../health/StatTabs.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import LoadSegmented from "../training-load/LoadSegmented.svelte";
	import FtpChart from "./FtpChart.svelte";
	import FtpCurrent from "./FtpCurrent.svelte";
	import FtpSheet from "./FtpSheet.svelte";

	/**
	 * Garmin Connect's FTP page (Performance Stats). Twin: Figma page
	 * 430:6120 — phones 727:9 (Current), 727:112 (Cross Country Skiing, no
	 * data in the past year), 727:178 / 727:342 (4w Watts / W/kg), 727:502 /
	 * 727:652 (12w), 727:800 / 727:957 (1y), 727:1112 (Cross Country Skiing
	 * 1y); Inferred 728:515 … 728:1507; panes 730:1919 (Current), 730:1988 /
	 * 730:2104 (12w).
	 *
	 * - The tabs sit in the body, under the header on Current and 7.33 under
	 *   the period on a range; a tab keeps the range, the period and the unit.
	 * - Current reads account.json (`powerToWeight/latest`, kept by the
	 *   account sync); the ranges read the FTP index. Nothing is fetched on
	 *   view. The history banner shows on the ranges, which read the index.
	 * - A range has the Watts | W/kg control (Load's, `LoadSegmented`), the
	 *   chart's title and the chart. A period step keeps the unit, a range
	 *   switch opens on Watts (`movedRoute`).
	 * - In a pane the unit control moves to the 370 pt column, on one line
	 *   with the chart's title (730:1988).
	 */
	let { route, today, units, canSync, onBack, swap, readIndex, onSyncHistory, versions, history, openSheet, readAccount }: PerformanceStatPageProps = $props();

	const KIND = FTP_INDEX.kind;

	let rows = $state.raw<FtpRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<FtpRow>(KIND).then(
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

	let account = $state.raw<AccountInfo | null>(null);
	$effect(() => {
		void versions["#account"];
		let live = true;
		readAccount().then(
			(read) => {
				if (live) account = read;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(ftpView(route, rows, { today, complete, account, units }));
	let current = $derived(view.current);
	let range: FtpRange = $derived(route.range === "12w" || route.range === "1y" ? route.range : "4w");

	/* Load's control speaks Load's ids: its left segment is "acute", its right "ratio". */
	const SIDE = { watts: "acute", wkg: "ratio" } as const;
	let segments = $derived((view.segments ?? []).map((s) => ({ id: SIDE[s.id], label: s.label, on: s.on })));

	function onsegment(side: TrainingSegment) {
		swap(withFtpUnit(route, side === "ratio" ? "wkg" : "watts"));
	}

	/** The shell's range control and steppers: a range switch opens on Watts, which the shell would keep. */
	function move(next: StatRoute) {
		swap(movedRoute(route, next));
	}

	function onlink() {
		const sheet = current?.link?.sheet;
		if (sheet) openSheet(sheet.title, FtpSheet, { sheet });
	}
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	steppers={current === null}
	{onBack}
	swap={move}
	history={current
		? undefined
		: {
				title: FTP_INDEX.title,
				// A window is two requests (watts, W/kg): the banner's "a year takes about N requests" counts both.
				windowDays: FTP_INDEX.windowDays / FTP_INDEX.requestsPerWindow,
				complete,
				walking: history[KIND],
				canSync,
				onSync: () => onSyncHistory(KIND),
			}}
>
	{#snippet children({ pane })}
		<div class="ftp-tabs" class:on-header={current !== null}><StatTabs {route} {swap} layout="equal" height={44} /></div>
		{#if current}
			<FtpCurrent {current} {onlink} />
		{:else}
			<div class="ftp-period">
				<div class="ftp-unit"><LoadSegmented {segments} onchange={onsegment} /></div>
				<p class="ftp-title">{view.title}</p>
				<div class="ftp-plot">
					<FtpChart chart={view.chart} {range} unit={view.unit ?? "watts"} empty={view.empty} {pane} />
				</div>
			</div>
		{/if}
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (727:178): the tabs 7.33 under the header on a range, right
	 * under it on Current; the unit control 16 under the tabs, 370 × 31 (the
	 * shot's control is a point shorter than Load's: its thumb keeps 28 at
	 * inset 2, a point of track under it); the chart's title, Regular 20/24
	 * at 16.5, 19.96 under the control; the chart's box 36.71 under the title.
	 */
	.ftp-tabs {
		margin-top: 7.33px;
	}
	.ftp-tabs.on-header {
		margin-top: 0;
	}
	.ftp-period {
		padding-bottom: 24px;
	}
	.ftp-unit {
		margin-top: 16px;
		padding: 0 16px;
	}
	.ftp-unit :global(.load-segmented) {
		height: 31px;
	}
	.ftp-unit :global(.load-segmented .thumb) {
		bottom: 1px;
	}
	.ftp-title {
		margin: 19.96px 0 0;
		padding-left: 16.5px;
		font-size: 20px;
		line-height: 24px;
		font-weight: 400;
		color: var(--text-normal);
	}
	.ftp-plot {
		margin-top: 36.71px;
	}

	/*
	 * The pane (730:1988): the tabs start on the header's rule; the chart's
	 * title 19.5 under them at 16.5 into the 748 pt column, the unit control
	 * at the top of the 370 one, 16 under the tabs, on one line with it; the
	 * chart's box 36.71 under the title.
	 */
	@container (min-width: 1000px) {
		.ftp-tabs,
		.ftp-tabs.on-header {
			margin-top: -1px;
		}
		.ftp-period {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas:
				"title unit"
				"chart unit";
			column-gap: 8px;
			align-items: start;
			padding-bottom: 0;
		}
		.ftp-unit {
			grid-area: unit;
			padding: 0;
		}
		.ftp-title {
			grid-area: title;
			margin-top: 19.5px;
		}
		.ftp-plot {
			grid-area: chart;
			min-width: 0;
		}
	}
</style>
