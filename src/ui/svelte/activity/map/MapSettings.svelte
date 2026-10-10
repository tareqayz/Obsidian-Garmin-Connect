<script lang="ts">
	import { OVERLAY_LABELS } from "../../../../dashboard/activity-map";
	import type { MapOverlay } from "../../../../dashboard/routes";
	import { lucide } from "../../home/lucide";
	import { obsidianToggle } from "./toggle";

	/**
	 * Map Settings, the sheet behind the full-screen map's layers button: the
	 * provider as plain text (OpenStreetMap only, no Map / Satellite / Terrain),
	 * the Laps switch and the Data Overlay list, one choice at a time.
	 *
	 * Each choice reaches the map at once through `onLaps` / `onOverlay` and the
	 * sheet stays open, as a settings sheet does. It was opened with the map's
	 * choices and keeps its own from there, since a sheet's props don't follow
	 * the page.
	 */
	interface Props {
		/** "OpenStreetMap", or what the map draws without tiles. */
		provider: string;
		laps: boolean;
		overlay: MapOverlay;
		/** The overlays this activity has data for. */
		overlays: readonly MapOverlay[];
		onLaps: (on: boolean) => void;
		onOverlay: (overlay: MapOverlay) => void;
		onClose: () => void;
	}

	let { provider, laps: openedLaps, overlay: openedOverlay, overlays, onLaps, onOverlay, onClose }: Props = $props();

	// svelte-ignore state_referenced_locally
	let laps = $state(openedLaps);
	// svelte-ignore state_referenced_locally
	let overlay = $state(openedOverlay);

	function setLaps(on: boolean) {
		laps = on;
		onLaps(on);
	}

	function choose(next: MapOverlay) {
		if (next === overlay) return;
		overlay = next;
		onOverlay(next);
	}
</script>

<div class="map-settings">
	<header class="head">
		<span class="grabber"></span>
		<h2>Map Settings</h2>
		<button class="close" aria-label="Close" onclick={onClose}><span use:lucide={"x"}></span></button>
	</header>
	<div class="provider">{provider}</div>

	<div class="caps">Distance Markers</div>
	<div class="row">
		<span class="label">Laps</span>
		<div class="switch" use:obsidianToggle={{ value: laps, onChange: setLaps }}></div>
	</div>

	<div class="caps">Data Overlay</div>
	<div class="list" role="radiogroup">
		{#each overlays as choice (choice)}
			<button class="row choice" role="radio" aria-checked={choice === overlay} onclick={() => choose(choice)}>
				<span class="label">{OVERLAY_LABELS[choice]}</span>
				{#if choice === overlay}<span class="check" use:lucide={"check"}></span>{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.map-settings {
		max-height: 85vh;
		overflow-y: auto;
		padding-bottom: 24px;
		background: var(--background-secondary);
		color: var(--text-normal);
	}
	.head {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
		padding: 0 16px;
		background: var(--background-primary);
	}
	/* A sheet's handle, for a finger: a desktop dialog has none. */
	.grabber {
		position: absolute;
		top: 5px;
		left: 50%;
		width: 36px;
		height: 5px;
		margin-left: -18px;
		border-radius: 2.5px;
		background: var(--text-faint);
	}
	@media (hover: hover) and (pointer: fine) {
		.grabber {
			display: none;
		}
	}
	h2 {
		margin: 2px 0 0;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
	}
	button {
		margin: 0;
		height: auto;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.close {
		display: inline-flex;
		padding: 0;
		color: var(--text-muted);
	}
	.close :global(svg) {
		width: 20px;
		height: 20px;
	}
	.provider {
		padding: 22.2px 16px 0;
		font-size: 17px;
		line-height: 22px;
	}
	.caps {
		padding: 29.1px 16px 7px;
		font-size: 12px;
		line-height: 16px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.row + .caps {
		padding-top: 32.6px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		height: 54px;
		padding: 0 16px;
		background: var(--background-primary);
	}
	.label {
		font-size: 17px;
		line-height: 22px;
	}
	.choice:hover {
		background: var(--background-modifier-hover);
	}
	.check {
		display: inline-flex;
		color: var(--text-accent);
	}
	.check :global(svg) {
		width: 18px;
		height: 18px;
	}
</style>
