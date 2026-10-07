<script lang="ts">
	import { lucide } from "../home/lucide";

	/**
	 * The Sleep pages' cards: a score factor with its verdict, the Sleep
	 * History link, and a night or a week in a list with its figures.
	 */
	interface Props {
		title: string;
		detail?: string;
		/** A factor's verdict, on the right. */
		rating?: string;
		/** A night's or week's figures, right-aligned over their labels. */
		values?: Array<{ value: string; label: string }>;
		/** Draws the chevron of a card that opens a sheet. */
		chevron?: boolean;
		onclick?: () => void;
	}

	let { title, detail, rating, values, chevron = false, onclick }: Props = $props();
</script>

{#snippet body()}
	<span class="text">
		<span class="title" class:list={values !== undefined}>{title}</span>
		{#if detail}<span class="detail">{detail}</span>{/if}
	</span>
	{#if rating}<span class="rating">{rating}</span>{/if}
	{#if values}
		<span class="values">
			{#each values as v (v.label)}
				<span class="col"><span class="value">{v.value}</span><span class="label">{v.label}</span></span>
			{/each}
		</span>
	{/if}
	{#if chevron}<span class="chev" use:lucide={"chevron-right"}></span>{/if}
{/snippet}

{#if onclick}
	<button class="sleep-card" class:list={values !== undefined} {onclick}>{@render body()}</button>
{:else}
	<div class="sleep-card" class:list={values !== undefined}>{@render body()}</div>
{/if}

<style>
	.sleep-card {
		display: flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		min-height: 74px;
		height: auto;
		margin: 0;
		padding: 0 17px 0 16px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: normal;
	}
	button.sleep-card {
		cursor: pointer;
	}
	button.sleep-card:hover {
		background: var(--background-modifier-hover);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 3.3px;
		flex: 1;
		min-width: 0;
	}
	.title {
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
	}
	.title.list {
		font-size: 16px;
		line-height: 21px;
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
	.list .text {
		gap: 3.8px;
	}
	.rating {
		flex: none;
		font-size: 18px;
		line-height: 22px;
	}
	.values {
		display: flex;
		gap: 14px;
		flex: none;
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 3.8px;
	}
	.value {
		font-size: 16px;
		line-height: 21px;
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
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
