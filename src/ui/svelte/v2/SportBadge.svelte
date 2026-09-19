<script lang="ts">
	import { sportOf, typeLabel } from "../../../dashboard/activity";

	interface Props {
		/** Garmin's typeKey — `running`, `lap_swimming`. */
		type?: string;
	}

	let { type }: Props = $props();

	let sport = $derived(sportOf(type));
	let label = $derived(typeLabel(type));
</script>

<!-- The hue sits in the dot, never in the label: the sport colours are chosen
     to be distinguishable from each other, which is a weaker constraint than
     clearing 4.5:1 against the pill, and they do not clear it. -->
<span class="badge">
	<span class="dot" style:background="var(--v2-sport-{sport})"></span>
	<span class="label">{label}</span>
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 8px;
		border-radius: 999px;
		background: var(--gcd-raised);
		flex: none;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex: none;
	}
	.label {
		font-size: 12px;
		font-weight: 500;
		color: var(--gcd-text);
		white-space: nowrap;
	}
</style>
