import { CATEGORIES } from "./checks.js";

const useColor = (process.stdout.isTTY || Boolean(process.env.FORCE_COLOR)) && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = { bold: paint(1), dim: paint(2), red: paint(31), green: paint(32), yellow: paint(33), cyan: paint(36), gray: paint(90) };

const ICON = { pass: c.green("✔"), warn: c.yellow("▲"), fail: c.red("✖"), info: c.cyan("ℹ") };
const tone = (n) => (n >= 90 ? c.green : n >= 60 ? c.yellow : c.red);

function bar(value, width = 20) {
  const filled = Math.round((value / 100) * width);
  return tone(value)("█".repeat(filled)) + c.gray("░".repeat(width - filled));
}

export function printReport(report, { verbose = false } = {}) {
  const out = [];
  out.push("");
  out.push(`${c.bold("Site audit")}  ${c.cyan(report.url)}`);
  if (report.title) out.push(c.dim(`“${report.title}”`));
  out.push(c.dim(`HTTP ${report.status} · ${report.timing.ttfb} ms to first byte · ${(report.bytes / 1024).toFixed(1)} KB HTML`));
  out.push("");
  out.push(`${c.bold("Overall")}  ${tone(report.score.overall)(c.bold(String(report.score.overall).padStart(3)))}/100  ${bar(report.score.overall, 30)}`);
  out.push("");

  for (const cat of CATEGORIES) {
    const value = report.score.byCategory[cat];
    if (value === null) continue;
    out.push(`${cat.padEnd(15)} ${tone(value)(String(value).padStart(3))}  ${bar(value)}`);
  }

  for (const cat of CATEGORIES) {
    const items = report.results.filter((r) => r.category === cat && (verbose || r.status !== "pass"));
    if (!items.length) continue;
    out.push("");
    out.push(c.bold(cat));
    for (const r of items) {
      out.push(`  ${ICON[r.status]} ${r.title}`);
      for (const line of String(r.detail).split("\n")) out.push(c.gray(`      ${line}`));
    }
  }

  const fails = report.results.filter((r) => r.status === "fail").length;
  const warns = report.results.filter((r) => r.status === "warn").length;
  out.push("");
  out.push(`${c.red(`${fails} to fix`)} · ${c.yellow(`${warns} to improve`)} · ${c.green(`${report.results.filter((r) => r.status === "pass").length} passed`)}${verbose ? "" : c.dim("   (use --verbose to list passed checks)")}`);
  out.push("");
  console.log(out.join("\n"));
}
