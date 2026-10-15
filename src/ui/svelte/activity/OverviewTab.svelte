<script lang="ts">
	import { BENEFIT_SHEET_TITLE, benefitMessage } from "../../../dashboard/activity-copy";
	import { mapLegend, overlayFor, overviewOverlay } from "../../../dashboard/activity-map";
	import { overviewView, type OverviewLink, type OverviewView } from "../../../dashboard/activity-overview";
	import { activityMapRoute } from "../../../dashboard/routes";
	import { toIsoDate } from "../../../garmin/endpoints";
	import { sportIcon } from "../../sport-icons";
	import { lucide } from "../home/lucide";
	import MapLegend from "./map/MapLegend.svelte";
	import Badges from "./overview/Badges.svelte";
	import BenefitSheet from "./overview/BenefitSheet.svelte";
	import Evaluation from "./overview/Evaluation.svelte";
	import OverviewStat from "./overview/OverviewStat.svelte";
	import WeatherChip from "./overview/WeatherChip.svelte";
	import RouteMap from "./RouteMap.svelte";
	import type { ActivityTabProps } from "./types";

	/**
	 * Overview, as the phone lays it out: the route map (static: a tap opens
	 * the full-screen map), the date line, the name, the big figure (the
	 * distance, or the sport's) and four figures, Evaluation, Badges,
	 * Navigation and the device with its sensors. A pane puts the map over two
	 * columns with the rest beside it; between the two, the map runs across and
	 * the sections pair up below it. The sport's profile decides the figures,
	 * the links and the map's overlay; Badges and sensors show only when the
	 * activity has some.
	 *
	 * Read-only, as the plugin is: no rename, notes, likes, photo or share, and
	 * Feel and Perceived Effort are shown, never edited. Only the Primary
	 * Benefit's "?" opens a sheet.
	 */
	let { detail, route, units, profile, tiles, go, swap, reach, openSheet, loading = false }: ActivityTabProps & { loading?: boolean } = $props();

	/** This device's day: an activity from another year shows its year on the date line. */
	const today = toIsoDate();
	let view = $derived(overviewView(detail, units, today, profile.overview));
	/** The sport's Overview overlay (the run's pace); an activity without its data draws plain. */
	let opening = $derived(overviewOverlay(profile.map));
	let overlay = $derived(overlayFor(detail, opening, profile.map));
	let legend = $derived(mapLegend(overlay, profile.map));
	let hasEvaluation = $derived(!!(view.benefit || view.feel || view.effort));

	function openChart(chart: string) {
		swap({ ...route, sub: `chart:${chart}` });
	}

	function openBenefit() {
		const benefit = view.benefit;
		if (benefit) openSheet(BENEFIT_SHEET_TITLE, BenefitSheet, { benefit, message: benefitMessage(detail.summary.trainingEffectLabel) });
	}

	/** The records row draws Lucide's trophy, as the phone does; the others their sport's figure. */
	function linkIcon(link: OverviewLink): string {
		return link.icon === "medal" ? "trophy" : sportIcon(link.icon);
	}

	/** A sensor's second line: "4.1 • Battery: OK". */
	function sensorLine(sensor: NonNullable<OverviewView["sensors"]>[number]): string {
		return [sensor.firmware, sensor.battery ? `Battery: ${sensor.battery}` : undefined].filter(Boolean).join(" • ");
	}
</script>

