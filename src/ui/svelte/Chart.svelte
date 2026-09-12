<script lang="ts">
	import type { Snippet } from "svelte";
	import type { Scale } from "../../dashboard/scales";
	import { PAD, buildScale } from "../../dashboard/scales";
	import { shortDate } from "../../dashboard/series";
	import Axes from "./Axes.svelte";
	import HitBands from "./HitBands.svelte";
	import Tooltip, { type TipRow } from "./Tooltip.svelte";

	interface Props {
		dates: readonly string[];
		/** Everything that must fit on the y-axis. */
		values: readonly number[];
		height: number;
		zeroBased?: boolean;
		goal?: number;
		format?: (value: number) => string;
		/** Where the tooltip should point for a given index. */
		anchorY: (index: number, scale: Scale) => number;
		rowsFor: (index: number) => TipRow[];
		marks: Snippet<[Scale, number]>;
	}

	let { dates, values, height, zeroBased, goal, format, anchorY, rowsFor, marks }: Props =
		$props();

	// Measured rather than guessed. `bind:clientWidth` is what lets the chart
	// size itself to the card it lands in and redraw on resize, with no
	// ResizeObserver and no measure-then-draw second pass.
	let hostWidth = $state(0);
	let active = $state(-1);

	let scale = $derived(
		buildScale({ count: dates.length, values, width: hostWidth, height, zeroBased, goal }),
	);
	let tipRows = $derived(active >= 0 ? rowsFor(active) : []);
</script>

<div class="chart" bind:clientWidth={hostWidth}>
	{#if hostWidth > 0 && dates.length > 0}
		<svg width={scale.width} height={scale.height} viewBox="0 0 {scale.width} {scale.height}" role="img">
			<g transform="translate({PAD.left},{PAD.top})">
				<Axes {scale} {dates} {format} {goal} />
				{@render marks(scale, active)}
				<HitBands
					{scale}
					{dates}
					count={dates.length}
					onhover={(i) => (active = i)}
					onleave={() => (active = -1)}
				/>
			</g>
		</svg>

		<Tooltip
			visible={active >= 0}
			x={PAD.left + scale.x(active < 0 ? 0 : active)}
			y={PAD.top + (active < 0 ? 0 : anchorY(active, scale))}
			{hostWidth}
			title={shortDate(dates[active] ?? "")}
			rows={tipRows}
		/>
	{/if}
</div>

<style>
	.chart {
		position: relative;
		width: 100%;
	}
	svg {
		display: block;
		max-width: 100%;
		overflow: visible;
	}
</style>
