<script lang="ts">
	import type { GlanceId, GlanceStat } from "../../../dashboard/glance";
	import { lucide } from "./lucide";
	import { toneColor } from "./tones";

	/** Garmin's Add a Stat sheet: every stat not on the page yet, in the app's order. */
	interface Props {
		stats: readonly GlanceStat[];
		onPick: (id: GlanceId) => void;
	}

	let { stats, onPick }: Props = $props();
</script>

<div class="list">
	{#each stats as s (s.id)}
		<button class="row" onclick={() => onPick(s.id)}>
			<span class="icon" style:color={toneColor(s.tone)} use:lucide={s.icon}></span>
			<span class="name">{s.title}</span>
		</button>
	{:else}
		<p class="none">Every stat is already on the page.</p>
	{/each}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		margin: 0 calc(-1 * var(--size-4-2, 8px));
	}
	.row {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 48px;
		padding: 0 var(--size-4-2, 8px);
		background: none;
		box-shadow: none;
		border: none;
		border-radius: var(--radius-s, 4px);
		color: var(--text-normal);
		font-size: 15px;
		text-align: left;
		cursor: pointer;
	}
	.row:hover,
	.row:focus-visible {
		background: var(--background-modifier-hover);
	}
	.icon {
		display: inline-flex;
		flex: none;
		color: var(--text-normal);
	}
	.icon :global(svg) {
		width: 20px;
		height: 20px;
	}
	.name {
		flex: 1;
		min-width: 0;
	}
	.none {
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
