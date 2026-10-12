<script lang="ts">
	import type { CssCurrentView } from "../../../dashboard/critical-swim-speed-pages";

	/**
	 * Current (twin 800:9 empty, the Inferred 800:424 with a result; pane
	 * 802:458): "Critical Swim Speed", the result's day, its pace over "Pace
	 * (min/100m)", then Garmin's copy. Without a result the day and the pace
	 * are "--", the day muted and the pace in the text colour (the twin's
	 * decision: Garmin draws it white).
	 *
	 * The phone keeps the copy where the app has it, at the foot of the
	 * screen in its six lines; a pane sets it beside the block, in the 370 pt
	 * column, as one paragraph.
	 */
	let { current }: { current: CssCurrentView } = $props();
</script>

<div class="css-current">
	<div class="block">
		<p class="title">{current.title}</p>
		<p class="date">{current.line}</p>
		<p class="value">{current.value}</p>
		<p class="unit">{current.unit}</p>
	</div>
	<!-- The phone's line breaks, kept as lines; a pane lets the same words wrap. -->
	<p class="copy">
		{#each current.copyLines as line, i (i)}<span>{line}{" "}</span>{/each}
	</p>
</div>

<style>
	/*
	 * The phone (800:9), under the header's foot at 116.33: the title (Nav
	 * Title 17/22) at 139.6; the day (Body 15/20) at 159; the pace (Semi Bold
	 * 33/40) at 225; the unit (Body) at 264.4, all centred between x 16 and
	 * 386. The copy (Body, x 16) from 693.34, its six lines 17.89 apart (the
	 * app's pitch, a little under the 20 pt line) and 24 over the page's end.
	 */
	.css-current {
		padding-bottom: 24px;
	}
	.block {
		padding-top: 23.27px;
		text-align: center;
	}
	.block p {
		padding: 0 16px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title {
		margin: 0;
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
		color: var(--text-normal);
	}
	/* The day's line box starts 2.6 inside the title's, as on the twin. */
	.date {
		margin: -2.6px 0 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.value {
		margin: 46px 0 0;
		font-size: 33px;
		line-height: 40px;
		font-weight: 600;
		color: var(--text-normal);
	}
	.unit {
		margin: -0.6px 0 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.copy {
		margin: 408.94px 0 0;
		padding: 0 16px;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.copy span {
		display: block;
		height: 17.886px;
	}

	/*
	 * The pane (802:458): the block centred in the 748 pt column (on x 406),
	 * its title 33 under the header's rule (149); the copy in the 370 pt
	 * column at x 788, its first line level with the title, wrapping. The
	 * shell's 32 pt end padding follows the unit.
	 */
	@container (min-width: 1000px) {
		.css-current {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			padding-bottom: 0;
		}
		.block {
			padding-top: 33px;
		}
		.copy {
			margin-top: 33px;
			padding: 0;
			white-space: normal;
		}
		.copy span {
			display: inline;
			height: auto;
		}
	}
</style>
