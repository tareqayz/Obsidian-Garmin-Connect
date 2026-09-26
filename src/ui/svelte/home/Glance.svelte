<script lang="ts">
	import { readinessDial, statFor, type GlanceId, type Trend } from "../../../dashboard/glance";
	import type { HomeModel } from "../../../dashboard/home";
	import Arc from "./Arc.svelte";
	import GlanceGauge from "./GlanceGauge.svelte";
	import GlancePrompt from "./GlancePrompt.svelte";
	import { clamp, clock, scaleX } from "./geometry";
	import HomeCard from "./HomeCard.svelte";
	import Hypnogram from "./Hypnogram.svelte";
	import Stat from "./Stat.svelte";
	import { lucide } from "./lucide";
	import { STATUS_TONE, toneColor } from "./tones";

	/**
	 * One At a Glance stat card. All 36 share a frame and differ only in the
	 * body, so they live together; the banded dials and the prompt cards,
	 * which a dozen of them share, have components of their own.
	 */
	interface Props {
		id: GlanceId;
		model: HomeModel;
	}

	let { id, model }: Props = $props();

	let stat = $derived(statFor(id));
	let g = $derived(model.glance);

	/** Garmin's pages for the prompts that offer to do something. Not checked against the site yet. */
	const GARMIN = "https://connect.garmin.com/modern";

	/* Stats with nothing to show get Garmin's own prompt card instead. */
	let prompt = $derived.by((): { title?: string; body: string; link?: { label: string; href: string } } | null => {
		switch (id) {
			case "altitude":
				return g.altitude
					? null
					: {
							body: `Train at ${g.units === "imperial" ? "2,625 feet" : "800 meters"} or higher to see how you are acclimating.`,
						};
			case "bloodPressure":
				return {
					body: "Take a blood pressure reading or enter one manually.",
					link: { label: "Add a Reading", href: `${GARMIN}/blood-pressure` },
				};
			case "criticalSwimSpeed":
				return { body: "Perform a CSS workout using a compatible Garmin device." };
			case "cyclingVo2":
				return g.cyclingVo2 ? null : { body: "Track rides with HR and power data to reveal your current VO₂ max." };
			case "healthStatus":
				return g.health && !g.health.onboarding ? null : { body: "Wear your device while sleeping for about 3 weeks." };
			case "hydration":
				return {
					body: "Start tracking the liquid you drink.",
					link: { label: "Track Hydration", href: `${GARMIN}/hydration` },
				};
			case "lifestyle":
				return { body: "Set up lifestyle logging to track daily behaviors." };
			case "nutrition":
				return {
					body: "Log foods daily to track your calories, macros and more.",
					link: { label: "Start your Free Trial", href: `${GARMIN}/nutrition` },
				};
			case "pulseOx":
				return g.pulseOx ? null : { title: "Pulse Ox Acclimation", body: "No readings today." };
			default:
				return null;
		}
	});

	let empty = $derived(
		({
			heartRate: !g.heartRate,
			intensity: !g.intensity,
			calories: !g.calories,
			stress: !g.stress,
			steps: !model.steps,
			bodyBattery: !model.battery,
			sleep: !model.sleep,
			hrv: !g.hrv,
			cyclingAbility: !g.cyclingAbility,
			cyclingFtp: !g.cyclingFtp,
			endurance: !g.endurance,
			fitnessAge: !g.fitnessAge,
			floors: !g.floors,
			heat: !g.heat,
			hillScore: !g.hillScore,
			lastActivity: !g.lastActivity,
			loadFocus: !g.loadFocus,
			respiration: !g.respiration,
			runningEconomy: !g.runningEconomy,
			lactateThreshold: !g.lactate,
			runningTolerance: !g.tolerance,
			trainingLoad: !g.trainingLoad,
			readiness: !model.readiness,
			trainingStatus: !model.trainingStatus,
			vo2max: !g.vo2max,
			weight: !g.weight,
			xcSkiFtp: !g.xcSkiFtp,
		} as Partial<Record<GlanceId, boolean>>)[id] ?? false,
	);

	/* Account-level numbers are not per day, so "for today" would be wrong. */
	let emptyText = $derived(
		(
			{
				cyclingAbility: "No cycling ability synced yet.",
				cyclingFtp: "No cycling FTP synced yet.",
				runningEconomy: "No running economy synced yet.",
				lactateThreshold: "No lactate threshold synced yet.",
				xcSkiFtp: "No XC skiing FTP synced yet.",
				weight: "No weigh-ins synced yet.",
				lastActivity: "No activities synced yet.",
				vo2max: "No VO₂ Max in the last 4 weeks.",
			} as Partial<Record<GlanceId, string>>
		)[id],
	);

	const ARROW: Record<Trend, string> = { up: "arrow-up", down: "arrow-down", flat: "arrow-right" };

	/* Heart rate: the day's range, zones drawn over its upper half. */
	let hr = $derived(g.heartRate);
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
	let im = $derived(g.intensity);
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
	let stress = $derived(g.stress);
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
	let hrv = $derived(g.hrv);
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

	const brpm = (v: number | undefined) => (v === undefined ? undefined : `${Math.round(v)} brpm`);
	const pct = (v: number | undefined) => (v === undefined ? undefined : `${Math.round(v)}%`);
