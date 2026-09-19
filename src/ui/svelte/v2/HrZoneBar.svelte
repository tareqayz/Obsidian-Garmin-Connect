<script lang="ts">
	import { zoneRows, type Zone } from "../../../dashboard/activity";

	interface Props {
		zones: readonly Zone[];
	}

	let { zones }: Props = $props();

	let rows = $derived(zoneRows(zones));
</script>

<!-- Zones are ordered by intensity, so the ramp runs cool to hot rather than
     taking five unrelated hues. The label carries the bpm range, so the reader
     never has to remember what Z4 means. -->
<div class="zones">
	{#each rows as row (row.zone)}
		<div class="row">
			<div class="label">
				<span class="z">Z{row.zone}</span>
				<span class="name">{row.name}</span>
			</div>
			<div class="range">{row.low}–{row.high}</div>
			<div class="track">
				<div
					class="fill"
					style:width="{row.fraction * 100}%"
					style:background="var(--v2-zone-{row.zone})"
				></div>
			</div>
			<div class="time">{row.clock}</div>
			<div class="percent">{row.percent}</div>
		</div>
	{/each}
</div>

<style>
	.zones {
		display: flex;
		flex-direction: column;
		gap: 8px;
		container-type: inline-size;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.label {
		display: flex;
		gap: 6px;
		width: 104px;
		flex: none;
		font-size: 12px;
		font-weight: 500;
		color: var(--gcd-text);
	}
	.z {
		width: 16px;
		flex: none;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.range {
		width: 52px;
		flex: none;
		font-size: 10px;
		color: var(--v2-muted);
		font-variant-numeric: tabular-nums;
	}
	/* The track takes the leftover, which lands on the design's 140px at the
	   card's design width and shrinks with the pane rather than overflowing it. */
	.track {
		flex: 1 1 auto;
		min-width: 32px;
		height: 10px;
		border-radius: 999px;
		background: var(--gcd-grid);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 999px;
		/* A zone with seconds in it always draws, however few. */
		min-width: 3px;
	}
	.time {
		width: 44px;
		flex: none;
		text-align: right;
		font-size: 12px;
		font-weight: 600;
		color: var(--gcd-text);
		font-variant-numeric: tabular-nums;
	}
	.percent {
		width: 34px;
		flex: none;
		text-align: right;
		font-size: 10px;
		color: var(--v2-muted);
		font-variant-numeric: tabular-nums;
	}

	/* Below this the fixed columns leave the track about 40px, which is too
	   little for the bar to be the thing you read. The bpm range goes first: it
	   explains the zone, and the bar is the point. */
	@container (max-width: 330px) {
		.range {
			display: none;
		}
		.label {
			width: 86px;
		}
	}
</style>
