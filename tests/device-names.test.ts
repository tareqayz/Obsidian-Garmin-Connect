import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DEVICE_NAMES } from "../src/garmin/device-names";

describe("device names", () => {
	it("names a sensor by its FIT product number, as the app does", () => {
		assert.equal(DEVICE_NAMES[3578], "Rally 100/200");
		assert.equal(DEVICE_NAMES[4607], "HRM 600");
	});

	it("holds product names only: positive numbers, short names, no serial", () => {
		for (const [number, name] of Object.entries(DEVICE_NAMES)) {
			assert.ok(Number.isSafeInteger(Number(number)) && Number(number) > 0, number);
			assert.ok(name.length > 0 && name.length <= 60, name);
			assert.ok(!/:\s*\d/.test(name), `${name} looks like it carries a serial`);
		}
	});
});
