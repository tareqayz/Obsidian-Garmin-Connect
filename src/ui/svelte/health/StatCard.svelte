<script lang="ts">
	import type { Snippet } from "svelte";

	/**
	 * A day or a week in a Health Stats list. A day has its weekday over its
	 * date, the figure on the right and an optional visual beside it (Stress's
	 * mini ring); a week has its dates and its figure on one line. Tapping it
	 * switches the page, as the app does.
	 */
	interface Props {
		title: string;
		detail?: string;
		value: string;
		/** "day": 73.6pt, a title over a detail; "week": 53.95pt, one line. */
		kind?: "day" | "week";
		/** Drawn after the figure, at the card's right edge. */
		visual?: Snippet;
		onclick: () => void;
	}

	let { title, detail, value, kind = "day", visual, onclick }: Props = $props();
</script>

<button class="stat-card" class:week={kind === "week"} {onclick}>
	<span class="text">
		<span class="title">{title}</span>
		{#if detail}<span class="detail">{detail}</span>{/if}
	</span>
	<span class="value">{value}</span>
	{@render visual?.()}
</button>

<style>
	.stat-card {
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
	.stat-card:hover {
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
