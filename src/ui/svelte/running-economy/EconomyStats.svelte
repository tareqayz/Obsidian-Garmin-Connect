<script lang="ts">
	import type { EconomyFigure } from "../../../dashboard/running-economy-pages";

	/**
	 * Avg and Best Running Economy (twin Stats 751:9737): each under a 1 pt
	 * rule, 177 pt wide and 16 apart (x 16–193 and 209–386 on the phone), the
	 * value in Value L (22/26) 5.35 under the rule's top and its label in
	 * Label (13/16) at 34.07. A pane's 370 pt column holds the same two.
	 */
	let { figures }: { figures: readonly EconomyFigure[] } = $props();
</script>

<div class="re-stats">
	{#each figures as figure (figure.label)}
		<div class="re-figure">
			<span class="value">{figure.value}</span>
			<span class="label">{figure.label}</span>
		</div>
	{/each}
</div>

<style>
	.re-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 16px;
		padding: 0 16px;
	}
	.re-figure {
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		min-width: 0;
		height: 51px;
		padding: 4.35px 0 0 0.3px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		white-space: nowrap;
	}
	.label {
		margin-top: 2.72px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@container (min-width: 1000px) {
		.re-stats {
			padding: 0;
		}
	}
</style>
