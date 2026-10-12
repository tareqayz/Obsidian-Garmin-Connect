<script lang="ts">
	import type { EnduranceFigure } from "../../../dashboard/endurance-score-pages";

	/**
	 * Avg Score and Max Score (the twin's Stats, 576:1202): two columns 15 pt
	 * apart, each under a 1 pt rule, the value in Value L (22/26) 8.01 under
	 * the rule's top and its caption in Label (13/16) at 34.41. On a phone the
	 * rules run from x 15 to 193 and 208 to 386; in a pane they fill the side
	 * column.
	 */
	let { figures }: { figures: readonly EnduranceFigure[] } = $props();
</script>

<div class="es-stats">
	{#each figures as figure (figure.label)}
		<div class="figure">
			<span class="value">{figure.value}</span>
			<span class="label">{figure.label}</span>
		</div>
	{/each}
</div>

<style>
	.es-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 15px;
		padding: 0 16px 0 15px;
	}
	.figure {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		min-width: 0;
		height: 51px;
		padding-top: 7.01px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.label {
		margin-top: 0.4px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@container (min-width: 1000px) {
		.es-stats {
			padding: 0;
		}
	}
</style>
