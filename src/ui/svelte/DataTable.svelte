<script lang="ts">
	import { TABLE_KEYS, formatFor } from "../../dashboard/metrics";
	import {
		availableKeys,
		availableTextKeys,
		compact,
		shortDate,
		type DayRow,
	} from "../../dashboard/series";
	import { DURATION_KEYS, METRIC_LABELS } from "../../sync/metrics";

	let { rows }: { rows: readonly DayRow[] } = $props();

	// Numbers and Garmin's qualitative labels, in the order the sync writes them,
	// so a column never appears here that is not also in the note.
	let numeric = $derived(new Set(availableKeys(rows, TABLE_KEYS)));
	let textual = $derived(new Set(availableTextKeys(rows, TABLE_KEYS)));
	let keys = $derived(TABLE_KEYS.filter((k) => numeric.has(k) || textual.has(k)));
	let newestFirst = $derived([...rows].reverse());

	/** Race predictions are seconds on the wire and times on screen. */
	function cell(row: DayRow, key: string): string {
		const value = row.values[key];
		if (typeof value === "number") {
			return DURATION_KEYS.has(key) ? formatFor(key)(value) : compact(value);
		}
		return row.text?.[key] ?? "—";
	}
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
						<td class:text={textual.has(key) && !numeric.has(key)}>{cell(row, key)}</td>
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
	/* Labels are words, and words read left-aligned however the numbers sit. */
	td.text {
		text-align: left;
		font-variant-numeric: normal;
	}
</style>
