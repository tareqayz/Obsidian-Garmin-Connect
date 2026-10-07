#!/bin/zsh
# usage: scripts/dev/test.sh '<name-glob>'      e.g. scripts/dev/test.sh 'stress-*'
# Bundles and runs only the matching tests/*.test.ts in tests/.build-<slug>/, so
# agents testing in parallel don't overwrite each other's tests/.build.
set -euo pipefail
cd ${0:A:h:h:h}
GLOB=${1:?usage: test.sh '<name-glob>'}
SLUG=$(print -r -- "$GLOB" | tr -c 'A-Za-z0-9\n' '-' | sed 's/-*$//')
OUT="tests/.build-$SLUG"
files=(tests/${~GLOB}.test.ts(N))
(( ${#files} )) || { print -u2 "no tests match tests/$GLOB.test.ts"; exit 2 }
rm -rf "$OUT"
npx esbuild "${files[@]}" --bundle --platform=node --format=esm --target=node20 --outdir="$OUT" --out-extension:.js=.mjs --log-level=warning
node --test "$OUT"/*.mjs
