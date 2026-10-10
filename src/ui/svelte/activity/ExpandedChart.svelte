<script lang="ts">
	import type { ActivityTabProps } from "./types";

	/**
	 * The landscape chart, as a page state inside the view: a metric with an
	 * optional overlay on a second axis, the overlay chips and the axis swap.
	 * Opened from a chart badge (`route.sub = "chart:<metric>[:<overlay>[:swap]]"`).
	 * The Charts build fills it in; this is the foundation's placeholder.
	 */
	let { detail, route, onClose }: ActivityTabProps & { onClose: () => void } = $props();
</script>

<div class="expanded">
	<button class="close" onclick={onClose}>Close</button>
	<div class="pending">{detail.name} · {route.sub}</div>
</div>

<style>
	.expanded {
		padding: 16px;
	}
	.close {
		margin: 0;
		border: none;
		box-shadow: none;
		background: none;
		color: var(--text-accent);
		font: inherit;
		cursor: pointer;
	}
	.pending {
		margin-top: 16px;
		color: var(--text-muted);
	}
</style>
