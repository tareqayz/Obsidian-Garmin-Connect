<script lang="ts">
	export interface TipRow {
		label: string;
		value: string;
		color?: string;
	}

	interface Props {
		visible: boolean;
		x: number;
		y: number;
		hostWidth: number;
		title: string;
		rows: TipRow[];
	}

	let { visible, x, y, hostWidth, title, rows }: Props = $props();

	let tipWidth = $state(0);
	let tipHeight = $state(0);

	// Clamped so the readout never hangs off the card at either edge.
	let left = $derived(
		Math.min(Math.max(4, x - tipWidth / 2), Math.max(4, hostWidth - tipWidth - 4)),
	);
	let top = $derived(Math.max(4, y - tipHeight - 10));
</script>

{#if visible}
	<div
		class="tip"
		style:left="{left}px"
		style:top="{top}px"
		bind:clientWidth={tipWidth}
		bind:clientHeight={tipHeight}
		role="status"
	>
		<div class="title">{title}</div>
		{#each rows as row (row.label)}
			<div class="row">
				<!-- A short stroke keys the series; a filled box would be data-weight ink. -->
				<span class="key" style:background={row.color ?? "var(--gcd-series)"}></span>
				<!-- Value leads, label follows: the reader has the series and wants the number. -->
				<span class="value">{row.value}</span>
				<span class="label">{row.label}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.tip {
		position: absolute;
		pointer-events: none;
		z-index: 20;
		background: var(--gcd-raised);
		border: 1px solid var(--gcd-border);
		border-radius: 6px;
		padding: 6px 9px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
		white-space: nowrap;
	}
	.title {
		color: var(--gcd-muted);
		font-size: 11px;
		margin-bottom: 2px;
	}
	.row {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.key {
		width: 10px;
		height: 2px;
		border-radius: 1px;
		flex: none;
	}
	.value {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.label {
		color: var(--gcd-muted);
		font-size: 11px;
	}
</style>
