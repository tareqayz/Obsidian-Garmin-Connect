<script lang="ts">
	import { Slider } from "bits-ui";

	interface Props {
		value: number;
		min: number;
		max: number;
		step?: number;
		label: string;
		/** Rendered next to the label, e.g. "45 days". */
		display: string;
		onValueChange: (value: number) => void;
	}

	let { value, min, max, step = 1, label, display, onValueChange }: Props = $props();
</script>

<div class="wrap">
	<div class="head">
		<span class="label">{label}</span>
		<span class="value">{display}</span>
	</div>
	<Slider.Root
		type="single"
		{value}
		{min}
		{max}
		{step}
		{onValueChange}
		aria-label={label}
		class="gcd-slider"
	>
		{#snippet children()}
			<span class="track"><Slider.Range class="gcd-slider-range" /></span>
			<Slider.Thumb index={0} class="gcd-slider-thumb" />
		{/snippet}
	</Slider.Root>
</div>

<style>
	.wrap {
		padding: 4px 0 8px;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 10px;
	}
	.label {
		font-size: var(--font-ui-small, 13px);
	}
	.value {
		margin-left: auto;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		font-variant-numeric: tabular-nums;
	}
	:global(.gcd-slider) {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		height: 18px;
		touch-action: none;
		user-select: none;
	}
	.track {
		position: relative;
		display: block;
		width: 100%;
		height: 4px;
		border-radius: 999px;
		background: var(--gcd-raised);
		border: 1px solid var(--gcd-border);
	}
	:global(.gcd-slider-range) {
		position: absolute;
		height: 100%;
		border-radius: 999px;
		background: var(--gcd-series);
	}
	:global(.gcd-slider-thumb) {
		display: block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--gcd-surface);
		border: 2px solid var(--gcd-series);
		cursor: grab;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
	}
	:global(.gcd-slider-thumb[data-active]) {
		cursor: grabbing;
	}
	:global(.gcd-slider-thumb:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: 2px;
	}
</style>
