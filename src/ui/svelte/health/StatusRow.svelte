<script lang="ts">
	/**
	 * A Training Status period as a table row (twin 443:735): its status dot
	 * and name, and its dates. Rows alternate from the page's colour, newest
	 * first; with another row selected, this one dims.
	 */
	interface Props {
		status: string;
		dates: string;
		color: string;
		/** "page" or "card": the zebra's two colours. */
		tone?: "page" | "card";
		dimmed?: boolean;
		onclick?: () => void;
	}

	let { status, dates, color, tone = "page", dimmed = false, onclick }: Props = $props();
</script>

<button class="status-row" class:card={tone === "card"} class:dimmed disabled={!onclick} onclick={() => onclick?.()}>
	<span class="dot" style:background={color}></span>
	<span class="status">{status}</span>
	<span class="dates">{dates}</span>
</button>

<style>
	.status-row {
		display: grid;
		grid-template-columns: 32.5px calc(52% - 32.5px) minmax(0, 1fr);
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		height: 50px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: var(--background-primary);
		color: var(--text-normal);
		font: inherit;
		font-size: 15px;
		line-height: 20px;
		text-align: left;
		cursor: pointer;
	}
	.status-row:disabled {
		cursor: default;
		opacity: 1;
	}
	.card {
		background: var(--background-primary-alt);
	}
	.dot {
		width: 8px;
		height: 8px;
		margin-left: 16px;
		border-radius: 50%;
	}
	.status,
	.dates {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dimmed .status,
	.dimmed .dates {
		opacity: 0.5;
	}
	.dimmed .dot {
		opacity: 0.45;
	}
</style>
