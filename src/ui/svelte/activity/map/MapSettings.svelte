<script lang="ts">
	import { lucide } from "../../home/lucide";
	import { obsidianToggle } from "./toggle";

	/**
	 * Map Settings, the sheet behind the full-screen map's layers button: the
	 * provider as plain text (OpenStreetMap only, no Map / Satellite / Terrain),
	 * the Laps switch and the Data Overlay list, one choice at a time. The
	 * sheet's title and close button are the modal's.
	 *
	 * Each choice reaches the map at once through `onLaps` / `onOverlay` and the
	 * sheet stays open, as a settings sheet does. It was opened with the map's
	 * choices and keeps its own from there, since a sheet's props don't follow
	 * the page. The overlays and their words are the sport's; a sport that
	 * offers only "None" (open water's plain red route) has no Data Overlay
	 * section, and the sheet hugs the rest (Inferred: not shot).
	 */
	interface Props {
		/** "OpenStreetMap", or what the map draws without tiles. */
		provider: string;
		laps: boolean;
		overlay: string;
		/** The overlays this activity has data for. */
		overlays: readonly string[];
		/** Each overlay's row, as the sport words it ("Pace", "Run/Walk"). */
		labels: Readonly<Record<string, string>>;
		onLaps: (on: boolean) => void;
		onOverlay: (overlay: string) => void;
		onClose: () => void;
	}

	let { provider, laps: openedLaps, overlay: openedOverlay, overlays, labels, onLaps, onOverlay }: Props = $props();

	// svelte-ignore state_referenced_locally
	let laps = $state(openedLaps);
	// svelte-ignore state_referenced_locally
	let overlay = $state(openedOverlay);

	function setLaps(on: boolean) {
		laps = on;
		onLaps(on);
	}

	function choose(next: string) {
		if (next === overlay) return;
		overlay = next;
		onOverlay(next);
	}
</script>

<div class="map-settings">
	<div class="provider">{provider}</div>

	<div class="caps">Distance Markers</div>
	<div class="row">
		<span class="label">Laps</span>
		<div class="switch" use:obsidianToggle={{ value: laps, onChange: setLaps }}></div>
	</div>

	{#if overlays.length > 1}
		<div class="caps">Data Overlay</div>
		<div class="list" role="radiogroup">
			{#each overlays as choice (choice)}
				<button class="row choice" role="radio" aria-checked={choice === overlay} onclick={() => choose(choice)}>
					<span class="label">{labels[choice] ?? choice}</span>
					{#if choice === overlay}<span class="check" use:lucide={"check"}></span>{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Its end clears a phone's home indicator. */
	.map-settings {
		padding-bottom: calc(24px + var(--safe-area-inset-bottom, 0px));
		background: var(--background-secondary);
		color: var(--text-normal);
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
