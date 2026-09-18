<script lang="ts">
	import { detail, type Point } from "../../dashboard/series";
	import Chart from "./Chart.svelte";
	import type { TipRow } from "./Tooltip.svelte";

	export interface LineSeries {
		key: string;
		label: string;
		/** 1-4 on the ordinal ramp. Two related measures, so one hue in two weights. */
		step: number;
		points: readonly Point[];
		dashed?: boolean;
	}

	interface Props {
		series: readonly LineSeries[];
		/** The dates every series is plotted against, oldest first. */
		dates: readonly string[];
		height: number;
		unit?: string;
		format?: (value: number) => string;
	}

	let { series, dates, height, unit = "", format }: Props = $props();

	let render = $derived(format ?? detail);

	/**
	 * Series are sampled onto the shared date axis rather than plotted against
	 * their own: acute load and chronic load are only comparable when a given x
	 * is the same day in both.
	 */
	let aligned = $derived(
		series.map((s) => {
			const byDate = new Map(s.points.map((p) => [p.date, p.value]));
			return { ...s, byDate, values: dates.map((d) => byDate.get(d)) };
		}),
	);
	let values = $derived(
		aligned.flatMap((s) => s.values.filter((v): v is number => v !== undefined)),
	);
</script>

<Chart
	{dates}
	{values}
	{height}
	zeroBased={false}
	{format}
	anchorY={(i, scale) => {
		const at = aligned.map((s) => s.values[i]).filter((v): v is number => v !== undefined);
		return at.length ? Math.min(...at.map((v) => scale.y(v))) : 0;
	}}
	rowsFor={(i) =>
		aligned
			.filter((s) => s.values[i] !== undefined)
			.map<TipRow>((s) => ({
				label: s.label,
				value: `${render(s.values[i]!)}${unit}`,
				color: `var(--gcd-stage-${s.step})`,
			}))}
>
	{#snippet marks(scale, active)}
		{#each aligned as line (line.key)}
			<!-- Gaps are carried by splitting the path rather than joining across
			     them: a straight line through a week of missing days is a lie. -->
			{#each segmentsOf(line.values) as run, r (r)}
				<path
					class="line"
					class:dashed={line.dashed}
					style:stroke="var(--gcd-stage-{line.step})"
					d={runPath(run, scale)}
				/>
			{/each}
		{/each}

		{#if active >= 0}
			<line class="crosshair" x1={scale.x(active)} x2={scale.x(active)} y1="0" y2={scale.inner.h} />
			{#each aligned as line (line.key)}
				{#if line.values[active] !== undefined}
					<circle
						class="dot"
						style:fill="var(--gcd-stage-{line.step})"
						cx={scale.x(active)}
						cy={scale.y(line.values[active]!)}
						r="3.5"
					/>
				{/if}
			{/each}
		{/if}
	{/snippet}
</Chart>

<script module lang="ts">
	import type { Scale } from "../../dashboard/scales";

	/** Unbroken runs of present values, as `[index, value]` pairs. */
	export function segmentsOf(
		values: ReadonlyArray<number | undefined>,
	): Array<Array<[number, number]>> {
		const runs: Array<Array<[number, number]>> = [];
		let current: Array<[number, number]> = [];
		values.forEach((value, i) => {
			if (value === undefined) {
				if (current.length) runs.push(current);
				current = [];
			} else current.push([i, value]);
		});
		if (current.length) runs.push(current);
		// A lone point has no line; draw it as a one-pixel run so it is still visible.
		return runs;
	}

	function runPath(run: ReadonlyArray<[number, number]>, scale: Scale): string {
		if (run.length === 1) {
			const [i, v] = run[0]!;
			return `M${scale.x(i) - 1},${scale.y(v)} L${scale.x(i) + 1},${scale.y(v)}`;
		}
		return run.map(([i, v], n) => `${n === 0 ? "M" : "L"}${scale.x(i)},${scale.y(v)}`).join(" ");
	}
</script>

<style>
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.dashed {
		stroke-dasharray: 5 4;
	}
	.dot {
		stroke: var(--gcd-surface);
		stroke-width: 2;
	}
	.crosshair {
		stroke: var(--gcd-axis);
		stroke-width: 1;
	}
</style>
