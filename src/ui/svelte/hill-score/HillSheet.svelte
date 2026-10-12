<script lang="ts">
	import type { HillFactorSheet } from "../../../dashboard/hill-score-pages";
	import StatDial from "../health/StatDial.svelte";

	/**
	 * A factor's half sheet (twin 505:51 / 505:169 / 505:284, the pane's
	 * dialogs 507:95637 / 95673 / 95711): the Factor Dial (503:523) 8 pt under
	 * the modal's header, then the copy. Hill Endurance and Hill Strength
	 * draw their three bands, VO₂ Max the VO₂ Max page's five; all on the hill
	 * dial's ring, without separators, so the gaps show the sheet. The title
	 * and the close button are the modal's own.
	 */
	interface Props {
		sheet: HillFactorSheet;
		onClose: () => void;
	}

	let { sheet }: Props = $props();
</script>

<div class="hill-sheet">
	<div class="dial">
		<!-- The word under the number is set in Body (15/20), a size under the page dial's "100". -->
		<StatDial kind="hill" gauge={sheet.gauge} label="" />
		{#if sheet.gauge.label}<span class="word">{sheet.gauge.label}</span>{/if}
	</div>
	{#if sheet.copy}<div class="sheet-copy">{sheet.copy}</div>{/if}
</div>

<style>
	/* The copy's lines on a 20 pt pitch from 8.6 under the dial; 25 under the last one, and a phone's home indicator. */
	.hill-sheet {
		box-sizing: border-box;
		padding: 8px 16px calc(25px + var(--safe-area-inset-bottom, 0px));
		background: var(--background-primary);
		color: var(--text-normal);
	}
	.dial {
		position: relative;
		width: 196px;
		margin: 0 auto;
	}
	.word {
		position: absolute;
		top: 113.26px;
		left: 13px;
		width: 170px;
		font-size: 15px;
		line-height: 20px;
		text-align: center;
		white-space: nowrap;
		color: var(--text-muted);
	}
	.sheet-copy {
		margin-top: 8.6px;
		font-size: 16px;
		line-height: 20px;
	}
</style>
