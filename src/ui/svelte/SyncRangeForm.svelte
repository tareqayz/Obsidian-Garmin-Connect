<script lang="ts">
	import { onMount } from "svelte";
	import { checkRange, EARLIEST, historyNote, outcomeMeta, outcomeTitle, type RangeQuote } from "../date-range";
	import { lucide } from "./home/lucide";

	/**
	 * Plugin-only: Sync a date range… (Figma: Obsidian/Sync Range). The two
	 * dates, then one card that says what the button does, sync now or
	 * download in the background, with the size and time, or why it can't.
	 */
	interface Props {
		initialFrom: string;
		initialTo: string;
		/** The latest day a range can reach. */
		today: string;
		/** Reads the vault once: where the history starts, and what a range takes. */
		quote: () => Promise<RangeQuote>;
		dayText: (date: string) => string;
		onSync: (from: string, to: string) => void;
		onQueue: (from: string, to: string) => void;
		onCancel: () => void;
	}

	let { initialFrom, initialTo, today, quote, dayText, onSync, onQueue, onCancel }: Props = $props();

	// svelte-ignore state_referenced_locally
	let from = $state(initialFrom);
	// svelte-ignore state_referenced_locally
	let to = $state(initialTo);
	/** Null for the moment the vault takes to read. */
	let priced = $state<RangeQuote | null>(null);

	onMount(() => {
		void quote().then((q) => (priced = q));
	});

	let check = $derived(checkRange(from, to, today, priced?.start, dayText));
	let estimate = $derived(check.ok && priced ? priced.price(check.from, check.to) : null);

	// A field left before the history, or past today, comes to the day it syncs from.
	// Only once it loses focus: a year typed digit by digit passes through years long gone.
	function settle() {
		if (!check.ok) return;
		from = check.from;
		to = check.to;
	}

	function go() {
		if (!check.ok || !estimate) return;
		(estimate.background ? onQueue : onSync)(check.from, check.to);
	}
</script>

<div class="gch-range">
	<div class="fields">
		<label class="field">
			<span>From</span>
			<input type="date" class:bad={!check.ok && check.field === "from"} min={priced?.start ?? EARLIEST} max={today} bind:value={from} onblur={settle} />
		</label>
		<label class="field">
			<span>To</span>
			<input type="date" class:bad={!check.ok && check.field === "to"} min={priced?.start ?? EARLIEST} max={today} bind:value={to} onblur={settle} />
		</label>
	</div>

	{#if !check.ok && check.message}
		<div class="outcome" role="alert">
			<div class="outcome-main outcome-error">
				<span class="outcome-icon" use:lucide={"circle-alert"}></span>
				<span>{check.message}</span>
			</div>
		</div>
	{:else if check.ok && estimate}
		<div class="outcome" role="status">
			<div class="outcome-main">
				<span class="outcome-icon" use:lucide={estimate.background ? "download" : "refresh-cw"}></span>
				<span class="outcome-text">
					<span class="outcome-title">{outcomeTitle(estimate)}</span>
					<span class="outcome-meta">{outcomeMeta(estimate)}</span>
				</span>
			</div>
			{#if check.atStart && priced?.start}
				<div class="outcome-note">
					<span class="outcome-icon" use:lucide={"history"}></span>
					<span>{historyNote(priced.start, dayText)}</span>
				</div>
			{/if}
		</div>
	{/if}

	<div class="footer">
		<button onclick={onCancel}>Cancel</button>
		<button class="mod-cta" disabled={!estimate} onclick={go}>{estimate?.background ? "Start download" : "Sync"}</button>
	</div>
</div>

<style>
	.gch-range {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.fields {
		display: flex;
		gap: 12px;
	}
	.field {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--font-ui-small);
	}
	input {
		width: 100%;
	}
	input.bad {
		border-color: var(--text-error);
	}
	.outcome {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 14px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.outcome-main {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	/* Level with the first line beside it. */
	.outcome-icon {
		--icon-size: 16px;
		flex: none;
		display: flex;
		align-items: center;
		height: 20px;
	}
	.outcome-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.outcome-title {
		font-size: var(--font-ui-medium);
		font-weight: var(--font-semibold);
		line-height: 20px;
	}
	.outcome-meta {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		line-height: 16px;
	}
	.outcome-error {
		color: var(--text-error);
		font-size: var(--font-ui-small);
		line-height: 20px;
	}
	.outcome-note {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		line-height: 16px;
	}
	.outcome-note .outcome-icon {
		height: 16px;
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	/* A phone's sheet: the button first, full width, Cancel under it. */
	@container (max-width: 480px) {
		.footer {
			flex-direction: column-reverse;
			align-items: stretch;
		}
	}
</style>
