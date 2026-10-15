<script lang="ts">
	import { rangeOfSlider, sliderOf, type RangeScale } from "../../../../dashboard/all-activities";

	/**
	 * Distance's and Time's slider (filters/16): two thumbs on one track, from
	 * 0 to the scale's end, which means no bound ("150+", "24h+"). Two range
	 * inputs stacked on a drawn track, so each thumb is a native control; a
	 * thumb stops at the other. Obsidian's swipes ignore it, and the page
	 * doesn't scroll under a drag.
	 */
	interface Props {
		scale: RangeScale;
		/** Metres or seconds; undefined is no bound. */
		min: number | undefined;
		max: number | undefined;
		onChange: (min: number | undefined, max: number | undefined) => void;
		/** The Minimum and Maximum captions that name the two thumbs. */
		labels: readonly [string, string];
	}

	let { scale, min, max, onChange, labels }: Props = $props();

	let ends = $derived(sliderOf(scale, min, max));
	let percent = (at: number) => `${(at / scale.end) * 100}%`;

	function move(end: 0 | 1, e: Event & { currentTarget: HTMLInputElement }) {
		let at = Number(e.currentTarget.value);
		const [lo, hi] = ends;
		if (end === 0 && at > hi) at = hi;
		if (end === 1 && at < lo) at = lo;
		e.currentTarget.value = String(at);
		const next = rangeOfSlider(scale, end === 0 ? at : lo, end === 1 ? at : hi);
		onChange(next.min, next.max);
	}
</script>

<div class="slider" data-ignore-swipe="true">
	<div class="track">
		<div class="fill" style:left={percent(ends[0])} style:right="calc(100% - {percent(ends[1])})"></div>
	</div>
	<!-- The low thumb above the high one once it reaches the end, or it couldn't come back. -->
	<input type="range" class:top={ends[0] >= scale.end} min="0" max={scale.end} step={scale.step} value={ends[0]} aria-labelledby={labels[0]} oninput={(e) => move(0, e)} />
	<input type="range" min="0" max={scale.end} step={scale.step} value={ends[1]} aria-labelledby={labels[1]} oninput={(e) => move(1, e)} />
</div>

<style>
	/* The phone's: a 4-thick track across the section, thumbs 28 across, centred 14 in from each end. */
	.slider {
		position: relative;
		height: 40px;
		margin: 0 16px;
		touch-action: none;
	}
	.track {
		position: absolute;
		left: 14px;
		right: 14px;
		top: 18px;
		height: 4px;
		border-radius: 2px;
		background: var(--background-modifier-border);
	}
	.fill {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 2px;
		background: var(--interactive-accent);
	}
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		background: none;
		pointer-events: none;
		touch-action: none;
		-webkit-appearance: none;
		appearance: none;
	}
	input.top {
		z-index: 1;
	}
	input:focus {
		outline: none;
	}
	input::-webkit-slider-runnable-track {
		height: 100%;
		background: none;
		border: none;
	}
	input::-moz-range-track {
		background: none;
		border: none;
	}
	input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 28px;
		height: 28px;
		margin-top: 6px;
		border: 0.5px solid var(--background-modifier-border-hover);
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 3px 8px rgba(0, 0, 0, 0.15);
		pointer-events: auto;
		cursor: grab;
	}
	input::-moz-range-thumb {
		width: 28px;
		height: 28px;
		border: 0.5px solid var(--background-modifier-border-hover);
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 3px 8px rgba(0, 0, 0, 0.15);
		pointer-events: auto;
		cursor: grab;
	}
	input:focus-visible::-webkit-slider-thumb {
		box-shadow: 0 0 0 3px var(--background-modifier-border-focus);
	}
</style>
