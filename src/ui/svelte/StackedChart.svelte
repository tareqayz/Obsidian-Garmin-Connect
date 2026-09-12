<script lang="ts">
	import { GAP, barWidth } from "../../dashboard/scales";
	import type { Stage } from "../../dashboard/metrics";
	import type { DayRow } from "../../dashboard/series";
	import Chart from "./Chart.svelte";

	interface Props {
		rows: readonly DayRow[];
		stages: readonly Stage[];
		height: number;
		format?: (value: number) => string;
	}

	let { rows, stages, height, format }: Props = $props();

	let dates = $derived(rows.map((r) => r.date));
	let totals = $derived(
		rows.map((r) => stages.reduce((sum, s) => sum + (r.values[s.key] ?? 0), 0)),
	);

	/** Bottom-up cumulative tops, so each segment knows where it starts. */
	function segments(row: DayRow) {
		let cursor = 0;
		return stages
			.map((stage) => {
				const value = row.values[stage.key];
				if (typeof value !== "number" || value <= 0) return null;
				const from = cursor;
				cursor += value;
				return { stage, value, from, to: cursor };
			})
			.filter((s): s is NonNullable<typeof s> => s !== null);
	}
</script>

<!--
	Deep → light → REM → awake is an ordered scale, not four identities, so the
	segments take an ordinal ramp of one hue. Four categorical colours here would
	be encoding order as identity.
-->
<Chart
	{dates}
	values={totals}
	{height}
	{format}
	anchorY={(i, scale) => scale.y(totals[i] ?? 0)}
	rowsFor={(i) =>
		segments(rows[i]!).map((s) => ({
			label: s.stage.label,
			value: (format ?? String)(s.value),
			color: `var(--gcd-stage-${s.stage.step})`,
		}))}
>
	{#snippet marks(scale, active)}
		{@const width = barWidth(scale)}
		{#each rows as row, i (row.date)}
			<g class:active={i === active}>
				{#each segments(row) as seg (seg.stage.key)}
					{@const top = scale.y(seg.to)}
					<!-- The 2px surface gap separates segments. Never a stroke. -->
					<rect
						class="stack stage-{seg.stage.step}"
						x={scale.x(i) - width / 2}
						y={top}
						{width}
						height={Math.max(0, scale.y(seg.from) - top - GAP)}
					/>
				{/each}
			</g>
		{/each}
	{/snippet}
</Chart>

<style>
	.stage-1 { fill: var(--gcd-stage-1); }
	.stage-2 { fill: var(--gcd-stage-2); }
	.stage-3 { fill: var(--gcd-stage-3); }
	.stage-4 { fill: var(--gcd-stage-4); }
	g.active .stack { fill-opacity: 0.75; }
</style>
