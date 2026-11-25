#!/usr/bin/env node
/**
 * Read or list library files by their /arsenal or /knowledge path.
 *
 * Usage:
 *   node library_read.mjs /arsenal/hooks-attention/foo.md --workspace DIR [--json]
 *   node library_read.mjs --list /arsenal/hooks-attention --workspace DIR [--json]
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeVfsPath,
  physicalPath,
  titleOf,
  toVfsPath,
  walkMarkdown,
} from "./lib.mjs";

function parseArgs(argv) {
  const args = { json: false, list: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--list") args.list = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node library_read.mjs <path> --workspace DIR [--json]\n       node library_read.mjs --list <path> --workspace DIR [--json]",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (!args.workspace) throw new Error("--workspace is required");
  args.path = positional[0] ?? "/";
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const path = normalizeVfsPath(args.path);
  const isList = args.list || args.path.endsWith("/") || path === "/";

  if (isList) {
    const prefix = path === "/" ? "/" : `${path.replace(/\/$/, "")}/`;
    const nodes = walkMarkdown(resolve(args.workspace, "library"))
      .map((file) => {
        const vfsPath = toVfsPath(file, args.workspace);
        if (!vfsPath) return null;
        const content = readFileSync(file, "utf8");
        return { path: vfsPath, title: titleOf(content, vfsPath) };
      })
      .filter(Boolean)
      .filter((node) => node.path.startsWith(prefix))
      .sort((left, right) => left.path.localeCompare(right.path));

    if (args.json) {
      console.log(JSON.stringify(nodes, null, 2));
    } else {
      for (const node of nodes) console.log(`${node.path}  (${node.title})`);
      if (nodes.length === 0) console.log("No files.");
    }
    return;
  }

  const file = physicalPath(path, args.workspace);
  if (!existsSync(file)) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }

  const content = readFileSync(file, "utf8");
  if (args.json) {
    console.log(
      JSON.stringify(
        { path, title: titleOf(content, path), characters: content.length, content },
        null,
        2,
      ),
    );
  } else {
    console.log(content);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
