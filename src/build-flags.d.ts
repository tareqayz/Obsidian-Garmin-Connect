/**
 * Compile-time flags replaced by esbuild's `define`.
 *
 * A `false` flag makes the branch that reads it dead code, so everything only
 * that branch reaches is dropped from the bundle rather than shipped unused.
 */

/** True in `npm run dev`, false in a production build. Gates the UI gallery. */
declare const __GALLERY__: boolean;
