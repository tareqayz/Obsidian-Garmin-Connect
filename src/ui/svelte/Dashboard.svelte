<script lang="ts">
	import {
		CARDS,
		COMPOSITIONS,
		GOALS,
		HEATMAP_METRICS,
		SLEEP_STAGES,
		TILES,
		type CardDef,
	} from "../../dashboard/metrics";
	import {
		availableKeys,
		between,
		compact,
		daysBetween,
		duration,
		inRange,
		seriesOf,
		statsFor,
		workoutsIn,
		type DayRow,
		type Point,
		type Stats,
		type WorkoutEntry,
	} from "../../dashboard/series";
	import {
		DEFAULT_LAYOUT_ID,
		WIDTH_LABELS,
		activeLayout,
		cardTitle,
		columnsFor,
		layoutIds,
		layoutName,
		plotHeight,
		spanFor,
		type LayoutBlock,
		type LayoutsState,
		type WidgetWidth,
	} from "../../dashboard/layouts";
	import {
		addBlock,
		cardBlock,
		cardsIn,
		createLayout,
		deleteLayout,
		duplicateLayout,
		endOfSection,
		moveBlock,
		removeBlock,
		renameLayout,
		resetLayout,
		resizeBlock,
		sectionBlock,
		setActive,
		setCardOptions,
		setSectionTitle,
		setStatMetrics,
		type LayoutSeed,
	} from "../../dashboard/layout-edit";
	import BandChart, { type BandRow } from "./BandChart.svelte";
	import BaselineChart, { type BaselinePoint } from "./BaselineChart.svelte";
	import CalendarHeatmap from "./CalendarHeatmap.svelte";
	import Card from "./Card.svelte";
	import ColumnChart from "./ColumnChart.svelte";
	import CompositionBar, { type Segment } from "./CompositionBar.svelte";
	import DataTable from "./DataTable.svelte";
	import DetailStats from "./DetailStats.svelte";
	import FilterBar from "./FilterBar.svelte";
	import GoalRing from "./GoalRing.svelte";
	import Legend from "./Legend.svelte";
	import LineChart from "./LineChart.svelte";
	import MultiLineChart, { type LineSeries } from "./MultiLineChart.svelte";
	import Section from "./Section.svelte";
	import StackedChart from "./StackedChart.svelte";
	import StatTile from "./StatTile.svelte";
	import SyncStatus from "./SyncStatus.svelte";
	import ActivityDetail from "./v2/ActivityDetail.svelte";
	import ActivityRow from "./v2/ActivityRow.svelte";
	import EditToolbar from "./layouts/EditToolbar.svelte";
	import LayoutBar from "./layouts/LayoutBar.svelte";
	import LayoutDialog from "./layouts/LayoutDialog.svelte";
	import WidgetFrame from "./layouts/WidgetFrame.svelte";
	import WidgetPicker from "./layouts/WidgetPicker.svelte";
	import WidgetSettings from "./layouts/WidgetSettings.svelte";

	interface Props {
		initialRows: readonly DayRow[];
		today: string;
		/** Whether a session exists — sync is pointless without one. */
		canSync: boolean;
		/** Resolves with a one-line summary of what the run did, or null. */
		onSync: () => Promise<string | null>;
		onBackfill: () => void;
		initialLayouts: LayoutsState;
		/** Called with every new state; the view persists it to data.json. */
		onLayouts: (next: LayoutsState) => void;
	}

	let { initialRows, today, canSync, onSync, onBackfill, initialLayouts, onLayouts }: Props =
		$props();

	// Capturing the initial value is the whole point — refreshes come through
	// setRows(), not through the prop.
	// svelte-ignore state_referenced_locally
	let rows = $state(initialRows);

	export function setRows(next: readonly DayRow[]) {
		rows = next;
	}

	// svelte-ignore state_referenced_locally
	let layouts = $state(initialLayouts);

	/** Every layout change goes through here, so nothing can forget to save. */
	function apply(next: LayoutsState) {
		layouts = next;
		onLayouts(next);
	}

	let rangeDays = $state(30);
	let custom = $state(false);
	let from = $state("");
	// Seeded once; the pickers own it from then on.
	// svelte-ignore state_referenced_locally
	let to = $state(today);
	let showTable = $state(false);
	let expanded = $state<string | null>(null);
	let syncing = $state(false);
	let syncMessage = $state<string | null>(null);
	/** Collapsed section blocks, by block id. A reading aid, so never saved. */
	let collapsed = $state(new Set<string>());
	/** The activity whose detail screen has taken over the pane. */
	let openActivity = $state<WorkoutEntry | null>(null);

	let latest = $derived(rows.length > 0 ? rows[rows.length - 1]!.date : null);
	let visible = $derived(custom ? between(rows, from, to) : inRange(rows, rangeDays, today));
	let latestRow = $derived(visible[visible.length - 1]);

	function startCustom() {
		if (!custom) {
			// Seed from whatever preset was showing, so the pickers open on a
			// sensible window instead of an empty one.
			const seeded = inRange(rows, rangeDays, today);
			from = seeded[0]?.date ?? today;
			to = seeded[seeded.length - 1]?.date ?? today;
		}
		custom = true;
	}

	function toggleSection(id: string) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsed = next;
	}

	async function sync() {
		if (syncing) return;
		syncing = true;
		syncMessage = null;
		try {
			syncMessage = await onSync();
		} catch (err) {
			syncMessage = err instanceof Error ? err.message : String(err);
		} finally {
			syncing = false;
		}
	}

	/* -------------------------------------------------------------- */
	/*  Cards                                                          */
	/* -------------------------------------------------------------- */

	type Plot =
		| { kind: "columns"; points: Point[]; goal?: number }
		| { kind: "line"; points: Point[] }
		| { kind: "band"; rows: BandRow[] }
		| { kind: "baseline"; points: BaselinePoint[]; bandLabel: string }
		| { kind: "multiline"; series: LineSeries[]; dates: string[] }
		| { kind: "stacked"; stages: typeof SLEEP_STAGES }
		| { kind: "heatmap" }
		| { kind: "composition"; segments: Segment[]; caption: string }
		| { kind: "workouts"; entries: WorkoutEntry[] };

	interface CardView {
		def: CardDef;
		plot: Plot;
		/** Label and unit for the tooltip. */
		label: string;
		unit: string;
		format?: (value: number) => string;
		stats?: Stats;
		/** The rows this view was built from, which a range override changes. */
		rows: readonly DayRow[];
		span: { from: string; to: string };
	}

	/**
	 * Build every card the given rows can fill.
	 *
	 * Parameterised by rows rather than reading `visible` directly, because a
	 * widget can pin its own date range — see `rowsFor`. The result is indexed
	 * by card id and memoised per distinct range, so pinning three widgets to
	 * 90 days costs one extra pass, not three.
	 */
	function buildCards(rowsIn: readonly DayRow[]): Map<string, CardView> {
		const span = {
			from: rowsIn[0]?.date ?? today,
			to: rowsIn[rowsIn.length - 1]?.date ?? today,
		};
		const out = new Map<string, CardView>();
		const add = (view: CardView | null) => {
			if (view) out.set(view.def.id, view);
		};
		const base = (def: CardDef, plot: Plot, rest: Partial<CardView> = {}): CardView => ({
			def,
			plot,
			label: def.title,
			unit: "",
			rows: rowsIn,
			span,
			...rest,
		});

		function lineCard(id: string, key: string, unit = "", format?: (v: number) => string) {
			const points = seriesOf(rowsIn, key);
			if (points.length === 0) return null;
			return base(CARDS[id]!, { kind: "line", points }, { unit, format, stats: statsFor(points) });
		}

		function columnCard(
			id: string,
			key: string,
			unit = "",
			goalKey?: string,
			format?: (v: number) => string,
		) {
			const points = seriesOf(rowsIn, key);
			if (points.length === 0) return null;
			const goal = goalKey
				? [...rowsIn].reverse().find((r) => typeof r.values[goalKey] === "number")?.values[goalKey]
				: undefined;
			return base(
				{
					...CARDS[id]!,
					subtitle: goal
						? `${CARDS[id]!.subtitle} · goal ${compact(goal)} (dashed)`
						: CARDS[id]!.subtitle,
				},
				{ kind: "columns", points, goal },
				{ unit, format, stats: statsFor(points) },
			);
		}

		/** Which distance/weight key this vault was synced with. */
		function unitKey(metric: string, imperial: string): string | null {
			if (availableKeys(rowsIn, [metric]).length > 0) return metric;
			if (availableKeys(rowsIn, [imperial]).length > 0) return imperial;
			return null;
		}

		/* Activity ---------------------------------------------------- */
		add(columnCard("steps", "steps", "", "steps_goal"));

		// Under two months the grid is five columns of squares, which says less
		// than the column chart above it and takes more ink to say it. The
		// calendar earns its place over a quarter or a year.
		if (daysBetween(span.from, span.to) >= 56) {
			add(base(CARDS.calendar!, { kind: "heatmap" }));
		}

		const distanceKey = unitKey("distance_km", "distance_mi");
		if (distanceKey) {
			add(columnCard("distance", distanceKey, distanceKey === "distance_km" ? " km" : " mi"));
		}
		add(columnCard("calories", "calories_active", "", undefined, compact));
		add(columnCard("intensity", "intensity_minutes", " min", "intensity_goal"));
		add(columnCard("floors", "floors", "", "floors_goal"));

		/* Sleep ------------------------------------------------------- */
		const stages = SLEEP_STAGES.filter((s) => availableKeys(rowsIn, [s.key]).length > 0);
		if (stages.length > 0) {
			add(
				base(
					CARDS.sleep!,
					{ kind: "stacked", stages },
					{
						label: "Sleep",
						format: (v: number) => `${Math.round(v * 100) / 100}h`,
						stats: statsFor(seriesOf(rowsIn, "sleep_hours")),
					},
				),
			);
		}
		add(lineCard("sleep_score", "sleep_score"));
		add(lineCard("sleep_respiration", "sleep_respiration", " br/min"));
		add(lineCard("sleep_spo2", "sleep_spo2", "%"));
		add(lineCard("sleep_battery", "sleep_body_battery_change"));
		add(lineCard("sleep_restless", "sleep_restless_moments"));

		/* Recovery ---------------------------------------------------- */
		/** HRV against the personal range Garmin judges it by, when it synced. */
		function hrvCard() {
			const points = seriesOf(rowsIn, "hrv_avg");
			if (points.length === 0) return null;
			const byDate = new Map(rowsIn.map((r) => [r.date, r.values]));
			const withBand: BaselinePoint[] = points.map((p) => {
				const values = byDate.get(p.date);
				const low = values?.hrv_baseline_low;
				const high = values?.hrv_baseline_high;
				return {
					...p,
					...(typeof low === "number" && typeof high === "number" ? { low, high } : {}),
				};
			});
			const banded = withBand.some((p) => p.low !== undefined);
			return base(
				{
					...CARDS.hrv!,
					subtitle: banded ? "Overnight average against your baseline, ms" : CARDS.hrv!.subtitle,
				},
				banded
					? { kind: "baseline", points: withBand, bandLabel: "Baseline" }
					: { kind: "line", points },
				{ label: "HRV", unit: " ms", stats: statsFor(points) },
			);
		}
		add(hrvCard());
		add(lineCard("resting_hr", "resting_hr", " bpm"));
		add(lineCard("readiness", "training_readiness"));

		const bands = rowsIn
			.filter(
				(r) =>
					typeof r.values.body_battery_low === "number" &&
					typeof r.values.body_battery_high === "number",
			)
			.map((r) => ({
				date: r.date,
				low: r.values.body_battery_low!,
				high: r.values.body_battery_high!,
			}));
		if (bands.length > 0) {
			add(
				base(
					CARDS.battery!,
					{ kind: "band", rows: bands },
					{ label: "Body Battery", stats: statsFor(seriesOf(rowsIn, "body_battery_high")) },
				),
			);
		}

		add(lineCard("stress", "stress_avg"));
		add(lineCard("recovery_time", "recovery_time_hours", " h"));
		add(lineCard("respiration", "respiration_avg", " br/min"));
		add(lineCard("spo2", "spo2_avg", "%"));

		/* Fitness ----------------------------------------------------- */
		const acute = seriesOf(rowsIn, "training_load_acute");
		const chronic = seriesOf(rowsIn, "training_load_chronic");
		if (acute.length > 0 || chronic.length > 0) {
			const series: LineSeries[] = [];
			if (acute.length) series.push({ key: "acute", label: "Acute (7d)", step: 2, points: acute });
			if (chronic.length) {
				series.push({
					key: "chronic",
					label: "Chronic (28d)",
					step: 4,
					points: chronic,
					dashed: true,
				});
			}
			add(
				base(
					CARDS.training_load!,
					{ kind: "multiline", series, dates: rowsIn.map((r) => r.date) },
					{ label: "Training load", stats: statsFor(acute.length ? acute : chronic) },
				),
			);
		}

		/** The productive band is a constant, which a baseline chart draws free. */
		const ratio = seriesOf(rowsIn, "training_load_ratio");
		if (ratio.length > 0) {
			add(
				base(
					CARDS.load_ratio!,
					{
						kind: "baseline",
						points: ratio.map((p) => ({ ...p, low: 0.8, high: 1.3 })),
						bandLabel: "Productive range",
					},
					{ label: "Load ratio", stats: statsFor(ratio) },
				),
			);
		}

		add(lineCard("vo2max", "vo2max"));
		add(lineCard("fitness_age", "fitness_age", " yrs"));
		add(lineCard("endurance", "endurance_score"));
		add(lineCard("race_5k", "race_5k", "", duration));
		add(lineCard("race_10k", "race_10k", "", duration));
		add(lineCard("race_half", "race_half", "", duration));
		add(lineCard("race_marathon", "race_marathon", "", duration));

		/* Body -------------------------------------------------------- */
		const weightKey = unitKey("weight_kg", "weight_lb");
		if (weightKey) {
			add(lineCard("weight", weightKey, weightKey === "weight_kg" ? " kg" : " lb"));
		}
		add(lineCard("body_fat", "body_fat_pct", "%"));
		add(lineCard("bmi", "bmi"));

		/* Compositions ------------------------------------------------ */
		for (const def of COMPOSITIONS) {
			const source = [...rowsIn]
				.reverse()
				.find((row) => def.parts.some((p) => typeof row.values[p.key] === "number"));
			if (!source) continue;
			const segments = def.parts
				.filter((p) => typeof source.values[p.key] === "number")
				.map((p) => ({ key: p.key, label: p.label, value: source.values[p.key]!, step: p.step }));
			add(
				base(def, { kind: "composition", segments, caption: shortDateOf(source.date) }, {
					unit: def.unit,
				}),
			);
		}

		/* Activities -------------------------------------------------- */
		const entries = workoutsIn(rowsIn);
		if (entries.length > 0) {
			add(
				base(
					{ ...CARDS.workouts!, subtitle: `${entries.length} in this range` },
					{ kind: "workouts", entries },
					{ label: "Activities" },
				),
			);
		}

		return out;
	}

	function shortDateOf(iso: string): string {
		return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
		});
	}

	let baseCards = $derived(buildCards(visible));

	/** One extra pass per distinct pinned range, not one per pinned widget. */
	let pinnedCards = $derived.by(() => {
		const out = new Map<number, Map<string, CardView>>();
		for (const block of layout.blocks) {
			if (block.type !== "card") continue;
			const days = block.options.range;
			if (typeof days === "number" && !out.has(days)) {
				out.set(days, buildCards(inRange(rows, days, today)));
			}
		}
		return out;
	});

	type CardBlock = Extract<LayoutBlock, { type: "card" }>;

	function viewFor(block: CardBlock): CardView | undefined {
		const days = block.options.range;
		return days === "follow" ? baseCards.get(block.card) : pinnedCards.get(days)?.get(block.card);
	}

	/* -------------------------------------------------------------- */
	/*  Headline                                                       */
	/* -------------------------------------------------------------- */

	let tilesFor = $derived((keys: readonly string[]) => {
		const wanted = new Set(keys);
		return TILES.filter(
			(t) => wanted.has(t.key) && availableKeys(visible, [t.key]).length > 0,
		).map((tile) => ({ tile, stats: statsFor(seriesOf(visible, tile.key)) }));
	});

	let rings = $derived(
		GOALS.map((goal) => {
			// The most recent day that has both the measure and its target — a goal
			// ring for a day Garmin never reported a goal for would be a fiction.
			const row = [...visible]
				.reverse()
				.find(
					(r) =>
						typeof r.values[goal.key] === "number" &&
						typeof r.values[goal.goalKey] === "number" &&
						r.values[goal.goalKey]! > 0,
				);
			return row ? { ...goal, value: row.values[goal.key]!, goal: row.values[goal.goalKey]! } : null;
		}).filter((r): r is NonNullable<typeof r> => r !== null),
	);

	let heatChoices = $derived(
		HEATMAP_METRICS.filter((m) => availableKeys(visible, [m.key]).length > 0),
	);

	/* -------------------------------------------------------------- */
	/*  Layout                                                         */
	/* -------------------------------------------------------------- */

	let width = $state(0);
	let wide = $derived(width > 560);
	let columns = $derived(columnsFor(width));
	let compactPane = $derived(columns === 1);

	let layout = $derived(activeLayout(layouts));
	let ids = $derived(layoutIds(layouts));
	let activeId = $derived(layouts.active);

	let editing = $state(false);
	let picker = $state<{ section: string | null } | null>(null);
	let settingsFor = $state<string | null>(null);
	let dialog = $state<{ mode: "new" | "rename" } | null>(null);

	/** Live preview of a drag, committed on release. */
	let pendingMove = $state<{ id: string; index: number } | null>(null);
	let dragId = $state<string | null>(null);
	let resizing = $state<{ id: string; preview: WidgetWidth } | null>(null);

	let blocks = $derived.by(() => {
		if (!pendingMove) return layout.blocks;
		const at = layout.blocks.findIndex((b) => b.id === pendingMove!.id);
		if (at === -1) return layout.blocks;
		const out = [...layout.blocks];
		const [moved] = out.splice(at, 1);
		if (!moved) return layout.blocks;
		out.splice(Math.max(0, Math.min(out.length, pendingMove.index)), 0, moved);
		return out;
	});

	interface Group {
		key: string;
		heading: Extract<LayoutBlock, { type: "section" }> | null;
		items: LayoutBlock[];
	}

	/**
	 * A layout is a flat list; sections are headings inside it. Everything
	 * between one heading and the next belongs to it, which is what lets a
	 * heading be dragged, renamed and deleted like any other block.
	 */
	let groups = $derived.by(() => {
		const out: Group[] = [{ key: "lead", heading: null, items: [] }];
		for (const block of blocks) {
			if (block.type === "section") out.push({ key: block.id, heading: block, items: [] });
			else out[out.length - 1]!.items.push(block);
		}
		return out.filter((g) => g.heading !== null || g.items.length > 0);
	});

	/** Cards with something to draw, for the picker's "Not synced" state. */
	let availableCards = $derived(new Set(baseCards.keys()));
	let presentCards = $derived(cardsIn(layout));
	let hasStats = $derived(layout.blocks.some((b) => b.type === "stats"));
	let hasRings = $derived(layout.blocks.some((b) => b.type === "rings"));
	let isDefault = $derived(activeId === DEFAULT_LAYOUT_ID);
	let canReset = $derived(isDefault && layouts.byId[DEFAULT_LAYOUT_ID] !== undefined);

	function titleOf(block: LayoutBlock): string {
		if (block.type === "card") return cardTitle(block.card)?.title ?? block.card;
		if (block.type === "section") return block.title;
		if (block.type === "stats") return "Key stats";
		return "Goal rings";
	}

	function badgeOf(block: LayoutBlock): string {
		if (block.type === "section") return "";
		const w = WIDTH_LABELS[block.width];
		return block.type === "card" ? `${w} · ${block.height}` : w;
	}

	/* -------------------------------------------------------------- */
	/*  Editing                                                        */
	/* -------------------------------------------------------------- */

	function widthOf(block: LayoutBlock): WidgetWidth {
		if (block.type === "section") return 4;
		return resizing?.id === block.id ? resizing.preview : block.width;
	}

	function openPicker(section: string | null) {
		picker = { section };
	}

	function addCard(card: string) {
		const at = endOfSection(layout, picker?.section ?? null);
		apply(addBlock(layouts, activeId, cardBlock(card), at));
	}

	function addStructure(block: LayoutBlock) {
		const at = endOfSection(layout, picker?.section ?? null);
		apply(addBlock(layouts, activeId, block, at));
	}

	function submitDialog(name: string, seed: LayoutSeed) {
		apply(dialog?.mode === "new" ? createLayout(layouts, name, seed) : renameLayout(layouts, activeId, name));
		dialog = null;
	}

	/* Dragging -------------------------------------------------------- */

	/*
	   Pointer events rather than HTML5 drag-and-drop, which does not fire on
	   touch at all. The gesture differs by input: a mouse starts a drag as soon
	   as it has moved a few pixels, while a finger must hold still for a moment
	   first — otherwise every attempt to scroll past a widget would pick it up.
	*/
	const HOLD_MS = 250;
	const SLOP = 6;

	let grab: {
		id: string;
		pointerId: number;
		x: number;
		y: number;
		armed: boolean;
		timer: number;
		target: HTMLElement;
	} | null = null;

	function onGrab(block: LayoutBlock, event: PointerEvent) {
		if (!editing) return;
		event.preventDefault();
		const target = event.currentTarget as HTMLElement;
		// Capture keeps the gesture alive when the pointer leaves the grip, but
		// it is not worth losing the drag over: a synthetic or already-released
		// pointer id throws here and the rest of the gesture is fine without it.
		try {
			target.setPointerCapture(event.pointerId);
		} catch {
			/* no capture; window-level move and up handlers still fire */
		}
		const touch = event.pointerType !== "mouse";
		grab = {
			id: block.id,
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			armed: !touch,
			timer: 0,
			target,
		};
		if (touch) {
			grab.timer = window.setTimeout(() => {
				if (grab) {
					grab.armed = true;
					start(grab.id);
				}
			}, HOLD_MS);
		}
	}

	function start(id: string) {
		dragId = id;
		const at = layout.blocks.findIndex((b) => b.id === id);
		pendingMove = { id, index: at === -1 ? 0 : at };
	}

	function onGrabMove(event: PointerEvent) {
		if (!grab || event.pointerId !== grab.pointerId) return;
		const moved = Math.hypot(event.clientX - grab.x, event.clientY - grab.y);

		if (!grab.armed) {
			// Moved before the hold completed: this was a scroll, not a drag.
			if (moved > SLOP) cancelGrab();
			return;
		}
		if (!dragId) {
			if (moved <= SLOP) return;
			start(grab.id);
		}
		const active = dragId;
		if (!active) return;

		const under = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest("[data-block]") as HTMLElement | null;
		if (!under) return;
		const overId = under.dataset.block;
		if (!overId || overId === active) return;

		const order = blocks.map((b) => b.id);
		const overAt = order.indexOf(overId);
		const fromAt = order.indexOf(active);
		if (overAt === -1 || fromAt === -1) return;

		const rect = under.getBoundingClientRect();
		// One column stacks, so the midpoint that matters is vertical; wider
		// panes lay widgets side by side, where it is horizontal.
		const after =
			columns === 1
				? event.clientY > rect.top + rect.height / 2
				: event.clientX > rect.left + rect.width / 2;

		let index = after ? overAt + 1 : overAt;
		if (fromAt < index) index -= 1;
		if (pendingMove?.index !== index) pendingMove = { id: active, index };
	}

	function onGrabEnd() {
		if (!grab) return;
		const id = dragId;
		const index = pendingMove?.index;
		cancelGrab();
		if (id && index !== undefined) apply(moveBlock(layouts, activeId, id, index));
	}

	function cancelGrab() {
		if (grab) {
			window.clearTimeout(grab.timer);
			try {
				if (grab.target.hasPointerCapture(grab.pointerId)) {
					grab.target.releasePointerCapture(grab.pointerId);
				}
			} catch {
				/* never captured */
			}
		}
		grab = null;
		dragId = null;
		pendingMove = null;
	}

	/* Resizing -------------------------------------------------------- */

	let grip: { id: string; x: number; start: WidgetWidth; step: number; pointerId: number } | null =
		null;

	function onResizeStart(block: LayoutBlock, event: PointerEvent) {
		if (block.type === "section") return;
		event.preventDefault();
		event.stopPropagation();
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			/* see onGrab */
		}
		// One stored span per rendered column: on a two-column pane a single
		// column of travel is worth two of the four stored spans.
		const perColumn = Math.max(1, (width - 32) / columns);
		grip = {
			id: block.id,
			x: event.clientX,
			start: block.width,
			step: perColumn / (4 / columns),
			pointerId: event.pointerId,
		};
		resizing = { id: block.id, preview: block.width };
	}

	function onResizeMove(event: PointerEvent) {
		if (!grip || event.pointerId !== grip.pointerId) return;
		const moved = Math.round((event.clientX - grip.x) / grip.step);
		const next = Math.max(1, Math.min(4, grip.start + moved)) as WidgetWidth;
		if (resizing?.preview !== next) resizing = { id: grip.id, preview: next };
	}

	function onResizeEnd() {
		if (grip && resizing) apply(resizeBlock(layouts, activeId, grip.id, { width: resizing.preview }));
		grip = null;
		resizing = null;
	}

	/** Pointer resizing is a pointer-only affordance; touch uses the panel. */
	let finePointer = $derived(
		typeof globalThis.matchMedia === "function"
			? globalThis.matchMedia("(pointer: fine)").matches
			: true,
	);

	let movingName = $derived(
		dragId ? titleOf(layout.blocks.find((b) => b.id === dragId) ?? { type: "stats", id: "", width: 4, metrics: [] }) : null,
	);
	let openCard = $derived.by(() => {
		if (!expanded) return null;
		const block = layout.blocks.find((b) => b.id === expanded);
		return block?.type === "card" ? { block, view: viewFor(block) } : null;
	});
