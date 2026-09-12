<script lang="ts">
	import { detail } from "../../dashboard/series";
	import Chart from "./Chart.svelte";

	export interface BandRow {
		date: string;
		low: number;
		high: number;
	}

	interface Props {
		rows: readonly BandRow[];
		height: number;
		lowLabel: string;
		highLabel: string;
	}

	let { rows, height, lowLabel, highLabel }: Props = $props();

	let dates = $derived(rows.map((r) => r.date));
	let values = $derived(rows.flatMap((r) => [r.low, r.high]));
</script>

<!-- One entity with a range, so one hue in two weights — not two series. -->
<Chart
	{dates}
	{values}
	{height}
	anchorY={(i, scale) => scale.y(rows[i]?.high ?? 0)}
	rowsFor={(i) => [
		{ label: highLabel, value: detail(rows[i]?.high ?? 0) },
		{ label: lowLabel, value: detail(rows[i]?.low ?? 0) },
	]}
>
	{#snippet marks(scale, _active)}
		{@const top = rows.map((r, i) => `${i === 0 ? "M" : "L"}${scale.x(i)},${scale.y(r.high)}`).join(" ")}
		{@const bottom = rows
			.map((_, i) => rows.length - 1 - i)
			.map((i) => `L${scale.x(i)},${scale.y(rows[i]!.low)}`)
			.join(" ")}
		<path class="area" d="{top} {bottom} Z" />
		<path class="line" d={top} />
		<path
			class="line soft"
			d={rows.map((r, i) => `${i === 0 ? "M" : "L"}${scale.x(i)},${scale.y(r.low)}`).join(" ")}
		/>
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
	.soft {
		stroke-opacity: 0.45;
	}
	.area {
		fill: var(--gcd-series);
		fill-opacity: 0.1;
		stroke: none;
	}
</style>
