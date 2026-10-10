<script lang="ts">
	import type { ActivityTabProps } from "./types";

	/** Gear: built by the Gear phase of the activity page; the foundation leaves it empty. */
	let { detail }: ActivityTabProps = $props();
</script>

<div class="pending">{detail.name}</div>

<style>
	.pending {
		padding: 16px;
		color: var(--text-muted);
	}
</style>
