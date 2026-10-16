#!/usr/bin/env node
/**
 * Writes `src/garmin/device-names.ts`: Garmin's product names by FIT product
 * number, which an activity's sensors (`metadataDTO.sensors[].fitProductNumber`)
 * are named by — "Rally 100/200" for 3578.
 *
 *   node scripts/api/device-names.mjs <devicelist.json>
 *
 * The input is Garmin's product catalogue, `GET /device-service/devicelist/devices`,
 * saved through `scripts/dev/live-api.sh` (about 1.2 MB). It names products only:
 * nothing in it is about the account. Run it again when a sensor shows its type word
 * instead of its name.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [input] = process.argv.slice(2);
if (!input) {
	console.error("usage: node scripts/api/device-names.mjs <devicelist.json>");
	process.exit(2);
}

const catalogue = JSON.parse(readFileSync(input, "utf8"));
const devices = Array.isArray(catalogue) ? catalogue : catalogue.devices;
if (!Array.isArray(devices)) throw new Error("no devices[] in the catalogue");

/** Where a number names several products (regional and Solar editions), the shortest: the family's name. */
const names = new Map();
for (const device of devices) {
	const number = device.fitProductNumber;
	const name = typeof device.productDisplayName === "string" ? device.productDisplayName.trim() : "";
	if (!Number.isSafeInteger(number) || number <= 0 || !name) continue;
	const held = names.get(number);
	if (held === undefined || name.length < held.length) names.set(number, name);
}

const day = new Date().toISOString().slice(0, 10);
const body = [...names.entries()]
	.sort(([a], [b]) => a - b)
	.map(([number, name]) => `\t${number}: ${JSON.stringify(name)},`)
	.join("\n");
const out = `/**
 * Garmin's product names by FIT product number, for an activity's sensors
 * (\`metadataDTO.sensors[].fitProductNumber\`): "Rally 100/200" for 3578. The
 * activity names its sensors by number only, and the sensors list names a
 * pedal "Rally:<its serial>".
 *
 * Generated on ${day} by \`scripts/api/device-names.mjs\` from Garmin's product
 * catalogue (\`/device-service/devicelist/devices\`, ${names.size} numbers). Where a
 * number names several products (regional and Solar editions), the shortest.
 */
export const DEVICE_NAMES: Readonly<Record<number, string>> = {
${body}
};
`;
writeFileSync("src/garmin/device-names.ts", out);
console.log(`wrote src/garmin/device-names.ts: ${names.size} products, ${out.length.toLocaleString("en-US")} bytes`);
