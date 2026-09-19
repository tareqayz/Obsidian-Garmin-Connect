<script lang="ts">
	import { heatGrid, type HeatCell } from "../../dashboard/heatmap";
	import { detail, shortDate, type DayRow } from "../../dashboard/series";

	interface Props {
		rows: readonly DayRow[];
		metricKey: string;
		from: string;
		to: string;
		label: string;
		unit?: string;
		format?: (value: number) => string;
	}

	let { rows, metricKey, from, to, label, unit = "", format }: Props = $props();

	let grid = $derived(heatGrid(rows, metricKey, from, to));
	let render = $derived(format ?? detail);
	let hovered = $state<HeatCell | null>(null);

	// The cell shrinks so a year fits without a scrollbar, and stops shrinking
	// before it stops being clickable.
	let width = $state(0);
	let cell = $derived(
		grid.weeks.length === 0
			? 11
			: Math.max(6, Math.min(20, Math.floor((width - 26) / grid.weeks.length) - 2)),
	);

	const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];

	function title(cell_: HeatCell): string {
		if (cell_.filler) return "";
		const value = cell_.value === undefined ? "no data" : `${render(cell_.value)}${unit}`;
		return `${shortDate(cell_.date)} — ${value}`;
	}
</script>

<!-- Weeks run left to right, weekdays top to bottom. Gaps are days with nothing
     synced, which on a health log is as much of the answer as the values. -->
<div class="heat" bind:clientWidth={width}>
	{#if grid.weeks.length > 0 && width > 0}
		<!-- A year of squares stops shrinking at 6px, so on a narrow pane it is
		     wider than the card. Scrolling it beats clipping it: the labels and
		     the grid move together, and the legend below does not. -->
		<div class="grid">
			<div class="months">
				{#each grid.months as month (month.column)}
					<span class="month" style:left="{month.column * (cell + 2)}px">{month.label}</span>
				{/each}
			</div>

			<div class="body">
				<div class="days" style:height="{7 * (cell + 2)}px">
					{#each WEEKDAYS as day, i (i)}
						<span class="day" style:height="{cell + 2}px" style:line-height="{cell + 2}px">{day}</span>
					{/each}
				</div>

				<div class="weeks">
					{#each grid.weeks as week, w (w)}
						<div class="week">
							{#each week as day (day.date)}
								{#if day.filler}
									<span class="cell hole" style:width="{cell}px" style:height="{cell}px"></span>
								{:else}
									<span
										class="cell"
										class:empty={day.level === 0}
										style:width="{cell}px"
										style:height="{cell}px"
										style:background={day.level === 0
											? undefined
											: `var(--gcd-stage-${day.level})`}
										role="img"
										aria-label={title(day)}
										onmouseenter={() => (hovered = day)}
										onmouseleave={() => (hovered = null)}
									></span>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="foot">
			<span class="read">
				{#if hovered && !hovered.filler}
					<strong>{hovered.value === undefined ? "—" : render(hovered.value) + unit}</strong>
					{shortDate(hovered.date)}
				{:else}
					{grid.days} days · {label}
				{/if}
			</span>
			<!-- Ordinal scale, so the legend is the ramp rather than named categories. -->
			<span class="scale">
				<span class="muted">less</span>
				<span class="cell" style:background="var(--gcd-grid)"></span>
				{#each [1, 2, 3, 4] as step (step)}
					<span class="cell" style:background="var(--gcd-stage-{step})"></span>
				{/each}
				<span class="muted">more</span>
			</span>
		</div>
	{:else}
		<p class="muted">Nothing to show for this range.</p>
	{/if}
</div>

<style>
	.heat {
		width: 100%;
		min-width: 0;
	}
	.grid {
		overflow-x: auto;
		overscroll-behavior-x: contain;
	}
	.months {
		position: relative;
		/* Clears the weekday gutter (.days is 22px, .body adds a 4px gap), which
		   is the same 26px the cell size is solved against. A margin rather than
		   padding: the labels inside are absolutely positioned, and padding does
		   not move their containing block. */
		margin-left: 26px;
		height: 14px;
		color: var(--gcd-muted);
		font-size: 10px;
	}
	.month {
		position: absolute;
		top: 0;
	}
	.body {
		display: flex;
		gap: 4px;
	}
	.days {
		display: flex;
		flex-direction: column;
		width: 22px;
		color: var(--gcd-muted);
		font-size: 9px;
		text-align: right;
		padding-right: 4px;
	}
	.weeks {
		display: flex;
		gap: 2px;
		min-width: 0;
	}
	.week {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.cell {
		display: inline-block;
		border-radius: 2px;
	}
	.hole {
		background: transparent;
	}
	.empty {
		/* A day with no data is a hairline outline, not a filled swatch: absence
		   should not carry the same ink as a low value. */
		box-shadow: inset 0 0 0 1px var(--gcd-grid);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 8px;
		font-size: var(--font-ui-smaller, 12px);
		color: var(--gcd-muted);
	}
	.read strong {
		color: var(--gcd-text);
		font-variant-numeric: tabular-nums;
	}
	.scale {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.scale .cell {
		width: 10px;
		height: 10px;
	}
	.muted {
		color: var(--gcd-muted);
	}
</style>
