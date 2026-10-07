// Drives the iPhone Mirroring window for the garmin-page pipeline: capture, OCR,
// taps, wheel scrolls and keys. It is built into a signed background app
// (scripts/iphone/build.sh) and run through scripts/iphone/mirror.sh, so macOS
// grants Screen Recording and Accessibility to this helper rather than to the
// terminal that launches it. Every command prints one JSON object.
//
// Phone coordinates are points on a 402-pt-wide screen (iPhone 16/17 Pro), with
// the origin at the top left, the same space the Figma frames use.

import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import ImageIO
import Vision

let mirroringBundle = "com.apple.ScreenContinuity"

// MARK: - Output

func emit(_ obj: [String: Any]) -> Never {
	let data = (try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys]))
		?? Data("{\"error\":\"JSON\",\"ok\":false}".utf8)
	FileHandle.standardOutput.write(data)
	FileHandle.standardOutput.write(Data("\n".utf8))
	exit((obj["ok"] as? Bool) == true ? 0 : 1)
}

func fail(_ code: String, _ detail: String = "") -> Never {
	emit(["ok": false, "error": code, "detail": detail])
}

// Decimal numbers serialise exactly ("365.6", not "365.60000000000002").
func r1(_ v: Double) -> NSDecimalNumber { NSDecimalNumber(string: String(format: "%.1f", v)) }
func r3(_ v: Double) -> NSDecimalNumber { NSDecimalNumber(string: String(format: "%.3f", v)) }

// MARK: - Arguments

var argv = Array(CommandLine.arguments.dropFirst()).filter { !$0.hasPrefix("-psn") }

func takeFlag(_ name: String) -> String? {
	guard let i = argv.firstIndex(of: name), i + 1 < argv.count else { return nil }
	let value = argv[i + 1]
	argv.removeSubrange(i...(i + 1))
	return value
}

func takeSwitch(_ name: String) -> Bool {
	guard let i = argv.firstIndex(of: name) else { return false }
	argv.remove(at: i)
	return true
}

let stateDir = takeFlag("--state") ?? NSTemporaryDirectory()
let phoneWidth = Double(takeFlag("--phone-width") ?? "") ?? 402
let command = argv.isEmpty ? "doctor" : argv.removeFirst()

func statePath(_ name: String) -> String { (stateDir as NSString).appendingPathComponent(name) }

func readState() -> [String: Any] {
	guard let data = try? Data(contentsOf: URL(fileURLWithPath: statePath("state.json"))),
		let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
	return obj
}

func markPost() {
	var state = readState()
	state["lastPost"] = Date().timeIntervalSince1970
	if let data = try? JSONSerialization.data(withJSONObject: state) {
		try? data.write(to: URL(fileURLWithPath: statePath("state.json")))
	}
}

/// Audit trail of every input event, so a capture run can be reviewed afterwards.
func audit(_ line: String) {
	let stamp = ISO8601DateFormatter().string(from: Date())
	let entry = Data("\(stamp) \(line)\n".utf8)
	let url = URL(fileURLWithPath: statePath("input.log"))
	if let handle = try? FileHandle(forWritingTo: url) {
		handle.seekToEndOfFile()
		handle.write(entry)
		try? handle.close()
	} else {
		try? entry.write(to: url)
	}
}

// MARK: - The mirroring window

struct Win {
	let id: CGWindowID
	let pid: pid_t
	let frame: CGRect
	/// Screen points per phone point.
	var scale: Double { Double(frame.width) / phoneWidth }
	func screen(_ p: CGPoint) -> CGPoint {
		CGPoint(x: frame.minX + p.x * scale, y: frame.minY + p.y * scale)
	}
}

func windowList(_ options: CGWindowListOption) -> [[String: Any]] {
	(CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]]) ?? []
}

func bounds(_ w: [String: Any]) -> CGRect? {
	guard let dict = w[kCGWindowBounds as String] as? NSDictionary else { return nil }
	return CGRect(dictionaryRepresentation: dict)
}

func mirroringApp() -> NSRunningApplication? {
	NSRunningApplication.runningApplications(withBundleIdentifier: mirroringBundle).first
}

