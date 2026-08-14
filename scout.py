#!/usr/bin/env python3
"""
luma-x-scout: pull every X (twitter) profile out of a Luma guest list.

Open the event page, click the guest count, scroll the modal all the way
down so everything loads, then save/copy the HTML. Feed it to this script
and get back a clean list of profile URLs.

Usage:
    python scout.py guests.html
    python scout.py guests.html -o handles.txt
    pbpaste | python scout.py -            # macOS, straight from clipboard
"""

import argparse
import re
import sys
from collections import OrderedDict

# matches x.com and twitter.com profile links, http or https
PROFILE_RE = re.compile(
    r"https?://(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})\b"
)

# links that show up in page chrome but aren't people
NOT_PEOPLE = {
    "home", "search", "explore", "notifications", "messages", "i",
    "intent", "share", "settings", "login", "signup", "tos", "privacy",
}


def extract(html: str) -> "OrderedDict[str, str]":
    """Return {handle: url}, deduped, in order of first appearance."""
    found = OrderedDict()
    for match in PROFILE_RE.finditer(html):
        handle = match.group(1)
        if handle.lower() in NOT_PEOPLE:
            continue
        # normalize everything to x.com
        found.setdefault(handle, f"https://x.com/{handle}")
    return found


def main() -> int:
    p = argparse.ArgumentParser(
        description="Extract X/twitter profile URLs from Luma guest list HTML."
    )
    p.add_argument("input", help="path to saved HTML, or - for stdin")
    p.add_argument("-o", "--output", help="write URLs here instead of stdout")
    p.add_argument(
        "--handles", action="store_true",
        help="print bare @handles instead of full URLs",
    )
    args = p.parse_args()

    if args.input == "-":
        html = sys.stdin.read()
    else:
        try:
            with open(args.input, encoding="utf-8", errors="replace") as f:
                html = f.read()
        except OSError as e:
            print(f"couldn't read {args.input}: {e}", file=sys.stderr)
            return 1

    profiles = extract(html)

    if not profiles:
        print("no profiles found — did the whole list load before you copied?",
              file=sys.stderr)
        return 1

    if args.handles:
        lines = [f"@{h}" for h in profiles]
    else:
        lines = list(profiles.values())

    out = "\n".join(lines) + "\n"

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"{len(profiles)} profiles -> {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(out)
        print(f"\n{len(profiles)} profiles total", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
