<script lang="ts">
	import { shortDate, type Stats } from "../../dashboard/series";

	interface Props {
		stats: Stats;
		format: (value: number) => string;
		unit?: string;
	}

	let { stats, format, unit = "" }: Props = $props();

	interface Row {
		label: string;
		value: number;
		date?: string;
	}

	let rows = $derived.by(() => {
		const out: Row[] = [];
		if (stats.latest) out.push({ label: "Latest", value: stats.latest.value, date: stats.latest.date });
		if (stats.mean !== undefined) out.push({ label: "Average", value: stats.mean });
		if (stats.min) out.push({ label: "Lowest", value: stats.min.value, date: stats.min.date });
		if (stats.max) out.push({ label: "Highest", value: stats.max.value, date: stats.max.date });
		return out;
	});
</script>

<!-- Only shown expanded: the numbers a hover would otherwise have to carry. -->
<dl class="stats">
	{#each rows as row (row.label)}
		<div class="stat">
			<dt>{row.label}</dt>
			<dd>
				{format(row.value)}{unit}
				{#if row.date}<span class="when">{shortDate(row.date)}</span>{/if}
			</dd>
		</div>
	{/each}
	<div class="stat">
		<dt>Days</dt>
		<dd>{stats.points.length}</dd>
	</div>
</dl>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 10px;
		margin: 14px 0 6px;
		padding-top: 12px;
		border-top: 1px solid var(--gcd-border);
	}
	.stat {
		min-width: 0;
	}
	dt {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	dd {
		margin: 2px 0 0;
		font-size: 17px;
		font-weight: 600;
	}
	.when {
		display: block;
		font-size: var(--font-ui-smaller, 12px);
		font-weight: 400;
		color: var(--gcd-muted);
	}
</style>
