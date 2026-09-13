<script lang="ts">
	import { Tabs } from "bits-ui";
	import type { Snippet } from "svelte";

	export interface Tab {
		value: string;
		label: string;
	}

	interface Props {
		value: string;
		tabs: readonly Tab[];
		/** Rendered inside the selected panel, given that tab's value. */
		panel: Snippet<[string]>;
		onValueChange: (value: string) => void;
	}

	let { value, tabs, panel, onValueChange }: Props = $props();
</script>

<!--
	The shape the "multiple dashboard layouts" item in TODO.md needs: arrow keys
	move between pages, the panel is wired to its trigger by aria, and only the
	selected panel is in the accessibility tree.
-->
<Tabs.Root {value} {onValueChange} class="gcd-tabs">
	<Tabs.List class="gcd-tablist">
		{#each tabs as tab (tab.value)}
			<Tabs.Trigger value={tab.value} class="gcd-tab">{tab.label}</Tabs.Trigger>
		{/each}
	</Tabs.List>
	{#each tabs as tab (tab.value)}
		<Tabs.Content value={tab.value} class="gcd-tabpanel">{@render panel(tab.value)}</Tabs.Content>
	{/each}
</Tabs.Root>

<style>
	:global(.gcd-tablist) {
		display: flex;
		gap: 2px;
		border-bottom: 1px solid var(--gcd-border);
		overflow-x: auto;
		scrollbar-width: none;
	}
	:global(.gcd-tab) {
		flex: none;
		padding: 6px 12px;
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		background: transparent;
		color: var(--gcd-muted);
		font-size: var(--font-ui-small, 13px);
		cursor: pointer;
		box-shadow: none;
		white-space: nowrap;
	}
	:global(.gcd-tab:hover) {
		color: var(--gcd-text);
	}
	:global(.gcd-tab[data-state="active"]) {
		color: var(--gcd-text);
		border-bottom-color: var(--gcd-series);
		font-weight: 600;
	}
	:global(.gcd-tab:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: -2px;
	}
	:global(.gcd-tabpanel) {
		padding-top: 14px;
	}
</style>
