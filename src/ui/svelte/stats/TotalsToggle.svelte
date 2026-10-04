<script lang="ts">
	import type { StatTotals } from "../../../dashboard/stats-pages";

	/** A year of steps by the week or by the month. */
	let { value, onChange }: { value: StatTotals; onChange: (totals: StatTotals) => void } = $props();
</script>

<div class="totals-toggle">
	<button class:on={value === "weekly"} aria-pressed={value === "weekly"} onclick={() => onChange("weekly")}>Weekly Totals</button>
	<button class:on={value === "monthly"} aria-pressed={value === "monthly"} onclick={() => onChange("monthly")}>Monthly Totals</button>
</div>

<style>
	.totals-toggle {
		display: flex;
		gap: 4px;
		box-sizing: border-box;
		width: 368px;
		max-width: 100%;
		height: 32px;
		padding: 2px;
		border-radius: 9px;
		background: var(--background-modifier-border);
	}
	button {
		flex: 1;
		margin: 0;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 7px;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 14px;
		line-height: 18px;
		color: var(--text-normal);
		cursor: pointer;
	}
	button.on {
		background: var(--background-primary);
	}
</style>
