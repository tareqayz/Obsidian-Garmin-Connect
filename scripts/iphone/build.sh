#!/bin/zsh
# Builds scripts/iphone/mirror.swift into a signed background app in
# $MIRROR_HOME (default ~/Library/Application Support/garmin-mirror; outside
# iCloud, whose extended attributes codesign rejects). macOS ties Screen Recording and
# Accessibility to the app's signature, so sign with a stable identity (the
# first "Apple Development" one, or MIRROR_SIGN_ID) and the grants survive
# rebuilds. Without one it signs ad hoc and every rebuild needs new grants.
set -euo pipefail
ROOT=${0:A:h:h:h}
DIR=${MIRROR_HOME:-$HOME/Library/Application Support/garmin-mirror}
APP="$DIR/GarminMirror.app"
mkdir -p "$APP/Contents/MacOS"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key><string>dev.tareqayz.garmin-mirror</string>
	<key>CFBundleName</key><string>Garmin Mirror</string>
	<key>CFBundleDisplayName</key><string>Garmin Mirror</string>
	<key>CFBundleExecutable</key><string>garmin-mirror</string>
	<key>CFBundlePackageType</key><string>APPL</string>
	<key>CFBundleShortVersionString</key><string>1.0</string>
	<key>CFBundleVersion</key><string>1</string>
	<key>LSMinimumSystemVersion</key><string>15.0</string>
	<key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
swiftc -O -swift-version 5 -o "$APP/Contents/MacOS/garmin-mirror" "$ROOT/scripts/iphone/mirror.swift"
ID=${MIRROR_SIGN_ID:-$(security find-identity -v -p codesigning | awk '/Apple Development/ {print $2; exit}')}
codesign --force --timestamp=none --sign "${ID:--}" "$APP"
print -r -- "built $APP (signed with ${ID:-ad hoc})"
