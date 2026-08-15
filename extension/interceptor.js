// runs in the page's own world on partiful, before any of their JS.
// partiful never puts guest social links in the DOM, they only exist in the
// data their app fetches. so we quietly tee response bodies over to the
// collector, which digs the handles out.
//
// we capture broadly (any json / next.js data / graphql / text response)
// because partiful's guest payload doesn't always announce itself with the
// word "twitter" in it. the collector filters everything down to real handles,
// so over-capturing here is harmless.

(() => {
  const send = (text) => {
    try {
      window.postMessage({ __guest_scout: true, payload: String(text).slice(0, 4_000_000) }, "*");
    } catch (e) {}
  };

  const wantType = (ct) =>
    !!ct && /(json|x-component|event-stream|text\/plain|graphql)/i.test(ct);

  // --- fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const ct = res.headers.get("content-type") || "";
      if (wantType(ct)) {
        res.clone().text().then((t) => { if (t && t.length > 40) send(t); }).catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  // --- XHR ---
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (this.responseType === "" || this.responseType === "text") {
          const ct = (this.getResponseHeader && this.getResponseHeader("content-type")) || "";
          const t = this.responseText;
          if (t && (wantType(ct) || /instagram|twitter|x\.com|linkedin|handle|username|"ig"/i.test(t))) {
            send(t);
          }
        }
      } catch (e) {}
    });
    return origSend.apply(this, args);
  };
})();
