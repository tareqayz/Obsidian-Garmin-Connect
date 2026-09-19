<script lang="ts">
	import type { Field } from "../../../dashboard/activity";

	interface Props {
		fields: readonly Field[];
	}

	let { fields }: Props = $props();
</script>

<!-- A fixed grid rather than a wrapping row, so the labels line up column to
     column. Values lead, units follow in the muted weight. -->
<dl class="grid">
	{#each fields as field (field.label)}
		<div class="item">
			<dt>{field.label}</dt>
			<dd>
				<span class="value">{field.value}</span>
				{#if field.unit}<span class="unit">{field.unit}</span>{/if}
			</dd>
		</div>
	{/each}
</dl>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 16px 14px;
		margin: 0;
	}
	.item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	dt {
		font-size: 11px;
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: 0.44px;
		text-transform: uppercase;
		color: var(--v2-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	dd {
		display: flex;
		align-items: baseline;
		gap: 3px;
		margin: 0;
	}
	.value {
		font-size: 13px;
		font-weight: 600;
		color: var(--gcd-text);
		font-variant-numeric: tabular-nums;
	}
	.unit {
		font-size: 12px;
		color: var(--v2-muted);
	}
</style>
