// collects social profile urls on lu.ma and partiful.
// luma: everything's just sitting in the DOM as <a href>.
// partiful: interceptor.js tees us the JSON the page fetches as we scroll.
//
// the main trick here is auto-scroll: both sites lazy-load the guest list,
// so we programmatically drive the list to the bottom until it stops growing,
// THEN extract. no manual scrolling, no pasting HTML.

const found = new Map(); // key: normalized url -> display url

const JUNK = new Set([
  "home", "search", "explore", "notifications", "messages", "i", "intent",
  "share", "settings", "login", "signup", "signin", "tos", "privacy", "about",
  "jobs", "blog", "help", "legal", "embed", "hashtag", "accounts", "p", "reel",
  "reels", "stories", "tv", "directory", "web", "download", "features", "premium",
]);

const URL_RE =
  /https?:\/\/(?:www\.)?(x\.com|twitter\.com|instagram\.com|linkedin\.com)\/([A-Za-z0-9_.\-\/@]{1,60})/g;

function addProfile(host, path) {
  path = path.replace(/^@/, "").replace(/[\/.,;:!?]+$/, "").split("?")[0].split("#")[0];
  if (!path) return;
  const first = path.split("/")[0].toLowerCase();
  if (JUNK.has(first)) return;

  let url = null;
  if (host === "x.com" || host === "twitter.com") {
    const handle = path.split("/")[0];
    if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) url = "https://x.com/" + handle;
  } else if (host === "instagram.com") {
    const handle = path.split("/")[0];
    if (/^[A-Za-z0-9_.]{1,30}$/.test(handle)) url = "https://instagram.com/" + handle;
  } else if (host === "linkedin.com") {
    const seg = path.split("/");
    if ((seg[0] === "in" || seg[0] === "company") && seg[1])
      url = "https://linkedin.com/" + seg[0] + "/" + seg[1];
  }
  if (url) found.set(url.toLowerCase(), url);
}

function harvest(text) {
  if (!text) return;
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) addProfile(m[1].toLowerCase(), m[2]);

  // bare handles hiding in JSON fields like "twitter":"foo" / "instagramHandle":"bar"
  const fieldRe =
    /"((?:twitter|x)(?:handle|username|user)?|instagram(?:handle|username|user)?|ig)"\s*:\s*"(@?[A-Za-z0-9_.\-\/:]{1,80})"/gi;
  while ((m = fieldRe.exec(text)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2];
    if (val.includes("://")) { harvestUrlOnly(val); continue; }
    if (key.startsWith("insta") || key === "ig") addProfile("instagram.com", val);
    else addProfile("x.com", val);
  }
}

function harvestUrlOnly(text) {
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) addProfile(m[1].toLowerCase(), m[2]);
}

// partiful: receive teed JSON from the main-world interceptor
window.addEventListener("message", (e) => {
  if (e.source === window && e.data && e.data.__guest_scout) harvest(e.data.payload);
});

// ---- finding the thing to scroll -------------------------------------------
//
// note on class names: both sites ship auto-generated, hashed class names
// (partiful's `ptf-l-66Z4C`, luma's equivalents) that change on every deploy,
// so hardcoding them would quietly break the extension after the next release.
// instead we anchor on the guest-search box, which is a stable, human-facing
// element on both platforms, and walk up to its scrollable parent. if that
// misses, we fall back to scrolling every scrollable container on the page.

function isScrollable(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const s = getComputedStyle(el);
  return (s.overflowY === "auto" || s.overflowY === "scroll") &&
    el.scrollHeight > el.clientHeight + 40;
}

function findGuestScroller() {
  const input =
    document.querySelector('input[placeholder*="guest" i]') ||
    document.querySelector('input[type="search"]');
  let el = input;
  while (el && el !== document.body) {
    if (isScrollable(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function allScrollers() {
  const out = [];
  document.querySelectorAll("div, ul, section, main").forEach((el) => {
    if (isScrollable(el)) out.push(el);
  });
  return out;
}

// how many guest-ish things are currently on the page (our progress signal)
function itemCount() {
  return document.querySelectorAll(
    'a[href*="x.com"], a[href*="twitter.com"], a[href*="instagram.com"], img[alt]'
  ).length;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function autoScroll(onTick) {
  const primary = findGuestScroller();
  let lastCount = -1;
  let stable = 0;

  // scroll until the list stops growing for a few rounds, or we hit the cap
  for (let i = 0; i < 300 && stable < 5; i++) {
    const targets = primary ? [primary, ...allScrollers()] : allScrollers();
    if (targets.length === 0) {
      window.scrollTo(0, document.documentElement.scrollHeight);
    } else {
      for (const t of targets) t.scrollTop = t.scrollHeight;
    }
    await sleep(350);
    harvest(document.documentElement.outerHTML); // catch DOM links as we go

    const c = itemCount();
    if (typeof onTick === "function") onTick(found.size, c);
    if (c === lastCount) stable++;
    else { stable = 0; lastCount = c; }
  }

  // nudge back to top so the user's view isn't left stranded at the bottom
  if (primary) primary.scrollTop = 0;
}

function scanDom() {
  document.querySelectorAll("a[href]").forEach((a) => harvestUrlOnly(a.href));
  harvest(document.documentElement.outerHTML);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "extract") {
    // grab whatever's loaded right now, no scrolling
    scanDom();
    sendResponse({ urls: Array.from(found.values()).sort(), host: location.hostname });
    return true;
  }

  if (msg && msg.type === "scroll_extract") {
    // auto-scroll the whole list, then hand back everything
    autoScroll().then(() => {
      scanDom();
      sendResponse({ urls: Array.from(found.values()).sort(), host: location.hostname });
    });
    return true; // keep the channel open for the async reply
  }

  return true;
});
