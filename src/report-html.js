import { CATEGORIES } from "./checks.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const color = (n) => (n >= 90 ? "#16a34a" : n >= 60 ? "#d97706" : "#dc2626");
const LABEL = { pass: "Passed", warn: "Improve", fail: "Fix", info: "Info" };

function ring(value, size = 120, label = "") {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)} ${value} out of 100">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="8"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color(value)}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - value / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${size / 4}" font-weight="800" fill="${color(value)}">${value}</text>
  </svg>`;
}

export function renderHtml(report) {
  const cats = CATEGORIES.filter((cat) => report.score.byCategory[cat] !== null);
  const order = { fail: 0, warn: 1, info: 2, pass: 3 };
  const sections = cats.map((cat) => {
    const items = report.results.filter((r) => r.category === cat).sort((a, b) => order[a.status] - order[b.status]);
    return `<section class="cat">
      <h2>${esc(cat)} <span style="color:${color(report.score.byCategory[cat])}">${report.score.byCategory[cat]}</span></h2>
      <ul>${items.map((r) => `<li class="${r.status}">
        <span class="badge">${LABEL[r.status]}</span>
        <div><strong>${esc(r.title)}</strong><p>${esc(r.detail).replace(/\n/g, "<br>")}</p></div>
      </li>`).join("")}</ul>
    </section>`;
  }).join("");

  const counts = ["fail", "warn", "pass"].map((s) => report.results.filter((r) => r.status === s).length);
  const date = new Date(report.fetchedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site audit: ${esc(new URL(report.url).host)}</title>
<style>
  :root { --ink:#111827; --muted:#6b7280; --line:#e5e7eb; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--ink); background:#f6f7fb; line-height:1.5; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 40px 20px 64px; }
  header { background:#fff; border:1px solid var(--line); border-radius:20px; padding:28px; display:flex; gap:28px; align-items:center; flex-wrap:wrap; }
  header h1 { margin:0 0 4px; font-size:1.5rem; word-break:break-all; }
  header p { margin:0; color:var(--muted); }
  .summary { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; }
  .pill { padding:4px 12px; border-radius:999px; font-weight:700; font-size:.85rem; }
  .cats { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin:20px 0; }
  .cats div { background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px; text-align:center; font-weight:600; font-size:.9rem; }
  .cats .ring { display:block; margin:0 auto 6px; }
  .cat { background:#fff; border:1px solid var(--line); border-radius:20px; padding:8px 24px 16px; margin-top:16px; }
  .cat h2 { display:flex; justify-content:space-between; font-size:1.1rem; }
  ul { list-style:none; margin:0; padding:0; }
  li { display:flex; gap:14px; padding:12px 0; border-top:1px solid var(--line); }
  li p { margin:2px 0 0; color:var(--muted); font-size:.92rem; word-break:break-word; }
  .badge { flex:0 0 72px; text-align:center; font-size:.72rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; padding:4px 0; border-radius:8px; height:fit-content; }
  .fail .badge { background:#fee2e2; color:#b91c1c; } .warn .badge { background:#fef3c7; color:#b45309; }
  .pass .badge { background:#dcfce7; color:#15803d; } .info .badge { background:#e0f2fe; color:#0369a1; }
  footer { text-align:center; color:var(--muted); font-size:.85rem; margin-top:32px; }
  footer a { color:#4f46e5; }
  @media print { body { background:#fff; } .cat, header { break-inside: avoid; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    ${ring(report.score.overall, 132, "Overall score")}
    <div>
      <h1>${esc(report.url)}</h1>
      ${report.title ? `<p>“${esc(report.title)}”</p>` : ""}
      <p>Audited ${esc(date)} · HTTP ${report.status} · ${report.timing.ttfb} ms to first byte · ${(report.bytes / 1024).toFixed(1)} KB HTML</p>
      <div class="summary">
        <span class="pill" style="background:#fee2e2;color:#b91c1c">${counts[0]} to fix</span>
        <span class="pill" style="background:#fef3c7;color:#b45309">${counts[1]} to improve</span>
        <span class="pill" style="background:#dcfce7;color:#15803d">${counts[2]} passed</span>
      </div>
    </div>
  </header>
  <div class="cats">${cats.map((cat) => `<div>${ring(report.score.byCategory[cat], 84, cat)}${esc(cat)}</div>`).join("")}</div>
  ${sections}
  <footer>Generated by <a href="https://github.com/Manjak669/site-audit-cli">site-audit-cli</a> · Built by <a href="https://moonwave-studio.com">MoonWave</a></footer>
</div>
</body>
</html>`;
}
