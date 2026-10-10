<script lang="ts">
	import { CHART_COLOURS, type TrainingEffectChart } from "../../../../dashboard/activity-chart-pages";
	import { trainingEffectScales } from "../../../../dashboard/activity-charts";
	import { PHONE } from "../../../../dashboard/stat-charts";

	/**
	 * Training Effect's two scales (the twin's 403:78 and its knob 403:85): five
	 * bands and a red cap, and a knob in its band's colour whose halo, the
	 * page's background, cuts the scale.
	 */
	let { chart }: { chart: TrainingEffectChart } = $props();

	let measured = $state(0);
	let scales = $derived(trainingEffectScales(chart, measured || PHONE));
</script>

<div class="te-scales" bind:clientWidth={measured}>
	{#each scales as scale (scale.label)}
		<div class="te-label">{scale.label}</div>
		<div class="te-track">
			{#each scale.segments as segment, i (i)}
				<span
					class="te-band"
					class:first={i === 0}
					class:cap={i === scale.segments.length - 1}
					style:left="{segment.x}px"
					style:width="{segment.width}px"
					style:background-color={CHART_COLOURS[segment.colour]}
				></span>
			{/each}
			<span class="te-knob" style:left="{scale.knob.x}px" style:background-color={CHART_COLOURS[scale.knob.colour]}></span>
		</div>
	{/each}
</div>

<style>
	/* From the figures' bottom (the twin's 120.47): label 14.66, scale 49.5, label 101.96, scale 136.83, end 197.53. */
	.te-scales {
		position: relative;
		padding-bottom: 52.7px;
	}
	.te-label {
		margin: 14.66px 16px 0 15.8px;
		font-size: 18px;
		line-height: 22px;
		color: var(--text-normal);
	}
	.te-label + .te-track + .te-label {
		margin-top: 44.46px;
	}
	.te-track {
		position: relative;
		height: 8px;
		margin-top: 12.85px;
	}
	.te-band {
		position: absolute;
		top: 0;
		height: 8px;
	}
	.te-band.first {
		border-radius: 4px 0 0 4px;
	}
	.te-band.cap {
		border-radius: 0 4px 4px 0;
	}
	/* A 20 pt disc in a 4 pt halo, 1 pt under the scale's centre as in the twin. */
	.te-knob {
		position: absolute;
		top: -5px;
		width: 20px;
		height: 20px;
		margin-left: -10px;
		border-radius: 50%;
		box-shadow: 0 0 0 4px var(--background-primary);
	}
</style>
