<script lang="ts">
	import { RANGES } from "../../dashboard/metrics";

	interface Props {
		rangeDays: number;
		showTable: boolean;
		syncing: boolean;
		canSync: boolean;
		onRange: (days: number) => void;
		onToggleTable: () => void;
		onSync: () => void;
		onBackfill: () => void;
	}

	let { rangeDays, showTable, syncing, canSync, onRange, onToggleTable, onSync, onBackfill }: Props =
		$props();
</script>

<!-- One row, above everything it scopes. Never a filter inside a chart card. -->
<div class="filters">
	<div class="group">
		{#each RANGES as range (range.days)}
			<button
				class="chip"
				class:selected={range.days === rangeDays}
				aria-pressed={range.days === rangeDays}
				onclick={() => onRange(range.days)}>{range.label}</button
			>
		{/each}
	</div>

	<div class="group end">
		<button class="chip primary" disabled={!canSync || syncing} onclick={onSync}>
			{syncing ? "Syncing…" : "Sync"}
		</button>
		<button
			class="chip"
			disabled={!canSync || syncing}
			onclick={onBackfill}
			title="Sync a date range of your choosing">Backfill…</button
		>
		<button class="chip" class:selected={showTable} aria-pressed={showTable} onclick={onToggleTable}>
			{showTable ? "Charts" : "Table"}
		</button>
	</div>
</div>

<style>
	.filters {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
	.group {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.end {
		margin-left: auto;
	}
	.chip {
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		box-shadow: none;
	}
	.chip:hover:not(:disabled) {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.chip.selected {
		background: var(--gcd-raised);
		border-color: var(--gcd-series);
		color: var(--gcd-text);
		font-weight: 600;
	}
	.chip.primary {
		border-color: var(--gcd-series);
		color: var(--gcd-series);
		font-weight: 600;
	}
	.chip.primary:hover:not(:disabled) {
		background: var(--gcd-series);
		color: var(--gcd-surface);
	}
</style>
