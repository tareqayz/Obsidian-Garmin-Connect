<script lang="ts">
	import type { Scale } from "../../dashboard/scales";

	interface Props {
		scale: Scale;
		count: number;
		dates: readonly string[];
		onhover: (index: number) => void;
		onleave: () => void;
	}

	let { scale, count, dates, onhover, onleave }: Props = $props();
</script>

<!--
	A transparent full-height band per data position: the pointer only has to be
	closest, never dead-centre on a 2px mark. Each band is focusable so keyboard
	users get exactly the same readout as hover.
-->
<g class="hits">
	{#each { length: count } as _, i (i)}
		<rect
			class="hit"
			x={scale.band * i}
			y="0"
			width={scale.band}
			height={scale.inner.h}
			tabindex="0"
			role="button"
			aria-label={dates[i] ?? ""}
			onpointerenter={() => onhover(i)}
			onfocus={() => onhover(i)}
			onpointerleave={onleave}
			onblur={onleave}
		/>
	{/each}
</g>

<style>
	.hit {
		fill: transparent;
		cursor: crosshair;
		outline: none;
	}
	.hit:focus-visible {
		fill: var(--gcd-series);
		fill-opacity: 0.08;
	}
</style>
