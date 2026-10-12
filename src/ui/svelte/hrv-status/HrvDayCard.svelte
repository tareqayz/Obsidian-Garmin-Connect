<script lang="ts">
	import type { HrvDayCard, HrvFigure } from "../../../dashboard/hrv-status-pages";
	import { toneColor } from "../home/tones";

	/**
	 * A night in the 7d / 4w list (twin Day Card 507:77): the weekday over
	 * the date; the status dot and "84 ms" over "7d Avg"; "79 ms" over
	 * "Overnight Avg" at the right. 370 × 73.33 in the twin, radius 12; the
	 * middle block starts 187.7 in, the right one ends 15.8 short. Tapping it
	 * opens the night's 1d (Inferred).
	 */
	let { card, onclick }: { card: HrvDayCard; onclick: () => void } = $props();

	const text = (figure: HrvFigure) => (figure.unit ? `${figure.value} ${figure.unit}` : figure.value);
</script>

<button class="hrv-day-card" {onclick}>
	<span class="night">
		<span class="weekday">{card.weekday}</span>
		<span class="date">{card.detail}</span>
	</span>
	<span class="weekly">
		<span class="row">
			<span class="dot" style:background={toneColor(card.look?.tone) ?? "transparent"}></span>
			<span class="value">{text(card.weekly)}</span>
		</span>
		<span class="label">{card.weekly.label}</span>
	</span>
	<span class="overnight">
		<span class="value">{text(card.night)}</span>
		<span class="label">{card.night.label}</span>
	</span>
</button>

<style>
	.hrv-day-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 68px 98.5px;
		align-items: start;
		box-sizing: border-box;
		width: 100%;
		height: 73.33px;
		margin: 0;
		padding: 0 15.8px 0 15.9px;
		border: none;
		border-radius: 12px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: normal;
		cursor: pointer;
	}
	.hrv-day-card:hover {
		background: var(--background-modifier-hover);
	}
	.night,
	.weekly,
	.overnight {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.night {
		padding-top: 16.5px;
	}
	.weekday {
		font-size: 16px;
		line-height: 21px;
		font-weight: 600;
	}
	.date {
		margin-top: 2.4px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.weekday,
	.date {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.weekly,
	.overnight {
		padding-top: 16.78px;
	}
	.overnight {
		align-items: flex-end;
		text-align: right;
	}
	/* The dot 3.97 in from the block, "84 ms" 16.39 in; "7d Avg" under them from the block's edge. */
	.row {
		display: flex;
		align-items: center;
		gap: 4.42px;
		padding-left: 3.97px;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.value {
		font-size: 15px;
		line-height: 20px;
		white-space: nowrap;
	}
	.label {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.weekly .label {
		margin-top: 4.79px;
	}
	.overnight .label {
		margin-top: 4.95px;
	}
</style>
