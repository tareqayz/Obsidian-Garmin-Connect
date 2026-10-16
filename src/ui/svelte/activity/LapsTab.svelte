<script lang="ts">
	import { lapsView } from "../../../dashboard/activity-stats-pages";
	import type { ActivityTabProps } from "./types";

	/**
	 * Laps: the sport's columns (the run's Lap, Time, Distance and Avg Pace),
	 * one striped row a lap (`lapsView`), as the twin's Lap Row (Figma 403:61).
	 * A pool swim's rests are rows like any other, as the phone draws them; a
	 * sport's totals row is the table's footer (the twin's Lap Row · Total,
	 * 968:103), and a sport may pin the header under the page's bar while the
	 * rows scroll (`LapsSpec.pinnedHeader`, the pool's "Int" table). The
	 * columns keep their share of the width, so the pane's 1126pt table reads
	 * like the phone's. From 640pt the table is a bordered card.
	 */
	let { detail, units, profile }: ActivityTabProps = $props();

	let view = $derived(lapsView(detail, units, profile.laps));
	let pinned = $derived(profile.laps?.pinnedHeader === true);
	/** Each column's share of the row; the cells sit at their column's right edge. */
	let columns = $derived(view.columns.map((c) => `${c.width}%`).join(" "));
</script>

{#if view.rows.length}
	<div class="laps-tab">
		<div class="laps" class:pinned role="table" style:--gc-lap-columns={columns}>
			<div class="row head" role="row">
				{#each view.columns as column (column.label)}
					<div class="cell" role="columnheader">
						<span class="title">{column.label}</span>
						{#if column.unit}<span class="unit">{column.unit}</span>{/if}
					</div>
				{/each}
			</div>
			{#each view.rows as row, i (row.key)}
				<div class="row lap" class:odd={i % 2 === 0} class:total={row.kind === "total"} role="row">
					{#each row.cells as cell, c (c)}
						<div class="cell" role="cell">{cell}</div>
					{/each}
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
	   the run's 12.25%, 38.37%, 66.98% and 96.01%. */
	.row {
		display: grid;
		grid-template-columns: var(--gc-lap-columns);
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
	/* The pinned header sits under the page's sticky bar and tabs, over the rows. */
	.pinned .head {
		position: sticky;
		top: var(--activity-bar-height, 0px);
		z-index: 1;
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
	/* Only a sport's tables have a totals row: the footer, Semi Bold on the
	   in-between background under a rule, whatever stripe its place gives. */
	.lap.total {
		font-weight: 600;
		background: var(--background-primary-alt);
		box-shadow: inset 0 1px 0 var(--background-modifier-border);
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
		/* `clip` rounds the card as `hidden` does without making it the scroll
		   container, which would hold a pinned header in place inside it. */
		.laps.pinned {
			overflow: clip;
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
