const $ = (id) => document.getElementById(id);

// is the current tab a luma event? reads the URL, nothing for the user to pick.
function isLuma(url) {
  if (!url) return false;
  try {
    const h = new URL(url).hostname;
    return h === "luma.com" || h.endsWith(".luma.com") || h === "lu.ma" || h.endsWith(".lu.ma");
  } catch (e) {
    return false;
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const ok = isLuma(tab && tab.url);
  const pill = $("pill");

  if (ok) {
    pill.classList.add("on");
    $("pilltext").textContent = "luma";
    $("scan").disabled = false;
    $("grab").disabled = false;
    $("hint").textContent = "open the guest list, then hit scan. it loads the whole list for you.";
  } else {
    pill.classList.remove("on");
    $("pilltext").textContent = "not on a luma event";
    $("scan").disabled = true;
    $("grab").disabled = true;
    $("hint").textContent = "open a luma.com event, then reopen this popup.";
  }
}

function setBusy(busy, text, enabled) {
  $("scan").disabled = busy || !enabled;
  $("grab").disabled = busy || !enabled;
  $("status").innerHTML = busy ? `<span class="spin"></span>${text || "working…"}` : "";
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
  setBusy(true, busyText, true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type });
    setBusy(false, "", true);
    showResults((res && res.urls) || []);
  } catch (e) {
    setBusy(false, "", true);
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
