#!/usr/bin/env node
/**
 * Import an OpenFranz VFS export into a local library.
 *
 * The input is the JSON produced by:
 *   psql "$DATABASE_URL" -At -c \
 *     "select json_agg(json_build_object('path', path, 'type', type, 'content', content, 'meta', meta) order by path) from vfs_nodes;"
 *
 * Usage:
 *   node import_from_postgres.mjs --nodes nodes.json --out library \
 *     [--links links.json] [--json]
 *
 * The output is a directory of Markdown files under arsenal/ and knowledge/.
 * The link index is rebuilt from the Markdown by library_index.mjs; the
 * optional links file is kept as source-links.json for reference.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function parseArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--nodes") args.nodes = argv[++index];
    else if (arg === "--links") args.links = argv[++index];
    else if (arg === "--out") args.out = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node import_from_postgres.mjs --nodes nodes.json --out library [--links links.json] [--json]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.nodes) throw new Error("--nodes is required");
  if (!args.out) throw new Error("--out is required");
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const nodes = JSON.parse(readFileSync(args.nodes, "utf8"));
  if (!Array.isArray(nodes)) throw new Error("The nodes file must be a JSON array");

  const out = resolve(args.out);
  let files = 0;
  let dirs = 0;

  for (const node of nodes) {
    const rel = String(node.path ?? "").replace(/^\//, "");
    if (!rel) continue;

    if (node.type === "dir") {
      mkdirSync(join(out, rel), { recursive: true });
      dirs += 1;
      continue;
    }

    if (node.type === "file") {
      const file = join(out, rel);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, node.content ?? "", "utf8");
      files += 1;
    }
  }

  if (args.links) {
    const links = JSON.parse(readFileSync(args.links, "utf8"));
    writeFileSync(
      join(out, "source-links.json"),
      `${JSON.stringify(links, null, 2)}\n`,
      "utf8",
    );
  }

  const result = { out, files, dirs };
  console.log(
    args.json
      ? JSON.stringify(result, null, 2)
      : `Imported ${files} files and ${dirs} directories into ${out}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
