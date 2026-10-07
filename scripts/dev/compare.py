#!/usr/bin/env python3
"""Side-by-side sheets for checking a page against its references (PIL).

  compare.py stitch PREFIX 'RESULT_JSON' CSS_WIDTH OUT.png
      Stitch capture-view.sh slices (PREFIX-<k>.png) into one 1x image.
  compare.py sbs REF OTHER OUT.png [--y0 PT] [--y1 PT] [--scale S]
      Phone reference next to a 402-wide image (Figma frame or live capture).
  compare.py trio PHONE FIGMA LIVE OUT.png [--live-offset PX] [--scale S]
      Phone | Figma | live, each at 402 wide. --live-offset crops the view's
      12 px top padding off the live capture.
  compare.py section REF SECTION OUT.png --y0 PT [--scale S]
      A reference crop from y0 next to a section render of the same height.
  compare.py pane FIGMA LIVE OUTPREFIX [--live-offset PX] [--slice PX]
      Wide-pane Figma frame next to a live capture, cut into slices.

Phone references are scaled to 402 pt wide, so native 3x (1206 px) and mirrored
2x (804 px) screenshots line up with 1x Figma exports and live captures.
"""
import argparse
import json
from PIL import Image

GUTTER, MAGENTA = 6, (255, 0, 255)


def at_402(path):
    im = Image.open(path).convert("RGB")
    if im.width != 402:
        im = im.resize((402, round(im.height * 402 / im.width)), Image.LANCZOS)
    return im


def row(images, scale=1.0):
    w = sum(i.width for i in images) + GUTTER * (len(images) - 1)
    h = max(i.height for i in images)
    out = Image.new("RGB", (w, h), MAGENTA)
    x = 0
    for im in images:
        out.paste(im, (x, 0))
        x += im.width + GUTTER
    if scale != 1:
        out = out.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return out


def stitch(a):
    result = json.loads(a.result.split("=> ", 1)[-1])
    dpr, tops, total = result["dpr"], result["tops"], result["total"]
    width = float(a.css_width)
    canvas = Image.new("RGB", (int(width * dpr), int(total * dpr)), "white")
    for k, top in enumerate(tops):
        im = Image.open(f"{a.prefix}-{k}.png").convert("RGB")
        canvas.paste(im.crop((0, 0, min(im.width, canvas.width), im.height)), (0, int(top * dpr)))
    canvas.resize((int(width), int(total)), Image.LANCZOS).save(a.out)
    print(a.out, int(width), int(total))


def sbs(a):
    ref, other = at_402(a.ref), at_402(a.other)
    y0 = int(a.y0 or 0)
    y1 = int(a.y1 or min(ref.height, other.height))
    out = row([ref.crop((0, y0, 402, y1)), other.crop((0, y0, 402, y1))], a.scale)
    out.save(a.out)
    print(a.out, out.size)


def trio(a):
    live = at_402(a.live)
    live = live.crop((0, a.live_offset, 402, live.height))
    out = row([at_402(a.phone), at_402(a.figma), live], a.scale)
    out.save(a.out)
    print(a.out, out.size)


def section(a):
    ref, sec = at_402(a.ref), at_402(a.section)
    y0 = int(a.y0)
    h = min(sec.height, ref.height - y0)
    out = row([ref.crop((0, y0, 402, y0 + h)), sec.crop((0, 0, 402, h))], a.scale)
    out.save(a.out)
    print(a.out, out.size)


def pane(a):
    fig = Image.open(a.figma).convert("RGB")
    live = Image.open(a.live).convert("RGB")
    live = live.crop((0, a.live_offset, live.width, live.height))
    full = row([fig, live])
    n = 0
    for y in range(0, full.height, a.slice):
        full.crop((0, y, full.width, min(full.height, y + a.slice))).save(f"{a.outprefix}_{n}.png")
        n += 1
    print(n, "slices", fig.size, live.size)


p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sub = p.add_subparsers(dest="cmd", required=True)
s = sub.add_parser("stitch"); s.add_argument("prefix"); s.add_argument("result"); s.add_argument("css_width"); s.add_argument("out"); s.set_defaults(fn=stitch)
s = sub.add_parser("sbs"); s.add_argument("ref"); s.add_argument("other"); s.add_argument("out"); s.add_argument("--y0", type=float); s.add_argument("--y1", type=float); s.add_argument("--scale", type=float, default=1.0); s.set_defaults(fn=sbs)
s = sub.add_parser("trio"); s.add_argument("phone"); s.add_argument("figma"); s.add_argument("live"); s.add_argument("out"); s.add_argument("--live-offset", type=int, default=12); s.add_argument("--scale", type=float, default=1.0); s.set_defaults(fn=trio)
s = sub.add_parser("section"); s.add_argument("ref"); s.add_argument("section"); s.add_argument("out"); s.add_argument("--y0", type=float, required=True); s.add_argument("--scale", type=float, default=1.0); s.set_defaults(fn=section)
s = sub.add_parser("pane"); s.add_argument("figma"); s.add_argument("live"); s.add_argument("outprefix"); s.add_argument("--live-offset", type=int, default=12); s.add_argument("--slice", type=int, default=760); s.set_defaults(fn=pane)
args = p.parse_args()
args.fn(args)