func mirroringWindow() -> Win? {
	guard let app = mirroringApp() else { return nil }
	var best: Win?
	for w in windowList([.optionOnScreenOnly, .excludeDesktopElements]) {
		guard (w[kCGWindowOwnerPID as String] as? Int) == Int(app.processIdentifier),
			(w[kCGWindowLayer as String] as? Int) == 0,
			let id = w[kCGWindowNumber as String] as? Int,
			let r = bounds(w), r.width > 150, r.height > 300 else { continue }
		if best == nil || r.width * r.height > best!.frame.width * best!.frame.height {
			best = Win(id: CGWindowID(id), pid: app.processIdentifier, frame: r)
		}
	}
	return best
}

func requireWindow() -> Win {
	guard mirroringApp() != nil else { fail("NOT_RUNNING", "open iPhone Mirroring") }
	guard let win = mirroringWindow() else { fail("NO_WINDOW", "iPhone Mirroring has no visible window") }
	return win
}

// MARK: - Capture and OCR

func capture(_ win: Win, to path: String) -> CGImage {
	guard CGPreflightScreenCaptureAccess() else { fail("NO_SCREEN_RECORDING", "grant Screen Recording to Garmin Mirror") }
	let p = Process()
	p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
	p.arguments = ["-x", "-o", "-l", String(win.id), path]
	do { try p.run() } catch { fail("CAPTURE_FAILED", "\(error)") }
	p.waitUntilExit()
	guard p.terminationStatus == 0,
		let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
		let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
		fail("CAPTURE_FAILED", "screencapture exited \(p.terminationStatus)")
	}
	return img
}

/// Standard deviation of a small grey thumbnail: near zero for a blank frame.
func lumaSpread(_ img: CGImage) -> Double {
	let w = 32, h = 64
	var px = [UInt8](repeating: 0, count: w * h)
	px.withUnsafeMutableBytes { buf in
		guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8,
			bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(),
			bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return }
		ctx.interpolationQuality = .low
		ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
	}
	let mean = px.reduce(0.0) { $0 + Double($1) } / Double(px.count)
	let variance = px.reduce(0.0) { $0 + pow(Double($1) - mean, 2) } / Double(px.count)
	return variance.squareRoot()
}

struct Item {
	let text: String
	let conf: Double
	let x: Double, y: Double, w: Double, h: Double
	var cx: Double { x + w / 2 }
	var cy: Double { y + h / 2 }
	var json: [String: Any] {
		["t": text, "c": r3(conf), "x": r1(x), "y": r1(y), "w": r1(w), "h": r1(h)]
	}
}

func ocr(_ img: CGImage) -> [Item] {
	let req = VNRecognizeTextRequest()
	req.recognitionLevel = .accurate
	req.usesLanguageCorrection = false // keep numbers and units verbatim
	req.recognitionLanguages = ["en-US"]
	do { try VNImageRequestHandler(cgImage: img, options: [:]).perform([req]) } catch { return [] }
	let W = Double(img.width), H = Double(img.height)
	let ppt = W / phoneWidth
	let items: [Item] = (req.results ?? []).compactMap { obs in
		guard let c = obs.topCandidates(1).first else { return nil }
		let b = obs.boundingBox // normalised, origin at the bottom left
		return Item(text: c.string, conf: Double(c.confidence),
			x: b.minX * W / ppt, y: (1 - b.maxY) * H / ppt, w: b.width * W / ppt, h: b.height * H / ppt)
	}
	return items.sorted { (Int($0.y / 6), $0.x) < (Int($1.y / 6), $1.x) }
}

/// Screens the agent must stop on rather than act through.
let blockingPhrases = ["iphone in use", "unlock iphone", "unlock your iphone", "iphone is locked", "paused", "connecting", "try again", "not available"]

func describe(_ img: CGImage, _ items: [Item]) -> [String: Any] {
	let ppt = Double(img.width) / phoneWidth
	let lower = items.map { $0.text.lowercased() }
	let blocking = blockingPhrases.filter { phrase in lower.contains { $0.contains(phrase) } }
	return [
		"pxPerPt": r3(ppt),
		"sizePt": [r1(phoneWidth), r1(Double(img.height) / ppt)],
		"blank": items.isEmpty && lumaSpread(img) < 4,
		"blocking": blocking,
	]
}

