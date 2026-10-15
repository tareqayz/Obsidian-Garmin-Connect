<script lang="ts">
	import type { ZonesChart } from "../../../../dashboard/activity-chart-pages";
	import type { TimeInPositionData } from "../../../../dashboard/cycling-metrics";
	import type { CardPlotProps } from "../charts/kinds";
	import ZoneRows from "../charts/ZoneRows.svelte";

	/**
	 * Time in Position (the twin's 950:689): the zone tables' rows, Standing
	 * then Seated, each over a track filled to its rounded share, the time and
	 * the share at its right; no range or zone name. `cycling-activity-charts`
	 * `timeInPositionPlot` gives the same bars.
	 */
	let { card }: CardPlotProps = $props();

	let rows = $derived<ZonesChart>({
		kind: "zones",
		id: card.id,
		title: card.title,
		help: card.help,
		figures: [],
		rows: (card.data as TimeInPositionData).rows.map((row, i) => ({
			zone: i + 1,
			title: row.label,
			range: "",
			name: "",
			time: row.time,
			percent: row.percent,
			fill: row.fill,
			colour: row.colour,
		})),
	});
</script>

<ZoneRows chart={rows} />
