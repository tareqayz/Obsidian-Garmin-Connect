<script lang="ts">
	import { lapsView } from "../../../dashboard/activity-stats-pages";
	import type { ActivityTabProps } from "./types";

	/**
	 * Laps: Lap, Time, Distance and Avg Pace, one striped row a lap and no
	 * totals (`lapsView`), as the twin's Lap Row (Figma 403:61). The columns
	 * keep their share of the width, so the pane's 1126pt table reads like the
	 * phone's. From 640pt the table is a bordered card.
	 */
	let { detail, units }: ActivityTabProps = $props();

	let view = $derived(lapsView(detail, units));
</script>

{#if view.rows.length}
	<div class="laps-tab">
		<div class="laps" role="table">
			<div class="row head" role="row">
				{#each view.columns as column (column.label)}
					<div class="cell" role="columnheader">
						<span class="title">{column.label}</span>
						{#if column.unit}<span class="unit">{column.unit}</span>{/if}
					</div>
				{/each}
			</div>
			{#each view.rows as lap, i (lap.n)}
				<div class="row lap" class:odd={i % 2 === 0} role="row">
					<div class="cell" role="cell">{lap.n}</div>
					<div class="cell" role="cell">{lap.time}</div>
					<div class="cell" role="cell">{lap.distance}</div>
					<div class="cell" role="cell">{lap.pace}</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.laps-tab {
		padding-bottom: 16px;
	}
	/* The cells' right edges, as shares of the row (Lap Row's SCALE columns):
	   12.25%, 38.37%, 66.98% and 96.01%. */
	.row {
		display: grid;
		grid-template-columns: 12.25% 26.12% 28.61% 29.03%;
		box-sizing: border-box;
		font-size: 15px;
		line-height: 20px;
	}
	.cell {
		min-width: 0;
		text-align: right;
		white-space: nowrap;
	}
	.head {
		height: 68px;
		padding-top: 15.22px;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.head .cell {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
	.title {
		font-weight: 600;
		color: var(--text-normal);
	}
	.unit {
		margin-top: -1.85px;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
	}
	.lap {
		height: 55px;
		padding-top: 15.22px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-variant-numeric: tabular-nums;
	}
	.lap.odd {
		background: var(--background-secondary);
	}

	/* The pane's table (Figma 414:85310): a card whose border is drawn over
	   the rows, 24pt under the tabs; 1126pt at most, centred. */
	@container (min-width: 640px) {
		.laps-tab {
			padding: 24px 32px 32px;
		}
		.laps {
			position: relative;
			overflow: hidden;
			padding-bottom: 1px;
			border-radius: 8px;
		}
		.laps::after {
			content: "";
			position: absolute;
			inset: 0;
			border: 1px solid var(--background-modifier-border);
			border-radius: inherit;
			pointer-events: none;
		}
		.row {
			margin-left: -1px;
		}
		.head {
			margin-top: -1px;
		}
	}

	@container (min-width: 1000px) {
		.laps-tab {
			max-width: 1126px;
			box-sizing: content-box;
			margin: 0 auto;
		}
	}
</style>