</script>

<svelte:window
	onpointermove={(e) => {
		onGrabMove(e);
		onResizeMove(e);
	}}
	onpointerup={() => {
		onGrabEnd();
		onResizeEnd();
	}}
	onpointercancel={() => {
		cancelGrab();
		onResizeEnd();
	}}
	onkeydown={(e) => e.key === "Escape" && dragId && cancelGrab()}
/>

{#snippet plot(card: CardView, block: CardBlock, height: number)}
	{#if card.plot.kind === "columns"}
		<ColumnChart
			points={card.plot.points}
			{height}
			label={card.label}
			unit={card.unit}
			goal={block.options.goalLine ? card.plot.goal : undefined}
		/>
	{:else if card.plot.kind === "line"}
		<LineChart
			points={card.plot.points}
			{height}
			label={card.label}
			unit={card.unit}
			format={card.format}
		/>
	{:else if card.plot.kind === "baseline"}
		<BaselineChart
			points={card.plot.points}
			{height}
			label={card.label}
			unit={card.unit}
			bandLabel={card.plot.bandLabel}
		/>
	{:else if card.plot.kind === "multiline"}
		<MultiLineChart
			series={card.plot.series}
			dates={card.plot.dates}
			{height}
			unit={card.unit}
			format={card.format}
		/>
		<Legend
			stages={card.plot.series.map((s) => ({ key: s.key, label: s.label, step: s.step }))}
		/>
	{:else if card.plot.kind === "band"}
		<BandChart rows={card.plot.rows} {height} lowLabel="Low" highLabel="High" />
	{:else if card.plot.kind === "heatmap"}
		{@const key = block.options.metric ?? heatChoices[0]?.key ?? ""}
		{@const choice = heatChoices.find((c) => c.key === key) ?? heatChoices[0]}
		<CalendarHeatmap
			rows={card.rows}
			metricKey={choice?.key ?? ""}
			from={card.span.from}
			to={card.span.to}
			label={choice?.label ?? card.label}
			unit={choice?.unit ?? ""}
			format={choice?.format}
		/>
	{:else if card.plot.kind === "composition"}
		<CompositionBar segments={card.plot.segments} unit={card.unit} caption={card.plot.caption} />
	{:else if card.plot.kind === "workouts"}
		{@const limit = height > 200 ? 40 : 8}
		{@const shown = card.plot.entries.slice(0, limit)}
		{@const hidden = card.plot.entries.length - shown.length}
		<!-- A recessed tray inside the card, so the rows have a surface to be
		     raised from. Elevation is what carries a v2 row, and a white row on a
		     white card has nothing to cast a shadow against. -->
		<div class="activities">
			{#each shown as entry, i (entry.start ?? `${entry.date}-${i}`)}
				<ActivityRow {entry} onOpen={(e) => !editing && (openActivity = e)} />
			{/each}
		</div>
		{#if hidden > 0}
			<p class="more">{hidden} more in this range.</p>
		{/if}
	{:else}
		<StackedChart rows={card.rows} stages={card.plot.stages} {height} format={card.format} />
		<Legend stages={card.plot.stages} />
	{/if}
{/snippet}

{#snippet cardBody(card: CardView, block: CardBlock, height: number)}
	{#if block.card === "calendar" && heatChoices.length > 1 && !editing}
		<!-- One switchable calendar rather than ten: a year of squares is a lot of
		     ink, and repeating it per metric would drown everything else. The
		     choice is saved with the widget rather than lost on reload. -->
		<label class="picker">
			<span class="sr">Calendar metric</span>
			<select
				value={block.options.metric ?? heatChoices[0]?.key}
				onchange={(e) =>
					apply(setCardOptions(layouts, activeId, block.id, { metric: e.currentTarget.value }))}
			>
				{#each heatChoices as choice (choice.key)}
					<option value={choice.key}>{choice.label}</option>
				{/each}
			</select>
		</label>
	{/if}
	{@render plot(card, block, height)}
{/snippet}

{#snippet blockContent(block: LayoutBlock)}
	{#if block.type === "rings"}
		<div class="rings">
			{#each rings as ring (ring.key)}
				<GoalRing
					label={ring.label}
					value={ring.value}
					goal={ring.goal}
					format={ring.key === "steps" ? compact : undefined}
				/>
			{/each}
			{#if latestRow}
				<p class="ring-note">
					Goals as of {shortDateOf(latestRow.date)}, the most recent day with data.
				</p>
			{/if}
		</div>
	{:else if block.type === "stats"}
		<div class="tiles">
			{#each tilesFor(block.metrics) as { tile, stats } (tile.key)}
				<StatTile
					label={tile.label}
					{stats}
					unit={tile.unit}
					format={tile.format}
					goodDirection={tile.goodDirection}
					info={tile.info}
				/>
			{/each}
		</div>
	{:else if block.type === "card"}
		{@const view = viewFor(block)}
		{#if view}
			<Card
				title={view.def.title}
				subtitle={view.def.subtitle}
				info={view.def.info}
				onExpand={view.plot.kind === "composition" ? undefined : () => (expanded = block.id)}
			>
				{@render cardBody(view, block, plotHeight(block.height, wide))}
			</Card>
		{/if}
	{/if}
{/snippet}

<!-- `gcd-root` is global on purpose: it is where styles.css hangs the design
     tokens that every child component reads. -->
<div class="gcd-root root" class:editing bind:clientWidth={width}>
	<LayoutBar
		{ids}
		active={activeId}
		nameOf={(id) => layoutName(layouts, id)}
		{editing}
		compact={compactPane}
		{isDefault}
		onSelect={(id) => {
			editing = false;
			expanded = null;
			apply(setActive(layouts, id));
		}}
		onNew={() => (dialog = { mode: "new" })}
		onEdit={() => {
			editing = true;
			expanded = null;
			openActivity = null;
		}}
		onRename={() => (dialog = { mode: "rename" })}
		onDuplicate={() => apply(duplicateLayout(layouts, activeId))}
		onReset={() => apply(resetLayout(layouts, activeId))}
		onDelete={() => apply(deleteLayout(layouts, activeId))}
	/>

	{#if editing}
		<EditToolbar
			name={layoutName(layouts, activeId)}
			moving={movingName}
			compact={compactPane}
			{canReset}
			onAdd={() => openPicker(null)}
			onReset={() => apply(resetLayout(layouts, activeId))}
			onDone={() => (editing = false)}
		/>
	{:else}
		<FilterBar
			{rangeDays}
			{custom}
			{from}
			{to}
			{today}
			{showTable}
			{syncing}
			{canSync}
			onRange={(days) => {
				rangeDays = days;
				custom = false;
			}}
			onCustom={startCustom}
			onFrom={(d) => (from = d)}
			onTo={(d) => (to = d)}
			onToggleTable={() => (showTable = !showTable)}
			onSync={sync}
			{onBackfill}
		/>

		<SyncStatus {latest} total={rows.length} {syncing} {canSync} message={syncMessage} />
	{/if}

	{#if visible.length === 0 && !editing}
		<div class="empty">
			<div class="empty-title">
				{rows.length > 0 ? "Nothing in this range" : "No Garmin data yet"}
			</div>
			<div>
				{rows.length > 0
					? "Try a longer range, or sync more days."
					: "Press Sync above, or run “Sync recent days” from the command palette."}
			</div>
		</div>
	{:else if showTable && !editing}
		<Card title="All values" subtitle="{visible.length} days">
			<DataTable rows={visible} />
		</Card>
	{:else if openActivity && !editing}
		<!-- One session, full pane. The v1 dashboard could only ever show a day;
		     this is the row underneath it. -->
		<ActivityDetail entry={openActivity} onBack={() => (openActivity = null)} />
	{:else if openCard?.view && !editing}
		<!-- Expanded: one card, the full pane, and the numbers a hover would carry. -->
		<Card
			title={openCard.view.def.title}
			subtitle={openCard.view.def.subtitle}
			info={openCard.view.def.info}
			expanded
			onCollapse={() => (expanded = null)}
		>
			{@render cardBody(openCard.view, openCard.block, wide ? 380 : 260)}
			{#snippet detail()}
				{#if openCard?.view?.stats && openCard.block.options.summary}
					<DetailStats
						stats={openCard.view.stats}
						format={openCard.view.format ?? ((v: number) => String(Math.round(v * 100) / 100))}
						unit={openCard.view.unit}
					/>
				{/if}
			{/snippet}
		</Card>
	{:else if layout.blocks.length === 0}
		<div class="blank">
			<div class="blank-glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
			<div class="blank-title">This layout is empty</div>
			<p class="blank-body">
				Add the widgets you actually read, then drag them into the order you read them in.
				Nothing you do here touches your other layouts.
			</p>
			<div class="blank-actions">
				<button class="chip primary" onclick={() => { editing = true; openPicker(null); }}>
					+ Add widget
				</button>
				<button class="chip" onclick={() => apply(createLayout(layouts, layoutName(layouts, activeId), "shipped"))}>
					Copy the default layout
				</button>
			</div>
		</div>
	{:else}
		{#each groups as group (group.key)}
			{#snippet grid(items: LayoutBlock[])}
				<div class="grid" style="--cols: {columns}">
					{#each items as block (block.id)}
						<div
							class="slot"
							data-block={block.id}
							style="grid-column: span {spanFor(widthOf(block), columns)}"
						>
							{#if editing}
								<WidgetFrame
									title={titleOf(block)}
									badge={badgeOf(block)}
									lifted={dragId === block.id}
									canResize={finePointer && columns > 1}
									empty={block.type === "card" && viewFor(block) === undefined}
									onGrab={(e) => onGrab(block, e)}
									onResize={(e) => onResizeStart(block, e)}
									onSettings={() => (settingsFor = block.id)}
									onRemove={() => apply(removeBlock(layouts, activeId, block.id))}
								>
									{#if block.type === "card"}
										{@const view = viewFor(block)}
										{#if view}
											{@render plot(view, block, plotHeight(block.height, wide))}
										{/if}
									{:else}
										{@render blockContent(block)}
									{/if}
								</WidgetFrame>
								{#if settingsFor === block.id}
									<WidgetSettings
										{block}
										title={titleOf(block)}
										compact={compactPane}
										{columns}
										tiles={TILES}
										{heatChoices}
										onResize={(size) => apply(resizeBlock(layouts, activeId, block.id, size))}
										onOptions={(patch) =>
											apply(setCardOptions(layouts, activeId, block.id, patch))}
										onMetrics={(metrics) =>
											apply(setStatMetrics(layouts, activeId, block.id, metrics))}
										onTitle={(t) => apply(setSectionTitle(layouts, activeId, block.id, t))}
										onRemove={() => {
											settingsFor = null;
											apply(removeBlock(layouts, activeId, block.id));
										}}
										onClose={() => (settingsFor = null)}
									/>
								{/if}
							{:else}
								{@render blockContent(block)}
							{/if}
						</div>
					{/each}

					{#if editing}
						<div class="slot" style="grid-column: span {columns}">
							<button class="add-slot" onclick={() => openPicker(group.heading?.id ?? null)}>
								<span class="plus">+</span>
								<span>Add widget</span>
							</button>
						</div>
					{/if}
				</div>
			{/snippet}

			{#if group.heading}
				{#if editing}
					<!-- A heading is a block like any other: draggable, renamable and
					     removable. Sections stay open while arranging, because
					     collapsing hides the thing being arranged. -->
					<div class="section-edit slot" data-block={group.heading.id}>
						<button
							class="grip"
							aria-label="Move {group.heading.title}"
							onpointerdown={(e) => onGrab(group.heading!, e)}
						>
							<span class="dots" aria-hidden="true">
								{#each Array(6) as _, i (i)}<i></i>{/each}
							</span>
						</button>
						<span class="section-title">{group.heading.title}</span>
						<span class="section-count">
							{group.items.length}
							{group.items.length === 1 ? "widget" : "widgets"}
						</span>
						<button
							class="icon"
							aria-label="Settings for {group.heading.title}"
							onclick={() => (settingsFor = group.heading!.id)}>⋯</button
						>
						<button
							class="icon"
							aria-label="Remove {group.heading.title}"
							onclick={() => apply(removeBlock(layouts, activeId, group.heading!.id))}>✕</button
						>
						{#if settingsFor === group.heading.id}
							<WidgetSettings
								block={group.heading}
								title={group.heading.title}
								compact={compactPane}
								{columns}
								tiles={TILES}
								{heatChoices}
								onResize={() => {}}
								onOptions={() => {}}
								onMetrics={() => {}}
								onTitle={(t) => apply(setSectionTitle(layouts, activeId, group.heading!.id, t))}
								onRemove={() => {
									const id = group.heading!.id;
									settingsFor = null;
									apply(removeBlock(layouts, activeId, id));
								}}
								onClose={() => (settingsFor = null)}
							/>
						{/if}
					</div>
					{@render grid(group.items)}
				{:else}
					<Section
						title={group.heading.title}
						count={group.items.length}
						open={!collapsed.has(group.heading.id)}
						onToggle={() => toggleSection(group.heading!.id)}
					>
						{@render grid(group.items)}
					</Section>
				{/if}
			{:else}
				{@render grid(group.items)}
			{/if}
		{/each}
	{/if}

	<!-- Overlays live inside `gcd-root` even though they are position: fixed.
	     Outside it they would render without the design tokens, which hang off
	     that class, and every background would resolve to transparent. -->
	{#if picker}
		<WidgetPicker
			compact={compactPane}
			present={presentCards}
			available={availableCards}
			destination={picker.section
				? `“${layout.blocks.find((b) => b.id === picker!.section)?.type === "section" ? titleOf(layout.blocks.find((b) => b.id === picker!.section)!) : "this layout"}”`
				: `“${layoutName(layouts, activeId)}”`}
			{hasStats}
			{hasRings}
			onAddCard={addCard}
			onAddSection={() => addStructure(sectionBlock("New section"))}
			onAddStats={() =>
				addStructure({ type: "stats", id: `stats-${Date.now()}`, width: 4, metrics: TILES.map((t) => t.key) })}
			onAddRings={() => addStructure({ type: "rings", id: `rings-${Date.now()}`, width: 4 })}
			onClose={() => (picker = null)}
		/>
	{/if}

	{#if dialog}
		<LayoutDialog
			mode={dialog.mode}
			initialName={dialog.mode === "rename" ? layoutName(layouts, activeId) : ""}
			currentName={layoutName(layouts, activeId)}
			compact={compactPane}
			onSubmit={submitDialog}
			onClose={() => (dialog = null)}
		/>
	{/if}
</div>

<style>
	.root {
		padding: 12px 16px 32px;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
	}
	/* The grid every widget sits in. One column count for the whole pane, so a
	   half-width widget is half of the same thing everywhere. */
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 14px;
		align-items: stretch;
	}
	.slot {
		min-width: 0;
		position: relative;
	}
	.rings {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 18px 26px;
		padding: 14px 16px;
		border: 1px solid var(--gcd-border);
		border-radius: 8px;
		background: var(--gcd-surface);
	}
	.editing .rings {
		border: none;
		padding: 4px 0 0;
	}
	.ring-note {
		flex: 1 1 160px;
		align-self: center;
		margin: 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.tiles {
		display: grid;
		/* Tiles stay two-up on a phone: a tile is still legible at 140px where a
		   chart is not. The minimum has to clear the narrowest case, which is a
		   366px pane minus the root and widget padding — 304px of grid, so two
		   columns and a 10px gap have to fit inside 147. */
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 10px;
	}
	.picker {
		display: block;
		margin-bottom: 8px;
	}
	.picker select {
		font-size: var(--font-ui-smaller, 12px);
		padding: 2px 6px;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.empty {
		padding: 40px 8px;
		text-align: center;
		color: var(--gcd-muted);
	}
	.empty-title {
		font-weight: 600;
		color: var(--gcd-text);
		margin-bottom: 4px;
	}
	.activities {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px;
		border-radius: 8px;
		background: var(--v2-surface-app);
	}
	.more {
		margin: 8px 0 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}

	/* Edit mode ---------------------------------------------------- */

	.add-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 100%;
		min-height: 96px;
		padding: 16px;
		border: 1px dashed var(--gcd-border);
		border-radius: 12px;
		background: transparent;
		box-shadow: none;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		height: auto;
		cursor: pointer;
	}
	.add-slot:hover {
		border-color: var(--v2-accent);
		color: var(--v2-accent);
	}
	.plus {
		font-size: 20px;
		line-height: 1;
	}
	.section-edit {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		margin-bottom: 12px;
		border-radius: 6px;
		background: var(--gcd-raised);
	}
	.section-title {
		flex: 1;
		font-weight: 600;
		font-size: var(--font-ui-small, 13px);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.section-count {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.section-edit .grip {
		display: grid;
		place-items: center;
		width: 22px;
		height: 26px;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
		color: var(--gcd-muted);
		cursor: grab;
		touch-action: none;
	}
	.dots {
		display: grid;
		grid-template-columns: repeat(2, 2.5px);
		gap: 3px;
	}
	.dots i {
		width: 2.5px;
		height: 2.5px;
		border-radius: 50%;
		background: currentColor;
	}
	.icon {
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 11px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
		flex: none;
	}
	.icon:hover {
		background: var(--gcd-surface);
		color: var(--gcd-text);
	}

	/* Empty layout -------------------------------------------------- */

	.blank {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 56px 24px;
		border: 1px dashed var(--gcd-border);
		border-radius: 12px;
		text-align: center;
	}
	.blank-glyph {
		display: grid;
		grid-template-columns: repeat(2, 26px);
		grid-template-rows: 26px 14px;
		gap: 4px;
	}
	.blank-glyph i {
		border-radius: 4px;
		background: var(--gcd-grid);
	}
	.blank-glyph i:nth-child(2) {
		grid-row: span 2;
		height: 56px;
	}
	.blank-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--gcd-text);
	}
	.blank-body {
		max-width: 430px;
		margin: 0;
		color: var(--gcd-muted);
		line-height: 1.5;
	}
	.blank-actions {
		display: flex;
		gap: 8px;
		margin-top: 6px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.chip {
		padding: 6px 14px;
		border: 1px solid var(--gcd-border);
		border-radius: 999px;
		background: transparent;
		color: var(--gcd-text);
		font-size: 12px;
		line-height: 1.25;
		height: auto;
		box-shadow: none;
		cursor: pointer;
	}
	.chip.primary {
		border-color: var(--v2-accent);
		color: var(--v2-accent);
		font-weight: 600;
	}
</style>
