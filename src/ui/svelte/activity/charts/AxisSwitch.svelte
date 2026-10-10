<script lang="ts">
	import type { ActivityAxis } from "../../../../dashboard/routes";

	/** Charts' Time | Distance control: the twin's Segmented (403:52), 32 pt tall, a sliding thumb. */
	interface Props {
		value: ActivityAxis;
		onChange: (axis: ActivityAxis) => void;
	}

	let { value, onChange }: Props = $props();

	const OPTIONS: ReadonlyArray<[ActivityAxis, string]> = [
		["time", "Time"],
		["distance", "Distance"],
	];
</script>

<div class="axis-switch">
	<span class="thumb" class:right={value === "distance"}></span>
	{#each OPTIONS as [axis, label] (axis)}
		<button class:on={value === axis} aria-pressed={value === axis} onclick={() => onChange(axis)}>{label}</button>
	{/each}
</div>

<style>
	.axis-switch {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		width: 369.67px;
		max-width: 100%;
		height: 32px;
		border-radius: 8px;
		background: var(--background-modifier-border);
	}
	.thumb {
		position: absolute;
		top: 2px;
		bottom: 2px;
		left: 2px;
		width: calc(50% - 5px);
		border-radius: 6px;
		background: var(--background-primary);
		transition: transform 150ms ease;
	}
	.thumb.right {
		transform: translateX(calc(100% + 6px));
	}
	button {
		position: relative;
		margin: 0;
		height: auto;
		padding: 0;
		border: none;
		box-shadow: none;
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-size: 13px;
		line-height: 16px;
		cursor: pointer;
	}
	button.on {
		color: var(--text-normal);
	}
</style>
