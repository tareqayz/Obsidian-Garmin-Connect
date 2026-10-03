<script lang="ts">
	import { lucide } from "../home/lucide";

	/**
	 * A row that opens a page: the hub's sports, More's sections, "View
	 * Personal Records". `icon` makes it More's taller row with a coloured icon.
	 */
	interface Props {
		label: string;
		onclick: () => void;
		icon?: string;
		/** "link" is View Personal Records: full width on a phone, a card in a pane. */
		kind?: "menu" | "more" | "link";
	}

	let { label, onclick, icon, kind = "menu" }: Props = $props();
</script>

<!-- Not class "menu": Obsidian styles that as its context menu, position: fixed. -->
<button class="row" class:more={kind === "more"} class:link={kind === "link"} {onclick}>
	{#if icon}<span class="icon" use:lucide={icon}></span>{/if}
	<span class="label">{label}</span>
	<span class="chev" use:lucide={"chevron-right"}></span>
</button>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 40px;
		margin: 0;
		padding: 0 24px 0 25px;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row:hover {
		background: var(--background-modifier-hover);
	}
	.more {
		height: 56px;
		gap: 13px;
		padding: 0 21px 0 16px;
	}
	.link {
		height: 48px;
		padding: 0 17px 0 8px;
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
	.icon {
		display: inline-flex;
		color: var(--color-blue);
	}
	.icon :global(svg) {
		width: 24px;
		height: 24px;
	}
	.chev {
		display: inline-flex;
		color: var(--text-faint);
	}
	.chev :global(svg) {
		width: 16px;
		height: 16px;
	}
</style>