</script>

<!-- The steps and floors card: a goal ring, the goal under it, and a week of ticks. -->
{#snippet goalRing(value: number, goal: number | undefined, week: Array<{ label: string; met: boolean | null; today: boolean }>)}
	<div class="dial">
		<Arc size={104} sweep={360} max={goal ?? value} value={Math.min(value, goal ?? value)} label={value.toLocaleString()} />
	</div>
	<div class="under">{goal?.toLocaleString() ?? ""}</div>
	<div class="split">
		<div class="letters checks">
			{#each week as d}
				<span class:today={d.today}>{d.today ? d.label : d.met ? "✓" : d.label}</span>
			{/each}
		</div>
		<div class="foot">Last 7d</div>
	</div>
{/snippet}

{#snippet readings(r: { latest?: number; average?: number; sleep?: number }, format: (v: number | undefined) => string | undefined, average: string)}
	<div class="value-xl">{format(r.latest) ?? "—"}</div>
	<div class="readings">
		<Stat size="l" value={format(r.average)} label={average} />
		<Stat size="l" value={format(r.sleep)} label="Sleep Avg" />
	</div>
{/snippet}

{#snippet weighIn()}
	<a class="add" href="{GARMIN}/weight" aria-label="Add a weigh-in in Garmin Connect" use:lucide={"circle-plus"}></a>
{/snippet}

{#if prompt}
	<GlancePrompt icon={stat.icon} color={toneColor(stat.tone)} title={prompt.title ?? stat.title} body={prompt.body} link={prompt.link} />
{:else}
	<HomeCard
		kind="glance"
		title={stat.title}
		icon={stat.icon}
		accent={toneColor(stat.tone)}
		{empty}
		{emptyText}
		aside={id === "weight" ? weighIn : undefined}
	>
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
		{:else if id === "calories" && g.calories}
			{@const c = g.calories}
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
			{@render goalRing(model.steps.steps, model.steps.goal, model.steps.week)}
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
		{:else if id === "endurance" && g.endurance}
			<GlanceGauge gauge={g.endurance} big trend={g.endurance.trend} />
		{:else if id === "hillScore" && g.hillScore}
			<GlanceGauge gauge={g.hillScore} trend={g.hillScore.trend} />
		{:else if id === "vo2max" && g.vo2max}
			<GlanceGauge gauge={g.vo2max} />
		{:else if id === "cyclingVo2" && g.cyclingVo2}
			<GlanceGauge gauge={g.cyclingVo2} />
		{:else if id === "cyclingFtp" && g.cyclingFtp}
			<GlanceGauge gauge={g.cyclingFtp} />
		{:else if id === "xcSkiFtp" && g.xcSkiFtp}
			<GlanceGauge gauge={g.xcSkiFtp} />
		{:else if id === "runningEconomy" && g.runningEconomy}
			<GlanceGauge gauge={g.runningEconomy} />
		{:else if id === "readiness" && model.readiness}
			{@const r = model.readiness}
			<GlanceGauge gauge={{ ...readinessDial(r.score), label: r.level }} caption={r.message} />
		{:else if id === "fitnessAge" && g.fitnessAge}
			{@const f = g.fitnessAge}
			<div class="value-l lead">{f.age}</div>
			<div class="after-lead"><Stat size="l" value={f.actual} label="Your Age" /></div>
			{#if f.updated}<div class="meta bottom">Updated {f.updated}</div>{/if}
		{:else if id === "floors" && g.floors}
			{@render goalRing(g.floors.floors, g.floors.goal, g.floors.week)}
		{:else if id === "runningTolerance" && g.tolerance}
			{@const t = g.tolerance}
			<div class="dial">
				<Arc size={104} sweep={360} max={1} value={t.share} label={t.load} />
			</div>
			<div class="under">Acute Impact Load</div>
			<div class="bottom"><Stat size="l" value={t.tolerance} label="Weekly Tolerance" /></div>
		{:else if id === "trainingStatus" && model.trainingStatus}
			{@const t = model.trainingStatus}
			<span class="badge-l" style:background={STATUS_TONE[t.tone]} use:lucide={"trending-up"}></span>
			<div class="value-l after-badge">{t.status}</div>
			{#if t.since}<div class="meta since">Since {t.since}</div>{/if}
			<div class="split">
				<div class="strip">
					{#each t.history as h}<span style:flex-grow={h.days} style:background={STATUS_TONE[h.tone]}></span>{/each}
				</div>
				<div class="foot">Last 4w</div>
			</div>
		{:else if (id === "heat" && g.heat) || (id === "altitude" && g.altitude)}
			{@const a = (id === "heat" ? g.heat : g.altitude)!}
			{#if a.trend}<span class="badge-l neutral" use:lucide={ARROW[a.trend]}></span>{/if}
			<div class="value-xl after-badge">{a.value}</div>
			<div class="acclimation">{a.message}</div>
			<div class="meta bottom">Updated {a.updated}</div>
		{:else if id === "loadFocus" && g.loadFocus}
			{@const lf = g.loadFocus}
			<div class="value-l lead">{lf.focus ?? "—"}</div>
			<div class="lf bottom">
				<div class="lf-rows">
					{#each lf.bars as b}
						<span class="lf-value">{b.value.toLocaleString()}</span>
						<span class="lf-track">
							<span class="lf-bar" style:width="{(b.value / lf.scale) * 100}%" style:background={toneColor(b.tone)}></span>
							{#if b.min !== undefined && b.max !== undefined}
								<span class="lf-range" style:left="{(b.min / lf.scale) * 100}%" style:width="{((b.max - b.min) / lf.scale) * 100}%"></span>
							{/if}
						</span>
					{/each}
				</div>
				<div class="lf-legend"><span class="lf-range key"></span>Optimal Range</div>
				<div class="meta range">{lf.range}</div>
			</div>
		{:else if id === "cyclingAbility" && g.cyclingAbility}
			<div class="ability">
				{#each g.cyclingAbility.bars as b}
					<div>
						<div class="ability-label">{b.label}</div>
						<div class="ability-track">
							<span style:width="{Math.max(b.value, 3)}%" style:background={toneColor(b.tone)}></span>
						</div>
					</div>
				{/each}
			</div>
		{:else if id === "trainingLoad" && g.trainingLoad}
			{@const t = g.trainingLoad}
			<div class="value-l lead">{t.status ?? "—"}</div>
			<div class="readings">
				<Stat
					size="l"
					value={t.acute !== undefined && t.chronic !== undefined ? `${t.acute}/${t.chronic}` : undefined}
					label="Acute/Chronic Load"
				/>
				<Stat size="l" value={t.ratio?.toFixed(1)} label="Load Ratio" />
			</div>
		{:else if id === "weight" && g.weight}
			{@const w = g.weight}
			<div class="value-xl tight">{w.value}</div>
			<div class="faint-line">--</div>
			<div class="weights">
				<Stat size="l" value={w.change} label="Change" />
				<Stat size="l" value={w.bmi} label="BMI" />
			</div>
			<div class="meta bottom">Updated {w.updated}</div>
		{:else if id === "lactateThreshold" && g.lactate}
			{@const l = g.lactate}
			<div class="lactate">
				{#each l.stats as s}
					<div>
						<div class="lactate-value">{s.value}</div>
						<div class="lactate-label"><i class="shape {s.shape}" style:background={toneColor(s.tone)}></i>{s.label}</div>
					</div>
				{/each}
			</div>
			{#if l.updated}<div class="meta bottom">Updated {l.updated}</div>{/if}
		{:else if id === "lastActivity" && g.lastActivity}
			{@const a = g.lastActivity}
			<span class="badge-m" style:background={toneColor(a.tone)} title={a.name} use:lucide={a.icon}></span>
			<div class="activity">
				{#each a.stats as s}<Stat size="l" value={s.value} label={s.label} />{/each}
			</div>
		{:else if id === "respiration" && g.respiration}
			{@render readings(g.respiration, brpm, "Awake Avg")}
		{:else if id === "pulseOx" && g.pulseOx}
			{@render readings(g.pulseOx, pct, "Avg")}
		{:else if id === "healthStatus" && g.health}
			{@const h = g.health}
			<div class="health-status">
				<span class="dot" style:background={h.outside ? "var(--color-orange)" : "var(--color-green)"}></span>
				{h.outside ? `${h.outside} Outside Range` : "All in Range"}
			</div>
			<div class="health">
				{#each h.metrics as m}
					<div class="health-row"><span>{m.label}</span><span class:off={!m.ok}>{m.status}</span></div>
				{/each}
			</div>
		{/if}
	</HomeCard>
{/if}

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

	/* The cards added with See All. */
	.value-l {
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
	}
	.lead {
		margin-top: 8px;
	}
	.after-lead {
		margin-top: 40px;
	}
	.readings {
		display: flex;
		flex-direction: column;
		gap: 22px;
		margin-top: 14px;
	}
	.tight {
		margin-bottom: 0;
	}
	.faint-line {
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
	}
	.weights {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 2px;
	}
	.badge-l,
	.badge-m {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		align-self: flex-start;
		border-radius: 50%;
		color: var(--text-on-accent);
	}
	.badge-l {
		width: 40px;
		height: 40px;
		margin-top: 6px;
	}
	.badge-l :global(svg) {
		width: 20px;
		height: 20px;
	}
	.badge-l.neutral {
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}
	.badge-m {
		width: 35px;
		height: 35px;
		margin: 18px 0 0 2px;
	}
	.badge-m :global(svg) {
		width: 18px;
		height: 18px;
	}
	.after-badge {
		margin-top: 24px;
	}
	/* Not ".message": Obsidian pads that class globally. */
	.acclimation {
		color: var(--text-muted);
		font-size: 15px;
		line-height: 20px;
		margin-top: 2px;
	}
	.activity {
		display: flex;
		flex-direction: column;
		gap: 9px;
		margin-top: 6px;
	}
	.strip {
		display: flex;
		gap: 1.5px;
		height: 12px;
		border-radius: 6px;
		overflow: hidden;
		margin-top: 6px;
	}
	.strip span {
		flex-basis: 0;
	}
	.lf {
		display: flex;
		flex-direction: column;
	}
	/* One number column for all three rows, as wide as the widest number, so
	   the bars start together even once a load passes 1,000. */
	.lf-rows {
		display: grid;
		grid-template-columns: minmax(40px, auto) 1fr;
		align-items: center;
		column-gap: 6px;
		row-gap: 0;
	}
	.lf-value {
		font-size: 17px;
		line-height: 21px;
		font-variant-numeric: tabular-nums;
	}
	.lf-track {
		position: relative;
		height: 8px;
	}
	.lf-bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		min-width: 8px;
		border-radius: 4px;
	}
	.lf-range {
		position: absolute;
		top: 0;
		bottom: 0;
		box-sizing: border-box;
		border: 1px dashed var(--text-normal);
		border-radius: 4px;
	}
	.lf-legend {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
		margin-top: 4px;
	}
	.lf-range.key {
		position: static;
		display: inline-block;
		width: 22px;
		height: 8px;
	}
	.meta {
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
	}
	.since {
		margin-top: 30px;
	}
	.range {
		margin-top: 25px;
	}
	.ability {
		display: flex;
		flex-direction: column;
		gap: 26px;
		margin-top: 12px;
	}
	.ability-label {
		font-size: 17px;
		line-height: 22px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ability-track {
		width: 88%;
		height: 6px;
		margin-top: 2px;
		border-radius: 3px;
		background: var(--background-modifier-border);
		overflow: hidden;
	}
	.ability-track span {
		display: block;
		height: 100%;
		border-radius: 3px;
	}
	.lactate {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.lactate-value {
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.lactate-label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
	}
	.shape {
		flex: none;
		width: 10px;
		height: 10px;
	}
	.shape.dot {
		border-radius: 50%;
	}
	.shape.triangle {
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}
	.shape.diamond {
		clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
	}
	.add {
		display: inline-flex;
		color: var(--text-accent);
	}
	.add :global(svg) {
		width: 22px;
		height: 22px;
	}
	.health-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 17px;
		line-height: 22px;
		margin-top: 8px;
	}
	.health {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 20px;
	}
	.health-row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
		line-height: 16px;
	}
	.health-row span:first-child {
		color: var(--text-muted);
	}
	.health-row .off {
		color: var(--color-orange);
	}
</style>