// MARK: - Input safety

/// Labels that change data, settings or the account. A tap on, or right next
/// to, any of them is refused.
let deniedLabels = [
	"edit", "delete", "remove", "add", "save", "log", "sync", "start", "stop", "reset", "connect",
	"pair", "unpair", "upgrade", "subscribe", "buy", "done", "clear", "share", "send", "record",
	"measure", "sign out", "log out", "+",
]

func isDenied(_ s: String) -> Bool {
	let t = s.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
	return deniedLabels.contains { t == $0 || t.hasPrefix($0 + " ") }
}

/// The right side of the navigation bar holds ⋮, + and pencil icons.
func forbiddenZone(_ p: CGPoint) -> Bool { p.x > 300 && p.y < 110 }

func secondsSinceInput() -> Double {
	let types: [CGEventType] = [.mouseMoved, .leftMouseDown, .rightMouseDown, .otherMouseDown,
		.leftMouseDragged, .scrollWheel, .keyDown, .flagsChanged]
	return types.map { CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: $0) }.min() ?? 1e9
}

/// True when someone used the Mac after this helper's last event, within 20 s.
func userActive() -> Bool {
	let idle = secondsSinceInput()
	let last = readState()["lastPost"] as? Double ?? 0
	let sinceOurs = Date().timeIntervalSince1970 - last
	return idle < 20 && idle + 1.0 < sinceOurs
}

func occluder(at sp: CGPoint, _ win: Win) -> String? {
	for w in windowList([.optionOnScreenOnly]) { // front to back
		guard let r = bounds(w), r.contains(sp) else { continue }
		let layer = w[kCGWindowLayer as String] as? Int ?? 0
		let alpha = w[kCGWindowAlpha as String] as? Double ?? 1
		let owner = w[kCGWindowOwnerName as String] as? String ?? "?"
		if alpha < 0.05 || layer >= 1000 || owner == "Window Server" { continue }
		if (w[kCGWindowNumber as String] as? Int) == Int(win.id) { return nil }
		if owner == "Dock" && layer > 0 { continue }
		return "\(owner) (layer \(layer))"
	}
	return "no window at point"
}

func guardInput(_ win: Win, _ phonePoint: CGPoint?) {
	if FileManager.default.fileExists(atPath: statePath("STOP")) { fail("KILL_SWITCH", statePath("STOP")) }
	if !AXIsProcessTrusted() { fail("NO_ACCESSIBILITY", "grant Accessibility to Garmin Mirror") }
	if userActive() { fail("USER_ACTIVE", "the Mac was used in the last 20 s; wait and retry") }
	let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
	if front != mirroringBundle { fail("NOT_FRONTMOST", front) }
	if let p = phonePoint, let who = occluder(at: win.screen(p), win) { fail("OCCLUDED", who) }
}

// MARK: - Events

func post(_ e: CGEvent?) { e?.post(tap: .cghidEventTap) }

func withCursorRestored(_ body: () -> Void) {
	let saved = CGEvent(source: nil)?.location
	body()
	if let s = saved {
		_ = CGWarpMouseCursorPosition(s)
		_ = CGAssociateMouseAndMouseCursorPosition(1)
	}
	markPost()
}

func click(_ sp: CGPoint) {
	let src = CGEventSource(stateID: .hidSystemState)
	withCursorRestored {
		post(CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: sp, mouseButton: .left))
		usleep(50_000)
		post(CGEvent(mouseEventSource: src, mouseType: .leftMouseDown, mouseCursorPosition: sp, mouseButton: .left))
		usleep(80_000)
		post(CGEvent(mouseEventSource: src, mouseType: .leftMouseUp, mouseCursorPosition: sp, mouseButton: .left))
		usleep(60_000)
	}
}

