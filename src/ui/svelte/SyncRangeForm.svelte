<script lang="ts">
	import { dateRange } from "../../sync/engine";

	interface Props {
		initialFrom: string;
		initialTo: string;
		/** Roughly how many requests one day costs, for the estimate. */
		perDay: number;
		/** Today, as the latest date worth asking for. */
		today: string;
		/** Pause between days, in ms — the other half of the time estimate. */
		pauseMs: number;
		/** Days of nothing before the sync gives up, or 0 if that guard is off. */
		stopAfterEmptyDays: number;
		onRun: (from: string, to: string) => void;
		onCancel: () => void;
	}

	let {
		initialFrom,
		initialTo,
		perDay,
		today,
		pauseMs,
		stopAfterEmptyDays,
		onRun,
		onCancel,
	}: Props = $props();

	// Garmin Connect did not exist before this, so an earlier date is a typo.
	const EARLIEST = "2010-01-01";

	// svelte-ignore state_referenced_locally
	let from = $state(initialFrom);
	// svelte-ignore state_referenced_locally
	let to = $state(initialTo);

	let days = $derived(dateRange(from, to).length);
	let valid = $derived(days > 0);
	let requests = $derived(days * perDay);
	// Request latency dominates; the pause is the part we control.
	let minutes = $derived(Math.round((days * (pauseMs + perDay * 400)) / 60000));
	let large = $derived(days > 90);
</script>

<h2>Sync a date range</h2>

<div class="fields">
	<div class="field">
		<label for="gc-from">From</label>
		<input id="gc-from" type="date" min={EARLIEST} max={today} bind:value={from} />
	</div>
	<div class="field">
		<label for="gc-to">To</label>
		<input id="gc-to" type="date" min={EARLIEST} max={today} bind:value={to} />
	</div>
</div>

<!-- The estimate is the point: a year-long backfill is thousands of requests
     and Garmin rate-limits per IP. -->
<div class="status" role="status">
	{#if valid}
		{days} day{days === 1 ? "" : "s"} · roughly {requests.toLocaleString()} requests
		{#if minutes >= 1}· about {minutes} min{/if}
	{:else}
		That range is empty — the end date is before the start.
	{/if}
</div>

{#if valid && large}
	<div class="caution">
		Long backfills get rate limited. The sync runs newest first, so if it stops early you
		still have the recent days.
		{#if stopAfterEmptyDays > 0}
			It also gives up once it hits {stopAfterEmptyDays} days running with nothing in them,
			so reaching back past the start of your Garmin history costs little.
		{:else}
			“Stop after empty days” is off, so it will ask for every day in this range even if
			your Garmin history does not go back that far.
		{/if}
	</div>
{/if}

<div class="actions">
	<button class="mod-cta" disabled={!valid} onclick={() => onRun(from, to)}>Sync</button>
	<button onclick={onCancel}>Cancel</button>
</div>

<style>
	h2 {
		margin-top: 0;
	}
	.fields {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.field {
		flex: 1 1 140px;
	}
	label {
		display: block;
		margin-bottom: 4px;
		font-size: var(--font-ui-small, 13px);
	}
	input {
		width: 100%;
	}
	.caution {
		border-left: 3px solid var(--text-warning);
		background: var(--background-secondary);
		padding: 0.6em 0.8em;
		margin-bottom: 10px;
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.45;
	}
	.status {
		color: var(--text-muted);
		font-size: var(--font-ui-small, 13px);
		margin: 10px 0;
		min-height: 1.4em;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
</style>
