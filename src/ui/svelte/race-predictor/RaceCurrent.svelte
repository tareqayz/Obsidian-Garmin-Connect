<script lang="ts">
	import type { RaceCurrentView } from "../../../dashboard/race-predictor-pages";
	import { RACE_COLOR } from "../health/performance-colors";
	import ShapeMarker from "../health/ShapeMarker.svelte";
	import RunnerIcon from "./RunnerIcon.svelte";

	/**
	 * Current (twin 535:35, pane 537:1310): the runner, "Your Predictions"
	 * and Garmin's copy, then the four predictions in a 2 × 2 grid filled
	 * column by column (5k, 10k | Half, Marathon), each a Prediction cell
	 * (534:341): a rule, the time, and the distance's glyph and name. A pane
	 * puts the grid in the wide column and the rest beside it, the runner
	 * level with the first rule.
	 */
	let { view }: { view: RaceCurrentView } = $props();
</script>

<div class="race-current">
	<div class="intro">
		<div class="icon"><RunnerIcon /></div>
		<p class="title">{view.title}</p>
		<p class="copy">
			{#each view.copyLines as line (line)}<span>{line}</span>{/each}
		</p>
	</div>
	<div class="grid">
		{#each view.times as t (t.id)}
			<div class="cell">
				<span class="time">{t.time}</span>
				<span class="name">
					<span class="glyph {t.shape}"><span class="scale"><ShapeMarker shape={t.shape} color={RACE_COLOR[t.id]} /></span></span>
					{t.label}
				</span>
			</div>
		{/each}
	</div>
</div>

<style>
	/*
	 * The phone (535:35), from the header's foot (y 116.33): the runner's
	 * art 63.3 down (its frame at 179.74), its centre 0.74 right of the
	 * page's, as the phone's ink sits; the title 19.52 under it; the copy's
	 * lines 18 apart, 16.16 under the title; the grid's first rules 39.49
	 * under the copy, at x 31 and 208, the rows 72.67 apart.
	 */
	.race-current {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 32px;
	}
	.intro {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		text-align: center;
	}
	.icon {
		position: relative;
		left: 0.74px;
		margin-top: 63.3px;
	}
	.title {
		margin: 19.52px 0 0;
		font-size: 20px;
		line-height: 24px;
		font-weight: 700;
		color: var(--text-normal);
	}
	.copy {
		display: flex;
		flex-direction: column;
		margin: 16.16px 0 0;
		font-size: 15px;
		line-height: 18px;
		color: var(--text-normal);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(2, 52px);
		grid-auto-flow: column;
		gap: 20.67px 15px;
		margin-top: 39.49px;
		padding: 0 32px 0 31px;
	}
	.cell {
		min-width: 0;
		box-shadow: inset 0 1px 0 var(--background-modifier-border);
		color: var(--text-normal);
	}
	.time {
		display: block;
		padding-top: 8.38px;
		font-size: 22px;
		line-height: 26px;
		white-space: nowrap;
	}
	.name {
		display: flex;
		align-items: flex-start;
		height: 20px;
		margin-top: -0.89px;
		font-size: 15px;
		line-height: 20px;
		white-space: nowrap;
	}
	/* The Shape Marker at 13 pt (the diamond 12), at x 4, before the name at 23.6. */
	.glyph {
		position: relative;
		flex: none;
		width: 13px;
		height: 13px;
		margin: 3.18px 6.6px 0 4px;
	}
	.glyph.triangle {
		margin-top: 3.77px;
	}
	.glyph.diamond {
		width: 12px;
		height: 12px;
		margin: 3.68px 7.1px 0 4.5px;
	}
	.scale {
		position: absolute;
		top: 0;
		left: 0;
		transform: scale(0.8125);
		transform-origin: 0 0;
	}
	.diamond .scale {
		transform: scale(0.75);
	}

	@container (min-width: 640px) {
		.race-current {
			padding-bottom: 0;
		}
		.grid {
			padding: 0;
		}
	}

	/*
	 * The pane (537:1310), from the header's rule (116): the grid in the wide
	 * column, its cells 370 wide and 8 apart, its first rules 33 down; beside
	 * it the runner level with them and the title and copy under it, centred
	 * on the 370 pt column.
	 */
	@container (min-width: 1000px) {
		.race-current {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "grid intro";
			column-gap: 8px;
			align-items: start;
		}
		.intro {
			grid-area: intro;
		}
		.icon {
			margin-top: 32.89px;
		}
		.grid {
			grid-area: grid;
			column-gap: 8px;
			margin-top: 33px;
		}
	}
</style>
