<script lang="ts">
	import { CARD_RING } from "../../../dashboard/stress-charts";
	import type { RingPart } from "../../../dashboard/stress-pages";
	import StressRing from "./StressRing.svelte";

	/**
	 * A day or a week in a Stress list. A day has its weekday over its date,
	 * the level and a mini ring, grey with "--" on a day without data; a week
	 * has its dates and its average on one line. Either switches the page in
	 * place: a day to 1d, a week to 7d.
	 */
	interface Props {
		title: string;
		detail?: string;
		value: string;
		/** A day's mini ring; a week has none. */
		ring?: RingPart[];
		onclick: () => void;
	}

	let { title, detail, value, ring, onclick }: Props = $props();
</script>

<button class="stress-card" class:week={ring === undefined} {onclick}>
	<span class="text">
		<span class="title">{title}</span>
		{#if detail}<span class="detail">{detail}</span>{/if}
	</span>
	<span class="value">{value}</span>
	{#if ring}<StressRing parts={ring} size={CARD_RING.size} thickness={CARD_RING.thickness} />{/if}
</button>

<style>
	.stress-card {
		display: flex;
		align-items: center;
		gap: 16.7px;
		box-sizing: border-box;
		width: 100%;
		min-height: 73.6px;
		height: auto;
		margin: 0;
		padding: 16.3px 16px 16.9px 16.7px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: normal;
		cursor: pointer;
	}
	.stress-card:hover {
		background: var(--background-modifier-hover);
	}
	.week {
		gap: 8px;
		min-height: 53.95px;
		padding: 16.33px 17px 16.62px 16px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 1.4px;
		flex: 1;
		min-width: 0;
	}
	.title {
		font-size: 16px;
		line-height: 21px;
		font-weight: 600;
	}
	.detail {
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}
	.title,
	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.value {
		flex: none;
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
	}
	.week .value {
		font-size: 14px;
		line-height: 18px;
	}
</style>
