#!/usr/bin/env node
/**
 * Gather the strongest library material for a writing task in one call.
 *
 * This is the one-call context helper: it
 * tokenizes the query, scores files by how many query tokens they match,
 * reads the top files, and returns their content.
 *
 * Usage:
 *   node library_context.mjs "curiosity gap for a cold brew launch" \
 *     --workspace DIR [--focus both|arsenal|knowledge] [--limit 3] \
 *     [--max-chars 4000] [--json]
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildIndex } from "./library_index.mjs";
import { fuzzyScore } from "./library_search.mjs";
import { physicalPath, readJson } from "./lib.mjs";

function parseArgs(argv) {
  const args = { focus: "both", limit: 3, maxChars: 4000, json: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--focus") args.focus = argv[++index];
    else if (arg === "--limit") args.limit = Number(argv[++index]);
    else if (arg === "--max-chars") args.maxChars = Number(argv[++index]);
    else if (arg === "--json") args.json = true;
    else if (arg === "--rebuild") args.rebuild = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node library_context.mjs <query> --workspace DIR [--focus both|arsenal|knowledge] [--limit 3] [--max-chars 4000] [--json]",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (!args.workspace) throw new Error("--workspace is required");
  args.query = positional.join(" ").trim();
  if (!args.query) throw new Error("A query is required");
  return args;
}

function tokenize(query) {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3),
    ),
  ].slice(0, 6);
}

function loadIndex(workspace, rebuild) {
  const file = join(resolve(workspace), "index", "links.json");
  if (!rebuild && existsSync(file)) {
    return readJson(file, null) ?? buildIndex(workspace);
  }
  return buildIndex(workspace);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const index = loadIndex(args.workspace, args.rebuild);
  const tokens = tokenize(args.query);
  const prefix =
    args.focus === "arsenal"
      ? "/arsenal/"
      : args.focus === "knowledge"
        ? "/knowledge/"
        : null;

  const scored = new Map();

  for (const token of tokens.length > 0 ? tokens : [args.query]) {
    for (const node of index.nodes) {
      if (prefix && !node.path.startsWith(prefix)) continue;

      const pathScore = fuzzyScore(token, node.path);
      if (pathScore <= 0) continue;

      const current = scored.get(node.path) ?? {
        node,
        tokenHits: 0,
        pathScore: 0,
      };
      current.tokenHits += 1;
      current.pathScore += pathScore;
      scored.set(node.path, current);
    }
  }

  // Content hits improve recall for synonyms and phrases that are not in the
  // filename. They are a secondary signal, not the primary ranking.
  for (const token of tokens.length > 0 ? tokens : [args.query]) {
    for (const node of index.nodes) {
      if (prefix && !node.path.startsWith(prefix)) continue;
      const file = physicalPath(node.path, args.workspace);
      if (!existsSync(file)) continue;
      const content = readFileSync(file, "utf8").toLowerCase();
      const hits = content.split(token.toLowerCase()).length - 1;
      if (hits <= 0) continue;

      const current = scored.get(node.path) ?? {
        node,
        tokenHits: 0,
        pathScore: 0,
      };
      current.tokenHits += 1;
      current.pathScore += Math.min(hits, 5) * 20;
      scored.set(node.path, current);
    }
  }

  const files = [...scored.values()]
    .sort(
      (left, right) =>
        right.tokenHits - left.tokenHits ||
        right.pathScore - left.pathScore ||
        left.node.path.localeCompare(right.node.path),
    )
    .slice(0, Math.min(Math.max(args.limit, 1), 5));

  const documents = [];
  for (const item of files) {
    const file = physicalPath(item.node.path, args.workspace);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    documents.push({
      path: item.node.path,
      title: item.node.title,
      updatedAt: item.node.updatedAt,
      tokenHits: item.tokenHits,
      content: content.slice(0, Math.max(args.maxChars, 200)),
    });
  }

  const result = {
    query: args.query,
    focus: args.focus,
    tokens,
    documents,
    note:
      documents.length === 0
        ? "No library match. Say so in one line and write from first principles."
        : "Use the strongest specific line, structure, or mechanism from these documents. Do not dump them.",
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (documents.length === 0) {
    console.log(result.note);
    return;
  }

  for (const document of documents) {
    console.log(`\n===== ${document.path} (${document.title}) =====`);
    console.log(document.content.trim());
  }
  console.log(`\n${result.note}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
