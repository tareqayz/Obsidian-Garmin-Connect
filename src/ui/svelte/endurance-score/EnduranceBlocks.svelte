<script lang="ts">
	import type { EnduranceBlock } from "../../../dashboard/endurance-score-pages";
	import EnduranceRows from "./EnduranceRows.svelte";

	/**
	 * A period's list, newest first (the twin's Period Header 576:1228 over
	 * Contributor Rows): each week or month under a 31.67 pt band with its
	 * name in Label (13/16) muted at x 16. On a phone the rows run edge to
	 * edge, one block after another; from 640 pt each block's rows are a
	 * rounded card, two a row 8 apart and 16 between rows, three in a pane
	 * (585:110129).
	 */
	let { blocks }: { blocks: readonly EnduranceBlock[] } = $props();
</script>

<div class="es-blocks">
	{#each blocks as block (block.date)}
		<section class="es-block">
			<div class="es-header">{block.title}</div>
			<div class="es-card"><EnduranceRows rows={block.rows} /></div>
		</section>
	{/each}
</div>

<style>
	.es-blocks {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.es-block {
		min-width: 0;
	}
	.es-header {
		box-sizing: border-box;
		height: 31.67px;
		padding: 7.84px 16px 0;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		background: var(--background-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@container (min-width: 640px) {
		.es-blocks {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px 8px;
			align-items: start;
		}
		.es-card {
			overflow: hidden;
			border-radius: var(--radius-m, 8px);
		}
	}

	@container (min-width: 1000px) {
		.es-blocks {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
