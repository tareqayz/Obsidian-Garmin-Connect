<script lang="ts">
	import type { FactorCard } from "../../../dashboard/fitness-age-pages";
	import { lucide } from "../home/lucide";

	/**
	 * A group of factor cards under its caps heading: RECOMMENDATIONS (a card
	 * opens its sheet; only BMI's is known) or ON TARGET (a green check).
	 */
	let { heading, cards, check = false, onopen }: { heading: string; cards: FactorCard[]; check?: boolean; onopen?: (card: FactorCard) => void } = $props();
</script>

{#if cards.length}
	<section class="fa-factors">
		<h3>{heading}</h3>
		{#each cards as card (card.factor)}
			{#if onopen && card.factor === "bmi"}
				<button class="fa-factor" onclick={() => onopen(card)}>
					<span class="text"><span class="title">{card.title}</span><span class="detail">{card.detail}</span></span>
				</button>
			{:else}
				<div class="fa-factor">
					<span class="text"><span class="title">{card.title}</span><span class="detail">{card.detail}</span></span>
					{#if check}<span class="check" use:lucide={"circle-check"}></span>{/if}
				</div>
			{/if}
		{/each}
	</section>
{/if}

<style>
	.fa-factors {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h3 {
		margin: 0 0 -4px;
		font-size: 13px;
		line-height: 16px;
		font-weight: 400;
		letter-spacing: 0.02em;
		color: var(--text-muted);
		text-transform: uppercase;
	}
	.fa-factor {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		min-height: 72px;
		height: auto;
		margin: 0;
		padding: 14px 16px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
	}
	button.fa-factor {
		cursor: pointer;
	}
	button.fa-factor:hover {
		background: var(--background-modifier-hover);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.title {
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
	}
	.detail {
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}
	.check {
		display: inline-flex;
		color: var(--color-green);
	}
	.check :global(svg) {
		width: 28px;
		height: 28px;
	}
</style>
