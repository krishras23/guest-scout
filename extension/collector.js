// collects social profile urls on lu.ma / luma.com and partiful.
// luma: everything's just sitting in the DOM as <a href>.
// partiful: interceptor.js tees us the data the page fetches; we dig handles out.
//
// auto-scroll drives the guest list to the bottom until nothing new shows up,
// so there's no manual scrolling and no pasting HTML.

const found = new Map(); // key: normalized url -> display url

const JUNK = new Set([
  "home", "search", "explore", "notifications", "messages", "i", "intent",
  "share", "settings", "login", "signup", "signin", "tos", "privacy", "about",
  "jobs", "blog", "help", "legal", "embed", "hashtag", "accounts", "p", "reel",
  "reels", "stories", "tv", "directory", "web", "download", "features", "premium",
  // the platforms' own accounts, so their footer links don't pose as guests
  "partiful", "lu", "luma",
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

  // bare handles in JSON fields like "twitter":"foo" / "instagramHandle":"bar" / "ig":"baz"
  const fieldRe =
    /"((?:twitter|x)(?:handle|username|user|url)?|instagram(?:handle|username|user|url)?|ig|ighandle)"\s*:\s*"(@?[A-Za-z0-9_.\-\/:]{1,80})"/gi;
  while ((m = fieldRe.exec(text)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2];
    if (val.includes("://")) { harvestUrlOnly(val); continue; }
    if (key.startsWith("insta") || key === "ig" || key === "ighandle") addProfile("instagram.com", val);
    else addProfile("x.com", val);
  }
}

function harvestUrlOnly(text) {
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) addProfile(m[1].toLowerCase(), m[2]);
}

// partiful: receive teed data from the main-world interceptor
window.addEventListener("message", (e) => {
  if (e.source === window && e.data && e.data.__guest_scout) harvest(e.data.payload);
});

// ---- finding the thing to scroll -------------------------------------------
//
// both sites ship auto-generated, hashed class names that change every deploy,
// so we don't hardcode them. we anchor on the guest-search box and on any
// scrollable element inside the guest modal, then fall back to the whole page.

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

function findScrollers() {
  const set = new Set();
  const primary = findGuestScroller();
  if (primary) set.add(primary);
  // prefer scrollables inside a modal/dialog (that's usually the guest list)
  const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
  const scope = dialog || document;
  scope.querySelectorAll("div, ul, ol, section, main").forEach((el) => {
    if (isScrollable(el)) set.add(el);
  });
  return [...set];
}

// progress signal: real profiles captured (weighted) plus visible rows.
// weighting profiles means we keep scrolling while the interceptor is still
// pulling in new people, even when the DOM row count stays flat (virtualized
// lists recycle their rows, so counting avatars alone would stall early).
function progressSignal() {
  const rows = document.querySelectorAll(
    'a[href*="x.com"], a[href*="twitter.com"], a[href*="instagram.com"], img[alt]'
  ).length;
  return found.size * 100000 + rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function autoScroll(onTick) {
  await sleep(800); // let the modal open and its first batch render

  let stable = 0;
  let last = -1;
  const MAX_ROUNDS = 250;   // hard cap so it always terminates (~2.5 min worst case)
  const WAIT = 600;         // per-round settle time
  const NEED_STABLE = 10;   // ~6s of no new data before we call it done

  for (let i = 0; i < MAX_ROUNDS && stable < NEED_STABLE; i++) {
    const targets = findScrollers();
    if (targets.length === 0) {
      window.scrollTo(0, document.documentElement.scrollHeight);
    } else {
      for (const t of targets) {
        t.scrollTop = t.scrollHeight;
        // some virtualized lists only fetch more on a real wheel/scroll event
        try { t.dispatchEvent(new WheelEvent("wheel", { deltaY: 1500, bubbles: true })); } catch (e) {}
        try { t.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (e) {}
      }
    }
    await sleep(WAIT);
    harvest(document.documentElement.outerHTML);

    const sig = progressSignal();
    if (typeof onTick === "function") onTick(found.size);
    if (sig > last) { last = sig; stable = 0; }
    else stable++;
  }

  const primary = findGuestScroller();
  if (primary) primary.scrollTop = 0;
}

function scanDom() {
  document.querySelectorAll("a[href]").forEach((a) => harvestUrlOnly(a.href));
  harvest(document.documentElement.outerHTML);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "extract") {
    scanDom();
    sendResponse({ urls: Array.from(found.values()).sort(), host: location.hostname });
    return true;
  }
  if (msg && msg.type === "scroll_extract") {
    autoScroll().then(() => {
      scanDom();
      sendResponse({ urls: Array.from(found.values()).sort(), host: location.hostname });
    });
    return true; // async reply
  }
  return true;
});
