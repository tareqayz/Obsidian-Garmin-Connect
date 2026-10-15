<script lang="ts">
	import { lucide } from "../../home/lucide";
	import MonthCalendar from "./MonthCalendar.svelte";

	/**
	 * Date Range (filters/14): Start and End, each a field showing its day or,
	 * empty, today's in grey; the focused one is outlined, and the calendar
	 * below picks its day. Picking a Start moves on to End; a pair picked
	 * backwards is put in order; × empties a field, which leaves that end open
	 * (all three Inferred).
	 */
	interface Props {
		from: string | undefined;
		to: string | undefined;
		today: string;
		years: readonly number[];
		onChange: (from: string | undefined, to: string | undefined) => void;
	}

	let { from, to, today, years, onChange }: Props = $props();

	type End = "from" | "to";
	const ENDS: ReadonlyArray<{ end: End; label: string }> = [
		{ end: "from", label: "Start" },
		{ end: "to", label: "End" },
	];

	let focus = $state<End>("from");
	let value = (end: End) => (end === "from" ? from : to);
	// svelte-ignore state_referenced_locally
	let month = $state((from ?? today).slice(0, 7));

	function choose(end: End) {
		focus = end;
		month = (value(end) ?? today).slice(0, 7);
	}

	function pick(date: string) {
		let next: [string | undefined, string | undefined] = focus === "from" ? [date, to] : [from, date];
		if (next[0] !== undefined && next[1] !== undefined && next[0] > next[1]) next = [next[1], next[0]];
		onChange(...next);
		if (focus === "from") focus = "to";
	}

	function clear(end: End) {
		onChange(end === "from" ? undefined : from, end === "to" ? undefined : to);
		focus = end;
	}
</script>

<div class="ends">
	{#each ENDS as { end, label } (end)}
		{@const day = value(end)}
		<div class="end">
			<span class="caption" id="gch-date-{end}-caption">{label}</span>
			<div class="field" class:focused={focus === end}>
				<!-- Named by its caption and its day: "Start 2026-10-01". -->
				<button class="day" id="gch-date-{end}" class:empty={day === undefined} aria-labelledby="gch-date-{end}-caption gch-date-{end}" aria-pressed={focus === end} onclick={() => choose(end)}>{day ?? today}</button>
				{#if day !== undefined}
					<button class="clear" aria-label="Clear {label}" onclick={() => clear(end)}><span use:lucide={"x"}></span></button>
				{/if}
			</div>
		</div>
	{/each}
</div>

<MonthCalendar {month} {today} selected={value(focus) ?? today} {years} onMonth={(next) => (month = next)} onPick={pick} />

<style>
	button {
		margin: 0;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	/* Two 181 × 46 fields, 8 apart, captioned Start and End. */
	.ends {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		padding: 0 16px 20px;
	}
	.end {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.caption {
		font-size: 15px;
		line-height: 20px;
	}
	/* Obsidian's input, as the Minimum and Maximum fields are: its field colour and border (none on a phone). */
	.field {
		position: relative;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		height: 46px;
		border: var(--input-border-width) solid var(--background-modifier-border);
		border-radius: 8px;
		background: var(--background-modifier-form-field);
	}
	/* The field the calendar picks for: Obsidian's focused input. */
	.field.focused {
		border-color: var(--background-modifier-border-focus);
		box-shadow: 0 0 0 var(--input-border-width-focus, 2px) var(--background-modifier-border-focus);
	}
	.day {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex: 1;
		height: 100%;
		min-width: 0;
		padding: 0 8px;
		border-radius: 8px;
		font-size: 17px;
		line-height: 22px;
		text-align: left;
		font-variant-numeric: tabular-nums;
		color: var(--text-normal);
	}
	.day.empty {
		color: var(--text-faint);
	}
	.clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 32px;
		height: 100%;
		padding: 0;
		color: var(--text-muted);
	}
	.clear :global(svg) {
		width: 16px;
		height: 16px;
	}
</style>
