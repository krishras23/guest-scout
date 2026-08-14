# luma-x-scout

Pull every X (twitter) profile out of a [Luma](https://lu.ma) event guest list, so you can scope out who's actually going to be there before you show up.

No API keys, no scraping infra, no dependencies. Just python and the HTML you already have in your browser.

## How it works

Luma renders the guest list client-side and each guest's linked socials are right there in the DOM. This just regexes out every `x.com` / `twitter.com` profile link, drops the junk (nav links, share buttons), dedupes, and hands you a clean list.

## Usage

1. Open the event page on lu.ma and click the guest count to open the guest list modal
2. **Scroll the modal all the way to the bottom** — the list lazy-loads, so if you don't scroll, you only get the first chunk
3. Right click → Inspect → right click the modal's element → Copy → Copy outerHTML, and paste it into a file (or just save the whole page, that works too)

Then:

```bash
python scout.py guests.html
```

Write to a file:

```bash
python scout.py guests.html -o handles.txt
```

Want @handles instead of URLs:

```bash
python scout.py guests.html --handles
```

On a mac you can even skip the file and pipe straight from your clipboard:

```bash
pbpaste | python scout.py -
```

Output is one profile per line, in the same order as the guest list, with a count at the end:

```
https://x.com/aadit_kannan
https://x.com/aahishabbani
...

305 profiles total
```

## Notes

- Works on any page really, not just Luma — it's just looking for profile links
- Only finds guests who actually linked their X account (in my experience that's ~20-25% of a tech event guest list)
- Requires python 3.8+, stdlib only

## Why

Went to an SF AI event with 1,300+ guests and wanted to know who to look out for. Ctrl+F'ing through the guest list was not it.

MIT licensed, do whatever.
