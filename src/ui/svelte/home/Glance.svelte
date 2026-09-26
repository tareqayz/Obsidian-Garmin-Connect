<script lang="ts">
	import type { GlanceId, HomeModel } from "../../../dashboard/home";
	import Arc from "./Arc.svelte";
	import { clamp, clock, scaleX } from "./geometry";
	import HomeCard from "./HomeCard.svelte";
	import Hypnogram from "./Hypnogram.svelte";
	import Stat from "./Stat.svelte";

	/**
	 * One At a Glance stat card. All eight share a frame and differ only in the
	 * body, so they live together rather than as eight near-identical files.
	 */
	interface Props {
		id: GlanceId;
		model: HomeModel;
	}

	let { id, model }: Props = $props();

	const TITLE: Record<GlanceId, [string, string, string]> = {
		heartRate: ["Heart Rate", "heart", "var(--color-red)"],
		intensity: ["Intensity Minutes", "timer", "var(--color-orange)"],
		calories: ["Calories Burned", "flame", "var(--color-green)"],
		stress: ["Stress", "brain", "var(--color-orange)"],
		steps: ["Steps", "footprints", "var(--color-blue)"],
		bodyBattery: ["Body Battery", "battery-charging", "var(--color-blue)"],
		sleep: ["Sleep Score", "moon-star", "var(--color-blue)"],
		hrv: ["HRV Status", "heart-pulse", "var(--color-red)"],
	};

	let empty = $derived(
		{
			heartRate: !model.heartRate,
			intensity: !model.intensity,
			calories: !model.calories,
			stress: !model.stress,
			steps: !model.steps,
			bodyBattery: !model.battery,
			sleep: !model.sleep,
			hrv: !model.hrv,
		}[id],
	);

	/* Heart rate: the day's range, zones drawn over its upper half. */
	let hr = $derived(model.heartRate);
	let hrMin = $derived(Math.min(hr?.min ?? 40, hr?.resting ?? 40, hr?.current ?? 40));
	let hrMax = $derived(Math.max(hr?.max ?? 180, hr?.current ?? 0));
	let hrZones = $derived.by(() => {
		const mid = hrMin + (hrMax - hrMin) / 2;
		const step = (hrMax - mid) / 4;
		return ["var(--color-blue)", "var(--color-green)", "var(--color-orange)", "var(--color-red)"].map((color, i) => ({
			from: mid + step * i,
			to: mid + step * (i + 1),
			color,
		}));
	});

	/* Intensity minutes: this week's running total as a sparkline. */
	let im = $derived(model.intensity);
	let imPath = $derived.by(() => {
		if (!im) return "";
		const top = Math.max(im.goal, im.total, 1);
		return im.week
			.map((d, i) => (d.total === null ? "" : `${i ? "L" : "M"}${(i / 6) * 100} ${30 - (d.total / top) * 28}`))
			.join("");
	});
	let imLast = $derived.by(() => {
		if (!im) return undefined;
		const top = Math.max(im.goal, im.total, 1);
		let at: { x: number; y: number } | undefined;
		im.week.forEach((d, i) => {
			if (d.total !== null) at = { x: (i / 6) * 100, y: 30 - (d.total / top) * 28 };
		});
		return at;
	});

	/* Stress: share of the day in each band. */
	let stress = $derived(model.stress);
	let stressSegments = $derived.by(() => {
		if (!stress) return [];
		const colors = [
			"var(--color-blue)",
			"color-mix(in srgb, var(--color-orange) 60%, transparent)",
			"var(--color-orange)",
			"color-mix(in srgb, var(--color-orange) 70%, var(--color-red))",
		];
		const total = stress.bands.reduce((a, b) => a + b, 0);
		if (!total) return [];
		let at = 0;
		return stress.bands.map((m, i) => {
			const seg = { from: at, to: at + (m / total) * 100, color: colors[i]! };
			at = seg.to;
			return seg;
		});
	});
	let stressBars = $derived(
		(stress?.points ?? [])
			.filter((p): p is [number, number] => p[1] !== null && p[1] > 0)
			.map(([t, v]) => ({ x: scaleX(t, stress!.from, stress!.to, 1000), v, rest: v <= 25 })),
	);

	/* HRV: where the weekly average sits against the baseline. */
	let hrv = $derived(model.hrv);
	let hrvScale = $derived.by(() => {
		if (!hrv || hrv.low === undefined || hrv.high === undefined) return undefined;
		const pad = (hrv.high - hrv.low) * 0.6;
		const min = hrv.low - pad;
		const max = hrv.high + pad;
		const at = (v: number) => clamp(((v - min) / (max - min)) * 100, 0, 100);
		return { low: at(hrv.low), high: at(hrv.high), mark: hrv.weekly !== undefined ? at(hrv.weekly) : undefined, at };
	});
	let hrvTone = $derived(
		hrv?.status === "Balanced" ? "var(--color-green)" : hrv?.status === "Low" || hrv?.status === "Poor" ? "var(--color-red)" : "var(--color-orange)",
	);
