<script lang="ts">
	/** The small capitals over a list: "ACTIVITIES", "RUNNING ACTIVITIES". */
	let { label, hub = false }: { label: string; hub?: boolean } = $props();
</script>

<h3 class="band" class:hub>{label}</h3>

<style>
	.band {
		margin: 0;
		padding: 4px 0 4px 9px;
		font-size: 13px;
		line-height: 16px;
		font-weight: 400;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	/* Over the hub's rows it sits in the page, not in the list. */
	.hub {
		padding: 9px 0 5px 16px;
	}
</style>
