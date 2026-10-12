<script lang="ts">
	import { CHART_COLOURS } from "../../../dashboard/activity-chart-pages";
	import { PHONE } from "../../../dashboard/stat-charts";
	import { TE_DETAIL, teScaleRow } from "../../../dashboard/training-effect-charts";
	import type { TeScale } from "../../../dashboard/training-effect-pages";

	/**
	 * AEROBIC's or ANAEROBIC's cell (twin Score Cell 683:274): the band's
	 * title, the run page's scale across the cell — its segments and its knob
	 * drawn as `activity/charts/TrainingEffectScales.svelte` draws them, in
	 * the same colours — the value centred under the knob wherever it is, and
	 * the band's copy as the phone breaks it, where it is known.
	 */
	let { scale }: { scale: TeScale } = $props();

	const D = TE_DETAIL;

	let measured = $state(0);
	let row = $derived(teScaleRow(scale, measured || PHONE));
</script>

<div
	class="te-score"
	bind:clientWidth={measured}
	style:--te-cell-top="{D.cellTop}px"
	style:--te-cell-bottom="{D.scaleBottom}px"
	style:--te-title="{D.title}px"
	style:--te-scale-row="{D.scaleRow}px"
	style:--te-scale-top="{D.scaleTop}px"
	style:--te-value-top="{D.scaleTop + D.valueTop}px"
>
	<div class="title">{scale.title}</div>
	<div class="scale-row">
		<div class="te-track">
			{#each row.segments as segment, i (i)}
				<span
					class="te-band"
					class:first={i === 0}
					class:cap={i === row.segments.length - 1}
					style:left="{segment.x}px"
					style:width="{segment.width}px"
					style:background-color={CHART_COLOURS[segment.colour]}
				></span>
			{/each}
			<span class="te-knob" style:left="{row.knob.x}px" style:background-color={CHART_COLOURS[row.knob.colour]}></span>
		</div>
		<span class="value" style:left="{row.value.x}px">{row.value.text}</span>
	</div>
	{#if scale.copyLines}
		<div class="copy">
			{#each scale.copyLines as line, i (i)}<span>{line}</span>{/each}
		</div>
	{/if}
</div>

<style>
	.te-score {
		padding: var(--te-cell-top) 0 var(--te-cell-bottom);
		background: var(--background-primary);
	}
	.title {
		padding: 0 16px;
		font-size: 16px;
		line-height: var(--te-title);
		color: var(--text-normal);
	}
	.scale-row {
		position: relative;
		height: var(--te-scale-row);
	}
	/* The run page's track, bands and knob (TrainingEffectScales.svelte): 8 pt bands, a 20 pt knob in a 4 pt halo, 1 pt under the scale's centre. */
	.te-track {
		position: absolute;
		top: var(--te-scale-top);
		left: 0;
		right: 0;
		height: 8px;
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
	.te-knob {
		position: absolute;
		top: -5px;
		width: 20px;
		height: 20px;
		margin-left: -10px;
		border-radius: 50%;
		box-shadow: 0 0 0 4px var(--background-primary);
	}
	/* Centred on the knob and never clamped: 0.0's sits half outside the 16 pt margin. */
	.value {
		position: absolute;
		top: var(--te-value-top);
		transform: translateX(-50%);
		font-size: 15px;
		line-height: 20px;
		white-space: nowrap;
		color: var(--text-normal);
	}
	.copy {
		padding: 0 16px;
		font-size: 15px;
		line-height: 22px;
		color: var(--text-normal);
	}
	.copy span {
		display: block;
	}
</style>
