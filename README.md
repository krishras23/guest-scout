# guest-scout

Pull everyone's socials off a [Luma](https://lu.ma) or [Partiful](https://partiful.com) guest list, so you can see who's actually going to be in the room before you show up.

No API keys, no scraping infra, no accounts. It's just a bit of JavaScript in your browser (plus a tiny Python script if you'd rather work from a saved HTML file).

## Chrome extension (recommended)

The extension lives in [`extension/`](extension/) and works on both Luma and Partiful. There's a platform dropdown in the popup, though auto-detect handles it for you.

Installing it takes about two minutes:

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open any Luma or Partiful event and open the guest list.
5. Click the extension icon and hit **scroll + grab everyone**. It scrolls the whole list for you, then copy or download the result.

You don't have to scroll the list yourself. The extension drives it to the bottom until everything's loaded, then pulls out every X (twitter), Instagram, and LinkedIn profile and filters out the noise like nav links, post URLs, and share buttons. Nothing ever leaves your browser. No servers, no analytics, just about 150 lines of JavaScript you can read in one sitting.

### How it handles each platform

The two sites store guest socials very differently, so the extension does something different for each.

On **Luma**, every guest's linked accounts sit right in the page as plain links, so the extension just reads them straight out of the DOM.

It figures out what to scroll by anchoring on the guest-search box rather than hardcoding class names, since both sites use auto-generated class names that change on every deploy.

On **Partiful** it's trickier. Their guest list shows little X and Instagram icons, but the actual links never make it into the HTML. They only exist in the JSON the app fetches in the background. So the extension quietly watches those network responses as the page loads and pulls the handles out of the JSON. Open the guest list *after* the page has loaded, and if you somehow get zero results, refresh the page and reopen the list.

## Python script

If you already saved a Luma guest list as HTML (or just want something you can pipe around in a terminal), `scout.py` does the same extraction from a file. This one is Luma-only, since Partiful's links aren't in the HTML to begin with.

Grab the HTML first: open the event on Luma, click the guest count to open the list, scroll it to the bottom so it all loads, then right click, Inspect, right click the list element, and choose Copy outerHTML. Paste that into a file (saving the whole page works too).

Then run it:

```bash
python scout.py guests.html
```

Write the results to a file:

```bash
python scout.py guests.html -o handles.txt
```

Get bare `@handles` instead of full URLs:

```bash
python scout.py guests.html --handles
```

On a Mac you can skip the file entirely and pipe straight from your clipboard:

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

It only needs Python 3.8+ and the standard library.

## A couple of notes

Only guests who actually linked an account will show up. In my experience that's roughly a quarter of a typical tech event guest list, so don't expect a full roster.

## Why

I went to an SF AI event with 1,300+ people and wanted to know who to look out for beforehand. Scrolling the guest list and Ctrl+F'ing names was not it.

MIT licensed, do whatever you want with it.
