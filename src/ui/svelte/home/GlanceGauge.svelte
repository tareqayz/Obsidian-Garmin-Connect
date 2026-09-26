<script lang="ts">
	import type { Gauge, Trend } from "../../../dashboard/glance";
	import Arc from "./Arc.svelte";
	import { lucide } from "./lucide";
	import { toneColor } from "./tones";

	/**
	 * The banded dial Garmin draws for VO₂ Max, FTP, Endurance, Hill Score,
	 * Running Economy and Training Readiness: coloured bands, a marker in its
	 * band's colour, the band's name underneath.
	 */
	interface Props {
		gauge: Gauge;
		/** Endurance draws its number a size up. */
		big?: boolean;
		/** A muted line under the band name, like readiness's feedback. */
		caption?: string;
		/** The arrow and "Trending" at the foot of the card. */
		trend?: Trend;
	}

	let { gauge, big = false, caption, trend }: Props = $props();

	const ARROW: Record<Trend, string> = { up: "arrow-up", down: "arrow-down", flat: "arrow-right" };

	let segments = $derived(gauge.segments.map((s) => ({ from: s.from, to: s.to, color: toneColor(s.tone)! })));
</script>

<div class="dial" class:big>
	<Arc
		size={104}
		min={0}
		max={1}
		gap={2}
		{segments}
		marker={gauge.at}
		markerColor={toneColor(gauge.tone)}
		markerRadius={5}
		label={gauge.value}
	/>
</div>
{#if gauge.label}<div class="band">{gauge.label}</div>{/if}
{#if caption}<div class="caption">{caption}</div>{/if}
{#if trend}
	<div class="trend">
		<span class="arrow" use:lucide={ARROW[trend]}></span>
		<span>Trending</span>
	</div>
{/if}

<style>
	.dial {
		display: flex;
		justify-content: center;
		padding-top: 12px;
	}
	.big {
		--arc-label-size: 27px;
		--arc-label-line: 32px;
	}
	.band {
		text-align: center;
		font-size: 15px;
		line-height: 20px;
		margin-top: 8px;
	}
	.caption {
		text-align: center;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
		margin-top: 6px;
	}
	.trend {
		margin-top: auto;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
	}
	.arrow {
		display: flex;
		color: var(--text-normal);
		margin: 0 0 8px 2px;
	}
	.arrow :global(svg) {
		width: 20px;
		height: 20px;
	}
</style>