</script>

<HomeCard kind="glance" title={TITLE[id][0]} icon={TITLE[id][1]} accent={TITLE[id][2]} {empty}>
	{#if id === "heartRate" && hr}
		<div class="dial">
			<Arc size={104} min={hrMin} max={hrMax} segments={hrZones} marker={hr.current} label={hr.current !== undefined ? String(hr.current) : "—"} />
		</div>
		<div class="bottom"><Stat size="l" value={hr.resting !== undefined ? `${hr.resting} bpm` : undefined} label="Resting" /></div>
	{:else if id === "intensity" && im}
		<div class="dial">
			<Arc size={104} sweep={360} max={im.goal} value={Math.min(im.total, im.goal)} color="var(--color-green)" label={String(im.total)} />
		</div>
		<div class="under">{im.goal}</div>
		<div class="split">
			<div class="spark">
				<svg viewBox="-4 0 108 32" preserveAspectRatio="none" aria-hidden="true">
					<path d={imPath} />
				</svg>
				{#if imLast}<span class="spark-dot" style:left="{((imLast.x + 4) / 108) * 100}%" style:top="{(imLast.y / 32) * 100}%"></span>{/if}
			</div>
			<div class="letters">
				{#each im.week as d}<span class:today={d.today}>{d.label}</span>{/each}
			</div>
		</div>
	{:else if id === "calories" && model.calories}
		{@const c = model.calories}
		<div class="value-xl">{c.total.toLocaleString()}</div>
		<div class="kcal-bar">
			<span class="active" style:flex-grow={c.active ?? 0}></span>
			<span class="rest" style:flex-grow={c.resting ?? 0}></span>
		</div>
		<div class="pair">
			<Stat value={c.active?.toLocaleString()} label="Active" />
			<div class="right"><Stat value={c.resting?.toLocaleString()} label="Resting" /></div>
		</div>
	{:else if id === "stress" && stress}
		<div class="dial">
			<Arc size={104} sweep={360} segments={stressSegments} gap={2} label={stress.average !== undefined ? String(stress.average) : "—"} />
		</div>
		<div class="mini-plot">
			<svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
				{#each stressBars as b}
					<line class="bar" class:rest={b.rest} x1={b.x} x2={b.x} y1="100" y2={100 - b.v} />
				{/each}
			</svg>
		</div>
		<div class="axis"><span>12 AM</span><span>12 AM</span></div>
	{:else if id === "steps" && model.steps}
		{@const s = model.steps}
		<div class="dial">
			<Arc size={104} sweep={360} max={s.goal ?? s.steps} value={Math.min(s.steps, s.goal ?? s.steps)} label={s.steps.toLocaleString()} />
		</div>
		<div class="under">{s.goal?.toLocaleString() ?? ""}</div>
		<div class="split">
			<div class="letters checks">
				{#each s.week as d}
					<span class:today={d.today}>{d.today ? d.label : d.met ? "✓" : d.label}</span>
				{/each}
			</div>
			<div class="foot">Last 7d</div>
		</div>
	{:else if id === "bodyBattery" && model.battery}
		{@const b = model.battery}
		<div class="dial">
			<Arc size={104} value={b.latest} max={100} label={b.latest !== undefined ? String(b.latest) : "—"} />
		</div>
		<div class="bottom stack">
			<Stat value={b.charged !== undefined ? `+${b.charged}` : undefined} label="Charged" />
			<Stat value={b.drained !== undefined ? `-${b.drained}` : undefined} label="Drained" />
		</div>
	{:else if id === "sleep" && model.sleep}
		{@const s = model.sleep}
		<div class="pair top">
			<div class="score">{s.score ?? "—"}</div>
			<div class="right"><Stat size="s" value={s.duration} label="Duration" /></div>
		</div>
		<div class="hypno">
			{#if s.levels.length}<Hypnogram levels={s.levels} height={130} />{/if}
		</div>
		<div class="axis"><span>{clock(s.start)}</span><span>{clock(s.end)}</span></div>
	{:else if id === "hrv" && hrv}
		<div class="status"><span class="dot" style:background={hrvTone}></span>{hrv.status ?? "—"}</div>
		<Stat size="l" value={hrv.weekly !== undefined ? `${hrv.weekly} ms` : undefined} label="7d Avg" />
		{#if hrvScale}
			<div class="baseline">
				<span style:width="{hrvScale.low}%" class="lo"></span>
				<span style:width="{hrvScale.high - hrvScale.low}%" class="ok"></span>
				<span style:flex="1" class="hi"></span>
				{#if hrvScale.mark !== undefined}<i style:left="{hrvScale.mark}%"></i>{/if}
			</div>
		{/if}
		<div class="split nights">
			<div class="band">
				{#if hrvScale}<span style:bottom="{hrvScale.low}%" style:height="{hrvScale.high - hrvScale.low}%"></span>{/if}
				{#each hrv.nights as n, i}
					{#if n !== null && hrvScale}
						<b
							style:left="{(i / 27) * 100}%"
							style:bottom="{hrvScale.at(n)}%"
							style:background={n >= (hrv.low ?? 0) && n <= (hrv.high ?? Infinity) ? "var(--color-green)" : "var(--color-orange)"}
						></b>
					{/if}
				{/each}
			</div>
			<div class="foot">Last 4w</div>
		</div>
	{/if}
</HomeCard>

<style>
	.dial {
		display: flex;
		justify-content: center;
		padding-top: 12px;
	}
	.under {
		text-align: center;
		font-size: 15px;
		margin-top: 8px;
	}
	.bottom {
		margin-top: auto;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.split {
		position: relative;
		margin: auto -12px 0;
		padding: 10px 12px 0;
		border-top: 1px solid var(--background-modifier-border);
	}
	.spark {
		position: relative;
		height: 32px;
	}
	.spark svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.spark path {
		fill: none;
		stroke: var(--text-faint);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}
	.spark-dot {
		position: absolute;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--text-faint);
		transform: translate(-50%, -50%);
	}
	.letters {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 11px;
		margin-top: 4px;
	}
	.letters .today {
		color: var(--text-normal);
		font-weight: 700;
	}
	.checks {
		margin-top: 0;
	}
	.foot {
		color: var(--text-muted);
		font-size: 11px;
		margin-top: 6px;
	}
	.value-xl {
		font-size: 27px;
		line-height: 32px;
		margin: 8px 0 16px;
		font-variant-numeric: tabular-nums;
	}
	.kcal-bar {
		display: flex;
		gap: 3px;
		height: 6px;
		margin-bottom: 12px;
	}
	.kcal-bar span {
		flex-basis: 0;
		border-radius: 3px;
	}
	.kcal-bar .active {
		background: var(--color-red);
		min-width: 6px;
	}
	.kcal-bar .rest {
		background: var(--color-blue);
	}
	.pair {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.right {
		text-align: right;
	}
	.top {
		align-items: flex-start;
	}
	.score {
		font-size: 22px;
		line-height: 26px;
	}
	.hypno {
		flex: 1;
		display: flex;
		align-items: flex-end;
		margin-top: 8px;
	}
	.mini-plot {
		margin-top: auto;
		height: 44px;
	}
	.mini-plot svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.mini-plot .bar {
		stroke: var(--color-orange);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.mini-plot .bar.rest {
		stroke: var(--color-blue);
	}
	.axis {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 11px;
		padding-top: 4px;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 22px;
		line-height: 26px;
		margin: 8px 0 18px;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex: none;
	}
	.baseline {
		position: relative;
		display: flex;
		gap: 2px;
		height: 6px;
		margin: 14px 0 16px;
	}
	.baseline span {
		border-radius: 3px;
	}
	.baseline .lo {
		background: var(--color-orange);
	}
	.baseline .ok {
		background: var(--color-green);
	}
	.baseline .hi {
		background: var(--color-orange);
	}
	.baseline i {
		position: absolute;
		top: -3px;
		width: 3px;
		height: 12px;
		border-radius: 2px;
		background: var(--color-green);
		border: 1px solid var(--background-secondary);
		transform: translateX(-50%);
	}
	.band {
		position: relative;
		height: 40px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--text-faint) 18%, transparent);
	}
	.band span {
		position: absolute;
		left: 0;
		right: 0;
		background: color-mix(in srgb, var(--text-faint) 35%, transparent);
	}
	.band b {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		transform: translate(-50%, 50%);
	}
</style>
