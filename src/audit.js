import { fetchPage, probe } from "./fetch.js";
import { scan } from "./html.js";
import { runChecks, score } from "./checks.js";

export function normalizeUrl(input) {
  const value = String(input || "").trim();
  if (!value) throw new Error("Please pass a URL, for example: site-audit example.com");
  if (/^[a-z][\w+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) throw new Error("Only http and https URLs are supported");
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url;
  try { url = new URL(withProtocol); } catch { throw new Error(`“${value}” is not a valid URL`); }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http and https URLs are supported");
  return url.href;
}

export async function audit(input, options = {}) {
  const url = normalizeUrl(input);
  const page = await fetchPage(url, options);
  const doc = scan(page.html);
  const origin = new URL(page.finalUrl).origin;
  const [robots, sitemap] = await Promise.all([probe(`${origin}/robots.txt`), probe(`${origin}/sitemap.xml`)]);
  const results = runChecks({ page, doc, robots, sitemap });
  return {
    url: page.finalUrl,
    requestedUrl: url,
    fetchedAt: new Date().toISOString(),
    status: page.status,
    timing: { ttfb: Math.round(page.ttfb), total: Math.round(page.totalTime) },
    bytes: page.bytes,
    title: doc.title,
    score: score(results),
    results,
  };
}
