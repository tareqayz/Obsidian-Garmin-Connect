<script lang="ts">
	import { EVENT_TYPES, eventLabel } from "../../../../dashboard/all-activities";

	/**
	 * Event Type (filters/17): Any, then Garmin's event types by label, as
	 * pills. Any is on while none is; several may be on (Inferred). A type the
	 * route holds that Garmin added later shows at the end, so it can be
	 * turned off.
	 */
	interface Props {
		events: readonly string[] | undefined;
		/** null is Any. */
		onToggle: (key: string | null) => void;
	}

	let { events, onToggle }: Props = $props();

	let pills = $derived([...EVENT_TYPES, ...(events ?? []).filter((key) => !EVENT_TYPES.some((e) => e.key === key)).map((key) => ({ key, label: eventLabel(key) }))]);
</script>

<div class="events">
	<button class="pill" class:on={!events?.length} aria-pressed={!events?.length} onclick={() => onToggle(null)}>Any</button>
	{#each pills as pill (pill.key)}
		{@const on = events?.includes(pill.key) === true}
		<button class="pill" class:on aria-pressed={on} onclick={() => onToggle(pill.key)}>{pill.label}</button>
	{/each}
</div>

<style>
	.events {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0 16px;
	}
	/* 36 tall, 12 a side; off an outline, on filled. */
	.pill {
		box-sizing: border-box;
		height: 36px;
		margin: 0;
		padding: 0 12px;
		border: 1px solid var(--background-modifier-border-hover);
		border-radius: 18px;
		box-shadow: none;
		background: none;
		color: var(--text-normal);
		font: inherit;
		font-size: 15px;
		line-height: 20px;
		cursor: pointer;
	}
	.pill.on {
		border-color: var(--background-modifier-border-hover);
		background: var(--background-modifier-border-hover);
	}
</style>
