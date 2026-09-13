<script lang="ts">
	import { Accordion } from "bits-ui";

	export interface Panel {
		value: string;
		title: string;
		/** Plain prose — the `info` strings in dashboard/metrics.ts fit as-is. */
		text: string;
	}

	interface Props {
		panels: readonly Panel[];
		/** Open values. Empty means all collapsed. */
		value?: string[];
		onValueChange?: (value: string[]) => void;
	}

	let { panels, value = [], onValueChange }: Props = $props();
</script>

<Accordion.Root type="multiple" {value} {onValueChange} class="gcd-acc">
	{#each panels as panel (panel.value)}
		<Accordion.Item value={panel.value} class="gcd-acc-item">
			<Accordion.Header>
				<Accordion.Trigger class="gcd-acc-trigger">
					<span class="title">{panel.title}</span>
					<span class="caret" aria-hidden="true">⌄</span>
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Content class="gcd-acc-content">
				<p>{panel.text}</p>
			</Accordion.Content>
		</Accordion.Item>
	{/each}
</Accordion.Root>

<style>
	:global(.gcd-acc-item) {
		border-bottom: 1px solid var(--gcd-border);
	}
	:global(.gcd-acc-trigger) {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 2px;
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--gcd-text);
		font-size: var(--font-ui-small, 13px);
		text-align: left;
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-acc-trigger:hover) {
		color: var(--gcd-text);
	}
	:global(.gcd-acc-trigger:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: -2px;
	}
	.title {
		min-width: 0;
	}
	.caret {
		margin-left: auto;
		flex: none;
		color: var(--gcd-muted);
		font-size: 11px;
		transition: transform 140ms ease;
	}
	:global(.gcd-acc-trigger[data-state="open"]) .caret {
		transform: rotate(180deg);
	}
	:global(.gcd-acc-content) p {
		margin: 0;
		padding: 0 2px 12px;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.55;
	}
</style>
