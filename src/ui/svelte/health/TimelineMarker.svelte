<script lang="ts">
	import type { SportGlyph } from "../../../dashboard/activities";
	import { DISC } from "../../../dashboard/hrv-status-charts";
	import { sportPathData } from "../../sport-icons";

	/**
	 * A disc on a 1d timeline's dot row, centred on `x, y`: the Sleep Marker
	 * (Figma 507:37) with "Zz" where sleep began or the alarm clock where it
	 * ended, as the HRV timeline draws them; a green disc with the sport's
	 * figure where a recorded activity began; a grey one where Move IQ saw
	 * one. `scale` shrinks it for a smaller chart.
	 */
	let { kind, x, y, glyph, scale = 1 }: { kind: "sleep" | "wake" | "activity" | "moveIq"; x: number; y: number; glyph?: SportGlyph; scale?: number } = $props();

	/** The Sleep Marker's 21.67 pt box, centred on the disc. */
	const C = 10.835;
	let figure = $derived(glyph ? sportPathData(glyph) : undefined);
</script>

<g class="gch-marker {kind}" transform="translate({x} {y}) scale({scale}) translate({-C} {-C})">
	<circle class="disc" cx={C} cy={C} r={DISC.radius} stroke-width={DISC.ring} />
	{#if kind === "sleep"}
		<path class="glyph" d="M6.99 7.64H11.02V8.68L8.44 11.94H11.02V12.98H6.99V11.94L9.57 8.68H6.99V7.64Z" />
		<path class="glyph" d="M11.37 9.65H14.98V10.69L12.72 13.26H14.98V14.3H11.37V13.26L13.63 10.69H11.37V9.65Z" />
	{:else if kind === "wake"}
		<circle class="face" cx="10.83" cy="10.76" r="4.62" />
		<path class="hands" d="M9.02 9.58L10.83 10.76L13.05 8.47" />
	{:else if figure}
		<g class="figure" transform="translate(4.835 4.835) scale(0.5)">
			{#each figure as d}<path {d} />{/each}
		</g>
	{:else}
		<!-- Lucide's activity line, for a sport without a figure of its own. -->
		<g class="figure" transform="translate(4.835 4.835) scale(0.5)"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></g>
	{/if}
</g>

<style>
	/* A disc in a page-coloured ring, its glyph in the accent's text colour. */
	.disc {
		fill: var(--color-blue);
		/* The ring is the background it sits on: the page's, or a card's (`--gch-marker-ring`). */
		stroke: var(--gch-marker-ring, var(--background-primary));
	}
	.activity .disc {
		fill: var(--color-green);
	}
	.moveIq .disc {
		fill: var(--text-faint);
	}
	.glyph {
		fill: var(--text-on-accent);
	}
	.face,
	.hands,
	.figure {
		fill: none;
		stroke: var(--text-on-accent);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.face {
		stroke-width: 1.04;
	}
	.hands {
		stroke-width: 0.85;
	}
	.figure {
		stroke-width: 2.2;
	}
</style>
