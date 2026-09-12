<script lang="ts">
	import { TABLE_KEYS } from "../../dashboard/metrics";
	import { availableKeys, compact, shortDate, type DayRow } from "../../dashboard/series";
	import { METRIC_LABELS } from "../../sync/metrics";

	let { rows }: { rows: readonly DayRow[] } = $props();

	let keys = $derived(availableKeys(rows, TABLE_KEYS));
	let newestFirst = $derived([...rows].reverse());
</script>

<!-- The twin every chart needs: the same numbers, with no colour and no hover. -->
<div class="wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Date</th>
				{#each keys as key (key)}
					<th scope="col">{METRIC_LABELS[key] ?? key.replace(/_/g, " ")}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each newestFirst as row (row.date)}
				<tr>
					<th scope="row">{shortDate(row.date)}</th>
					{#each keys as key (key)}
						<td>{typeof row.values[key] === "number" ? compact(row.values[key]) : "—"}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.wrap {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: var(--font-ui-smaller, 12px);
	}
	th,
	td {
		text-align: right;
		padding: 5px 10px;
		border-bottom: 1px solid var(--gcd-border);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		font-weight: 400;
	}
	thead th {
		color: var(--gcd-muted);
		font-weight: 500;
	}
	tbody th:first-child,
	thead th:first-child {
		text-align: left;
	}
</style>
