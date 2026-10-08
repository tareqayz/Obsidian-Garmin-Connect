<script lang="ts">
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { HIGH_LOW_WIDTH, WEIGH_DOT_R, weightPlot } from "../../../dashboard/weight-charts";
	import type { WeightPeriodView } from "../../../dashboard/weight-pages";

	/**
	 * Weight's chart (no title): 7d / 4w a dot a day with weigh-ins and its
	 * High-Low bar, 1y the weekly line; "No data available." without either.
	 */
	let { view, pane }: { view: WeightPeriodView; pane: boolean } = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(weightPlot(view, width, pane));
	let legend = $derived(view.series === "bmi" ? "BMI" : "Avg Weight");
</script>

<figure class="weight-chart">
	<div class="canvas" bind:clientWidth={measured} style:height="{p.height}px">
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line (line.label)}
				<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
			{/each}
			{#each p.bars as bar}<line class="high-low" x1={bar.x} x2={bar.x} y1={bar.top} y2={bar.bottom} stroke-width={HIGH_LOW_WIDTH} />{/each}
			{#each p.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label}
				{#if label.rotated}
					<text class="axis" x={label.x} y={label.y} text-anchor="start" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
				{:else}
					<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
				{/if}
			{/each}
			{#if p.line}<path class="line" class:bmi={view.series === "bmi"} d={p.line} />{/if}
			{#each p.marks as m}<circle class="mark" class:bmi={view.series === "bmi"} cx={m.x} cy={m.y} r={WEIGH_DOT_R} />{/each}
			{#if !view.hasData}<text class="empty" x={p.width / 2} y={p.emptyY} text-anchor="middle" dominant-baseline="central">No data available.</text>{/if}
		</svg>
	</div>
	{#if view.range === "1y" && view.hasData}
		<div class="legend"><span class="swatch" class:bmi={view.series === "bmi"}></span>{legend}</div>
	{/if}
</figure>

<style>
	.weight-chart {
		margin: 0;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.dot {
		fill: var(--text-faint);
	}
	.empty {
		fill: var(--text-muted);
		font-size: 13px;
	}
	.line {
		fill: none;
		stroke: var(--weight-line);
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.mark {
		fill: var(--weight-line);
	}
	.line.bmi {
		stroke: var(--weight-bmi);
	}
	.mark.bmi {
		fill: var(--weight-bmi);
	}
	.high-low {
		stroke: var(--weight-high-low);
		stroke-linecap: round;
	}
	.legend {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 32px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.swatch {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--weight-line);
	}
	.swatch.bmi {
		background: var(--weight-bmi);
	}
</style>
