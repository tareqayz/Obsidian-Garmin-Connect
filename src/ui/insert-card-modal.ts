import { FuzzySuggestModal, setIcon, type App, type Editor, type FuzzyMatch } from "obsidian";
import { formatDistance, glyphOf, typeLabel, type Units } from "../dashboard/activities";
import { duration } from "../dashboard/series";
import { CARDS, type CardEntry } from "../embeds/catalog";
import { CHARTS, type ChartEntry } from "../embeds/charts";
import { activitySnippet, chartSnippet, snippetFor, type ActivityPick } from "../embeds/spec";
import { dayWords } from "../embeds/status";
import { toIsoDate } from "../garmin/endpoints";
import type { ActivityRow } from "../sync/activity-index";
import { sportIcon } from "./sport-icons";

/** What the picker lists: Home's cards, the stat page charts, and the way to an activity. */
type Choice = { kind: "card"; card: CardEntry } | { kind: "chart"; chart: ChartEntry } | { kind: "activity" };

/** The vault's activities, newest first, and the units to word them in. */
export type ActivityList = () => Promise<{ rows: readonly ActivityRow[]; units: Units }>;

/**
 * **Insert card…**: a card, a chart or an activity picked by name, inserted
 * at the cursor as its ```garmin block. A note without a day of its own gets
 * the day it was inserted on (`date`), so the card keeps showing that day.
 * Picking **Activity…** lists the vault's activities next.
 */
export class InsertCardModal extends FuzzySuggestModal<Choice> {
	constructor(
		app: App,
		private readonly editor: Editor,
		private readonly date: string | undefined,
		private readonly activities: ActivityList,
	) {
		super(app);
		this.setPlaceholder("Search cards…");
		this.setInstructions([
			{ command: "↑↓", purpose: "to navigate" },
			{ command: "↵", purpose: "to insert" },
			{ command: "esc", purpose: "to dismiss" },
		]);
	}

	getItems(): Choice[] {
		return [...CARDS.map((card) => ({ kind: "card" as const, card })), ...CHARTS.map((chart) => ({ kind: "chart" as const, chart })), { kind: "activity" }];
	}

	getItemText(choice: Choice): string {
		if (choice.kind === "card") return [choice.card.title, choice.card.id, ...choice.card.aliases].join(" ");
		if (choice.kind === "chart") return `${choice.chart.title} chart ${choice.chart.id} trend`;
		return "Activity map workout run ride";
	}

	renderSuggestion(match: FuzzyMatch<Choice>, el: HTMLElement): void {
		const choice = match.item;
		if (choice.kind === "card") suggestion(el, choice.card.icon, choice.card.title, choice.card.description, choice.card.id);
		else if (choice.kind === "chart") suggestion(el, choice.chart.icon, `${choice.chart.title} chart`, choice.chart.description, `chart: ${choice.chart.id}`);
		else suggestion(el, "activity", "Activity…", "One activity with its route map. Pick it next.", "activity");
	}

	onChooseItem(choice: Choice): void {
		const opts = this.date ? { date: this.date } : {};
		if (choice.kind === "card") insertBlock(this.editor, snippetFor(choice.card, opts));
		else if (choice.kind === "chart") insertBlock(this.editor, chartSnippet(choice.chart, opts));
		else void this.activities().then(({ rows, units }) => new ActivityPickModal(this.app, this.editor, this.date, rows, units).open());
	}
}

type ActivityChoice = { pick: ActivityPick; row?: ActivityRow };

/** The picker's second step: the day's latest, all of the day's, or one activity from the vault. */
class ActivityPickModal extends FuzzySuggestModal<ActivityChoice> {
	private readonly today = toIsoDate();

	constructor(
		app: App,
		private readonly editor: Editor,
		private readonly date: string | undefined,
		private readonly rows: readonly ActivityRow[],
		private readonly units: Units,
	) {
		super(app);
		this.setPlaceholder("Choose an activity…");
		this.setInstructions([
			{ command: "↑↓", purpose: "to navigate" },
			{ command: "↵", purpose: "to insert it" },
			{ command: "esc", purpose: "to dismiss" },
		]);
	}

	getItems(): ActivityChoice[] {
		return [{ pick: { kind: "latest" } }, { pick: { kind: "all" } }, ...this.rows.map((row) => ({ pick: { kind: "id" as const, id: row.id }, row }))];
	}

	getItemText(choice: ActivityChoice): string {
		if (!choice.row) return choice.pick.kind === "latest" ? "Latest that day" : "Every activity that day";
		return `${this.titleOf(choice.row)} ${choice.row.start.slice(0, 10)} ${this.noteOf(choice.row)}`;
	}

	renderSuggestion(match: FuzzyMatch<ActivityChoice>, el: HTMLElement): void {
		const { pick, row } = match.item;
		if (!row) {
			if (pick.kind === "latest") suggestion(el, "clock", "Latest that day", "The day’s most recent activity, whatever it is.", "latest");
			else suggestion(el, "list", "Every activity that day", "Each with its map, newest first.", "all");
			return;
		}
		suggestion(el, sportIcon(glyphOf(row)), this.titleOf(row), this.noteOf(row), String(row.id));
	}

	onChooseItem({ pick }: ActivityChoice): void {
		insertBlock(this.editor, activitySnippet(pick, this.date ? { date: this.date } : {}));
	}

	private titleOf(row: ActivityRow): string {
		return row.name ?? typeLabel(row.type);
	}

	/** "Sat, Oct 10 · 10.01 km · 56:01". */
	private noteOf(row: ActivityRow): string {
		const parts = [dayWords(row.start.slice(0, 10), this.today)];
		if (row.distance) parts.push(formatDistance(row.distance, this.units, 2, true));
		if (row.duration) parts.push(duration(row.duration));
		return parts.join(" · ");
	}
}

/** A suggestion as Obsidian draws its own: the icon, the title over its note, and the block's name aside. */
function suggestion(el: HTMLElement, icon: string, title: string, note: string, aux: string): void {
	el.addClass("mod-complex", "gch-card-suggestion");
	setIcon(el.createDiv({ cls: "suggestion-icon" }).createSpan({ cls: "suggestion-flair" }), icon);
	const content = el.createDiv({ cls: "suggestion-content" });
	content.createDiv({ cls: "suggestion-title", text: title });
	content.createDiv({ cls: "suggestion-note", text: note });
	el.createDiv({ cls: "suggestion-aux" }).createSpan({ cls: "gch-card-id", text: aux });
}

/** A block on a line of its own, a blank one below any text: after text, it goes below it. */
function insertBlock(editor: Editor, block: string): void {
	const at = editor.getCursor("from");
	const line = editor.getLine(at.line);
	if (line.trim() && editor.getSelection() === "") {
		editor.setCursor({ line: at.line, ch: line.length });
		editor.replaceSelection(`\n\n${block}`);
	} else {
		const above = at.line > 0 ? editor.getLine(at.line - 1) : "";
		editor.replaceSelection(`${above.trim() && !line.trim() ? "\n" : ""}${block}`);
	}
}
