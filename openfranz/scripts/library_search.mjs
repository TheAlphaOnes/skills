#!/usr/bin/env node
/**
 * Search and traverse the OpenFranz library.
 *
 * Usage:
 *   node library_search.mjs <query> --workspace DIR [--limit 20] [--content] [--root arsenal|knowledge] [--json]
 *   node library_search.mjs links <path> --workspace DIR [--json]
 *   node library_search.mjs related <path> --workspace DIR [--depth 2] [--json]
 *   node library_search.mjs path <from> <to> --workspace DIR [--json]
 *   node library_search.mjs list [path] --workspace DIR [--json]
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildIndex } from "./library_index.mjs";
import {
  normalizeVfsPath,
  physicalPath,
  readJson,
} from "./lib.mjs";

function parseArgs(argv) {
  const args = { limit: 20, depth: 1, json: false, content: false };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--limit") args.limit = Number(argv[++index]);
    else if (arg === "--depth") args.depth = Number(argv[++index]);
    else if (arg === "--root") args.root = argv[++index];
    else if (arg === "--content") args.content = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--rebuild") args.rebuild = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node library_search.mjs <query>|links|related|path|list ... --workspace DIR",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (!args.workspace) throw new Error("--workspace is required");
  args.command = positional[0] ?? "search";
  args.query = positional[0] ?? "";
  args.path = positional[1] ?? "";
  args.from = positional[1] ?? "";
  args.to = positional[2] ?? "";
  return args;
}

function loadIndex(workspace, rebuild) {
  const file = join(resolve(workspace), "index", "links.json");
  if (!rebuild && existsSync(file)) {
    return readJson(file, null) ?? buildIndex(workspace);
  }
  return buildIndex(workspace);
}

export function fuzzyScore(query, candidate) {
  const needle = query.trim().toLowerCase();
  const haystack = candidate.toLowerCase();

  if (!needle) return 0;
  if (haystack === needle) return 1000;

  const basename = haystack.slice(haystack.lastIndexOf("/") + 1);
  if (basename === needle) return 900;
  if (basename.startsWith(needle)) return 800 - basename.length * 0.01;
  if (haystack.includes(needle)) {
    return 700 - haystack.indexOf(needle) - haystack.length * 0.01;
  }

  let queryIndex = 0;
  let score = 0;
  let previousMatch = -2;

  for (let index = 0; index < haystack.length && queryIndex < needle.length; index += 1) {
    if (haystack[index] !== needle[queryIndex]) continue;
    score += 10;
    if (index === previousMatch + 1) score += 8;
    if (
      index === 0 ||
      haystack[index - 1] === "/" ||
      haystack[index - 1] === "-" ||
      haystack[index - 1] === "_" ||
      haystack[index - 1] === " "
    ) {
      score += 12;
    }
    previousMatch = index;
    queryIndex += 1;
  }

  if (queryIndex < needle.length) return 0;
  return score - haystack.length * 0.1;
}

function normalizeQueryPath(value) {
  let path = String(value ?? "").trim();
  if (!path) return "/";
  if (path.startsWith("library/")) path = path.slice("library".length);
  if (!path.startsWith("/")) path = `/${path}`;
  return normalizeVfsPath(path);
}

function search(args, index) {
  const query = args.query.trim();
  if (!query) throw new Error("A search query is required");

  const rootPrefix =
    args.root === "arsenal"
      ? "/arsenal/"
      : args.root === "knowledge"
        ? "/knowledge/"
        : null;

  const results = [];
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);

  for (const node of index.nodes) {
    if (rootPrefix && !node.path.startsWith(rootPrefix)) continue;

    let score =
      tokens.length > 1
        ? tokens.reduce((sum, token) => sum + fuzzyScore(token, node.path), 0)
        : fuzzyScore(query, node.path);
    let contentHits = 0;

    if (args.content) {
      const file = physicalPath(node.path, args.workspace);
      if (existsSync(file)) {
        const content = readFileSync(file, "utf8").toLowerCase();
        const needles = tokens.length > 0 ? tokens : [query.toLowerCase()];
        for (const needle of needles) {
          let position = content.indexOf(needle);
          while (position !== -1) {
            contentHits += 1;
            position = content.indexOf(needle, position + needle.length);
          }
        }
        if (contentHits > 0) score += 500 + contentHits * 10;
      }
    }

    if (score > 0) {
      results.push({ ...node, score: Number(score.toFixed(2)), contentHits });
    }
  }

  results.sort(
    (left, right) =>
      right.score - left.score || left.path.localeCompare(right.path),
  );

  return results.slice(0, Math.min(Math.max(args.limit, 1), 100));
}

function printSearch(results, json) {
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (results.length === 0) {
    console.log("No matches.");
    return;
  }
  for (const result of results) {
    const hits = result.contentHits > 0 ? ` [${result.contentHits} content hits]` : "";
    console.log(
      `${String(result.score).padStart(7)}  ${result.path}  (${result.title})${hits}`,
    );
  }
}

function printLinks(path, index, json) {
  const outgoing = index.links.filter((link) => link.source === path);
  const backlinks = index.backlinks[path] ?? [];
  const missing = index.missing.filter((item) => item.source === path);

  if (json) {
    console.log(JSON.stringify({ path, outgoing, backlinks, missing }, null, 2));
    return;
  }

  console.log(`Path: ${path}`);
  console.log(`Outgoing (${outgoing.length}):`);
  for (const link of outgoing) console.log(`  -> ${link.target} (${link.kind})`);
  console.log(`Backlinks (${backlinks.length}):`);
  for (const source of backlinks) console.log(`  <- ${source}`);
  if (missing.length > 0) {
    console.log(`Missing targets (${missing.length}):`);
    for (const item of missing) console.log(`  !! ${item.target}`);
  }
}

function related(path, index, depth) {
  const adjacency = new Map();
  const add = (from, to) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from).add(to);
  };
  for (const link of index.links) {
    add(link.source, link.target);
    add(link.target, link.source);
  }

  const visited = new Set([path]);
  const queue = [{ path, depth: 0 }];
  const results = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth >= depth) continue;
    for (const next of adjacency.get(current.path) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      results.push({ path: next, depth: current.depth + 1 });
      queue.push({ path: next, depth: current.depth + 1 });
    }
  }

  return results;
}

function shortestPath(from, to, index) {
  const adjacency = new Map();
  for (const link of index.links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    adjacency.get(link.source).push(link.target);
  }

  const queue = [[from]];
  const visited = new Set([from]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (current === to) return path;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }

  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const index = loadIndex(args.workspace, args.rebuild);

  if (args.command === "links") {
    printLinks(normalizeQueryPath(args.path), index, args.json);
    return;
  }

  if (args.command === "related") {
    const path = normalizeQueryPath(args.path);
    const results = related(path, index, Math.min(Math.max(args.depth, 1), 5));
    if (args.json) {
      console.log(JSON.stringify({ path, related: results }, null, 2));
    } else {
      console.log(`Related to ${path}:`);
      for (const item of results) {
        console.log(`  ${"  ".repeat(item.depth - 1)}${item.path}`);
      }
      if (results.length === 0) console.log("  (none)");
    }
    return;
  }

  if (args.command === "path") {
    const from = normalizeQueryPath(args.from);
    const to = normalizeQueryPath(args.to);
    const result = shortestPath(from, to, index);
    if (args.json) {
      console.log(JSON.stringify({ from, to, path: result }, null, 2));
    } else if (result) {
      console.log(result.join(" -> "));
    } else {
      console.log("No path.");
    }
    return;
  }

  if (args.command === "list") {
    const prefix = args.path ? normalizeQueryPath(args.path) : "/";
    const nodes = index.nodes.filter(
      (node) => node.path === prefix || node.path.startsWith(`${prefix.replace(/\/$/, "")}/`),
    );
    if (args.json) {
      console.log(JSON.stringify(nodes, null, 2));
    } else {
      for (const node of nodes) console.log(`${node.path}  (${node.title})`);
      if (nodes.length === 0) console.log("No files.");
    }
    return;
  }

  printSearch(search(args, index), args.json);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
