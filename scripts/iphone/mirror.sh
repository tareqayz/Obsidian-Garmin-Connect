#!/bin/zsh
# usage: scripts/iphone/mirror.sh <command> [args]
#   doctor [--prompt]                 permissions, window geometry, kill switch
#   shot <out.png> [--ocr <out.json>] capture the phone screen (+ OCR with tap points)
#   ocr [--grep <text>]               visible text with boxes in phone points
#   ocr-file <png>                    OCR any image (e.g. a native screenshot) the same way
#   calibrate <native.png>            re-fit the window mapping (phone on the Garmin Home tab)
#   tap --text "<label>" [--nth k] [--contains] | tap --xy X Y --why "<step>"
#   back                              tap the navigation bar's back chevron
#   scroll down|up <points> [--at <y>]
#   key cmd+1|cmd+2|cmd+3|return|escape
#   type "<text>"                     Spotlight search only
#   open-app "<App Name>"
#   stop | resume                     kill switch: refuse all input until resumed
# Runs the signed helper app, so macOS permissions belong to it and not to the
# terminal. State (input.log, last.png, STOP) lives in $MIRROR_HOME.
set -u
DIR=${MIRROR_HOME:-$HOME/Library/Application Support/garmin-mirror}
APP="$DIR/GarminMirror.app"
if [[ ! -x "$APP/Contents/MacOS/garmin-mirror" ]]; then
	print -r -- '{"detail":"npm run iphone:build","error":"NOT_BUILT","ok":false}'; exit 2
fi
cmd=${1:-doctor}; (( $# )) && shift
case $cmd in
	stop) mkdir -p "$DIR" && touch "$DIR/STOP" && print -r -- '{"ok":true,"stopped":true}'; exit 0 ;;
	resume) rm -f "$DIR/STOP" && print -r -- '{"ok":true,"stopped":false}'; exit 0 ;;
esac
args=()
while (( $# )); do
	case $1 in
		--ocr) args+=("$1" "${2:A}"); shift 2 ;;
		*) args+=("$1"); shift ;;
	esac
done
# The app starts in /, so the output path must be absolute.
if [[ ($cmd == shot || $cmd == ocr-file || $cmd == calibrate) && ${#args} -gt 0 && ${args[1]} != --* ]]; then args[1]=${args[1]:A}; fi
case $cmd in
	tap|back|scroll|key|type|open-app)
		if [[ -e "$DIR/STOP" ]]; then print -r -- '{"error":"KILL_SWITCH","ok":false}'; exit 1; fi
		# Activate iPhone Mirroring first; a click that has to activate the window is lost.
		if ! lsappinfo info -only bundleid "$(lsappinfo front)" | grep -q com.apple.ScreenContinuity; then
			open -b com.apple.ScreenContinuity && sleep 0.9
		fi ;;
esac
out=$(mktemp -t garmin-mirror)
open -W -n -g --stdout "$out" --stderr "$out" -a "$APP" --args --state "$DIR" "$cmd" "${args[@]}" 2>/dev/null
# open -W can return before a fast helper has flushed; wait for its JSON line.
for _ in {1..150}; do grep -q '}' "$out" && break; sleep 0.1; done
cat "$out"
grep -q '"ok":true' "$out"; rc=$?
rm -f "$out"
exit $rc
