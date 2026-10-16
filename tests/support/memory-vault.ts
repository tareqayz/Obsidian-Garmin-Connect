import type { App } from "obsidian";
import { TAbstractFile, TFile, TFolder, normalizePath } from "./obsidian";

/**
 * A vault in memory, for the code that reads and writes files through
 * `app.vault`: the folders and files as Obsidian's own objects, and the few
 * methods the plugin calls.
 */
export class MemoryVault {
	readonly root: TFolder;
	private readonly entries = new Map<string, TAbstractFile>();
	private readonly texts = new Map<string, string>();
	/** Paths written through `modify`, `process` or `create`, oldest first. */
	readonly writes: string[] = [];

	constructor() {
		this.root = new TFolder();
		this.root.path = "/";
		this.entries.set("/", this.root);
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.entries.get(normalizePath(path)) ?? null;
	}

	getFolderByPath(path: string): TFolder | null {
		const entry = this.entries.get(normalizePath(path));
		return entry instanceof TFolder ? entry : null;
	}

	async read(file: TFile): Promise<string> {
		return this.textOf(file);
	}

	async cachedRead(file: TFile): Promise<string> {
		return this.textOf(file);
	}

	async modify(file: TFile, text: string): Promise<void> {
		this.textOf(file);
		this.texts.set(file.path, text);
		this.writes.push(file.path);
	}

	async process(file: TFile, fn: (text: string) => string): Promise<string> {
		const next = fn(this.textOf(file));
		await this.modify(file, next);
		return next;
	}

	async create(path: string, text: string): Promise<TFile> {
		const at = normalizePath(path);
		if (this.entries.has(at)) throw new Error(`File already exists: ${at}`);
		const file = new TFile();
		this.place(file, at);
		this.texts.set(at, text);
		this.writes.push(at);
		return file;
	}

	async createFolder(path: string): Promise<TFolder> {
		const at = normalizePath(path);
		if (this.entries.has(at)) throw new Error(`Folder already exists: ${at}`);
		const folder = new TFolder();
		this.place(folder, at);
		return folder;
	}

	async rename(file: TAbstractFile, path: string): Promise<void> {
		const to = normalizePath(path);
		if (this.entries.has(to)) throw new Error(`Destination exists: ${to}`);
		const from = file.path;
		const text = this.texts.get(from);
		this.entries.delete(from);
		this.texts.delete(from);
		file.parent?.children.splice(file.parent.children.indexOf(file), 1);
		this.place(file, to);
		if (text !== undefined) this.texts.set(to, text);
	}

	/* For the tests ------------------------------------------------- */

	/** Puts a file in place, folders and all, without counting it as a write. */
	seed(path: string, text: string): void {
		const at = normalizePath(path);
		const existing = this.entries.get(at);
		if (existing instanceof TFile) {
			this.texts.set(at, text);
			return;
		}
		const file = new TFile();
		this.place(file, at);
		this.texts.set(at, text);
	}

	/** A file's text, or undefined when there is no file. */
	text(path: string): string | undefined {
		return this.texts.get(normalizePath(path));
	}

	/** The names in a folder, sorted. */
	list(path: string): string[] {
		const folder = this.entries.get(normalizePath(path));
		return folder instanceof TFolder ? folder.children.map((child) => child.name).sort() : [];
	}

	/** This vault as `app` holds it. */
	asApp(): App {
		return { vault: this } as unknown as App;
	}

	private textOf(file: TFile): string {
		const text = this.texts.get(file.path);
		if (text === undefined) throw new Error(`No such file: ${file.path}`);
		return text;
	}

	/** Files `entry` at `path`, making the folders above it. */
	private place(entry: TAbstractFile, path: string): void {
		const slash = path.lastIndexOf("/");
		const parentPath = slash > 0 ? path.slice(0, slash) : "/";
		let parent = this.entries.get(parentPath);
		if (!parent) {
			const folder = new TFolder();
			this.place(folder, parentPath);
			parent = folder;
		}
		if (!(parent instanceof TFolder)) throw new Error(`Not a folder: ${parentPath}`);
		entry.path = path;
		entry.name = slash >= 0 ? path.slice(slash + 1) : path;
		entry.parent = parent;
		parent.children.push(entry);
		this.entries.set(path, entry);
	}
}
