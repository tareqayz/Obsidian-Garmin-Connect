import { ConfirmationModal, Notice, normalizePath, type App, type TFile } from "obsidian";
import type GarminPlugin from "../main";
import { ensureFolder } from "../sync/vault-paths";
import { dailyNotesOf, templatesFolderOf } from "./core-plugins";
import { cardGuide, dailyTemplate, GUIDE_NAME, TEMPLATE_NAME } from "./notes-text";

/**
 * The two notes the plugin writes, and only when asked: the daily note
 * template and the card guide. Neither is ever written over unasked: the
 * template only once, and the guide again only through **Rebuild card guide**,
 * after a confirmation.
 */

/** Beside the data folder: `Garmin` for `Garmin/data`, the vault's root for a folder at the top. */
function besideData(plugin: GarminPlugin): string {
	const folder = normalizePath(plugin.data.settings.dataFolder);
	return folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
}

function pathIn(folder: string, name: string): string {
	return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
}

/** The template's path: in the Templates folder when the core plugin has one, else beside the data folder. */
export function templatePath(plugin: GarminPlugin): string {
	return pathIn(templatesFolderOf(plugin.app) ?? besideData(plugin), TEMPLATE_NAME);
}

export function guidePath(plugin: GarminPlugin): string {
	return pathIn(besideData(plugin), GUIDE_NAME);
}

/** A note created only if it isn't there: the one that is wins. */
async function createOnce(app: App, path: string, text: string): Promise<{ file: TFile; created: boolean }> {
	const held = app.vault.getFileByPath(path);
	if (held) return { file: held, created: false };
	const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
	if (folder) await ensureFolder(app, folder);
	return { file: await app.vault.create(path, text), created: true };
}

async function show(app: App, file: TFile): Promise<void> {
	await app.workspace.getLeaf("tab").openFile(file);
}

/** **Create daily note template**: written once, then opened. */
export async function createDailyTemplate(plugin: GarminPlugin): Promise<void> {
	const path = templatePath(plugin);
	try {
		const { file, created } = await createOnce(plugin.app, path, dailyTemplate());
		await show(plugin.app, file);
		if (!created) new Notice(`${path} is already there.`);
		else new Notice(dailyNotesOf(plugin.app) ? `Saved ${path}. Choose it in Settings → Daily notes.` : `Saved ${path}.`);
	} catch (err) {
		new Notice(`Couldn't save the template: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/** **Open card guide**: written the first time, opened after. */
export async function openCardGuide(plugin: GarminPlugin): Promise<void> {
	try {
		const { file } = await createOnce(plugin.app, guidePath(plugin), cardGuide(plugin.manifest.version));
		await show(plugin.app, file);
	} catch (err) {
		new Notice(`Couldn't save the card guide: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/** **Rebuild card guide**: the guide written again for this version, once confirmed. */
export function rebuildCardGuide(plugin: GarminPlugin): void {
	const path = guidePath(plugin);
	const held = plugin.app.vault.getFileByPath(path);
	if (!held) {
		void openCardGuide(plugin);
		return;
	}
	const modal = new ConfirmationModal(plugin.app);
	modal.setTitle("Rebuild card guide?");
	modal.setContent(`${path} is written again for this version. Edits you made to it are lost.`);
	modal
		.addButton((b) =>
			b
				.setButtonText("Rebuild")
				.setDestructive()
				.onClick(async () => {
					try {
						await plugin.app.vault.modify(held, cardGuide(plugin.manifest.version));
						await show(plugin.app, held);
					} catch (err) {
						new Notice(`Couldn't rebuild the card guide: ${err instanceof Error ? err.message : String(err)}`);
					}
				}),
		)
		.addCancelButton();
	modal.open();
}
