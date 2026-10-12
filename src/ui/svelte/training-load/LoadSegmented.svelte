<script lang="ts">
	import type { TrainingSegment } from "../../../dashboard/training-load-copy";

	/**
	 * Training Load's Acute Load | Load Ratio control (twin Segmented 602:24,
	 * drawn as Activity Details' 403:52): 370 × 32, the border-grey track
	 * with radius 8, the page-coloured thumb 180 × 28 inset 2 with radius 6,
	 * the labels 13/16 centred in each half, the selected one --text-normal.
	 */
	interface Props {
		segments: ReadonlyArray<{ id: TrainingSegment; label: string; on: boolean }>;
		onchange: (segment: TrainingSegment) => void;
	}

	let { segments, onchange }: Props = $props();

	let right = $derived(segments[1]?.on ?? false);
</script>

<div class="load-segmented">
	<span class="thumb" class:right></span>
	{#each segments as segment (segment.id)}
		<button class:on={segment.on} aria-pressed={segment.on} onclick={() => onchange(segment.id)}>{segment.label}</button>
	{/each}
</div>

<style>
	.load-segmented {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		width: 370px;
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
