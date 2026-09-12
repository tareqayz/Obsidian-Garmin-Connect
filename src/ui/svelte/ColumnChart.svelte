<script lang="ts">
	import { barPath, barWidth } from "../../dashboard/scales";
	import { detail, type Point } from "../../dashboard/series";
	import Chart from "./Chart.svelte";

	interface Props {
		points: readonly Point[];
		height: number;
		label: string;
		unit?: string;
		goal?: number;
	}

	let { points, height, label, unit = "", goal }: Props = $props();

	let dates = $derived(points.map((p) => p.date));
	let values = $derived(points.map((p) => p.value));
</script>

<Chart
	{dates}
	{values}
	{height}
	{goal}
	anchorY={(i, scale) => scale.y(values[i] ?? 0)}
	rowsFor={(i) => [{ label, value: `${detail(values[i] ?? 0)}${unit}` }]}
>
	{#snippet marks(scale, active)}
		{@const width = barWidth(scale)}
		{@const baseline = scale.y(Math.max(0, scale.min))}
		<g>
			{#each points as point, i (point.date)}
				{@const y = scale.y(point.value)}
				<path
					class="bar"
					class:active={i === active}
					d={barPath(scale.x(i) - width / 2, Math.min(y, baseline), width, Math.abs(baseline - y))}
				/>
			{/each}
		</g>
	{/snippet}
</Chart>

<style>
	.bar {
		fill: var(--gcd-series);
	}
	.bar.active {
		fill-opacity: 0.75;
	}
</style>
