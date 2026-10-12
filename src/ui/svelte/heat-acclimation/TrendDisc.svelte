<script lang="ts">
	import type { Trend } from "../../../dashboard/glance";
	import { TREND_DISC, TREND_GLYPHS } from "../../../dashboard/heat-acclimation-charts";

	/**
	 * 1d's disc (twin Trend Disc 629:19): Ø 64 in --background-secondary with
	 * Garmin's trend as Material's trending_up, _flat or _down in --text-muted,
	 * the vectors as the twin exports them (`TREND_GLYPHS`). At 0 % Garmin
	 * sends no trend: the empty disc (None, Inferred). The trend line under
	 * the % says the same in words.
	 */
	let { glyph }: { glyph?: Trend } = $props();
</script>

<svg class="ha-disc" width={TREND_DISC} height={TREND_DISC} viewBox="0 0 {TREND_DISC} {TREND_DISC}" aria-hidden="true">
	<circle class="ha-disc-fill" cx={TREND_DISC / 2} cy={TREND_DISC / 2} r={TREND_DISC / 2} />
	{#if glyph}<path class="ha-glyph" d={TREND_GLYPHS[glyph]} />{/if}
</svg>

<style>
	.ha-disc {
		display: block;
		flex: none;
	}
	.ha-disc-fill {
		fill: var(--background-secondary);
	}
	.ha-glyph {
		fill: var(--text-muted);
	}
</style>
