<script lang="ts">
	import { linePath } from "../../dashboard/scales";
	import { detail, type Point } from "../../dashboard/series";
	import Chart from "./Chart.svelte";

	interface Props {
		points: readonly Point[];
		height: number;
		label: string;
		unit?: string;
	}

	let { points, height, label, unit = "" }: Props = $props();

	let dates = $derived(points.map((p) => p.date));
	let values = $derived(points.map((p) => p.value));
</script>

<Chart
	{dates}
	{values}
	{height}
	zeroBased={false}
	anchorY={(i, scale) => scale.y(values[i] ?? 0)}
	rowsFor={(i) => [{ label, value: `${detail(values[i] ?? 0)}${unit}` }]}
>
	{#snippet marks(scale, active)}
		{@const d = linePath(values, scale)}
		<path class="area" d="{d} L{scale.x(values.length - 1)},{scale.inner.h} L{scale.x(0)},{scale.inner.h} Z" />
		<path class="line" {d} />

		<!-- Only the endpoint is labelled; a number on every point goes unread. -->
		<circle class="dot" cx={scale.x(values.length - 1)} cy={scale.y(values[values.length - 1] ?? 0)} r="4" />

		{#if active >= 0}
			<line class="crosshair" x1={scale.x(active)} x2={scale.x(active)} y1="0" y2={scale.inner.h} />
			<circle class="dot" cx={scale.x(active)} cy={scale.y(values[active] ?? 0)} r="4" />
		{/if}
	{/snippet}
</Chart>

<style>
	.line {
		fill: none;
		stroke: var(--gcd-series);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.area {
		fill: var(--gcd-series);
		fill-opacity: 0.1;
		stroke: none;
	}
	/* The 2px ring is the surface colour, so a marker stays legible where it
	   crosses the line. */
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
