<script lang="ts">
	import type { EconomyCurrent } from "../../../dashboard/running-economy-pages";
	import StatDial from "../health/StatDial.svelte";

	/**
	 * Current (twin 752:3253; Inferred 752:3973 without any reading; pane
	 * 756:595): the reading's day over the dial, which has the score inside
	 * and no line under it; then Garmin's class and its copy — or, without a
	 * reading, the bands with "--" and the help's Getting an Estimate.
	 *
	 * A pane sets the day and the dial centred in the 748 pt column and the
	 * class and its copy in the 370 pt one beside them, the class's cap
	 * level with the ring's top, as the twin does.
	 */
	let { current }: { current: EconomyCurrent } = $props();
</script>

<div class="re-current">
	<div class="re-main">
		<p class="re-date">{current.label ?? ""}</p>
		<div class="re-dial"><StatDial kind="economy" gauge={current.dial.gauge} /></div>
	</div>
	<div class="re-side">
		<p class="re-heading">{current.heading}</p>
		{#if current.steps}
			<p class="re-lead">{current.copy}</p>
			{#each current.steps as step, i (i)}<p class="re-step">•  {step}</p>{/each}
		{:else if current.copy}
			<p class="re-copy">{current.copy}</p>
		{/if}
	</div>
</div>

<style>
	/*
	 * The phone (752:3253): under the bare header (the range control alone,
	 * its foot at 116.33), the day 7.8 down, Body Semibold centred; the dial's
	 * 196 box 29.11 under it (centre 200.98, 271.24); the class, Body
	 * Semibold, 43.89 under the dial at x 16; the copy, Body on a 22 pt pitch,
	 * its first line's box 21.66 under the class at x 16.3. Without a reading
	 * (752:3973) the dial keeps its place, and the help's lead and its five
	 * points follow the heading 22.16 under it, Article 15/21, 6 apart.
	 */
	.re-current {
		padding-bottom: 24px;
	}
	.re-date {
		height: 20px;
		margin: 7.8px 0 0;
		padding: 0 16px;
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.re-dial {
		display: flex;
		justify-content: center;
		height: 196px;
		margin-top: 29.11px;
	}
	/* The twin sets the number in proportional figures. */
	.re-dial :global(.stat-dial .value) {
		font-variant-numeric: normal;
	}
	.re-side {
		padding: 0 16px;
	}
	.re-heading {
		margin: 43.89px 0 0;
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	.re-copy {
		margin: 21.66px 0 0;
		padding-left: 0.3px;
		font-size: 15px;
		line-height: 22px;
	}
	.re-lead,
	.re-step {
		margin: 6px 0 0;
		font-size: 15px;
		line-height: 21px;
		white-space: pre-wrap;
	}
	.re-lead {
		margin-top: 22.16px;
	}

	/*
	 * The pane (756:595): under the header's rule, the day 23.8 down and the
	 * dial 29.11 under it, both centred on the 748 pt column (x 406); the
	 * class at x 788, 73.92 under the rule, and the copy 21.66 under it.
	 */
	@container (min-width: 1000px) {
		.re-current {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			padding-bottom: 0;
		}
		.re-date {
			margin-top: 23.8px;
		}
		.re-side {
			padding: 0;
		}
		.re-heading {
			margin-top: 73.92px;
		}
	}
</style>
