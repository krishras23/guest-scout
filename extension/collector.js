// collects social profile urls on lu.ma and partiful.
// luma: everything's just sitting in the DOM as <a href>.
// partiful: interceptor.js tees us the JSON the page fetches.

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

function scanDom() {
  document.querySelectorAll("a[href]").forEach((a) => harvestUrlOnly(a.href));
  // luma sometimes tucks links in odd attrs; cheap catch-all:
  harvest(document.documentElement.outerHTML);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "extract") {
    scanDom();
    sendResponse({ urls: Array.from(found.values()).sort(), host: location.hostname });
  }
  return true;
});
