<script lang="ts">
	import { lucide } from "../home/lucide";

	/**
	 * A rounded card in a category's list: an activity (name, when, value) or,
	 * over a year, a month (month, how many, total) that opens the month.
	 * Activities are not clickable until there is an activity screen to open.
	 */
	interface Props {
		title: string;
		detail: string;
		value: string;
		/** Months are muted under their title; an activity's date is not. */
		muted?: boolean;
		onclick?: () => void;
	}

	let { title, detail, value, muted = false, onclick }: Props = $props();
</script>

{#snippet body()}
	<span class="text">
		<span class="title">{title}</span>
		<span class="detail" class:muted>{detail}</span>
	</span>
	<span class="value">{value}</span>
	{#if onclick}<span class="chev" use:lucide={"chevron-right"}></span>{/if}
{/snippet}

{#if onclick}
	<button class="list-card" {onclick}>{@render body()}</button>
{:else}
	<div class="list-card">{@render body()}</div>
{/if}

<style>
	.list-card {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		min-height: 69.7px;
		height: auto;
		margin: 0;
		padding: 14px 17.3px 13.3px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: normal;
	}
	button.list-card {
		cursor: pointer;
	}
	button.list-card:hover {
		background: var(--background-modifier-hover);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2.4px;
		flex: 1;
		min-width: 0;
	}
	.title,
	.detail {
		font-size: 15px;
		line-height: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title {
		font-weight: 600;
	}
	.muted {
		color: var(--text-muted);
	}
	.value {
		flex: none;
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
	}
	.chev {
		display: inline-flex;
		flex: none;
		color: var(--text-faint);
	}
	.chev :global(svg) {
		width: 16px;
		height: 16px;
	}
</style>
