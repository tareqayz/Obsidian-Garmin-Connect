<script lang="ts">
	import type { EnduranceListRow } from "../../../dashboard/endurance-score-pages";

	/**
	 * A contributor list (the twin's Contributor Row, 579:24): a category on
	 * the secondary background, 44.33 tall, its name in List Item (17/22) at
	 * x 16 and its share in the same, semibold, ending 16 from the right; a
	 * Gym & Fitness Equipment type under it on the hover background, 42 tall,
	 * both in Body (15/20) muted, its name indented to x 32. The parent makes
	 * it a card where the twin rounds it.
	 */
	let { rows }: { rows: readonly EnduranceListRow[] } = $props();
</script>

<div class="es-rows">
	{#each rows as row, i (i)}
		<div class="row" class:es-sub={row.sub}>
			<span class="es-name">{row.name}</span>
			<span class="es-share">{row.text}</span>
		</div>
	{/each}
</div>

<style>
	.es-rows {
		display: flex;
		flex-direction: column;
	}
	.row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		box-sizing: border-box;
		height: 44.33px;
		padding: 11.35px 16px 0;
		background: var(--background-secondary);
		font-size: 17px;
		line-height: 22px;
		color: var(--text-normal);
	}
	.es-sub {
		height: 42px;
		padding: 11.01px 16px 0 32px;
		background: var(--background-modifier-hover);
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.es-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.es-share {
		flex: none;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.es-sub .es-share {
		font-weight: 400;
	}
</style>
