<script lang="ts">
	import { CalendarDate, parseDate, type DateValue } from "@internationalized/date";
	import { RangeCalendar, type DateRange } from "bits-ui";

	interface Props {
		/** ISO "YYYY-MM-DD", the shape the rest of the plugin passes around. */
		from: string;
		to: string;
		min: string;
		max: string;
		/** One month reads better on a phone; two make a backfill easier to judge. */
		months?: number;
		onChange: (from: string, to: string) => void;
	}

	let { from, to, min, max, months = 1, onChange }: Props = $props();

	/** A bad string in settings should not blank the calendar. */
	function toDate(iso: string, fallback: CalendarDate): DateValue {
		try {
			return parseDate(iso);
		} catch {
			return fallback;
		}
	}

	const EPOCH = new CalendarDate(2010, 1, 1);

	let value = $derived<DateRange>({
		start: from ? toDate(from, EPOCH) : undefined,
		end: to ? toDate(to, EPOCH) : undefined,
	});
</script>

<!--
	Replaces the two <input type="date"> fields in SyncRangeForm. Those are a
	different control on every platform — a native picker on iOS, a Chromium
	one on the desktop, nothing usable on Android WebView — and neither can
	show the *range* as one shape, which is the whole question when you are
	judging how large a backfill is about to be.
-->
<RangeCalendar.Root
	{value}
	onValueChange={(next) => {
		const start = next.start?.toString() ?? "";
		const end = next.end?.toString() ?? "";
		// Fires on the first click too, when only one end is set. Passing it
		// straight through lets the caller show the half-made range live.
		onChange(start, end);
	}}
	minValue={toDate(min, EPOCH)}
	maxValue={toDate(max, EPOCH)}
	numberOfMonths={months}
	weekdayFormat="short"
	fixedWeeks
	class="gcd-cal"
>
	{#snippet children({ months: grid, weekdays })}
		<div class="head">
			<RangeCalendar.PrevButton class="gcd-cal-nav" aria-label="Previous month">‹</RangeCalendar.PrevButton>
			<RangeCalendar.Heading class="gcd-cal-heading" />
			<RangeCalendar.NextButton class="gcd-cal-nav" aria-label="Next month">›</RangeCalendar.NextButton>
		</div>
		<div class="months">
			{#each grid as month (month.value.toString())}
				<RangeCalendar.Grid class="gcd-cal-grid">
					<RangeCalendar.GridHead>
						<RangeCalendar.GridRow class="gcd-cal-row">
							{#each weekdays as weekday (weekday)}
								<RangeCalendar.HeadCell class="gcd-cal-headcell">
									{weekday.slice(0, 2)}
								</RangeCalendar.HeadCell>
							{/each}
						</RangeCalendar.GridRow>
					</RangeCalendar.GridHead>
					<RangeCalendar.GridBody>
						{#each month.weeks as week, i (i)}
							<RangeCalendar.GridRow class="gcd-cal-row">
								{#each week as date (date.toString())}
									<RangeCalendar.Cell {date} month={month.value} class="gcd-cal-cell">
										<RangeCalendar.Day class="gcd-cal-day" />
									</RangeCalendar.Cell>
								{/each}
							</RangeCalendar.GridRow>
						{/each}
					</RangeCalendar.GridBody>
				</RangeCalendar.Grid>
			{/each}
		</div>
	{/snippet}
</RangeCalendar.Root>

<style>
	:global(.gcd-cal) {
		display: inline-block;
		padding: 4px;
		user-select: none;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	:global(.gcd-cal-heading) {
		flex: 1;
		text-align: center;
		font-size: var(--font-ui-small, 13px);
		font-weight: 600;
	}
	:global(.gcd-cal-nav) {
		width: 24px;
		height: 24px;
		padding: 0;
		border-radius: 4px;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-cal-nav:hover) {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	.months {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
	}
	:global(.gcd-cal-grid) {
		border-collapse: collapse;
	}
	:global(.gcd-cal-headcell) {
		width: 30px;
		padding-bottom: 4px;
		color: var(--gcd-muted);
		font-size: 11px;
		font-weight: 400;
	}
	:global(.gcd-cal-cell) {
		padding: 0;
	}
	:global(.gcd-cal-day) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 28px;
		border: none;
		background: transparent;
		color: var(--gcd-text);
		font-size: var(--font-ui-smaller, 12px);
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	:global(.gcd-cal-day:hover:not([data-disabled])) {
		background: var(--gcd-raised);
	}
	:global(.gcd-cal-day[data-outside-month]) {
		opacity: 0.3;
	}
	:global(.gcd-cal-day[data-disabled]) {
		opacity: 0.25;
		cursor: default;
	}
	/* The selected span reads as one block, with the ends rounded off. */
	:global(.gcd-cal-day[data-selected]) {
		background: color-mix(in srgb, var(--gcd-series) 22%, transparent);
		color: var(--gcd-text);
	}
	:global(.gcd-cal-day[data-selection-start]),
	:global(.gcd-cal-day[data-selection-end]) {
		background: var(--gcd-series);
		color: #ffffff;
		font-weight: 600;
	}
	:global(.gcd-cal-day[data-selection-start]) {
		border-radius: 4px 0 0 4px;
	}
	:global(.gcd-cal-day[data-selection-end]) {
		border-radius: 0 4px 4px 0;
	}
	:global(.gcd-cal-day[data-today]:not([data-selected])) {
		box-shadow: inset 0 0 0 1px var(--gcd-series);
		border-radius: 4px;
	}
	:global(.gcd-cal-day:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: -2px;
	}
</style>
