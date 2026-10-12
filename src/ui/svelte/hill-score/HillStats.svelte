<script lang="ts">
	import type { HillFigure } from "../../../dashboard/hill-score-pages";

	/**
	 * Avg Score and Max Score (the twin's Stats, 503:472): each under a 1 pt
	 * rule, the value in Value L (22/26) 8.27 pt under the rule's top and its
	 * caption in Label (13/16) at 34.2, the two 15 pt apart. On a phone the
	 * row starts 1 pt left of the page's 16 pt inset, as the twin's rules run
	 * from x 15 to 386; in a pane it fills the side column.
	 */
	let { figures }: { figures: readonly HillFigure[] } = $props();
</script>

<div class="hill-stats">
	{#each figures as figure (figure.label)}
		<div class="figure">
			<span class="value">{figure.value}</span>
			<span class="label">{figure.label}</span>
		</div>
	{/each}
</div>

<style>
	.hill-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 15px;
		margin-left: -1px;
	}
	.figure {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		min-width: 0;
		height: 51px;
		padding-top: 7.27px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.label {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@container (min-width: 1000px) {
		.hill-stats {
			margin-left: 0;
		}
	}
</style>
