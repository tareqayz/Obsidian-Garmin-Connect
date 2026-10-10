<script lang="ts">
	import {
		BENEFIT_CATEGORIES,
		BENEFIT_CLOSING,
		BENEFIT_MORE,
		BENEFIT_MORE_TITLE,
		BENEFIT_SHEET_TITLE,
	} from "../../../../dashboard/activity-copy";
	import { BENEFIT_COLOR, type PrimaryBenefit } from "../../../../dashboard/activity-labels";
	import { lucide } from "../../home/lucide";

	/**
	 * This Activity's Benefit, the sheet behind the Primary Benefit's "?":
	 * the benefit with its category's dot and what it did, then Garmin's note on
	 * the three categories. It draws its own header; the modal's is hidden.
	 */
	interface Props {
		benefit: PrimaryBenefit;
		/** What this activity did; known for Threshold only. */
		message: string | null;
		onClose: () => void;
	}

	let { benefit, message, onClose }: Props = $props();
</script>

<div class="benefit-sheet">
	<span class="grabber"></span>
	<header class="head">
		<h2>{BENEFIT_SHEET_TITLE}</h2>
		<button class="close" aria-label="Close" onclick={onClose}><span use:lucide={"x"}></span></button>
	</header>

	<div class="this">
		{#if benefit.group}<span class="dot" style:background={BENEFIT_COLOR[benefit.group]}></span>{/if}
		<span>{benefit.name}</span>
	</div>
	{#if message}<div class="copy">{message}</div>{/if}

	<h3>{BENEFIT_MORE_TITLE}</h3>
	<div class="copy">{BENEFIT_MORE}</div>
	{#each BENEFIT_CATEGORIES as category (category.group)}
		<h4>{category.group}</h4>
		<ul>
			{#each category.benefits as name (name)}
				<li><span class="dot" style:background={BENEFIT_COLOR[category.group]}></span>{name}</li>
			{/each}
		</ul>
	{/each}
	<div class="copy closing">{BENEFIT_CLOSING}</div>
</div>

<style>
	.benefit-sheet {
		position: relative;
		max-height: 85vh;
		overflow-y: auto;
		box-sizing: border-box;
		padding: 30.3px 16px 32px;
		background: var(--background-primary);
		color: var(--text-normal);
	}
	/* A sheet's handle, for a finger: a desktop dialog has none. */
	.grabber {
		position: absolute;
		top: 10px;
		left: 50%;
		width: 36px;
		height: 5px;
		margin-left: -18px;
		border-radius: 2.5px;
		background: var(--text-faint);
	}
	@media (hover: hover) and (pointer: fine) {
		.grabber {
			display: none;
		}
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-size: 22px;
		line-height: 28px;
		font-weight: 600;
	}
	.close {
		display: inline-flex;
		flex: none;
		margin: 0;
		height: auto;
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.close :global(svg) {
		width: 20px;
		height: 20px;
	}
	.this {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 31.7px;
		font-size: 16px;
		line-height: 21px;
		font-weight: 600;
	}
	.dot {
		flex: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
	}
	.copy {
		margin-top: 14.9px;
		font-size: 15px;
		line-height: 22px;
		letter-spacing: -0.018em;
		color: var(--text-muted);
	}
	h3 {
		margin: 14.5px 0 0;
		font-size: 21px;
		line-height: 26px;
		font-weight: 600;
	}
	h3 + .copy {
		margin-top: 15.9px;
	}
	h4 {
		margin: 14.5px 0 0;
		font-size: 18px;
		line-height: 22px;
		font-weight: 600;
	}
	ul {
		margin: 8.5px 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		line-height: 20px;
	}
	li + li {
		margin-top: 8px;
	}
	ul + h4 {
		margin-top: 15.2px;
	}
	.closing {
		margin-top: 14.6px;
	}
</style>
