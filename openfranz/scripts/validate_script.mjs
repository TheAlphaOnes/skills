#!/usr/bin/env node
/**
 * Validate an OpenFranz script before saving.
 *
 * Checks:
 * - one ```script fence with a title attribute
 * - exactly three variants
 * - each variant has **Angle:**, at least three beats, and **Why it works:**
 * - each beat is `0-2s | on-screen: ... | spoken: ... | visual: ...`
 * - no placeholder text
 *
 * Usage:
 *   node validate_script.mjs <file> [--json]
 *   node validate_script.mjs --content-file <file> [--json]
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FENCE = /```script\s+([^\n]*)\n([\s\S]*?)```/i;
const BEAT =
  /^\s*\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*s\s*\|\s*on-screen\s*:.*\|\s*spoken\s*:.*\|\s*visual\s*:.*$/i;

export function validateScript(content) {
  const problems = [];
  const trimmed = String(content ?? "").trim();

  if (!trimmed) return ["The script is empty."];

  const fence = trimmed.match(FENCE);
  if (!fence) {
    return [
      "Wrap the whole script in one ```script fence with a title attribute.",
    ];
  }

  const attributes = fence[1];
  const body = fence[2];

  if (!/\btitle\s*=\s*"[^"]+"/i.test(attributes)) {
    problems.push('The script fence needs a title="..." attribute.');
  }

  const variants = body.split(/^###\s+/m).slice(1);
  if (variants.length !== 3) {
    problems.push(
      `Expected exactly 3 variants with ### headings, found ${variants.length}.`,
    );
  }

  for (const [index, variant] of variants.entries()) {
    const label = `Variant ${index + 1}`;

    if (!/\*\*Angle:\*\*/i.test(variant)) {
      problems.push(`${label}: add an **Angle:** line.`);
    }
    if (!/\*\*Why it works:\*\*/i.test(variant)) {
      problems.push(`${label}: add a **Why it works:** line.`);
    }

    const beats = variant
      .split("\n")
      .filter((line) => BEAT.test(line.trim()));
    if (beats.length < 3) {
      problems.push(
        `${label}: add at least 3 beats in the form 0-2s | on-screen: ... | spoken: ... | visual: ... (found ${beats.length}).`,
      );
    }
  }

  if (/\b(TODO|TBD|lorem ipsum|to be created)\b/i.test(trimmed)) {
    problems.push("Remove placeholder text before saving.");
  }

  return problems;
}

function parseArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--content-file") args.contentFile = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node validate_script.mjs <file> [--json]\n       node validate_script.mjs --content-file <file> [--json]",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      args.file = arg;
    }
  }
  if (!args.file && !args.contentFile) {
    throw new Error("A script file is required");
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file ?? args.contentFile;
  const content = readFileSync(file, "utf8");
  const problems = validateScript(content);

  if (args.json) {
    console.log(
      JSON.stringify({ ok: problems.length === 0, file, problems }, null, 2),
    );
  } else if (problems.length === 0) {
    console.log(`OK ${file}`);
  } else {
    console.error(`INVALID ${file}`);
    for (const problem of problems) console.error(`  - ${problem}`);
  }

  if (problems.length > 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
