<script lang="ts" module>
	/** A card of a Hill Score list: a day (weekday over date) or a month (its name alone), its score over its class. */
	export interface HillCardItem {
		key: string;
		kind: "day" | "month";
		/** "Sunday", "October 2026". */
		title: string;
		/** A day's date: "October 11". */
		detail?: string;
		/** "29", "29 Avg". */
		value: string;
		/** The class: "Challenger". */
		word: string;
		onclick: () => void;
	}
</script>

<script lang="ts">
	/**
	 * A period's list (the twin's List Card, 503:457): days on 4w, 12w and a
	 * month page, 370 × 74; months on 1y, 370 × 73. A day has its weekday in
	 * Body Semibold over its date in Label; a month its name alone, centred
	 * down the card. The score (Value M) over the class (Label) ends 16 pt
	 * from the right. One a row 16 apart on a phone, two from 640 pt, three
	 * in a pane.
	 */
	let { items }: { items: readonly HillCardItem[] } = $props();
</script>

<div class="hill-cards">
	{#each items as item (item.key)}
		<button class="hill-card" class:month={item.kind === "month"} onclick={item.onclick}>
			<span class="text">
				<span class="title">{item.title}</span>
				{#if item.detail}<span class="detail">{item.detail}</span>{/if}
			</span>
			<span class="figure">
				<span class="value">{item.value}</span>
				<span class="word">{item.word}</span>
			</span>
		</button>
	{/each}
</div>

<style>
	/* 31 pt under the Avg / Max row on a phone, 30 under the chart in a pane; the twin's frames end 35 and 32 under the last card. */
	.hill-cards {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		margin-top: 31px;
		padding: 0 16px 35px;
	}
	.hill-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		height: 74px;
		margin: 0;
		padding: 0 16px;
		border: none;
		border-radius: var(--radius-m, 8px);
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: normal;
		cursor: pointer;
	}
	.hill-card:hover {
		background: var(--background-modifier-hover);
	}
	.month {
		height: 73px;
	}
	.text,
	.figure {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	/* A day: the weekday 16.97 down, the date 2.99 under it. A month: its name centred, 26.67 down. */
	.text {
		gap: 2.99px;
		padding-top: 16.97px;
	}
	.month .text {
		padding-top: 26.67px;
	}
	/* The score 15.17 down, the class 4.46 under it (3.79 on a month). */
	.figure {
		flex: none;
		align-items: flex-end;
		gap: 4.46px;
		padding-top: 15.17px;
	}
	.month .figure {
		gap: 3.79px;
	}
	.title {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	.detail,
	.word {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.title,
	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.value {
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.word {
		white-space: nowrap;
	}

	@container (min-width: 640px) {
		.hill-cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 0 0 32px;
		}
	}

	@container (min-width: 1000px) {
		.hill-cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			margin-top: 30px;
		}
	}
</style>
