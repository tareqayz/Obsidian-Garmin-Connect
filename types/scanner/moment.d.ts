// The Community directory's scanner has no `moment` package, which "obsidian" only pulls in as its own
// dependency, so there `moment` from "obsidian" has no type. src/tsconfig.json points `moment` here so
// `npm run lint` and svelte-check see it the same way: give each moment call a local type.
declare const moment: unknown;
export = moment;
