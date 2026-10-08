<script lang="ts">
	import { DAY_RING } from "../../../dashboard/stress-charts";
	import type { StressDayView } from "../../../dashboard/stress-pages";
	import StressRing from "./StressRing.svelte";
	import StressTiles from "./StressTiles.svelte";
	import StressTimeline from "./StressTimeline.svelte";

	/**
	 * A day: the ring with the day's level, the copy line, the four tiles and
	 * the Daily Timeline under them. A pane puts the timeline on the left and
	 * the rest in a 370pt column beside it.
	 */
	let { view, pane }: { view: StressDayView; pane: boolean } = $props();
</script>

<div class="day-body">
	<div class="summary">
		<div class="ring">
			<StressRing parts={view.ring} size={DAY_RING.size} thickness={DAY_RING.thickness} />
			<div class="centre">
				<span class="level">{view.value}</span>
				<span class="caption">Overall</span>
			</div>
		</div>
		<!-- Not a <p>: Obsidian pads it. -->
		<div class="copy">{view.copy}</div>
		<div class="tiles"><StressTiles stats={view.tiles} /></div>
	</div>
	<div class="timeline"><StressTimeline timeline={view.timeline} {pane} /></div>
</div>

<style>
	/* Measured off the twin's 1d frame (272:18), from the bottom of the header. */
	.day-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: "summary" "timeline";
	}
	.summary {
		grid-area: summary;
		min-width: 0;
	}
	.timeline {
		grid-area: timeline;
		min-width: 0;
		margin-top: 21px;
	}
	.ring {
		position: relative;
		width: 182.4px;
		height: 182.4px;
		margin: 17.3px auto 0;
	}
	.centre {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding-top: 2px;
	}
	.level {
		font-size: 34px;
		line-height: 40px;
		font-variant-numeric: tabular-nums;
		color: var(--text-normal);
	}
	.caption {
		margin-top: -0.9px;
		font-size: 16px;
		line-height: 21px;
		color: var(--text-muted);
	}
	.copy {
		min-height: 30px;
		margin-top: 30px;
		padding: 0 11.5px 0 15.5px;
		font-size: 13px;
		line-height: 15px;
		color: var(--text-normal);
	}
	.tiles {
		margin-top: 33.3px;
		padding: 0 16.5px 0 16px;
	}

	/* The twin's pane (279:3157): the timeline in the wide column, the ring,
	   the copy and the tiles in the 370pt one. */
	@container (min-width: 1000px) {
		.day-body {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "timeline summary";
			column-gap: 8px;
			align-items: start;
			--stress-title-indent: 0px;
			--stress-tile-gap: 16px;
		}
		.timeline {
			margin-top: 32px;
		}
		.ring {
			margin-top: 33px;
		}
		.copy,
		.tiles {
			padding: 0;
		}
	}
</style>
