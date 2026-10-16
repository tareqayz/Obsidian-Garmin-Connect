import type { Component } from "svelte";
import type { CustomChart } from "../../../../dashboard/activity-chart-pages";
import type { ChartLayout } from "../../../../dashboard/activity-charts";
import { CYCLING_PLOTS } from "../cycling/plots";
import { SWIM_PLOTS } from "../swim/plots";

/**
 * The plots a sport draws itself, by the name its custom cards give
 * (`CustomChart.plot`): a ride's position lanes, power phase dials and power
 * curve. `ChartSection` draws a custom card with the plot named here; each
 * sport keeps its own map, so builders never edit this file.
 */
export interface CardPlotProps {
	card: CustomChart;
	layout: ChartLayout;
}

export type CardPlot = Component<CardPlotProps>;

export const CARD_PLOTS: Readonly<Record<string, CardPlot>> = { ...CYCLING_PLOTS, ...SWIM_PLOTS };
