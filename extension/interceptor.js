// runs in the page's own world on partiful, before any of their JS.
// partiful never puts guest social links in the DOM -- they only exist in
// the JSON their app fetches. so we quietly tee every JSON response that
// looks interesting over to the collector.

(() => {
  const send = (text) => {
    try {
      window.postMessage({ __guest_scout: true, payload: text.slice(0, 3_000_000) }, "*");
    } catch (e) {}
  };

  const interesting = (t) =>
    t && /twitter|instagram|linkedin|x\.com|social/i.test(t);

  // --- fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("json")) {
        res.clone().text().then((t) => { if (interesting(t)) send(t); }).catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  // --- XHR, just in case ---
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if ((this.responseType === "" || this.responseType === "text") && interesting(this.responseText)) {
          send(this.responseText);
        }
      } catch (e) {}
    });
    return origSend.apply(this, args);
  };
})();
