<script lang="ts">
	import { compact, duration, shortDate, type WorkoutEntry } from "../../dashboard/series";

	interface Props {
		workouts: readonly WorkoutEntry[];
		/** Cut the list here and say how many more there were. */
		limit?: number;
	}

	let { workouts, limit = 12 }: Props = $props();

	let shown = $derived(workouts.slice(0, limit));
	let hidden = $derived(Math.max(0, workouts.length - shown.length));

	/** `running` → `Running`, `lap_swimming` → `Lap swimming`. */
	function typeLabel(key: string | undefined): string {
		if (!key) return "Activity";
		const words = key.replace(/_/g, " ");
		return words.charAt(0).toUpperCase() + words.slice(1);
	}

	function time(entry: WorkoutEntry): string {
		return entry.start?.includes("T") ? entry.start.slice(11, 16) : "";
	}
</script>

<!-- Activities were being synced into every note and shown nowhere. This is the
     list, newest first, with the four numbers that identify a session. -->
{#if shown.length > 0}
	<ul class="workouts">
		{#each shown as entry, i (entry.start ?? `${entry.date}-${i}`)}
			<li>
				<div class="head">
					<span class="name">{entry.name ?? typeLabel(entry.type)}</span>
					<span class="when">{shortDate(entry.date)}{time(entry) ? ` · ${time(entry)}` : ""}</span>
				</div>
				<div class="facts">
					<span class="type">{typeLabel(entry.type)}</span>
					{#if entry.distance}
						<span class="fact"
							><strong>{entry.distance.value}</strong> {entry.distance.unit}</span
						>
					{/if}
					{#if entry.minutes !== undefined}
						<span class="fact"><strong>{duration(entry.minutes * 60)}</strong></span>
					{/if}
					{#if entry.pace}
						<span class="fact"
							><strong>{entry.pace}</strong> /{entry.distance?.unit ?? "km"}</span
						>
					{/if}
					{#if entry.avg_hr !== undefined}
						<span class="fact"><strong>{entry.avg_hr}</strong> bpm</span>
					{/if}
					{#if entry.calories !== undefined}
						<span class="fact"><strong>{compact(entry.calories)}</strong> kcal</span>
					{/if}
					{#if entry.training_effect !== undefined}
						<span class="fact"><strong>{entry.training_effect}</strong> TE</span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
	{#if hidden > 0}
		<p class="more">{hidden} more in this range.</p>
	{/if}
{:else}
	<p class="more">No activities in this range.</p>
{/if}

<style>
	.workouts {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		padding: 8px 0;
		border-bottom: 1px solid var(--gcd-border);
	}
	li:last-child {
		border-bottom: none;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.name {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		margin-left: auto;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		white-space: nowrap;
		flex: none;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		margin-top: 2px;
		font-size: var(--font-ui-smaller, 12px);
		color: var(--gcd-muted);
	}
	.type {
		/* The one qualitative field, so it reads as a tag rather than a number. */
		background: var(--gcd-raised);
		border-radius: 3px;
		padding: 0 6px;
	}
	.fact strong {
		color: var(--gcd-text);
		font-variant-numeric: tabular-nums;
	}
	.more {
		margin: 8px 0 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
</style>
