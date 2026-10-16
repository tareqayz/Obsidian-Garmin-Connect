<script lang="ts">
	import { monthGrid, monthOptions, pickMonth } from "../../../../dashboard/all-activities";
	import { lucide } from "../../home/lucide";

	/**
	 * Date Range's calendar (filters/14–15): the month's title over weeks from
	 * Sunday, with ‹ and ›. Days after today are grey and can't be picked, and
	 * › stops at this month. Today is the accent's; the focused field's day is
	 * circled, filled when it is today (as iOS draws a picked day).
	 *
	 * The title turns the grid into the month and year pickers, two native
	 * selects, which iOS shows as its wheel; months still to come are
	 * disabled, as the wheel dims them.
	 */
	interface Props {
		/** `YYYY-MM`. */
		month: string;
		today: string;
		/** The focused field's day, or today while it is empty. */
		selected: string;
		/** The years the picker offers, oldest first. */
		years: readonly number[];
		onMonth: (month: string) => void;
		onPick: (date: string) => void;
	}

	let { month, today, selected, years, onMonth, onPick }: Props = $props();

	let picker = $state(false);

	let grid = $derived(monthGrid(month, today, selected, `${years[0] ?? today.slice(0, 4)}-01`));
	let year = $derived(Number(month.slice(0, 4)));
	let monthNumber = $derived(Number(month.slice(5, 7)));
</script>

<div class="calendar">
	<div class="head">
		<button class="title" class:open={picker} aria-expanded={picker} onclick={() => (picker = !picker)}>
			<span>{grid.title}</span>
			<span class="turn" use:lucide={picker ? "chevron-down" : "chevron-right"}></span>
		</button>
		{#if !picker}
			<button class="step" aria-label="Previous month" disabled={grid.prev === null} onclick={() => grid.prev && onMonth(grid.prev)}>
				<span use:lucide={"chevron-left"}></span>
			</button>
			<button class="step" aria-label="Next month" disabled={grid.next === null} onclick={() => grid.next && onMonth(grid.next)}>
				<span use:lucide={"chevron-right"}></span>
			</button>
		{/if}
	</div>

	{#if picker}
		<div class="pickers">
			<select class="dropdown" value={monthNumber} onchange={(e) => onMonth(pickMonth(year, Number(e.currentTarget.value), today))}>
				{#each monthOptions(year, today) as option (option.value)}
					<option value={option.value} disabled={option.disabled}>{option.label}</option>
				{/each}
			</select>
			<select class="dropdown" value={year} onchange={(e) => onMonth(pickMonth(Number(e.currentTarget.value), monthNumber, today))}>
				{#each years as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>
	{:else}
		<div class="weekdays" aria-hidden="true">
			{#each grid.weekdays as weekday (weekday)}<span>{weekday}</span>{/each}
		</div>
		{#each grid.weeks as week, w (w)}
			<div class="week">
				{#each week as day, d (d)}
					{#if day}
						<button class="day" class:today={day.today} class:selected={day.selected} disabled={day.disabled} aria-pressed={day.selected} onclick={() => onPick(day.date)}>{day.day}</button>
					{:else}
						<span></span>
					{/if}
				{/each}
			</div>
		{/each}
	{/if}
</div>

<style>
	/* 370 wide, radius 16: the title row, the weekdays, rows of days 55.5 apart. */
	.calendar {
		margin: 0 16px;
		padding: 12px 0 20px;
		border-radius: 16px;
		background: var(--background-secondary);
	}
	button {
		margin: 0;
		height: auto;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.head {
		display: flex;
		align-items: center;
		height: 44px;
		padding: 0 8px 0 12px;
	}
	.title {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-right: auto;
		padding: 0;
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
		color: var(--text-normal);
	}
	.title.open {
		color: var(--text-accent);
	}
	.turn {
		display: inline-flex;
		color: var(--text-accent);
	}
	.turn :global(svg) {
		width: 16px;
		height: 16px;
		stroke-width: 3px;
	}
	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		padding: 0;
		color: var(--text-accent);
	}
	.step :global(svg) {
		width: 22px;
		height: 22px;
	}
	.step:disabled {
		color: var(--text-faint);
		cursor: default;
	}
	.weekdays,
	.week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		justify-items: center;
	}
	.weekdays {
		height: 22px;
		align-items: center;
		font-size: 13px;
		line-height: 16px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.week {
		height: 55.5px;
		align-items: center;
	}
	.day {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border-radius: 50%;
		font-size: 20px;
		line-height: 24px;
		color: var(--text-normal);
		font-variant-numeric: tabular-nums;
	}
	.day:hover:not(:disabled) {
		background: var(--background-modifier-hover);
	}
	.day:disabled {
		color: var(--text-faint);
		cursor: default;
	}
	.day.today {
		color: var(--text-accent);
	}
	.day.selected {
		background: hsla(var(--interactive-accent-hsl), 0.18);
		color: var(--text-accent);
		font-weight: 600;
	}
	.day.today.selected {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}
	.pickers {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		min-height: 300px;
	}
	.pickers select {
		height: 44px;
		font-size: 17px;
	}
</style>
