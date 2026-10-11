<script lang="ts">
	/**
	 * Garmin's empty state inside a chart: one grey line, centred in the box
	 * it is given ("No data available", HRV Stress), or set at its top
	 * ("There is no 3 month power data for this period", Cycling Power Curve).
	 * It fills its parent, which a chart's plot box positions.
	 */
	let { text, placement = "center" }: { text: string; placement?: "center" | "top" } = $props();
</script>

<div class="stat-empty" class:top={placement === "top"}>{text}</div>

<style>
	.stat-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 16px;
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
		text-align: center;
		pointer-events: none;
	}
	.top {
		align-items: flex-start;
	}
</style>
