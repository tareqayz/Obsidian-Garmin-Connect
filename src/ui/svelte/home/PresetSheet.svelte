<script lang="ts">
	import { PRESETS, type PresetId } from "../../../dashboard/home";
	import { lucide } from "./lucide";

	/** Garmin's Reset Home sheet: pick one of the three presets. */
	interface Props {
		current: PresetId;
		onPick: (id: PresetId) => void;
		onCancel: () => void;
	}

	let { current, onPick, onCancel }: Props = $props();

	// svelte-ignore state_referenced_locally
	let picked = $state(current);

	const ICON: Record<string, string> = {
		Sleep: "moon-star",
		"Body Battery": "battery-charging",
		Steps: "footprints",
		"Exercise trends": "chart-column",
		"Training readiness": "gauge",
		"Training status": "trending-up",
	};
</script>

<div class="sheet" role="dialog" aria-label="Reset Home">
	<div class="bar">
		<button class="link" onclick={onCancel}>Cancel</button>
		<strong>Reset Home</strong>
		<button class="link" onclick={() => onPick(picked)}>Save</button>
	</div>
	<p>Select a new preset option for your home screen. This will reset any prior changes you have made.</p>
	{#each PRESETS as p}
		<button class="option" class:on={picked === p.id} onclick={() => (picked = p.id)}>
			<span class="name">{p.name}</span>
			{#if picked === p.id}<span class="check" use:lucide={"check"}></span>{/if}
			<span class="highlights">
				{#each p.highlights as h}
					<span><span class="hi-icon" use:lucide={ICON[h] ?? "circle"}></span>{h}</span>
				{/each}
			</span>
			<span class="blurb">{p.blurb}</span>
		</button>
	{/each}
</div>

<style>
	.sheet {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 520px;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 17px;
		padding-bottom: 8px;
	}
	.link {
		color: var(--text-accent);
		background: none;
		box-shadow: none;
		font-size: 15px;
	}
	p {
		font-size: 16px;
		line-height: 21px;
		margin: 0 0 8px;
	}
	.option {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		height: auto;
		padding: 16px;
		text-align: left;
		white-space: normal;
		border-radius: var(--radius-m, 8px);
		background: var(--background-secondary);
		box-shadow: none;
		border: 1px solid transparent;
		cursor: pointer;
	}
	.option.on {
		border-color: var(--interactive-accent);
	}
	.name {
		font-size: 20px;
		line-height: 24px;
		color: var(--text-normal);
	}
	.check {
		position: absolute;
		right: 16px;
		top: 16px;
		color: var(--text-accent);
	}
	.highlights {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		font-size: 14px;
		color: var(--text-normal);
	}
	.highlights > span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.hi-icon {
		display: inline-flex;
	}
	.hi-icon :global(svg) {
		width: 16px;
		height: 16px;
	}
	.blurb {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
</style>