/// Vertical wheel scroll by `points` phone points. Never horizontal: a sideways
/// swipe over a chart changes the period.
func scroll(_ win: Win, down: Bool, points: Double, at p: CGPoint) {
	let sp = win.screen(p)
	let src = CGEventSource(stateID: .hidSystemState)
	withCursorRestored {
		post(CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: sp, mouseButton: .left))
		usleep(50_000)
		let total = points * win.scale
		let steps = max(1, Int((total / 12).rounded()))
		let per = Int32((total / Double(steps)).rounded()) * (down ? -1 : 1)
		for _ in 0..<steps {
			let e = CGEvent(scrollWheelEvent2Source: src, units: .pixel, wheelCount: 1, wheel1: per, wheel2: 0, wheel3: 0)
			e?.location = sp
			post(e)
			usleep(12_000)
		}
		usleep(450_000)
	}
}

let keyCodes: [String: CGKeyCode] = [
	"0": 29, "1": 18, "2": 19, "3": 20, "=": 24, "-": 27,
	"return": 36, "escape": 53, "tab": 48, "space": 49, "delete": 51,
	"up": 126, "down": 125, "left": 123, "right": 124,
]

func key(_ combo: String) {
	let parts = combo.lowercased().split(separator: "+").map(String.init)
	var flags: CGEventFlags = []
	for m in parts.dropLast() {
		switch m {
		case "cmd": flags.insert(.maskCommand)
		case "shift": flags.insert(.maskShift)
		case "alt", "opt": flags.insert(.maskAlternate)
		case "ctrl": flags.insert(.maskControl)
		default: fail("BAD_KEY", combo)
		}
	}
	guard let last = parts.last, let code = keyCodes[last] else { fail("BAD_KEY", combo) }
	let src = CGEventSource(stateID: .hidSystemState)
	let down = CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: true)
	down?.flags = flags
	post(down)
	usleep(40_000)
	let up = CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: false)
	up?.flags = flags
	post(up)
	markPost()
}

func typeText(_ s: String) {
	let src = CGEventSource(stateID: .hidSystemState)
	for unit in s.utf16 {
		var c = unit
		let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true)
		down?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c)
		post(down)
		let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false)
		up?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c)
		post(up)
		usleep(30_000)
	}
	markPost()
}

/// Resolves a tap target and refuses anything unsafe.
func tapTarget(_ items: [Item]) -> (CGPoint, String) {
	let why = takeFlag("--why") ?? ""
	var target: CGPoint
	var label = ""
	if let text = takeFlag("--text") {
		if isDenied(text) { fail("DENIED_LABEL", text) }
		let nth = Int(takeFlag("--nth") ?? "1") ?? 1
		let contains = takeSwitch("--contains")
		let want = text.lowercased()
		let matches = items.filter {
			let t = $0.text.lowercased().trimmingCharacters(in: .whitespaces)
			return contains ? t.contains(want) : t == want
		}
		guard nth >= 1, matches.count >= nth else { fail("LABEL_NOT_FOUND", "\(text): \(matches.count) match(es)") }
		let m = matches[nth - 1]
		target = CGPoint(x: m.cx, y: m.cy)
		label = m.text
	} else if let i = argv.firstIndex(of: "--xy"), i + 2 < argv.count,
		let x = Double(argv[i + 1]), let y = Double(argv[i + 2]) {
		argv.removeSubrange(i...(i + 2))
		if why.isEmpty { fail("WHY_REQUIRED", "--xy taps need --why \"<shot-list step>\"") }
		target = CGPoint(x: x, y: y)
		label = "xy"
	} else {
		fail("BAD_ARGS", "tap --text \"<label>\" [--nth k] [--contains] | tap --xy X Y --why \"…\"")
	}
	if forbiddenZone(target) { fail("FORBIDDEN_ZONE", "right side of the navigation bar") }
	if let hit = items.first(where: {
		isDenied($0.text) && CGRect(x: $0.x - 12, y: $0.y - 12, width: $0.w + 24, height: $0.h + 24).contains(target)
	}) { fail("NEAR_DENIED", hit.text) }
	return (target, label + (why.isEmpty ? "" : " — \(why)"))
}

// MARK: - Commands

