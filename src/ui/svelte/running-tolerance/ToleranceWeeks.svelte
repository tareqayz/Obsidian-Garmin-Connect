<script lang="ts">
	import { WEEK_BLOCK } from "../../../dashboard/running-tolerance-charts";
	import type { ToleranceWeekBlock } from "../../../dashboard/running-tolerance-pages";

	/**
	 * The weeks, newest first (twin Week Block 692:123): a 25.67 pt band with
	 * the week in Group Label (13/16) muted, then Tolerance, Impact Load and
	 * Actual Distance, each label in List Item (17/22) muted with its value in
	 * Nav Title on the right; the band and the rows on the secondary
	 * background, 1 pt rules under the band, between the rows and at the foot.
	 * On a phone the blocks run edge to edge, one after another; from 640 pt
	 * each is a rounded card without its foot rule, two a row, three in a pane
	 * (370 wide, 8 apart, rows 16 apart).
	 */
	let { weeks }: { weeks: readonly ToleranceWeekBlock[] } = $props();
</script>

<div
	class="rt-weeks"
	style:--rt-band={`${WEEK_BLOCK.band}px`}
	style:--rt-band-top={`${WEEK_BLOCK.headerTop}px`}
	style:--rt-row-top={`${WEEK_BLOCK.rowText}px`}
	style:--rt-row-1={`${WEEK_BLOCK.rows[0]}px`}
	style:--rt-row-2={`${WEEK_BLOCK.rows[1]}px`}
	style:--rt-row-3={`${WEEK_BLOCK.rows[2]}px`}
>
	{#each weeks as week (week.week)}
		<section class="rt-week">
			<div class="rt-band">{week.title}</div>
			{#each week.rows as row (row.label)}
				<div class="rt-row">
					<span class="rt-label">{row.label}</span>
					<span class="rt-value">{row.value}</span>
				</div>
			{/each}
		</section>
	{/each}
</div>

<style>
	.rt-weeks {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.rt-week {
		min-width: 0;
		background: var(--background-secondary);
	}
	.rt-band,
	.rt-row {
		box-sizing: content-box;
		padding: 0 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		white-space: nowrap;
	}
	.rt-band {
		height: calc(var(--rt-band) - var(--rt-band-top));
		padding-top: var(--rt-band-top);
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rt-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		height: calc(var(--rt-row-1) - var(--rt-row-top));
		padding-top: var(--rt-row-top);
		font-size: 17px;
		line-height: 22px;
	}
	.rt-row:last-child {
		height: calc(var(--rt-row-3) - var(--rt-row-top));
	}
	.rt-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-muted);
	}
	.rt-value {
		flex: none;
		font-weight: 600;
		color: var(--text-normal);
	}

	@container (min-width: 640px) {
		.rt-weeks {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px 8px;
			align-items: start;
		}
		.rt-week {
			overflow: hidden;
			border-radius: var(--radius-m, 8px);
		}
		/* A card's foot is its edge: the last row keeps its height without the rule. */
		.rt-row:last-child {
			border-bottom: none;
			padding-bottom: 1px;
		}
	}

	@container (min-width: 1000px) {
		.rt-weeks {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
