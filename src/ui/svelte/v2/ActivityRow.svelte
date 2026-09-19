<script lang="ts">
	import { rowMetrics, sportOf, typeLabel } from "../../../dashboard/activity";
	import { shortDate, type WorkoutEntry } from "../../../dashboard/series";

	interface Props {
		entry: WorkoutEntry;
		/** Omit and the row is inert — no chevron, no button. */
		onOpen?: (entry: WorkoutEntry) => void;
	}

	let { entry, onOpen }: Props = $props();

	let sport = $derived(sportOf(entry.type));
	let metrics = $derived(rowMetrics(entry));
	let time = $derived(entry.start?.includes("T") ? entry.start.slice(11, 16) : "");
	let when = $derived(
		[shortDate(entry.date), time, typeLabel(entry.type)].filter(Boolean).join(" · "),
	);
	let title = $derived(entry.name ?? typeLabel(entry.type));
</script>

{#snippet body()}
	<!-- The sport reads off a stripe rather than a badge here: a list of rows
	     wants a colour it can scan down, not twenty pills. -->
	<span class="stripe" style:background="var(--v2-sport-{sport})"></span>

	<span class="heading">
		<span class="name">{title}</span>
		<span class="when">{when}</span>
	</span>

	{#each metrics as metric (metric.label)}
		<span class="metric">
			<span class="value">{metric.value}</span>
			<span class="label">{metric.label}</span>
		</span>
	{/each}

	{#if onOpen}<span class="chevron" aria-hidden="true">›</span>{/if}
{/snippet}

{#if onOpen}
	<button class="row" type="button" onclick={() => onOpen(entry)} aria-label="Open {title}">
		{@render body()}
	</button>
{:else}
	<div class="row">{@render body()}</div>
{/if}

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		/* Obsidian gives every <button> `height: var(--input-height)` — 30px on
		   desktop, 44px on mobile. A row is taller than that even on one line,
		   and taller again once the metrics wrap, so without this the box stays
		   at Obsidian's height and the content paints over the rows below. */
		height: auto;
		padding: 12px 14px;
		border: none;
		border-radius: 8px;
		background: var(--v2-surface-card);
		box-shadow: var(--v2-shadow-1);
		text-align: left;
		/* Narrow panes wrap the metrics under the heading rather than clipping
		   them or forcing the pane to scroll sideways. */
		flex-wrap: wrap;
	}
	button.row {
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	button.row:hover {
		background: var(--gcd-raised);
	}
	.stripe {
		width: 3px;
		height: 30px;
		border-radius: 999px;
		flex: none;
	}
	.heading {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1 1 180px;
		min-width: 0;
	}
	.name {
		font-size: 13px;
		font-weight: 600;
		color: var(--gcd-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		font-size: 12px;
		color: var(--v2-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.metric {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 78px;
		flex: none;
	}
	.metric .value {
		font-size: 13px;
		font-weight: 600;
		color: var(--gcd-text);
		font-variant-numeric: tabular-nums;
	}
	.metric .label {
		font-size: 9px;
		color: var(--v2-muted);
		white-space: nowrap;
	}
	.chevron {
		font-size: 16px;
		line-height: 1;
		color: var(--v2-muted);
		flex: none;
	}
</style>
