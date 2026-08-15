const $ = (id) => document.getElementById(id);

// figure out which platform the current tab is, from its URL. no dropdown,
// no guessing on the user's part.
function detectPlatform(url) {
  if (!url) return null;
  try {
    const h = new URL(url).hostname;
    if (h === "luma.com" || h.endsWith(".luma.com") || h === "lu.ma" || h.endsWith(".lu.ma"))
      return "luma";
    if (h === "partiful.com" || h.endsWith(".partiful.com")) return "partiful";
  } catch (e) {}
  return null;
}

const HINTS = {
  luma: "open the guest list, then hit scan. it loads the whole list for you.",
  partiful: "let the page finish loading, open the guest list, then scan. if you get 0, refresh and try again.",
};

let currentPlatform = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentPlatform = detectPlatform(tab && tab.url);

  const pill = $("pill");
  if (currentPlatform) {
    pill.classList.add("on");
    $("pilltext").textContent = currentPlatform;
    $("scan").disabled = false;
    $("grab").disabled = false;
    $("hint").textContent = HINTS[currentPlatform] || "";
  } else {
    pill.classList.remove("on");
    $("pilltext").textContent = "not on an event page";
    $("scan").disabled = true;
    $("grab").disabled = true;
    $("hint").textContent = "open a luma.com or partiful.com event, then reopen this.";
  }
}

function setBusy(busy, text) {
  $("scan").disabled = busy || !currentPlatform;
  $("grab").disabled = busy || !currentPlatform;
  $("status").innerHTML = busy
    ? `<span class="spin"></span>${text || "working…"}`
    : "";
}

function showResults(urls) {
  $("out").value = urls.join("\n");
  const has = urls.length > 0;
  $("copy").disabled = !has;
  $("dl").disabled = !has;
  $("status").innerHTML = has
    ? `<span class="num">${urls.length}</span> profiles found`
    : "0 found — see the tip below";
}

async function run(type, busyText) {
  setBusy(true, busyText);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type });
    setBusy(false);
    showResults((res && res.urls) || []);
  } catch (e) {
    setBusy(false);
    $("status").textContent = "";
    $("hint").textContent =
      "couldn't reach the page. refresh the event tab once, then reopen this popup.";
  }
}

$("scan").addEventListener("click", () => run("scroll_extract", "scrolling the list…"));
$("grab").addEventListener("click", () => run("extract", "grabbing…"));

$("copy").addEventListener("click", () => {
  navigator.clipboard.writeText($("out").value);
  $("status").innerHTML = `<span class="num">copied</span>`;
});

$("dl").addEventListener("click", () => {
  const blob = new Blob([$("out").value + "\n"], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "guest-profiles.txt";
  a.click();
  URL.revokeObjectURL(a.href);
});

init();
