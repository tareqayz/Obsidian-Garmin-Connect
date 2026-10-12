<script lang="ts">
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { FOCUS_KEY, FOCUS_ROW, LOAD_LAYOUT, focusRowPlot } from "../../../dashboard/training-load-charts";
	import type { FocusTabView } from "../../../dashboard/training-load-pages";
	import OptimalRange from "../health/OptimalRange.svelte";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * The Load Focus tab (twin 603:10; pane 609:1438): the phrase's title and
	 * copy, then a row a bucket — Anaerobic, High Aerobic, Low Aerobic — with
	 * Garmin's load and its bar, the Optimal Range box over it, and the
	 * legend. A pane puts the rows and the legend in the 748 pt column and
	 * the title and copy, left-aligned, in the 370 pt one. Geometry is
	 * `focusRowPlot`'s; the rhythm `LOAD_LAYOUT.focus`.
	 */
	let { view, pane }: { view: FocusTabView; pane: boolean } = $props();

	const L = LOAD_LAYOUT.focus;

	/* The rows' content: 370 on the phone, the pane's column. */
	let measured = $state(0);
	let track = $derived(Math.max(0, (measured || (pane ? PANE_COLUMN : PHONE - 32)) - FOCUS_ROW.trackLeft));
</script>

<div
	class="lf"
	style:--lf-title="{L.title}px"
	style:--lf-copy="{L.copy}px"
	style:--lf-rows="{L.rows}px"
	style:--lf-legend="{L.legend}px"
	style:--lf-pane-top="{L.paneTop}px"
	style:--lf-pane-title="{L.paneTitle}px"
	style:--lf-track="{FOCUS_ROW.trackLeft}px"
	style:--lf-value="{FOCUS_ROW.valueRight}px"
>
	<div class="side">
		{#if view.title}<h3 class="lf-title">{view.title}</h3>{/if}
		{#if view.copyLines}
			<p class="lf-copy">
				{#each view.copyLines as line, i (i)}<span>{line}</span>{/each}
			</p>
		{/if}
	</div>
	<div class="main">
		{#if view.empty}
			<div class="lf-empty"><StatEmpty text={view.empty} /></div>
		{:else}
			<div class="rows" bind:clientWidth={measured}>
				{#each view.bars as bar (bar.bucket)}
					{@const plot = focusRowPlot(bar, track)}
					<div class="row">
						<span class="label">{bar.label}</span>
						<span class="value">{bar.text}</span>
						<svg class="track" width={track} height={FOCUS_ROW.barHeight} aria-hidden="true">
							{#if plot.bar.kind !== "none"}<path d={plot.bar.d} fill={plot.color} />{/if}
							{#if plot.box}<OptimalRange x={plot.box.x} width={plot.box.width} height={FOCUS_ROW.barHeight} />{/if}
						</svg>
					</div>
				{/each}
			</div>
			<div class="key">
				<svg width={FOCUS_KEY.width} height={FOCUS_KEY.height} aria-hidden="true"><OptimalRange width={FOCUS_KEY.width} height={FOCUS_KEY.height} /></svg>
				<span>{view.legend}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	/* The phone (603:10): title 18.68 under the header, the copy 7.51 under it, the rows 24.48 under that, the legend 11.67 under the rows. */
	.lf {
		padding-bottom: 35px;
	}
	.side {
		padding: 0 16px;
		text-align: center;
	}
	.lf-title {
		margin: var(--lf-title) 0 0;
		font-size: 22px;
		line-height: 28px;
		font-weight: 700;
		color: var(--text-normal);
	}
	.lf-copy {
		margin: var(--lf-copy) 0 0;
		font-size: 16px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.lf-copy span {
		display: block;
	}
	.main {
		margin-top: var(--lf-rows);
		padding: 0 16px;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row {
		position: relative;
		height: 40px;
		font-size: 17px;
		line-height: 22px;
		color: var(--text-normal);
	}
	.label,
	.value {
		position: absolute;
		top: 7.52px;
		white-space: nowrap;
	}
	.label {
		left: 0;
	}
	.value {
		right: calc(100% - var(--lf-value));
		font-variant-numeric: tabular-nums;
	}
	.track {
		position: absolute;
		top: 16px;
		left: var(--lf-track);
		display: block;
		overflow: visible;
	}
	.key {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: var(--lf-legend);
		font-size: 13px;
		line-height: 16px;
		color: var(--text-normal);
	}
	.key svg {
		display: block;
		flex: none;
		overflow: visible;
	}
	/* No record yet: the shared line where the rows would be (Inferred). */
	.lf-empty {
		position: relative;
		height: 128px;
	}

	/* From 640 pt the shell pads the body: the rows lose their own inset. */
	@container (min-width: 640px) {
		.lf {
			padding-bottom: 0;
		}
		.side,
		.main {
			padding: 0;
		}
	}

	/* The pane (609:1438): the rows 31 under the header in the 748 pt column, the title 37.34 under it in the 370 pt one, left-aligned. */
	@container (min-width: 1000px) {
		.lf {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "main side";
			column-gap: 8px;
			align-items: start;
		}
		.main {
			grid-area: main;
			min-width: 0;
			margin-top: var(--lf-pane-top);
		}
		.side {
			grid-area: side;
			min-width: 0;
			text-align: left;
		}
		.lf-title {
			margin-top: var(--lf-pane-title);
		}
	}
</style>
