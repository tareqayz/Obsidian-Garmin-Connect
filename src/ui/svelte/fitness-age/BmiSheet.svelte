<script lang="ts">
	import type { BmiSheet } from "../../../dashboard/fitness-age-pages";
	import AgeTrack from "./AgeTrack.svelte";

	/**
	 * The BMI sheet the Reduce BMI card opens: a sheet from the bottom on the
	 * phone, a centred dialog in a pane (twin 346:65595 / 346:65632). Copy
	 * verbatim from the phone (bmi/IMG_0824–0825); its Add Weight button is
	 * left out: the plugin cannot log a weight.
	 */
	let { sheet, pane, onclose }: { sheet: BmiSheet; pane: boolean; onclose: () => void } = $props();

	function onkeydown(event: KeyboardEvent) {
		if (event.key === "Escape") onclose();
	}
</script>

<svelte:window {onkeydown} />

<div class="fa-scrim" role="presentation" onclick={onclose}></div>
<div class="fa-sheet" class:dialog={pane} role="dialog" aria-modal="true" aria-labelledby="fa-bmi-title">
	<div class="bar">
		<button class="done" onclick={onclose}>Done</button>
		<strong id="fa-bmi-title">BMI</strong>
		<span></span>
	</div>
	<div class="content">
		<AgeTrack main={{ label: "Avg BMI", value: sheet.average, at: sheet.track.average }} other={{ label: "Target", value: sheet.target, at: sheet.track.target }} />
		<p>{sheet.copy}</p>
		<p class="muted">To help achieve this goal:</p>
		<ul>
			<li>Focus on both diet and exercise. Cutting calories has been shown to be most effective for weight loss, but both regular exercise and calorie maintenance are important for keeping the weight off.</li>
		</ul>
		<p><a href="https://www.mayoclinic.org/healthy-lifestyle/weight-loss/in-depth/weight-loss/art-20047752">Learn more from Mayo Clinic</a></p>
		<h3>Body Mass Index</h3>
		<p>Body mass index (BMI) is a method of measuring your weight in relationship to your height. It's used to calculate Fitness Age if you don't have a body fat percentage available in Garmin Connect.</p>
		<p>Garmin Connect estimates your BMI based on the weight and height that you enter manually. If you own a Garmin Index Smart Scale, it calculates a BMI for you.</p>
		<p>Keep in mind that BMI may not be a useful metric for everyone. Highly trained and muscular athletes, for example, may report high BMI numbers even though they are very fit.</p>
		<p><a href="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight">Learn More from the World Health Organization</a></p>
	</div>
</div>

<style>
	.fa-scrim {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: rgba(0, 0, 0, 0.35);
	}
	.fa-sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		top: 48px;
		z-index: 31;
		display: flex;
		flex-direction: column;
		border-radius: 12px 12px 0 0;
		background: var(--background-primary);
		color: var(--text-normal);
		box-shadow: var(--shadow-l);
	}
	.fa-sheet.dialog {
		top: 50%;
		left: 50%;
		right: auto;
		bottom: auto;
		width: min(560px, calc(100% - 32px));
		max-height: min(720px, calc(100% - 64px));
		transform: translate(-50%, -50%);
		border-radius: 12px;
	}
	.bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: 52px;
		padding: 0 16px;
	}
	.bar strong {
		font-size: 17px;
	}
	.done {
		justify-self: start;
		margin: 0;
		padding: 0;
		height: auto;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 17px;
		font-weight: 600;
		color: var(--interactive-accent);
		cursor: pointer;
	}
	.content {
		overflow-y: auto;
		padding: 24px 16px 32px;
		font-size: 15px;
		line-height: 21px;
	}
	.content p {
		margin: 16px 0 0;
	}
	.content :global(.fa-track) {
		margin-bottom: 16px;
	}
	.muted {
		color: var(--text-muted);
	}
	ul {
		margin: 12px 0 0;
		padding-left: 20px;
	}
	h3 {
		margin: 24px 0 0;
		font-size: 19px;
		font-weight: 700;
	}
	a {
		color: var(--interactive-accent);
		text-decoration: none;
	}
</style>
