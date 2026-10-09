import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { audit, normalizeUrl } from "../src/audit.js";
import { scan, decode } from "../src/html.js";
import { renderHtml } from "../src/report-html.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
let server;
let base;

before(async () => {
  server = createServer((req, res) => {
    const goodHeaders = {
      "content-type": "text/html; charset=utf-8",
      "content-encoding": "gzip",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'self'",
    };
    if (req.url === "/") { res.writeHead(200, goodHeaders); return res.end(gzipSync(fixture("good.html"))); }
    if (req.url === "/old") { res.writeHead(301, { location: "/" }); return res.end(); }
    if (req.url === "/bad") { res.writeHead(200, { "content-type": "text/html", "x-powered-by": "PHP/5.6" }); return res.end(fixture("bad.html")); }
    if (req.url === "/robots.txt") { res.writeHead(200); return res.end("User-agent: *\nSitemap: /sitemap.xml"); }
    if (req.url === "/missing") { res.writeHead(404, { "content-type": "text/html" }); return res.end("<h1>Not found</h1>"); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const byId = (report, id) => report.results.find((r) => r.id === id);

test("normalizeUrl adds https and rejects junk", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("http://a.b/c"), "http://a.b/c");
  assert.throws(() => normalizeUrl(""), /Please pass a URL/);
  assert.throws(() => normalizeUrl("ftp://x.y"), /Only http/);
});

test("scanner ignores comments and script contents, decodes entities", () => {
  const doc = scan(fixture("bad.html"));
  assert.deepEqual(doc.headings.map((h) => h.text), ["One", "Two", "Skipped"]);
  assert.equal(scan(fixture("good.html")).headings[0].text, "Fresh bread & coffee");
  assert.equal(decode("&lt;b&gt; &#169; &#x41;"), "<b> © A");
});

test("a well-built page scores high", async () => {
  const report = await audit(`${base}/`);
  assert.equal(report.status, 200);
  assert.equal(byId(report, "title").status, "pass");
  assert.equal(byId(report, "description").status, "pass");
  assert.equal(byId(report, "h1").status, "pass");
  assert.equal(byId(report, "alt").status, "pass");
  assert.equal(byId(report, "compression").status, "pass");
  assert.equal(byId(report, "sitemap").status, "pass", "sitemap declared in robots.txt counts");
  assert.equal(byId(report, "render-blocking").status, "pass", "defer scripts are not blocking");
  assert.ok(report.score.byCategory.SEO >= 90, `SEO ${report.score.byCategory.SEO}`);
  assert.ok(report.score.byCategory.Accessibility === 100);
});

test("a broken page gets the right findings", async () => {
  const report = await audit(`${base}/bad`);
  assert.equal(byId(report, "title").status, "fail");
  assert.equal(byId(report, "noindex").status, "fail");
  assert.equal(byId(report, "h1").status, "warn");
  assert.match(byId(report, "h1").detail, /2 <h1>/);
  assert.equal(byId(report, "alt").status, "fail");
  assert.match(byId(report, "alt").detail, /1 image missing alt/, "alt=\"\" is valid for decorative images");
  assert.equal(byId(report, "lang").status, "fail");
  assert.equal(byId(report, "viewport").status, "warn");
  assert.equal(byId(report, "heading-order").status, "warn");
  assert.equal(byId(report, "labels").status, "warn");
  assert.equal(byId(report, "render-blocking").status, "warn");
  assert.equal(byId(report, "noopener").status, "warn");
  assert.equal(byId(report, "powered-by").status, "warn");
  assert.equal(byId(report, "doctype").status, "warn");
  assert.ok(report.score.overall < 60, `overall ${report.score.overall}`);
});

test("redirects are followed and reported", async () => {
  const report = await audit(`${base}/old`);
  assert.equal(report.url, `${base}/`);
  assert.match(byId(report, "redirects").detail, /301/);
});

test("non-200 pages fail the status check", async () => {
  const report = await audit(`${base}/missing`);
  assert.equal(byId(report, "status").status, "fail");
});

test("unreachable hosts give a friendly error", async () => {
  await assert.rejects(audit("http://127.0.0.1:9"), /Could not reach/);
});

test("HTML report escapes page content", async () => {
  const report = await audit(`${base}/bad`);
  report.title = '<script>alert("x")</script>';
  const html = renderHtml(report);
  assert.ok(!html.includes('<script>alert("x")</script>'));
  assert.ok(html.includes("&lt;script&gt;"));
});
