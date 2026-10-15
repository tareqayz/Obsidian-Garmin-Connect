<script lang="ts">
	import { CHART_COLOURS } from "../../../../dashboard/activity-chart-pages";
	import { powerCurvePlot } from "../../../../dashboard/cycling-activity-charts";
	import type { PowerCurveData } from "../../../../dashboard/cycling-metrics";
	import { PHONE } from "../../../../dashboard/stat-charts";
	import type { CardPlotProps } from "../charts/kinds";

	/**
	 * The Power Curve (the twin's 952:1402): the line under the title, then this
	 * ride's best power by duration over the all-time Record, in W or W/kg, on
	 * the 14 durations from 1 sec to 5 hr. The gridlines cross over both areas
	 * at 12 % of the text colour, as Garmin's tint what they cross; the Record
	 * is a backdrop that follows the theme (`--gc-record-area`).
	 */
	let { card, layout }: CardPlotProps = $props();

	let measured = $state(0);
	let data = $derived(card.data as PowerCurveData);
	let p = $derived(powerCurvePlot(data, measured || PHONE, layout));
</script>

<div class="gc-power-curve" bind:clientWidth={measured} style:height="{p.height}px">
	<p class="subtitle" style:top="{p.subtitleY - 10}px">{data.subtitle}</p>
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#if p.record.area}<path class="record" d={p.record.area} />{/if}
		{#if p.activity.area}<path class="activity" d={p.activity.area} />{/if}
		{#if p.activity.line}<path class="activity-line" d={p.activity.line} />{/if}
		{#each p.grid as line, i (i)}
			<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
			<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
		{/each}
		{#each p.dots as dot, i (i)}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
		{#each p.labels as label, i (i)}
			<text class="duration" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
		{/each}
		<text class="axis-title" x={p.title.x} y={p.title.y} text-anchor="middle" dominant-baseline="central">{p.title.text}</text>
	</svg>
	<div class="keys" style:top="{p.keysY - 8}px">
		{#each data.keys as key (key.label)}
			<span class="key"><span class="key-dot" class:this={key.colour === "blue"} style:background-color={key.colour === "blue" ? null : CHART_COLOURS[key.colour]}></span>{key.label}</span>
		{/each}
	</div>
</div>

<style>
	.gc-power-curve {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	/* The line under the title: one line on a phone, two in a pane's card. */
	.subtitle {
		position: absolute;
		left: 16.3px;
		right: 16px;
		margin: 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.record {
		fill: var(--gc-record-area);
	}
	.activity {
		fill: var(--gc-curve-area);
	}
	.activity-line {
		fill: none;
		stroke: var(--gc-curve-line);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.grid {
		stroke: var(--text-normal);
		stroke-width: 0.67;
		opacity: 0.12;
	}
	.tick {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.dot {
		fill: var(--text-faint);
	}
	.duration {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.axis-title {
		fill: var(--text-muted);
		font-size: 12px;
	}
	/* The key: 12 pt dots, This Activity in the line's blue, Record text-faint. */
	.keys {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 11px;
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 7.6px;
	}
	.key-dot {
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}
	.key-dot.this {
		background-color: var(--gc-curve-line);
	}
</style>
