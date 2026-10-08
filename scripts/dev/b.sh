#!/bin/zsh
# usage: scripts/dev/b.sh <browse command> [args]
# gstack's browser ($B) for the Garmin web app. It always uses its own profile
# outside iCloud (a daemon started without CHROMIUM_PROFILE would put one inside
# the project, which iCloud syncs) and it only passes read-only commands through:
# no cookies, storage, state, cookie import, form filling or arbitrary JS.
set -u
B=${B:-$HOME/.claude/skills/gstack/browse/dist/browse}
export CHROMIUM_PROFILE=${CHROMIUM_PROFILE:-$HOME/.gstack/profiles/garmin-connect/chromium-profile}
cmd=${1:-status}
case $cmd in
	goto|back|forward|reload|url|snapshot|click|hover|press|scroll|wait|text|links|screenshot|viewport) ;;
	status|connect|disconnect|focus|handoff|resume|stop|restart|tabs|tab|newtab|closetab|console|perf) ;;
	network)
		case ${2:-} in
			""|--clear|--capture|--export|--bodies) ;;
			*) print -u2 "b.sh: network ${2:-} is not allowed"; exit 2 ;;
		esac ;;
	eval)
		if [[ ${2:-} != scripts/garmin-web/*.js ]]; then
			print -u2 "b.sh: eval only runs scripts/garmin-web/*.js"; exit 2
		fi ;;
	*) print -u2 "b.sh: '$cmd' is not allowed (read-only wrapper)"; exit 2 ;;
esac
mkdir -p "${CHROMIUM_PROFILE:h}"
exec "$B" "$@"
