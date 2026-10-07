<script lang="ts">
	import GroupBand from "../activities/GroupBand.svelte";
	import MenuRow from "../activities/MenuRow.svelte";
	import PageBar from "../home/PageBar.svelte";

	/**
	 * Health Stats, in the app's order. Only Sleep for now; Health Status,
	 * Heart Rate, Stress and the rest join it as their pages are built.
	 */
	let { onBack, openSleep }: { onBack: () => void; openSleep: () => void } = $props();
</script>

<PageBar title="Health Stats" {onBack} />

<div class="list">
	<GroupBand label="Health" hub />
	<div class="rows">
		<MenuRow label="Sleep" onclick={openSleep} />
	</div>
</div>

<style>
	.rows {
		display: flex;
		flex-direction: column;
	}
	@container (min-width: 640px) {
		.list {
			max-width: 560px;
			margin: 0 auto;
			padding-top: 8px;
		}
	}
</style>
