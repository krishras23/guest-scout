const $ = (id) => document.getElementById(id);

const HINTS = {
  luma: "tip: click the guest count to open the full list and scroll it to the bottom so everything loads, then extract.",
  partiful: "tip: partiful only loads socials over the network — open the guest list (and scroll it) AFTER the page loads, then extract. if you get 0, refresh and reopen the list.",
  auto: "",
};

function setHint(host, platform) {
  let p = platform;
  if (p === "auto") {
    if (host && host.includes("partiful")) p = "partiful";
    else if (host && host.includes("lu.ma")) p = "luma";
  }
  $("hint").textContent = HINTS[p] || "";
}

$("platform").addEventListener("change", () => setHint(null, $("platform").value));

$("go").addEventListener("click", async () => {
  $("count").textContent = "extracting…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type: "extract" });
    const urls = (res && res.urls) || [];
    $("out").value = urls.join("\n");
    $("count").textContent = urls.length
      ? urls.length + " profiles found"
      : "0 found — see tip below";
    setHint(res && res.host, $("platform").value);
  } catch (e) {
    $("count").textContent = "";
    $("out").value = "";
    $("hint").textContent =
      "couldn't reach the page — make sure you're on a lu.ma or partiful event tab, then refresh it once and try again.";
  }
});

$("copy").addEventListener("click", () => {
  navigator.clipboard.writeText($("out").value);
  $("count").textContent = "copied ✓";
});

$("dl").addEventListener("click", () => {
  const blob = new Blob([$("out").value + "\n"], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "guest-profiles.txt";
  a.click();
  URL.revokeObjectURL(a.href);
});
