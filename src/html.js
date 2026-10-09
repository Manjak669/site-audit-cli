// Tiny dependency-free HTML scanner. It is not a full parser: it is built to
// answer audit questions (which tags, which attributes, which text) reliably
// on real-world pages, including messy markup.

const RAW_TEXT_TAGS = /(<(script|style|noscript|template)\b[^>]*>)[\s\S]*?<\/\2\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decode(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function parseAttrs(source = "") {
  const attrs = {};
  for (const m of source.matchAll(ATTR)) {
    attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

export function scan(html) {
  const raw = html;
  const stripped = html.replace(COMMENTS, "").replace(RAW_TEXT_TAGS, (m, open, name) => `${open}</${name}>`);

  const tags = [];
  for (const m of stripped.matchAll(TAG)) {
    tags.push({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2]), index: m.index });
  }
  const all = (name) => tags.filter((t) => t.name === name);

  const title = stripped.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const headings = [...stripped.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    level: Number(m[1]),
    text: clean(m[2]),
  }));
  const meta = (key, value) => all("meta").find((t) => (t.attrs[key] || "").toLowerCase() === value)?.attrs.content;
  const link = (rel) => all("link").find((t) => (t.attrs.rel || "").toLowerCase().split(/\s+/).includes(rel));

  const scripts = [...raw.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map((m) => ({
    attrs: parseAttrs(m[1]),
    inlineBytes: Buffer.byteLength(m[2] || ""),
  }));

  const bodyText = clean(stripped.replace(/^[\s\S]*?<body\b[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, ""));

  return {
    tags,
    all,
    title: title ? clean(title[1]) : null,
    headings,
    lang: all("html")[0]?.attrs.lang ?? null,
    doctype: /^\s*<!doctype html/i.test(raw),
    meta,
    link,
    scripts,
    wordCount: bodyText ? bodyText.split(" ").length : 0,
  };
}
