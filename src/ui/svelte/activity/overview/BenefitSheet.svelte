<script lang="ts">
	import { BENEFIT_CATEGORIES, BENEFIT_CLOSING, BENEFIT_MORE, BENEFIT_MORE_TITLE } from "../../../../dashboard/activity-copy";
	import { BENEFIT_COLOR, type PrimaryBenefit } from "../../../../dashboard/activity-labels";

	/**
	 * This Activity's Benefit, the sheet behind the Primary Benefit's "?":
	 * the benefit with its category's dot and what it did, then Garmin's note on
	 * the three categories. Its title, This Activity's Benefit, and its close
	 * button are the modal's.
	 */
	interface Props {
		benefit: PrimaryBenefit;
		/** What this activity did; known for Threshold only. */
		message: string | null;
		onClose: () => void;
	}

	let { benefit, message }: Props = $props();
</script>

<div class="benefit-sheet">
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
	/* Below the modal's header, as far as Garmin's sheet sets it below its title;
	   its end clears a phone's home indicator. */
	.benefit-sheet {
		box-sizing: border-box;
		padding: 34px 16px calc(32px + var(--safe-area-inset-bottom, 0px));
		background: var(--background-primary);
		color: var(--text-normal);
	}
	.this {
		display: flex;
		align-items: center;
		gap: 8px;
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
