<script lang="ts">
	import type { TreeGroup } from "../../../../dashboard/all-activities";
	import { sportIcon } from "../../../sport-icons";
	import { lucide } from "../../home/lucide";

	/**
	 * The Activities section (filters/02–13): the groups, each with its figure,
	 * opening on "All <Group>" and its sub-types; the first five, then "Show
	 * All" for the rest, which turns into "Show less". A ticked row carries an
	 * accent check (Inferred). It opens on Show All when a tick is behind it.
	 */
	interface Props {
		groups: TreeGroup[];
		ticked: readonly number[];
		onToggle: (group: TreeGroup, id: number) => void;
	}

	let { groups, ticked, onToggle }: Props = $props();

	// svelte-ignore state_referenced_locally
	let showAll = $state(groups.some((g) => !g.shown && g.types.some((t) => ticked.includes(t.id))));
	let opened = $state<Record<number, boolean>>({});

	let visible = $derived(showAll ? groups : groups.filter((g) => g.shown));
</script>

<div class="tree">
	{#each visible as group (group.id)}
		{@const open = opened[group.id] === true}
		<button class="group" aria-expanded={open} onclick={() => (opened[group.id] = !open)}>
			<span class="glyph" use:lucide={sportIcon(group.glyph)}></span>
			<span class="label">{group.name}</span>
			<span class="chev" use:lucide={open ? "chevron-up" : "chevron-down"}></span>
		</button>
		{#if open}
			{#each group.types as type (type.id)}
				{@const on = ticked.includes(type.id)}
				<button class="type" aria-pressed={on} onclick={() => onToggle(group, type.id)}>
					<span class="label">{type.label}</span>
					{#if on}<span class="check" use:lucide={"check"}></span>{/if}
				</button>
			{/each}
		{/if}
	{/each}
	<button class="more" onclick={() => (showAll = !showAll)}>{showAll ? "Show less" : "Show All"}</button>
</div>

<style>
	button {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 14px;
		box-sizing: border-box;
		width: 100%;
		height: 56px;
		margin: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	button:hover {
		background: var(--background-modifier-hover);
	}
	/* A group: its figure 18 in, its name 52 in. */
	.group {
		padding: 0 16px 0 18px;
	}
	/* A type: no figure, its name 48 in. */
	.type {
		padding: 0 16px 0 48px;
	}
	.more {
		padding: 0 16px;
		color: var(--text-accent);
	}
	.label {
		flex: 1;
		min-width: 0;
		font-size: 17px;
		line-height: 22px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.more {
		font-size: 17px;
		line-height: 22px;
	}
	.glyph,
	.chev,
	.check {
		display: inline-flex;
		flex: none;
	}
	.glyph :global(svg) {
		width: 20px;
		height: 20px;
	}
	.chev {
		color: var(--text-muted);
	}
	.chev :global(svg) {
		width: 18px;
		height: 18px;
	}
	.check {
		color: var(--text-accent);
	}
	.check :global(svg) {
		width: 20px;
		height: 20px;
	}
</style>