switch command {
case "doctor":
	if takeSwitch("--prompt") {
		_ = CGRequestScreenCaptureAccess()
		_ = AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": true] as CFDictionary)
	}
	var out: [String: Any] = [
		"ok": true,
		"screenRecording": CGPreflightScreenCaptureAccess(),
		"accessibility": AXIsProcessTrusted(),
		"mirroringRunning": mirroringApp() != nil,
		"frontmost": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "",
		"killSwitch": FileManager.default.fileExists(atPath: statePath("STOP")),
		"secondsSinceInput": r1(secondsSinceInput()),
	]
	if let w = mirroringWindow() {
		out["window"] = [
			"id": Int(w.id), "x": r1(w.frame.minX), "y": r1(w.frame.minY),
			"w": r1(w.frame.width), "h": r1(w.frame.height),
			"aspect": r3(Double(w.frame.height / w.frame.width)), "screenPtPerPhonePt": r3(w.scale),
		]
	}
	emit(out)

case "shot":
	guard !argv.isEmpty else { fail("BAD_ARGS", "shot <out.png> [--ocr <out.json>]") }
	let ocrPath = takeFlag("--ocr")
	let path = argv.removeFirst()
	let win = requireWindow()
	let img = capture(win, to: path)
	let items = ocr(img)
	var info = describe(img, items)
	if let ocrPath {
		var doc = info
		doc["image"] = (path as NSString).lastPathComponent
		doc["capturedAt"] = ISO8601DateFormatter().string(from: Date())
		doc["items"] = items.map(\.json)
		if let data = try? JSONSerialization.data(withJSONObject: doc, options: [.prettyPrinted, .sortedKeys]) {
			try? data.write(to: URL(fileURLWithPath: ocrPath))
		}
	}
	info["ok"] = true
	info["path"] = path
	info["items"] = items.count
	emit(info)

case "ocr":
	let grep = takeFlag("--grep")?.lowercased()
	let win = requireWindow()
	let img = capture(win, to: statePath("last.png"))
	var items = ocr(img)
	if let grep { items = items.filter { $0.text.lowercased().contains(grep) } }
	var info = describe(img, items)
	info["ok"] = true
	info["items"] = items.map(\.json)
	emit(info)

case "tap", "back":
	let win = requireWindow()
	let items = ocr(capture(win, to: statePath("last.png")))
	if command == "back" { argv += ["--xy", "20", "77", "--why", "back chevron"] }
	let (target, note) = tapTarget(items)
	guardInput(win, target)
	click(win.screen(target))
	audit("tap \(r1(target.x)),\(r1(target.y)) \(note)")
	emit(["ok": true, "tapped": [r1(target.x), r1(target.y)], "note": note])

case "scroll":
	guard let dir = argv.first, dir == "down" || dir == "up", argv.count >= 2, let pts = Double(argv[1]) else {
		fail("BAD_ARGS", "scroll down|up <points> [--at <y>]")
	}
	let win = requireWindow()
	let at = CGPoint(x: 350, y: Double(takeFlag("--at") ?? "") ?? 520)
	guardInput(win, at)
	scroll(win, down: dir == "down", points: pts, at: at)
	audit("scroll \(dir) \(pts) at y \(r1(at.y))")
	emit(["ok": true, "scrolled": dir, "points": pts])

case "key":
	guard let combo = argv.first else { fail("BAD_ARGS", "key cmd+1|cmd+2|cmd+3|return|escape|…") }
	let win = requireWindow()
	guardInput(win, nil)
	key(combo)
	audit("key \(combo)")
	emit(["ok": true, "key": combo])

case "type":
	guard let text = argv.first else { fail("BAD_ARGS", "type \"<text>\" (Spotlight search only)") }
	let win = requireWindow()
	guardInput(win, nil)
	typeText(text)
	audit("type \(text)")
	emit(["ok": true, "typed": text])

case "open-app":
	guard let name = argv.first else { fail("BAD_ARGS", "open-app \"<App Name>\"") }
	let win = requireWindow()
	guardInput(win, nil)
	key("cmd+3")
	usleep(900_000)
	typeText(name)
	usleep(1_000_000)
	key("return")
	audit("open-app \(name)")
	emit(["ok": true, "opened": name])

default:
	fail("BAD_COMMAND", "doctor | shot | ocr | tap | back | scroll | key | type | open-app")
}