<div class="ov" class:has-map={view.map || view.routeMissing} class:has-badges={!!view.badges}>
	{#if view.map}
		<div class="ov-map">
			<RouteMap {detail} tiles={tiles()} interactive={false} laps={false} {overlay} map={profile.map} onOpen={() => go(activityMapRoute(detail.id, opening))}>
				{#if legend}<div class="ov-legend"><MapLegend {legend} /></div>{/if}
				{#if view.weather}<div class="ov-weather"><WeatherChip chip={view.weather} /></div>{/if}
			</RouteMap>
		</div>
	{:else if view.routeMissing}
		<div class="ov-map is-empty">{loading ? "Loading the map…" : "The map didn’t load."}</div>
	{/if}

	<section class="ov-summary">
		<div class="when">
			<span class="glyph" use:lucide={sportIcon(view.glyph)}></span>
			<span class="when-text">{view.when}</span>
			{#if view.private}
				<span class="lock" use:lucide={"lock"}></span>
				<span class="gc-hidden">Private</span>
			{/if}
		</div>
		<h2 class="title">{view.title}</h2>
		{#if view.notes}<div class="notes">{view.notes}</div>{/if}
		{#if view.distance}
			<div class="distance">
				<span class="distance-value">{view.distance.value}</span>
				<span class="distance-unit">{view.distance.unit}</span>
			</div>
			<div class="sub">Distance</div>
		{:else if view.hero}
			<div class="distance">
				<span class="distance-value">{view.hero.value}</span>
				{#if view.hero.unit}<span class="distance-unit">{view.hero.unit}</span>{/if}
			</div>
			<div class="sub">{view.hero.label}</div>
		{/if}
		{#if view.figures.length}
			<div class="figures">
				{#each view.figures as figure (figure.label)}
					<OverviewStat {figure} onChart={openChart} />
				{/each}
			</div>
		{/if}
	</section>

	{#if hasEvaluation}
		<section class="ov-eval">
			<Evaluation benefit={view.benefit} feel={view.feel} effort={view.effort} onBenefit={openBenefit} />
		</section>
	{/if}

	{#if view.badges}
		<section class="ov-badges">
			<Badges badges={view.badges} />
		</section>
	{/if}

	{#if view.links.length}
		<section class="ov-nav">
			<h3 class="gc-ov-heading">Navigation</h3>
			<div class="links">
				{#each view.links as link (link.label)}
					<button class="link" onclick={() => reach(link.route)}>
						<span class="link-icon" use:lucide={linkIcon(link)}></span>
						<span class="link-label">{link.label}</span>
						<span class="chev" use:lucide={"chevron-right"}></span>
					</button>
				{/each}
			</div>
		</section>
	{/if}

	{#if view.device || view.sensors}
		<section class="ov-device">
			<h3 class="gc-ov-heading">Devices &amp; Apps</h3>
			{#if view.device}
				<div class="device">
					<span class="watch" use:lucide={"watch"}></span>
					<div class="device-text">
						<div class="device-name">{view.device.name}</div>
						{#if view.device.firmware}<div class="sub">{view.device.firmware}</div>{/if}
					</div>
				</div>
			{/if}
			{#if view.sensors}
				{#each view.sensors as sensor, i (i)}
					{@const line = sensorLine(sensor)}
					<div class="device sensor">
						<span class="watch" use:lucide={"radio"}></span>
						<div class="device-text">
							<div class="device-name">{sensor.name}</div>
							{#if line}<div class="sub">{line}</div>{/if}
						</div>
					</div>
				{/each}
			{/if}
		</section>
	{/if}
</div>

<style>
	/* The phone: one column, 16pt in from the edges; the map and the
	   Navigation rows run edge to edge. */
	.ov {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: "map" "summary" "eval" "nav" "device";
		padding: 0 16px 41px;
		color: var(--text-normal);
	}
	.ov-map {
		grid-area: map;
		position: relative;
		height: 206px;
		margin: 0 -16px;
		background: var(--background-secondary);
	}
	/* The map takes the cell's size, which a pane gets from the column beside it. */
	.ov-map > :global(.gc-route-map) {
		position: absolute;
		inset: 0;
		height: auto;
	}
	.ov-map.is-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		color: var(--text-muted);
	}
	/* Over the map: the legend top left, the weather top right. */
	.ov-legend,
	.ov-weather {
		position: absolute;
		top: var(--gc-map-inset, 8px);
	}
	.ov-legend {
		left: var(--gc-map-inset, 8px);
	}
	.ov-weather {
		right: var(--gc-map-inset, 8px);
	}
	.ov-summary {
		grid-area: summary;
		padding-top: 24px;
	}
	.ov.has-map .ov-summary {
		padding-top: 36.2px;
	}
	.ov-eval {
		grid-area: eval;
		padding-top: 32.2px;
	}
	/* Badges sit between Evaluation and Navigation, as on the ride's page; a page
	   without any keeps the grid it had (the areas below change only with them). */
	.ov.has-badges {
		grid-template-areas: "map" "summary" "eval" "badges" "nav" "device";
	}
	/* Badges 23 under the Evaluation cards (the ride's twin, 886:5). */
	.ov-badges {
		grid-area: badges;
		padding-top: 23px;
	}
	.ov-nav {
		grid-area: nav;
		padding-top: 23px;
	}
	.ov-device {
		grid-area: device;
		padding-top: 22.7px;
	}
	.ov :global(.gc-ov-heading) {
		margin: 0;
		font-size: 22px;
		line-height: 28px;
		font-weight: 600;
	}

	.when {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 16px;
		padding-right: 14px;
		font-size: 12px;
		line-height: 16px;
	}
	.when-text {
		flex: 1;
		min-width: 0;
	}
	.glyph,
	.lock {
		display: inline-flex;
		flex: none;
	}
	.glyph {
		color: var(--text-muted);
	}
	.lock {
		color: var(--text-faint);
	}
	.glyph :global(svg),
	.lock :global(svg) {
		width: 16px;
		height: 16px;
	}
	.gc-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.title {
		margin: 23.4px 0 0;
		font-size: 22px;
		line-height: 28px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.notes {
		margin-top: 8px;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.distance {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-top: 18px;
	}
	.distance-value {
		font-size: 34px;
		line-height: 40px;
		font-variant-numeric: tabular-nums;
	}
	.distance-unit {
		font-size: 15px;
		line-height: 19px;
	}
	.sub {
		margin-top: 3.6px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 15px 16px;
		margin-top: 17.7px;
	}

	.links {
		margin: 9.4px -16px 0;
		overflow: hidden;
	}
	.link {
		display: flex;
		align-items: center;
		gap: 13px;
		box-sizing: border-box;
		width: 100%;
		height: 56px;
		margin: 0;
		padding: 0 21px 0 16px;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.link:hover {
		background: var(--background-modifier-hover);
	}
	.link-icon,
	.chev {
		display: inline-flex;
		flex: none;
	}
	.link-icon :global(svg) {
		width: 24px;
		height: 24px;
	}
	.link-label {
		flex: 1;
		min-width: 0;
		font-size: 17px;
		line-height: 22px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chev {
		color: var(--text-faint);
	}
	.chev :global(svg) {
		width: 16px;
		height: 16px;
	}

	.device {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-top: 25.7px;
		padding-left: 4px;
	}
	.watch {
		display: inline-flex;
		flex: none;
		color: var(--text-muted);
	}
	.watch :global(svg) {
		width: 28px;
		height: 28px;
	}
	.device-text {
		min-width: 0;
	}
	.device-name {
		font-size: 17px;
		line-height: 22px;
	}
	.device-text .sub {
		margin-top: 1.2px;
	}
	/* A sensor under the watch, with a generic figure: the plugin loads no product images. Its name 75.3 under the watch's (the twin's Sensor Row). */
	.device.sensor {
		margin-top: 36.1px;
	}

	/* 640pt and up: the map across the top, rounded, and the sections in two columns under it. */
	@container (min-width: 640px) {
		.ov {
			--gc-map-inset: 12px;
			box-sizing: content-box;
			max-width: 1126px;
			margin: 0 auto;
			padding: 24px 32px 32px;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-template-areas: "map map" "summary eval" "nav device";
			column-gap: 32px;
		}
		.ov.has-badges {
			grid-template-areas: "map map" "summary eval" "badges nav" "badges device";
		}
		.ov-badges {
			padding-top: 32px;
		}
		.ov-map {
			height: 360px;
			margin: 0;
			border-radius: 8px;
			overflow: hidden;
		}
		.ov-summary,
		.ov-eval {
			padding-top: 0;
		}
		.ov.has-map .ov-summary,
		.ov.has-map .ov-eval {
			padding-top: 24px;
		}
		.ov-nav,
		.ov-device {
			padding-top: 32px;
		}
		.links {
			margin: 9.4px 0 0;
			border-radius: 8px;
		}
	}

	/* A pane: the map over two of the three 370pt columns, as tall as the third beside it. */
	@container (min-width: 1000px) {
		.ov {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-rows: auto auto auto 1fr;
			grid-template-areas: "map summary" "map eval" "map nav" "map device";
			column-gap: 8px;
		}
		.ov-map {
			height: auto;
			min-height: 480px;
		}
		.ov.has-map .ov-summary {
			padding-top: 2px;
		}
		.ov.has-map .ov-eval {
			padding-top: 32.2px;
		}
		.ov-nav {
			padding-top: 23px;
		}
		.ov-device {
			padding-top: 22.7px;
		}
		.ov.has-badges {
			grid-template-rows: auto auto auto auto 1fr;
			grid-template-areas: "map summary" "map eval" "map badges" "map nav" "map device";
		}
		.ov.has-map .ov-badges {
			padding-top: 23px;
		}
		/* No map: three columns from the top. */
		.ov:not(.has-map) {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			grid-template-rows: auto 1fr;
			grid-template-areas: "summary eval nav" "summary eval device";
			column-gap: 32px;
		}
		.ov.has-badges:not(.has-map) {
			grid-template-rows: auto 1fr;
			grid-template-areas: "summary eval nav" "summary badges device";
		}
		.ov:not(.has-map) .ov-nav {
			padding-top: 0;
		}
	}
</style>
