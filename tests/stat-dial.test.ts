import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Tone } from "../src/dashboard/gauges";
import { PHONE } from "../src/dashboard/stat-charts";
import { DIAL_CENTRE, DIAL_KINDS, dialAngle, dialFraction, dialGeometry, segmentsFromAngles, type DialKind } from "../src/dashboard/stat-dial";

/*
 * The Obsidian twin's Stat Dial (442:1349), as measured off the 2026-10-11
 * phone shots: each kind's band boundaries in degrees from 12 o'clock, the
 * marker's angle, and where the twin puts the caps and the marker in the
 * 196 × 196 frame (a node's box plus half its size).
 */
const TWIN: Record<Exclude<DialKind, "tolerance">, { angles: number[]; tones: Tone[]; at?: number; cap: [number, number]; marker?: [number, number] }> = {
	vo2: { angles: [-150, -30, 15, 60, 105, 150], tones: ["red", "orange", "green", "blue", "purple"], at: 102.8, cap: [58, 167.28], marker: [176.01, 115.72] },
	readiness: { angles: [-150, -84.9, -4.8, 75.2, 139.1, 150], tones: ["red", "orange", "green", "blue", "purple"], at: -105.6, cap: [56, 170.75], marker: [17.09, 120.59] },
	ftp: { angles: [-150, -38.9, -10.95, 45, 101.9, 150], tones: ["red", "orange", "green", "blue", "purple"], at: 51.3, cap: [58.5, 166.42], marker: [159.65, 48.61] },
	hill: { angles: [-150, -72, 4.55, 64.5, 108, 135.1, 150], tones: ["red", "orange", "green", "blue", "purple", "pink"], at: -62.9, cap: [56.7, 169.53], marker: [24.47, 60.37] },
	endurance: {
		angles: [-150, -84.3, -54.25, -20.05, 10.1, 44.35, 74.4, 150],
		tones: ["red", "orange", "yellow", "green", "blue", "purple", "pink"],
		at: -28.1,
		cap: [56.7, 169.53],
		marker: [59.09, 25.14],
	},
	hrv: { angles: [-150, -118.4, -75.2, 88.1, 150], tones: ["red", "orange", "green", "orange"], at: 23.4, cap: [56, 170.75], marker: [131.36, 20.91] },
	recovery: { angles: [-150, 150], tones: ["red"], cap: [56.5, 169.88] },
};

const near = (actual: number, expected: number, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);

function geometryOf(kind: Exclude<DialKind, "tolerance">) {
	const twin = TWIN[kind];
	const segments = segmentsFromAngles(twin.angles, twin.tones);
	const at = twin.at === undefined ? undefined : dialFraction(twin.at);
	return dialGeometry(kind, { segments, at, tone: twin.tones[1] });
}

describe("the stat dial, against its twin", () => {
	it("sweeps 300°, its ends at ±150° from 12 o'clock", () => {
		assert.equal(dialAngle(0), -150);
		assert.equal(dialAngle(1), 150);
		assert.equal(dialAngle(0.5), 0);
		assert.equal(dialFraction(102.8), 252.8 / 300);
		// A dial sits centred on the phone's 402.
		assert.equal(PHONE / 2 - DIAL_CENTRE, 103);
	});

	it("leaves half the gap either side of each boundary, none at the ends", () => {
		const vo2 = geometryOf("vo2");
		assert.deepEqual(
			vo2.bands.map((b) => [Number(b.from.toFixed(2)), Number(b.to.toFixed(2)), b.tone]),
			[
				[-150, -30.95, "red"],
				[-29.05, 14.05, "orange"],
				[15.95, 59.05, "green"],
				[60.95, 104.05, "blue"],
				[105.95, 150, "purple"],
			],
		);
		// The twin's arcs, in Figma's radians from 3 o'clock: band 1 ends at −2.110976, band 2 starts at −2.077815.
		near(((vo2.bands[0]!.to - 90) * Math.PI) / 180, -2.110975742340088, 1e-6);
		near(((vo2.bands[1]!.from - 90) * Math.PI) / 180, -2.0778145790100098, 1e-6);
		const readiness = geometryOf("readiness");
		assert.deepEqual(readiness.bands.map((b) => Number(b.from.toFixed(2))), [-150, -83.4, -3.3, 76.7, 140.6]);
	});

	it("sets each kind's ring, caps and marker where the twin has them", () => {
		for (const kind of Object.keys(TWIN) as Array<keyof typeof TWIN>) {
			const twin = TWIN[kind];
			const g = geometryOf(kind);
			const spec = DIAL_KINDS[kind];
			assert.equal(g.rc, spec.radius - spec.width / 2, kind);
			assert.equal(g.bands.length, twin.tones.length, kind);
			near(g.caps[0]!.x, twin.cap[0]);
			near(g.caps[0]!.y, twin.cap[1]);
			// The end cap mirrors the start.
			near(g.caps[1]!.x, 2 * DIAL_CENTRE - twin.cap[0]);
			near(g.caps[1]!.y, twin.cap[1]);
			assert.equal(g.caps[0]!.r, spec.width / 2, kind);
			assert.equal(g.caps[0]!.tone, twin.tones[0]);
			assert.equal(g.caps[1]!.tone, twin.tones.at(-1));
			if (twin.marker) {
				near(g.marker!.x, twin.marker[0]);
				near(g.marker!.y, twin.marker[1]);
				assert.equal(g.marker!.outline, kind === "readiness" || kind === "hrv" ? 4 : 2, kind);
			} else {
				assert.equal(g.marker, undefined, kind);
			}
		}
	});

	it("lays VO₂ Max's bands over a page-coloured ring, and no other kind's", () => {
		assert.ok(geometryOf("vo2").separators?.startsWith("M58 167.28A80 80 0 1 1 138 167.28"));
		assert.equal(geometryOf("hill").separators, undefined);
	});

	it("fills a full ring's share from 12 o'clock over a track: Running Tolerance's 28.2 of 37 km", () => {
		const g = dialGeometry("tolerance", null, 28.2 / 37);
		assert.equal(g.rc, 80);
		assert.ok(g.track?.startsWith("M98 18A80 80"));
		// 273.6° round: the arc ends left of 12 o'clock, above the centre.
		assert.ok(g.progress?.startsWith("M98 18A80 80 0 1 1 "));
		const end = g.progress!.split(" ").slice(-2).map(Number);
		near(end[0]!, 98 + 80 * Math.sin((274.38 * Math.PI) / 180), 0.05);
		assert.deepEqual([g.bands, g.caps, g.marker], [[], [], undefined]);
		assert.equal(dialGeometry("tolerance", null, 0).progress, undefined);
	});

	it("draws nothing it cannot place: no bands, no caps, no marker without a gauge", () => {
		const g = dialGeometry("vo2", null);
		assert.deepEqual([g.bands, g.caps, g.marker], [[], [], undefined]);
		assert.equal(dialGeometry("vo2", { segments: segmentsFromAngles([-150, 150], ["blue"]) }).marker, undefined);
	});
});
