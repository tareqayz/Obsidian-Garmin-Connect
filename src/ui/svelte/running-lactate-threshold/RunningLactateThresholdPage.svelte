<script lang="ts">
	import type { StatRoute } from "../../../dashboard/routes";
	import { LT_FRAMES } from "../../../dashboard/running-lactate-threshold-charts";
	import { LT_CHIP_RULE, movedRoute, runningLactateThresholdView, withLtChip, type LtChipId } from "../../../dashboard/running-lactate-threshold-pages";
	import type { AccountInfo } from "../../../sync/account";
	import type { DayIndexDef, DayIndexMeta } from "../../../sync/day-index";
	import { FTP_INDEX, type FtpRow } from "../../../sync/ftp-index";
	import { LACTATE_THRESHOLD_INDEX, type LactateThresholdRow } from "../../../sync/lactate-threshold-index";
	import StatChips from "../health/StatChips.svelte";
	import StatLegend from "../health/StatLegend.svelte";
	import StatPageShell, { type StatHistory } from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import { LT_COLOR } from "./colors";
	import LtChart from "./LtChart.svelte";
	import LtCurrent from "./LtCurrent.svelte";

	/**
	 * Garmin Connect's Running Lactate Threshold page (Performance Stats).
	 * Twin: Figma page 430:6126 — phones 755:50 (Current), 755:154 / 755:344
	 * / 755:536 (4w Pace / Power / W/kg), 755:728 / 755:938 / 755:1153
	 * (12w), 755:1368 / 755:1648 / 755:1928 (1y); Inferred 755:2208 (12w −1)
	 * and 755:2418 (4w without a point); panes 758:1042 (Current), 758:1092
	 * (12w Pace), 758:1230 (1y Power).
	 *
	 * - Current reads account.json: the four values, no date (`LtCurrent`).
	 * - 4w / 12w / 1y read the lactate threshold index (heart rate, pace)
	 *   and the FTP index (running power, W/kg): "Heart Rate", the two-axis
	 *   chart, the legend (Heart Rate and the chip's series) and the chips,
	 *   single-select in the route's `sub` (`withLtChip`). A range switch
	 *   opens on Pace, a period step keeps the chip (`movedRoute`). A period
	 *   without a point keeps the box, the legend and the chips.
	 * - The history banner follows both indexes: the one walking, else the
	 *   first still coming (the threshold's, then FTP's), its button walking
	 *   that one. Nothing is fetched on view.
	 * - A pane puts the chips and the legend beside the chart, the chips'
	 *   top level with the top gridline's.
	 */
	let { route, today, units, canSync, onBack, swap, readIndex, onSyncHistory, versions, history, readAccount }: PerformanceStatPageProps = $props();

	const LT = LACTATE_THRESHOLD_INDEX.kind;
	const FTP = FTP_INDEX.kind;

	let ltRows = $state.raw<LactateThresholdRow[]>([]);
	let ltMeta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[LT];
		let live = true;
		readIndex<LactateThresholdRow>(LT).then(
			(index) => {
				if (!live) return;
				ltRows = index.rows;
				ltMeta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let powerRows = $state.raw<FtpRow[]>([]);
	let ftpMeta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[FTP];
		let live = true;
		readIndex<FtpRow>(FTP).then(
			(index) => {
				if (!live) return;
				powerRows = index.rows;
				ftpMeta = index.meta;
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

	let complete = $derived({ lt: ltMeta?.complete ?? false, power: ftpMeta?.complete ?? false });
	let view = $derived(runningLactateThresholdView(route, { lt: ltRows, power: powerRows }, { today, complete, account, units }));
	let current = $derived(view.range === "1d" ? view : null);
	let period = $derived(view.range === "1d" ? null : view);

	/** The banner over a range: the index walking, else the first still coming; none once both are whole. Current reads account.json. */
	let banner: StatHistory | undefined = $derived.by(() => {
		if (current) return undefined;
		const indexes: ReadonlyArray<{ def: DayIndexDef; complete: boolean }> = [
			{ def: LACTATE_THRESHOLD_INDEX, complete: complete.lt },
			{ def: FTP_INDEX, complete: complete.power },
		];
		const shown = indexes.find((i) => history[i.def.kind]) ?? indexes.find((i) => !i.complete);
		if (!shown) return undefined;
		const { def } = shown;
		return {
			title: def.title,
			complete: shown.complete,
			walking: history[def.kind],
			canSync,
			onSync: () => onSyncHistory(def.kind),
		};
	});

	let legend = $derived((period?.legend ?? []).map((k) => ({ label: k.label, shape: k.shape, color: LT_COLOR[k.id] })));
	let chips = $derived((period?.chips ?? []).map((c) => ({ id: c.id, label: c.label })));

	/** The shell's range control and steppers: a range switch opens on Pace, which the shell would keep. */
	function move(next: StatRoute) {
		swap(movedRoute(route, next));
	}

	/** A chip: the one on, always one. */
	function onchip(selected: string[]) {
		const chip = selected[0] as LtChipId | undefined;
		if (chip) swap(withLtChip(route, chip));
	}
</script>

<StatPageShell {route} {today} label={view.label} canGoBack={view.canGoBack} {onBack} swap={move} history={banner}>
	{#snippet children({ pane })}
		{#if current}
			<LtCurrent view={current} />
		{:else if period}
			<!-- In a pane the side column starts level with the top gridline: the title's 33 + 22, then the frame's top line's top edge. -->
			<div class="lt-period" style:--lt-side-top="{33 + 22 + LT_FRAMES[period.range].top - 0.5}px">
				<figure class="chart">
					<figcaption>{period.title}</figcaption>
					<LtChart range={period.range} chart={period.chart} empty={period.empty} {pane} />
				</figure>
				<div class="side">
					<div class="legend"><StatLegend items={legend} /></div>
					<div class="chips">
						<StatChips {chips} selected={[period.chip]} multi={LT_CHIP_RULE.multi} required={LT_CHIP_RULE.required} onchange={onchip} />
					</div>
				</div>
			</div>
		{/if}
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (755:154), from the header's foot (y 165): "Heart Rate" 9.86
	 * down (174.86), Value M 17/22 at x 18.5; the chart's box from its foot
	 * to the legend (y 500.67), the legend centred, the chips 13.66 under it
	 * (530.33); nothing below them.
	 */
	.lt-period {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 32px;
	}
	.chart {
		min-width: 0;
		margin: 0;
	}
	figcaption {
		margin-top: 9.86px;
		padding-left: 18.5px;
		font-size: 17px;
		line-height: 22px;
		color: var(--text-normal);
	}
	.side {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	/* The twin's Legend (754:584): Caption 11/14 labels, the entries 15.5 apart. */
	.legend :global(.stat-legend) {
		gap: 8px 15.5px;
	}
	.legend :global(.stat-legend .item) {
		font-size: 11px;
		line-height: 14px;
	}
	.chips {
		margin-top: 13.66px;
	}
	/* The twin's Chip Row (754:594): the shared 36 pt chip with a Value M 17 label. */
	.chips :global(.stat-chips .chip) {
		font-size: 17px;
	}

	@container (min-width: 640px) {
		.lt-period {
			padding-bottom: 0;
		}
	}

	/*
	 * The panes (758:1092, 758:1230), from the header's rule (116): "Heart
	 * Rate" 33 down, 2.5 into the wide column; the chart under it to its
	 * axis' foot; beside it the chips, their top level with the top
	 * gridline's (219.97), and the legend 16 under them, both from the
	 * column's left edge (788).
	 */
	@container (min-width: 1000px) {
		.lt-period {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "chart side";
			column-gap: 8px;
			align-items: start;
		}
		.chart {
			grid-area: chart;
		}
		figcaption {
			margin-top: 33px;
			padding-left: 2.5px;
		}
		.side {
			grid-area: side;
			margin-top: var(--lt-side-top);
		}
		.chips {
			order: 0;
			margin-top: 0;
		}
		/* The shared legend centres its items: fitted to them, it starts at the column's edge. */
		.legend {
			order: 1;
			width: fit-content;
			margin-top: 16px;
		}
	}
</style>
