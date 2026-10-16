/**
 * What the code under test imports from "obsidian" at runtime. The test build
 * aliases "obsidian" to this file (package.json's `test` script); type checks
 * still read the real typings, so this only has to behave like them.
 */

export class TAbstractFile {
	path = "";
	name = "";
	parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
	stat = { ctime: 0, mtime: 0, size: 0 };

	get basename(): string {
		const dot = this.name.lastIndexOf(".");
		return dot > 0 ? this.name.slice(0, dot) : this.name;
	}

	get extension(): string {
		const dot = this.name.lastIndexOf(".");
		return dot > 0 ? this.name.slice(dot + 1) : "";
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];

	isRoot(): boolean {
		return this.path === "/";
	}
}

/** As Obsidian's: one slash between parts, none at either end, and "/" for nothing at all. */
export function normalizePath(path: string): string {
	const clean = path.replace(/[\\/]+/g, "/").replace(/^\/|\/$/g, "").replace(/\u00A0/g, " ").normalize();
	return clean === "" ? "/" : clean;
}

export const apiVersion = "1.14.4";

/** A Mac, unless a test says otherwise. */
export const Platform = {
	isDesktopApp: true,
	isMobileApp: false,
	isIosApp: false,
	isAndroidApp: false,
	isTablet: false,
	isMacOS: true,
	isWin: false,
	isLinux: false,
};

/** Every Notice shown since the last `clearNotices`, oldest first. */
export const notices: string[] = [];

export function clearNotices(): void {
	notices.length = 0;
}

export class Notice {
	constructor(message: string | DocumentFragment, _duration?: number) {
		notices.push(String(message));
	}

	setMessage(message: string | DocumentFragment): this {
		notices.push(String(message));
		return this;
	}

	hide(): void {}
}
