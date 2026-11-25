#!/usr/bin/env node
/**
 * Build the OpenFranz library index.
 *
 * Scans every Markdown file under library/, extracts wiki and Markdown links,
 * resolves them to /arsenal or /knowledge paths, and writes:
 *   index/links.json  nodes, links, backlinks, missing targets
 *   index/graph.json  { nodes, edges } for visualization
 *
 * Usage:
 *   node library_index.mjs --workspace DIR [--quiet]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  extractLinks,
  fileStat,
  physicalPath,
  resolveLink,
  titleOf,
  toVfsPath,
  walkMarkdown,
} from "./lib.mjs";

export function buildIndex(workspace) {
  const libraryRoot = resolve(workspace, "library");
  const files = walkMarkdown(libraryRoot);
  const nodes = [];
  const links = [];
  const missing = [];

  for (const file of files) {
    const vfsPath = toVfsPath(file, workspace);
    if (!vfsPath) continue;

    const content = readFileSync(file, "utf8");
    const stat = fileStat(file);
    nodes.push({
      path: vfsPath,
      title: titleOf(content, vfsPath),
      updatedAt: stat ? stat.mtime.toISOString() : null,
      size: stat ? stat.size : content.length,
    });

    for (const link of extractLinks(content)) {
      const target = resolveLink(vfsPath, link.target);
      if (!target) continue;
      links.push({ source: vfsPath, target, kind: link.kind });
      if (!existsSync(physicalPath(target, workspace))) {
        missing.push({ source: vfsPath, target });
      }
    }
  }

  // One edge per source/target pair. Markdown wins when both syntaxes appear,
  // matching the app's last-write-wins behavior.
  const edgeMap = new Map();
  for (const link of links) {
    edgeMap.set(`${link.source}\0${link.target}`, link);
  }
  const uniqueLinks = [...edgeMap.values()].sort(
    (left, right) =>
      left.source.localeCompare(right.source) ||
      left.target.localeCompare(right.target),
  );

  const backlinks = {};
  for (const link of uniqueLinks) {
    if (!backlinks[link.target]) backlinks[link.target] = [];
    if (!backlinks[link.target].includes(link.source)) {
      backlinks[link.target].push(link.source);
    }
  }
  for (const sources of Object.values(backlinks)) sources.sort();

  const index = {
    generatedAt: new Date().toISOString(),
    nodes: nodes.sort((left, right) => left.path.localeCompare(right.path)),
    links: uniqueLinks,
    backlinks,
    missing,
  };

  const graph = {
    nodes: index.nodes.map((node) => ({ id: node.path, title: node.title })),
    edges: uniqueLinks.map((link) => ({
      source: link.source,
      target: link.target,
      kind: link.kind,
    })),
  };

  const indexDir = join(workspace, "index");
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(
    join(indexDir, "links.json"),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(indexDir, "graph.json"),
    `${JSON.stringify(graph, null, 2)}\n`,
    "utf8",
  );

  return index;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--quiet") args.quiet = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node library_index.mjs --workspace DIR [--quiet]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.workspace) throw new Error("--workspace is required");
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const index = buildIndex(args.workspace);
  if (!args.quiet) {
    console.log(
      `Indexed ${index.nodes.length} files, ${index.links.length} links, ${index.missing.length} missing targets.`,
    );
    if (index.missing.length > 0) {
      for (const item of index.missing.slice(0, 20)) {
        console.log(`  missing: ${item.source} -> ${item.target}`);
      }
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
