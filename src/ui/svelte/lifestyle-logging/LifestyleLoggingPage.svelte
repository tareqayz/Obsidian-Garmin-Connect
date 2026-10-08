<script lang="ts">
	import PageBar from "../home/PageBar.svelte";
	import type { HealthStatPageProps } from "../health/pages";

	/**
	 * Lifestyle Logging, a placeholder until a later version (twin 347:63370,
	 * pane 347:63384): the page bar and one centred line. No data, no index.
	 */
	let { onBack }: HealthStatPageProps = $props();

	const LIFESTYLE_COMING = "Lifestyle Logging is coming in a future version.";
</script>

<div class="lifestyle-logging">
	<PageBar title="Lifestyle Logging" {onBack} />
	<p class="soon">{LIFESTYLE_COMING}</p>
</div>

<style>
	.lifestyle-logging {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}
	.soon {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0 16px 120px;
		min-height: 60vh;
		text-align: center;
		font-size: 16px;
		line-height: 21px;
		color: var(--text-muted);
	}
</style>
