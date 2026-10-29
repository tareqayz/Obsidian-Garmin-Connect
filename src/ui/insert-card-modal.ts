import { FuzzySuggestModal, setIcon, type App, type Editor, type FuzzyMatch } from "obsidian";
import { CARDS, type CardEntry } from "../embeds/catalog";
import { snippetFor } from "../embeds/spec";

/**
 * **Insert card…**: a card picked by name, inserted at the cursor as its
 * ```garmin block. A note without a day of its own gets the day it was
 * inserted on (`date`), so the card keeps showing that day.
 */
export class InsertCardModal extends FuzzySuggestModal<CardEntry> {
	constructor(
		app: App,
		private readonly editor: Editor,
		private readonly date: string | undefined,
	) {
		super(app);
		this.setPlaceholder("Search cards…");
		this.setInstructions([
			{ command: "↑↓", purpose: "to navigate" },
			{ command: "↵", purpose: "to insert" },
			{ command: "esc", purpose: "to dismiss" },
		]);
	}

	getItems(): CardEntry[] {
		return [...CARDS];
	}

	getItemText(card: CardEntry): string {
		return [card.title, card.id, ...card.aliases].join(" ");
	}

	renderSuggestion(match: FuzzyMatch<CardEntry>, el: HTMLElement): void {
		const card = match.item;
		el.addClass("mod-complex", "gch-card-suggestion");
		setIcon(el.createDiv({ cls: "suggestion-icon" }).createSpan({ cls: "suggestion-flair" }), card.icon);
		const content = el.createDiv({ cls: "suggestion-content" });
		content.createDiv({ cls: "suggestion-title", text: card.title });
		content.createDiv({ cls: "suggestion-note", text: card.description });
		el.createDiv({ cls: "suggestion-aux" }).createSpan({ cls: "gch-card-id", text: card.id });
	}

	onChooseItem(card: CardEntry): void {
		const editor = this.editor;
		const block = snippetFor(card, this.date ? { date: this.date } : {});
		const at = editor.getCursor("from");
		const line = editor.getLine(at.line);
		// A block starts its own line, a blank one below any text: after text, it goes below it.
		if (line.trim() && editor.getSelection() === "") {
			editor.setCursor({ line: at.line, ch: line.length });
			editor.replaceSelection(`\n\n${block}`);
		} else {
			const above = at.line > 0 ? editor.getLine(at.line - 1) : "";
			editor.replaceSelection(`${above.trim() && !line.trim() ? "\n" : ""}${block}`);
		}
	}
}
