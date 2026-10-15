import type { CardPlot } from "../charts/kinds";
import PlatformOffsetPlot from "./PlatformOffsetPlot.svelte";
import PositionPlot from "./PositionPlot.svelte";
import PowerCurvePlot from "./PowerCurvePlot.svelte";
import PowerPhasePlot from "./PowerPhasePlot.svelte";
import TimeInPositionPlot from "./TimeInPositionPlot.svelte";

/**
 * A ride's own plots by the name its custom cards give (`cycling-metrics.ts`
 * `CYCLING_CARDS`), which `charts/kinds.ts` spreads into `CARD_PLOTS`:
 * Position's lanes, Time in Position's bars, the Power Phase dials, the
 * Platform Offset pedals and the Power Curve. Each draws with
 * `cycling-activity-charts.ts`'s geometry at the width its card gets.
 */
export const CYCLING_PLOTS: Readonly<Record<string, CardPlot>> = {
	position: PositionPlot,
	"time-in-position": TimeInPositionPlot,
	"power-phase-balance": PowerPhasePlot,
	"platform-offset": PlatformOffsetPlot,
	"power-curve": PowerCurvePlot,
};
