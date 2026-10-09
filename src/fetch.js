const UA = "site-audit-cli/1.0 (+https://github.com/Manjak669/site-audit-cli)";

export async function fetchPage(url, { timeout = 15000, maxRedirects = 10 } = {}) {
  const redirects = [];
  let current = url;
  const started = performance.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let res;
    const hopStart = performance.now();
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-encoding": "gzip, br, deflate" },
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") throw new Error(`Timed out after ${timeout / 1000}s fetching ${current}`);
      throw new Error(`Could not reach ${current}: ${err.cause?.code || err.message}`);
    }
    const ttfb = performance.now() - hopStart;

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      const next = new URL(res.headers.get("location"), current).href;
      redirects.push({ from: current, to: next, status: res.status });
      current = next;
      continue;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    clearTimeout(timer);
    return {
      requestedUrl: url,
      finalUrl: current,
      status: res.status,
      headers: Object.fromEntries(res.headers),
      html: buffer.toString("utf8"),
      bytes: buffer.length,
      ttfb,
      totalTime: performance.now() - started,
      redirects,
    };
  }
  throw new Error(`Too many redirects (more than ${maxRedirects})`);
}

export async function probe(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": UA } });
    const text = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}
