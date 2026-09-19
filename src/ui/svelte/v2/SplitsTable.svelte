<script lang="ts">
	import { splitRows, type Split, type Sport } from "../../../dashboard/activity";

	interface Props {
		splits: readonly Split[];
		/** Distance unit, which names the first column. */
		unit?: string;
		/** Elevation unit for the signed change column. */
		elevationUnit?: string;
		sport?: Sport;
	}

	let { splits, unit = "km", elevationUnit = "m", sport = "run" }: Props = $props();

	let rows = $derived(splitRows(splits));
	let hasHr = $derived(rows.some((r) => r.hr !== undefined));
	let hasElevation = $derived(rows.some((r) => r.elevation !== undefined));

	/** A true minus sign, not a hyphen: these sit in a column of numbers. */
	function signed(value: number): string {
		return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
	}
</script>

<!-- The bar encodes speed rather than time, so a longer bar always means a
     faster split. A trailing partial split is dimmed, because its pace is not
     comparable to a whole one's. -->
<div class="splits">
	<div class="row head">
		<div class="km">{unit === "mi" ? "Mi" : "Km"}</div>
		<div class="pace">Pace</div>
		{#if hasHr}<div class="hr">HR</div>{/if}
		{#if hasElevation}<div class="elev">Elev</div>{/if}
		<div class="bar"></div>
	</div>

	{#each rows as row, i (i)}
		<div class="row" class:partial={row.partial}>
			<div class="km">{row.label}</div>
			<div class="pace">{row.pace}</div>
			{#if hasHr}<div class="hr">{row.hr ?? "—"}</div>{/if}
			{#if hasElevation}
				<div class="elev">
					{row.elevation === undefined ? "—" : `${signed(row.elevation)} ${elevationUnit}`}
				</div>
			{/if}
			<div class="bar">
				<div
					class="fill"
					style:width="{row.fraction * 100}%"
					style:background="var(--v2-sport-{sport})"
				></div>
			</div>
		</div>
	{/each}
</div>

<style>
	.splits {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 0;
	}
	.head {
		padding: 0 0 6px;
		border-bottom: 1px solid var(--gcd-border);
		font-size: 11px;
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: 0.44px;
		text-transform: uppercase;
		color: var(--v2-muted);
	}
	.partial {
		opacity: 0.55;
	}
	.km {
		width: 30px;
		flex: none;
		font-size: 12px;
		font-weight: 500;
		color: var(--v2-muted);
	}
	.pace {
		width: 50px;
		flex: none;
		text-align: right;
		font-size: 12px;
		font-weight: 600;
		color: var(--gcd-text);
	}
	.hr {
		width: 40px;
		flex: none;
		text-align: right;
		font-size: 12px;
		color: var(--gcd-text);
	}
	.elev {
		width: 44px;
		flex: none;
		text-align: right;
		font-size: 12px;
		color: var(--v2-muted);
		white-space: nowrap;
	}
	.row :is(.km, .pace, .hr, .elev) {
		font-variant-numeric: tabular-nums;
	}
	.head :is(.km, .pace, .hr, .elev) {
		font-weight: 500;
		color: var(--v2-muted);
	}
	.bar {
		flex: 1 1 auto;
		min-width: 40px;
		height: 8px;
	}
	.head .bar {
		height: auto;
	}
	.fill {
		height: 8px;
		border-radius: 999px;
	}
</style>
