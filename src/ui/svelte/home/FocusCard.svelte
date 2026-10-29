<script lang="ts">
	import type { FocusId, HomeModel } from "../../../dashboard/home";
	import FocusActivities from "./FocusActivities.svelte";
	import FocusBattery from "./FocusBattery.svelte";
	import FocusReadiness from "./FocusReadiness.svelte";
	import FocusSleep from "./FocusSleep.svelte";
	import FocusSteps from "./FocusSteps.svelte";
	import FocusTraining from "./FocusTraining.svelte";

	/** One In Focus card by its id: Home's carousel and a note's cards both draw them here. */
	interface Props {
		id: FocusId;
		model: HomeModel;
		/** What the card says with nothing for its day; Home's own line when absent. */
		emptyText?: string;
	}

	let { id, model, emptyText }: Props = $props();
</script>

{#if id === "sleep"}<FocusSleep sleep={model.sleep} {emptyText} />
{:else if id === "bodyBattery"}<FocusBattery battery={model.battery} {emptyText} />
{:else if id === "steps"}<FocusSteps steps={model.steps} {emptyText} />
{:else if id === "activities"}<FocusActivities activities={model.activities} />
{:else if id === "readiness"}<FocusReadiness readiness={model.readiness} {emptyText} />
{:else if id === "trainingStatus"}<FocusTraining status={model.trainingStatus} {emptyText} />
{/if}
