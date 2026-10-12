<script lang="ts">
	import type { LtCurrentView } from "../../../dashboard/running-lactate-threshold-pages";
	import ShapeMarker from "../health/ShapeMarker.svelte";
	import RunnerIcon from "../race-predictor/RunnerIcon.svelte";
	import { LT_COLOR } from "./colors";

	/**
	 * Current (twin 755:50, pane 758:1042): the runner in its disc (Icon
	 * Badge 754:552), "Your current threshold" and Garmin's copy, then the
	 * four values in a 2 × 2 grid filled row by row — Heart Rate, Pace |
	 * Power, Power (W/kg) — each a Threshold Cell (754:555): a rule, the
	 * number with its unit on its baseline, and the series' glyph and name.
	 * No date and no "Based On". A pane puts the grid in the wide column and
	 * the rest beside it, the disc level with the first rule.
	 */
	let { view }: { view: LtCurrentView } = $props();
</script>

<div class="lt-current">
	<div class="intro">
		<div class="badge"><span class="art"><RunnerIcon /></span></div>
		<p class="title">{view.title}</p>
		<p class="copy">
			{#each view.copyLines as line (line)}<span>{line}</span>{/each}
		</p>
	</div>
	<div class="grid">
		{#each view.cells as cell (cell.id)}
			<div class="cell">
				<span class="figure"><span class="value">{cell.value}</span><span class="unit">{cell.unit}</span></span>
				<span class="glyph {cell.shape}"><span class="scale"><ShapeMarker shape={cell.shape} color={LT_COLOR[cell.id]} /></span></span>
				<span class="name">{cell.label}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	/*
	 * The phone (755:50), from the header's foot (y 116.33): the disc 16
	 * down (y 132.33), the title 16.29 under it (212.62), the copy's lines
	 * 15.17 under the title (251.79) and 17.67 apart, the grid's first rules
	 * 38.87 under the copy (328.33), at x 31 and 208, the rows 72.67 apart.
	 */
	.lt-current {
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
	/* Icon Badge: a 64 pt disc, the runner (31.67 × 33.67) at (17, 15) in it. */
	.badge {
		position: relative;
		flex: none;
		width: 64px;
		height: 64px;
		margin-top: 16px;
		border-radius: 50%;
		background: var(--background-secondary);
	}
	.art {
		position: absolute;
		left: 17px;
		top: 15px;
		transform: scale(1.0133, 1.0142);
		transform-origin: 0 0;
	}
	.art :global(.runner path) {
		fill: var(--text-muted);
	}
	/* Title M, 20/24 bold. */
	.title {
		margin: 16.29px 0 0;
		font-size: 20px;
		line-height: 24px;
		font-weight: 700;
		color: var(--text-normal);
	}
	/* Body, 15/20, the lines 17.67 apart. */
	.copy {
		display: flex;
		flex-direction: column;
		margin: 15.17px 0 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-normal);
	}
	.copy span + span {
		margin-top: -2.33px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(2, 52px);
		gap: 20.67px 15px;
		margin-top: 38.87px;
		padding: 0 32px 0 31px;
	}
	/* Threshold Cell: a 1 pt rule over the value row and the glyph and name. */
	.cell {
		position: relative;
		min-width: 0;
		box-shadow: inset 0 1px 0 var(--background-modifier-border);
		color: var(--text-normal);
	}
	/* Value L 22/26 and the unit in Body 15/20 on its baseline, 4 apart. */
	.figure {
		position: absolute;
		top: 8.35px;
		left: -0.33px;
		display: flex;
		align-items: baseline;
		gap: 4px;
		white-space: nowrap;
	}
	.value {
		font-size: 22px;
		line-height: 26px;
	}
	.unit {
		font-size: 15px;
		line-height: 20px;
	}
	/* The Shape Marker at 13 pt (the diamond 12, the triangle 11) at x 4. */
	.glyph {
		position: absolute;
		left: 4px;
		top: 36.67px;
		width: 13px;
		height: 13px;
	}
	.glyph.diamond {
		left: 4.5px;
		top: 37.17px;
		width: 12px;
		height: 12px;
	}
	.glyph.triangle {
		left: 5px;
		top: 38.33px;
		width: 11px;
		height: 11px;
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
	.triangle .scale {
		transform: scale(0.6875);
	}
	/* Label, 13/16, at x 23.67. */
	.name {
		position: absolute;
		left: 23.67px;
		top: 36.07px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	@container (min-width: 640px) {
		.lt-current {
			padding-bottom: 0;
		}
		.grid {
			padding: 0;
		}
	}

	/*
	 * The pane (758:1042), from the header's rule (116): the grid in the wide
	 * column, its cells 370 wide and 8 apart, its first rules 33 down; beside
	 * it the disc level with them and the title and copy under it, centred on
	 * the 370 pt column (x 973).
	 */
	@container (min-width: 1000px) {
		.lt-current {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "grid intro";
			column-gap: 8px;
			align-items: start;
		}
		.intro {
			grid-area: intro;
		}
		.badge {
			margin-top: 33px;
		}
		.grid {
			grid-area: grid;
			column-gap: 8px;
			margin-top: 33px;
		}
	}
</style>
