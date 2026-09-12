import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	BAR_MAX,
	GAP,
	PAD,
	anchorFor,
	barPath,
	barWidth,
	buildScale,
	linePath,
	xLabelIndices,
} from "../src/dashboard/scales";

const scale = (over: Partial<Parameters<typeof buildScale>[0]> = {}) =>
	buildScale({ count: 4, values: [0, 50, 100, 25], width: 446, height: 200, ...over });

describe("buildScale", () => {
	it("puts the plot inside the padding", () => {
		const s = scale();
		assert.equal(s.inner.w, 446 - PAD.left - PAD.right);
		assert.equal(s.inner.h, 200 - PAD.top - PAD.bottom);
	});

	it("maps the extremes to the plot edges", () => {
		const s = scale();
		assert.equal(s.y(s.max), 0);
		assert.equal(s.y(s.min), s.inner.h);
	});

	it("centres each value in its band", () => {
		const s = scale();
		assert.equal(s.x(0), s.band / 2);
		assert.equal(s.x(3), s.band * 3 + s.band / 2);
	});

	it("starts bars at zero even when the data does not", () => {
		assert.equal(scale({ values: [40, 60] }).min, 0);
	});

	it("gives a line headroom instead of clamping to zero", () => {
		const s = scale({ values: [48, 52], zeroBased: false });
		assert.ok(s.min > 0 && s.min < 48, `expected padding below 48, got ${s.min}`);
		assert.ok(s.max > 52);
	});

	it("keeps a flat series readable rather than dividing by zero", () => {
		const s = scale({ values: [7, 7, 7] });
		assert.ok(Number.isFinite(s.y(7)));
		assert.notEqual(s.min, s.max);
	});

	it("makes room for a goal above every value", () => {
		assert.ok(scale({ values: [100, 200], goal: 10000 }).max >= 10000);
	});

	it("never lets a narrow pane produce a negative plot", () => {
		const s = scale({ width: 10, height: 10 });
		assert.ok(s.inner.w > 0 && s.inner.h > 0);
	});
});

describe("barPath", () => {
	it("is rounded at the data end and square at the baseline", () => {
		const d = barPath(10, 20, 24, 60);
		// Starts at the baseline, curves at the top, returns to the baseline.
		assert.ok(d.startsWith("M10,80"), d);
		assert.equal((d.match(/Q/g) ?? []).length, 2);
		assert.ok(d.endsWith("Z"));
	});

	it("never rounds more than the bar can carry", () => {
		// A 1px-tall bar must not produce a radius bigger than itself.
		assert.ok(barPath(0, 0, 2, 1).includes("Q"));
		assert.doesNotThrow(() => barPath(0, 0, 1, 0));
	});
});

describe("barWidth", () => {
	it("caps the bar so the band keeps its air", () => {
		assert.equal(barWidth(scale({ count: 2 })), BAR_MAX);
	});

	it("leaves the surface gap between neighbours when bands are tight", () => {
		const s = scale({ count: 120 });
		assert.equal(barWidth(s), Math.max(1, s.band - GAP));
	});

	it("never goes to zero on a year of data", () => {
		assert.ok(barWidth(scale({ count: 365, width: 300 })) >= 1);
	});
});

describe("linePath", () => {
	it("moves once and lines thereafter", () => {
		const s = scale();
		const d = linePath([0, 50, 100], s);
		assert.equal((d.match(/M/g) ?? []).length, 1);
		assert.equal((d.match(/L/g) ?? []).length, 2);
	});
});

describe("xLabelIndices", () => {
	it("labels first, last and two between — never one per column", () => {
		assert.deepEqual(xLabelIndices(30), [0, 10, 20, 29]);
	});

	it("labels every point when there are only a few", () => {
		assert.deepEqual(xLabelIndices(3), [0, 1, 2]);
	});

	it("copes with an empty series", () => {
		assert.deepEqual(xLabelIndices(0), []);
	});

	it("never repeats an index", () => {
		for (const n of [5, 6, 7, 12, 365]) {
			const got = xLabelIndices(n);
			assert.equal(new Set(got).size, got.length, `duplicates for ${n}`);
		}
	});
});

describe("anchorFor", () => {
	it("tucks the end labels inside the plot", () => {
		assert.equal(anchorFor(0, 10), "start");
		assert.equal(anchorFor(9, 10), "end");
		assert.equal(anchorFor(4, 10), "middle");
	});
});
