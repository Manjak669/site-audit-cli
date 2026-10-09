#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { audit } from "../src/audit.js";
import { printReport } from "../src/report-terminal.js";
import { renderHtml } from "../src/report-html.js";

const HELP = `
site-audit — quick SEO, performance, accessibility and security check for any web page

Usage
  site-audit <url> [options]

Options
  --html [file]     Save a shareable HTML report (default: site-audit-<host>.html)
  --json            Print the full result as JSON (for scripts and CI)
  --min-score <n>   Exit with code 1 if the overall score is below n (for CI)
  --timeout <sec>   Request timeout in seconds (default 15)
  -v, --verbose     Also list passed checks
  -h, --help        Show this help

Examples
  site-audit example.com
  site-audit https://example.com --html report.html
  site-audit example.com --json --min-score 80
`;

// Allow a bare `--html` (no file name) by turning it into `--html=`.
const argv = process.argv.slice(2).map((arg, i, all) =>
  arg === "--html" && (i === all.length - 1 || all[i + 1].startsWith("-")) ? "--html=" : arg
);

let args;
try {
  args = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      html: { type: "string" },
      json: { type: "boolean" },
      "min-score": { type: "string" },
      timeout: { type: "string" },
      verbose: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

const { values, positionals } = args;
if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(values.help ? 0 : 2);
}

try {
  const timeout = values.timeout ? Number(values.timeout) * 1000 : undefined;
  const report = await audit(positionals[0], { timeout });

  if (values.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report, { verbose: values.verbose });

  if (values.html !== undefined) {
    const file = values.html || `site-audit-${new URL(report.url).host.replace(/[^\w.-]/g, "_")}.html`;
    await writeFile(file, renderHtml(report));
    if (!values.json) console.log(`HTML report saved to ${file}\n`);
  }

  const min = values["min-score"] ? Number(values["min-score"]) : null;
  if (min !== null && report.score.overall < min) {
    console.error(`Score ${report.score.overall} is below the minimum ${min}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(2);
}
