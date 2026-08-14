const $ = (id) => document.getElementById(id);

const HINTS = {
  luma: "on luma, open the guest list first, then hit scroll + grab.",
  partiful: "on partiful, let the page finish loading, open the guest list, then hit scroll + grab. if you get 0, refresh and try again.",
  auto: "keep this popup open while it scrolls.",
};

function setHint(host, platform) {
  let p = platform;
  if (p === "auto") {
    if (host && host.includes("partiful")) p = "partiful";
    else if (host && host.includes("lu.ma")) p = "luma";
  }
  $("hint").textContent = HINTS[p] || HINTS.auto;
}

$("platform").addEventListener("change", () => setHint(null, $("platform").value));

async function run(type, label) {
  $("go").disabled = true;
  $("grab").disabled = true;
  $("count").textContent = type === "scroll_extract"
    ? "scrolling the list… hang tight"
    : "grabbing…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type });
    const urls = (res && res.urls) || [];
    $("out").value = urls.join("\n");
    $("count").textContent = urls.length
      ? urls.length + " profiles found"
      : "0 found — see tip below";
    setHint(res && res.host, $("platform").value);
  } catch (e) {
    $("out").value = "";
    $("count").textContent = "";
    $("hint").textContent =
      "couldn't reach the page. make sure you're on a lu.ma or partiful event tab, refresh it once, and try again.";
  } finally {
    $("go").disabled = false;
    $("grab").disabled = false;
  }
}

$("go").addEventListener("click", () => run("scroll_extract"));
$("grab").addEventListener("click", () => run("extract"));

$("copy").addEventListener("click", () => {
  navigator.clipboard.writeText($("out").value);
  $("count").textContent = "copied";
});

$("dl").addEventListener("click", () => {
  const blob = new Blob([$("out").value + "\n"], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "guest-profiles.txt";
  a.click();
  URL.revokeObjectURL(a.href);
});
