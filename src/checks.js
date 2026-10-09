// Every check returns { id, category, title, status, detail, weight }.
// status: "pass" | "warn" | "fail" | "info". "info" does not affect the score.

export const CATEGORIES = ["SEO", "Performance", "Accessibility", "Security", "Best practices"];

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const ms = (n) => `${Math.round(n)} ms`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sample = (list, n = 3) => list.slice(0, n).map((s) => `“${s}”`).join(", ") + (list.length > n ? ` and ${list.length - n} more` : "");

export function runChecks({ page, doc, robots, sitemap }) {
  const results = [];
  const add = (category, id, title, status, detail, weight = 1) => results.push({ category, id, title, status, detail, weight });
  const url = new URL(page.finalUrl);

  // ---------------- SEO ----------------
  const t = doc.title;
  if (!t) add("SEO", "title", "Page title", "fail", "No <title> tag. Search engines show the title as the headline of your result.", 3);
  else if (t.length < 15 || t.length > 65) add("SEO", "title", "Page title", "warn", `“${t}” is ${t.length} characters. Aim for 15–65 so it is descriptive and not cut off.`, 3);
  else add("SEO", "title", "Page title", "pass", `“${t}” (${t.length} characters)`, 3);

  const desc = doc.meta("name", "description");
  if (!desc) add("SEO", "description", "Meta description", "fail", "Missing. Google will invent a snippet from random page text.", 3);
  else if (desc.length < 50 || desc.length > 160) add("SEO", "description", "Meta description", "warn", `${desc.length} characters. Aim for 50–160.`, 3);
  else add("SEO", "description", "Meta description", "pass", `${desc.length} characters`, 3);

  const h1s = doc.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) add("SEO", "h1", "Main heading (H1)", "fail", "No <h1>. Every page should have one clear main heading.", 2);
  else if (h1s.length > 1) add("SEO", "h1", "Main heading (H1)", "warn", `${h1s.length} <h1> tags: ${sample(h1s.map((h) => h.text))}. Use one.`, 2);
  else add("SEO", "h1", "Main heading (H1)", "pass", `“${h1s[0].text}”`, 2);

  const canonical = doc.link("canonical")?.attrs.href;
  add("SEO", "canonical", "Canonical URL", canonical ? "pass" : "warn", canonical ? canonical : "No <link rel=\"canonical\">. Helps avoid duplicate-content issues.", 1);

  const robotsMeta = (doc.meta("name", "robots") || "").toLowerCase();
  if (robotsMeta.includes("noindex")) add("SEO", "noindex", "Indexable", "fail", "The page has <meta name=\"robots\" content=\"noindex\">, so it will not appear in search results.", 3);
  else add("SEO", "noindex", "Indexable", "pass", "No noindex directive", 3);

  add("SEO", "robots", "robots.txt", robots.ok ? "pass" : "warn", robots.ok ? `${url.origin}/robots.txt found` : `${url.origin}/robots.txt not found (HTTP ${robots.status || "error"})`, 1);
  const sitemapListed = /sitemap:/i.test(robots.text);
  add("SEO", "sitemap", "XML sitemap", sitemap.ok || sitemapListed ? "pass" : "warn",
    sitemap.ok ? "/sitemap.xml found" : sitemapListed ? "Sitemap declared in robots.txt" : "No /sitemap.xml and none declared in robots.txt", 1);

  const og = ["og:title", "og:description", "og:image"].filter((p) => !doc.meta("property", p));
  add("SEO", "opengraph", "Social preview (Open Graph)", og.length === 0 ? "pass" : og.length === 3 ? "fail" : "warn",
    og.length ? `Missing ${og.join(", ")}. Links shared on Telegram, WhatsApp or Facebook will look plain.` : "og:title, og:description and og:image present", 1);

  if (doc.wordCount < 150) add("SEO", "content", "Amount of text", "warn", `About ${doc.wordCount} words of visible text. Thin pages rank poorly.`, 1);
  else add("SEO", "content", "Amount of text", "pass", `About ${doc.wordCount} words`, 1);

  // ---------------- Performance ----------------
  if (page.ttfb > 1200) add("Performance", "ttfb", "Server response time", "fail", `${ms(page.ttfb)} to first byte. Over 1.2 s feels slow.`, 3);
  else if (page.ttfb > 600) add("Performance", "ttfb", "Server response time", "warn", `${ms(page.ttfb)} to first byte. Under 600 ms is good.`, 3);
  else add("Performance", "ttfb", "Server response time", "pass", `${ms(page.ttfb)} to first byte`, 3);

  if (page.bytes > 500 * 1024) add("Performance", "html-size", "HTML size", "fail", `${kb(page.bytes)}. Very heavy HTML slows the first paint.`, 2);
  else if (page.bytes > 150 * 1024) add("Performance", "html-size", "HTML size", "warn", `${kb(page.bytes)}. Under 150 KB is better.`, 2);
  else add("Performance", "html-size", "HTML size", "pass", kb(page.bytes), 2);

  const enc = page.headers["content-encoding"];
  add("Performance", "compression", "Compression", enc ? "pass" : "warn", enc ? `Served with ${enc}` : "No gzip/brotli compression detected.", 2);

  const bodyStart = doc.tags.find((tg) => tg.name === "body")?.index ?? Infinity;
  const blockingInHead = doc.tags.filter((tg) => tg.name === "script" && tg.attrs.src && !("async" in tg.attrs) && !("defer" in tg.attrs) && tg.attrs.type !== "module" && tg.index < bodyStart);
  add("Performance", "render-blocking", "Render-blocking scripts", blockingInHead.length ? "warn" : "pass",
    blockingInHead.length ? `${plural(blockingInHead.length, "script")} in <head> without async/defer: ${sample(blockingInHead.map((s) => s.attrs.src))}` : "None in <head>", 2);

  const imgs = doc.all("img");
  const noLazy = imgs.filter((i) => i.attrs.loading !== "lazy");
  if (imgs.length > 4 && noLazy.length > imgs.length - 2) add("Performance", "lazy", "Lazy-loaded images", "warn", `${noLazy.length} of ${imgs.length} images load eagerly. Add loading="lazy" below the fold.`, 1);
  else add("Performance", "lazy", "Lazy-loaded images", "pass", imgs.length ? `${imgs.length - noLazy.length} of ${imgs.length} images are lazy` : "No <img> tags", 1);

  const noSize = imgs.filter((i) => !i.attrs.width || !i.attrs.height);
  add("Performance", "img-dimensions", "Image dimensions", noSize.length ? "warn" : "pass",
    noSize.length ? `${plural(noSize.length, "image")} without width/height cause layout shift.` : "All images have width and height", 1);

  const cache = page.headers["cache-control"];
  add("Performance", "cache", "Cache headers", "info", cache ? `cache-control: ${cache}` : "No cache-control header on the HTML", 0);
  add("Performance", "redirects", "Redirect chain", page.redirects.length > 1 ? "warn" : "pass",
    page.redirects.length ? page.redirects.map((r) => `${r.status} ${r.from} → ${r.to}`).join("\n") : "No redirects", 1);

  // ---------------- Accessibility ----------------
  add("Accessibility", "lang", "Page language", doc.lang ? "pass" : "fail", doc.lang ? `lang="${doc.lang}"` : "No lang attribute on <html>. Screen readers may use the wrong voice.", 2);

  const noAlt = imgs.filter((i) => !("alt" in i.attrs));
  add("Accessibility", "alt", "Image alt text", noAlt.length ? "fail" : "pass",
    noAlt.length ? `${plural(noAlt.length, "image")} missing alt: ${sample(noAlt.map((i) => i.attrs.src || "inline image"))}` : imgs.length ? `All ${imgs.length} images have alt` : "No <img> tags", 3);

  const viewport = doc.meta("name", "viewport");
  if (!viewport) add("Accessibility", "viewport", "Mobile viewport", "fail", "No viewport meta tag. The page will look tiny on phones.", 3);
  else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport)) add("Accessibility", "viewport", "Mobile viewport", "warn", "Zoom is disabled. People with low vision cannot enlarge text.", 3);
  else add("Accessibility", "viewport", "Mobile viewport", "pass", viewport, 3);

  let skipped = null;
  doc.headings.reduce((prev, h) => { if (!skipped && prev && h.level > prev + 1) skipped = `h${prev} → h${h.level} (“${h.text}”)`; return h.level; }, 0);
  add("Accessibility", "heading-order", "Heading order", skipped ? "warn" : "pass", skipped ? `Skipped level: ${skipped}` : `${plural(doc.headings.length, "heading")}, no skipped levels`, 1);

  const inputs = doc.all("input").filter((i) => !["hidden", "submit", "button", "reset", "image"].includes((i.attrs.type || "").toLowerCase()));
  const labelFor = new Set(doc.all("label").map((l) => l.attrs.for).filter(Boolean));
  const unlabeled = inputs.filter((i) => !(i.attrs.id && labelFor.has(i.attrs.id)) && !i.attrs["aria-label"] && !i.attrs["aria-labelledby"] && !i.attrs.title);
  if (inputs.length) add("Accessibility", "labels", "Form labels", unlabeled.length ? "warn" : "pass",
    unlabeled.length ? `${plural(unlabeled.length, "field")} may have no label: ${sample(unlabeled.map((i) => i.attrs.name || i.attrs.placeholder || i.attrs.type || "input"))}` : `All ${inputs.length} fields labelled`, 2);

  const emptyLinks = doc.all("a").filter((a) => a.attrs.href && a.attrs["aria-label"] === "");
  if (emptyLinks.length) add("Accessibility", "link-names", "Link names", "warn", `${plural(emptyLinks.length, "link")} with an empty aria-label`, 1);

  // ---------------- Security ----------------
  add("Security", "https", "HTTPS", url.protocol === "https:" ? "pass" : "fail", url.protocol === "https:" ? "Served over HTTPS" : "Not served over HTTPS. Browsers mark the site as “Not secure”.", 4);
  if (url.protocol === "https:") {
    const hsts = page.headers["strict-transport-security"];
    add("Security", "hsts", "HSTS", hsts ? "pass" : "warn", hsts || "No Strict-Transport-Security header", 1);
  }
  const csp = page.headers["content-security-policy"];
  add("Security", "csp", "Content-Security-Policy", csp ? "pass" : "warn", csp ? "Present" : "No CSP header. It protects against injected scripts.", 1);
  const xcto = page.headers["x-content-type-options"];
  add("Security", "nosniff", "X-Content-Type-Options", xcto === "nosniff" ? "pass" : "warn", xcto ? `x-content-type-options: ${xcto}` : "Missing (should be nosniff)", 1);
  const frame = page.headers["x-frame-options"] || (csp && /frame-ancestors/i.test(csp));
  add("Security", "clickjacking", "Clickjacking protection", frame ? "pass" : "warn", frame ? "X-Frame-Options or frame-ancestors set" : "No X-Frame-Options or CSP frame-ancestors", 1);
  const mixed = url.protocol === "https:" ? doc.tags.filter((tg) => ["img", "script", "link", "iframe", "source"].includes(tg.name) && /^http:\/\//i.test(tg.attrs.src || tg.attrs.href || "")) : [];
  if (url.protocol === "https:") add("Security", "mixed", "Mixed content", mixed.length ? "fail" : "pass", mixed.length ? `${plural(mixed.length, "resource")} loaded over http://` : "No http:// resources", 2);
  const blank = doc.all("a").filter((a) => a.attrs.target === "_blank" && !/noopener|noreferrer/i.test(a.attrs.rel || ""));
  add("Security", "noopener", "Safe external links", blank.length ? "warn" : "pass", blank.length ? `${plural(blank.length, "link")} with target="_blank" but no rel="noopener"` : "OK", 1);
  const server = page.headers["x-powered-by"];
  if (server) add("Security", "powered-by", "Technology disclosure", "warn", `x-powered-by: ${server} reveals your stack to attackers`, 1);

  // ---------------- Best practices ----------------
  add("Best practices", "status", "HTTP status", page.status === 200 ? "pass" : "fail", `HTTP ${page.status}`, 3);
  add("Best practices", "doctype", "HTML5 doctype", doc.doctype ? "pass" : "warn", doc.doctype ? "<!doctype html>" : "Missing <!doctype html>: the browser may use quirks mode", 1);
  const charset = doc.all("meta").some((m) => m.attrs.charset) || /charset=/i.test(page.headers["content-type"] || "");
  add("Best practices", "charset", "Character encoding", charset ? "pass" : "warn", charset ? "Declared" : "No charset declared", 1);
  const favicon = doc.all("link").some((l) => /icon/i.test(l.attrs.rel || ""));
  add("Best practices", "favicon", "Favicon", favicon ? "pass" : "warn", favicon ? "Declared" : "No <link rel=\"icon\">", 1);
  const inlineJs = doc.scripts.reduce((sum, s) => sum + s.inlineBytes, 0);
  add("Best practices", "inline-js", "Inline JavaScript", inlineJs > 100 * 1024 ? "warn" : "pass", `${kb(inlineJs)} of inline script`, 1);
  const theme = doc.meta("name", "theme-color");
  add("Best practices", "theme-color", "Theme colour", theme ? "pass" : "info", theme ? theme : "No theme-color meta (colours the mobile browser bar)", theme ? 0.5 : 0);

  return results;
}

export function score(results) {
  const value = { pass: 1, warn: 0.5, fail: 0 };
  const byCategory = {};
  for (const cat of CATEGORIES) {
    const scored = results.filter((r) => r.category === cat && r.status !== "info" && r.weight > 0);
    const total = scored.reduce((s, r) => s + r.weight, 0);
    byCategory[cat] = total ? Math.round((scored.reduce((s, r) => s + r.weight * value[r.status], 0) / total) * 100) : null;
  }
  const values = Object.values(byCategory).filter((v) => v !== null);
  const overall = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { overall, byCategory };
}
