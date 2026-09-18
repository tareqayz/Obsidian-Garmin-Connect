<script lang="ts">
	import { linePath } from "../../dashboard/scales";
	import { detail, type Point } from "../../dashboard/series";
	import Chart from "./Chart.svelte";
	import type { TipRow } from "./Tooltip.svelte";

	export interface BaselinePoint extends Point {
		low?: number;
		high?: number;
	}

	interface Props {
		points: readonly BaselinePoint[];
		height: number;
		label: string;
		unit?: string;
		bandLabel?: string;
	}

	let { points, height, label, unit = "", bandLabel = "Baseline" }: Props = $props();

	let dates = $derived(points.map((p) => p.date));
	let values = $derived(points.map((p) => p.value));
	// The band has to be inside the axis or it gets clipped at the top.
	let extent = $derived(
		points.flatMap((p) => [p.value, ...(p.low === undefined ? [] : [p.low]), ...(p.high === undefined ? [] : [p.high])]),
	);
	let banded = $derived(points.filter((p) => p.low !== undefined && p.high !== undefined));
</script>

<!-- A number against the range it is judged by. 38 ms means nothing on its own;
     38 ms inside a 32-48 band means "normal for you". -->
<Chart
	{dates}
	values={extent}
	{height}
	zeroBased={false}
	anchorY={(i, scale) => scale.y(values[i] ?? 0)}
	rowsFor={(i) => {
		const point = points[i];
		const rows: TipRow[] = [{ label, value: `${detail(point?.value ?? 0)}${unit}` }];
		if (point?.low !== undefined && point?.high !== undefined) {
			rows.push({
				label: bandLabel,
				value: `${detail(point.low)}–${detail(point.high)}${unit}`,
				color: "var(--gcd-stage-4)",
			});
		}
		return rows;
	}}
>
	{#snippet marks(scale, active)}
		{#if banded.length > 1}
			{@const top = points
				.map((p, i) => (p.high === undefined ? null : `${scale.x(i)},${scale.y(p.high)}`))
				.filter((s): s is string => s !== null)}
			{@const bottom = points
				.map((p, i) => (p.low === undefined ? null : `${scale.x(i)},${scale.y(p.low)}`))
				.filter((s): s is string => s !== null)
				.reverse()}
			<path class="band" d="M{top.join(" L")} L{bottom.join(" L")} Z" />
		{/if}

		<path class="line" d={linePath(values, scale)} />
		<circle
			class="dot"
			cx={scale.x(values.length - 1)}
			cy={scale.y(values[values.length - 1] ?? 0)}
			r="4"
		/>

		{#if active >= 0}
			<line class="crosshair" x1={scale.x(active)} x2={scale.x(active)} y1="0" y2={scale.inner.h} />
			<circle class="dot" cx={scale.x(active)} cy={scale.y(values[active] ?? 0)} r="4" />
		{/if}
	{/snippet}
</Chart>

<style>
	/* The band is context, so it sits at the lightest step of the same hue and
	   never competes with the line for attention. */
	.band {
		fill: var(--gcd-stage-4);
		fill-opacity: 0.25;
		stroke: none;
	}
	.line {
		fill: none;
		stroke: var(--gcd-series);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.dot {
		fill: var(--gcd-series);
		stroke: var(--gcd-surface);
		stroke-width: 2;
	}
	.crosshair {
		stroke: var(--gcd-axis);
		stroke-width: 1;
	}
</style>
