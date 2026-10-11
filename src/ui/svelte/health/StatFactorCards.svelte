<script lang="ts">
	/**
	 * A stat's factors as cards (twin 443:420): Training Readiness's six and
	 * Hill Score's three. A card has its title over a detail, and its rating
	 * on the right with a status dot where the app draws one; no chevron, as
	 * on the phone. Tapping one opens its sheet (the props' `openSheet`). One
	 * a row, two from 640 pt, three in a pane.
	 */
	interface Factor {
		key: string;
		title: string;
		/** The line under the title: "89", "82h". */
		detail?: string;
		/** The word on the right: "Good", "High Need". */
		rating: string;
		/** The status dot's colour; none for a card without one (Hill Score). */
		color?: string;
		onclick?: () => void;
	}

	let { factors }: { factors: readonly Factor[] } = $props();
</script>

<div class="stat-factors">
	{#each factors as factor (factor.key)}
		<button class="factor" disabled={!factor.onclick} onclick={() => factor.onclick?.()}>
			<span class="text">
				<span class="title">{factor.title}</span>
				{#if factor.detail}<span class="detail">{factor.detail}</span>{/if}
			</span>
			<span class="rating">
				{factor.rating}
				{#if factor.color}<span class="dot" style:background={factor.color}></span>{/if}
			</span>
		</button>
	{/each}
</div>

<style>
	.stat-factors {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		padding: 0 16px;
	}
	.factor {
		display: flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		height: 74px;
		margin: 0;
		padding: 0 16px 0 16.5px;
		border: none;
		border-radius: var(--radius-m, 8px);
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.factor:disabled {
		cursor: default;
		opacity: 1;
	}
	.factor:not(:disabled):hover {
		background: var(--background-modifier-hover);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 3.3px;
		flex: 1;
		min-width: 0;
		white-space: nowrap;
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
	.title,
	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rating {
		display: flex;
		align-items: center;
		gap: 13.33px;
		flex: none;
		font-size: 18px;
		line-height: 22px;
		white-space: nowrap;
	}
	.dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
	}

	@container (min-width: 640px) {
		.stat-factors {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 0;
		}
	}

	@container (min-width: 1000px) {
		.stat-factors {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
