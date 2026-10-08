<script lang="ts">
	import type { SleepAverageCard } from "../../../dashboard/respiration-pages";

	/**
	 * "Sleep Averages": the night that ended this day and the one that began
	 * this evening. One night fills the row with its date; two share it,
	 * weekday and value only. A card opens that night on the Sleep page.
	 */
	let { nights, open }: { nights: SleepAverageCard[]; open: (night: SleepAverageCard) => void } = $props();
</script>

{#if nights.length}
	<section class="resp-sleep">
		<h3>Sleep Averages</h3>
		<div class="row" class:pair={nights.length > 1}>
			{#each nights as night (night.date)}
				<button class="night" onclick={() => open(night)}>
					{#if nights.length > 1}
						<span class="title">{night.weekday}</span>
						<span class="sub">{night.value}</span>
					{:else}
						<span class="text"><span class="title">{night.weekday}</span><span class="sub">{night.detail}</span></span>
						<span class="value">{night.value}</span>
					{/if}
				</button>
			{/each}
		</div>
	</section>
{/if}

<style>
	.resp-sleep {
		padding: 0 16px;
		margin-top: 30px;
	}
	h3 {
		margin: 0 0 12px;
		font-size: 16px;
		line-height: 21px;
		font-weight: 400;
		color: var(--text-normal);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
	}
	.row.pair {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	}
	.night {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		height: auto;
		min-height: 73px;
		margin: 0;
		padding: 16px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.pair .night {
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 2px;
	}
	.night:hover {
		background: var(--background-modifier-hover);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.title {
		font-size: 16px;
		line-height: 21px;
		font-weight: 600;
	}
	.sub {
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.value {
		font-size: 16px;
		line-height: 21px;
		font-variant-numeric: tabular-nums;
	}

	@container (min-width: 1000px) {
		.resp-sleep {
			padding: 0;
			max-width: 370px;
		}
	}
</style>
