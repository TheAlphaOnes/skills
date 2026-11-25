#!/usr/bin/env node
/**
 * Validate, write, and reindex a library document in one call.
 *
 * Usage:
 *   node library_write.mjs --workspace DIR --path /arsenal/hooks-attention/foo.md \
 *     --content-file /tmp/doc.md --source "https://..." [--no-index] [--json]
 *
 * The document is rejected if it fails the same checks as validate_document.mjs.
 * On success the file is written and index/links.json is rebuilt.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { buildIndex } from "./library_index.mjs";
import { validateDocument } from "./validate_document.mjs";
import { normalizeVfsPath, physicalPath } from "./lib.mjs";

function parseArgs(argv) {
  const args = { json: false, index: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--path") args.path = argv[++index];
    else if (arg === "--content-file") args.contentFile = argv[++index];
    else if (arg === "--content") args.content = argv[++index];
    else if (arg === "--source") args.source = argv[++index];
    else if (arg === "--no-index") args.index = false;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node library_write.mjs --workspace DIR --path /arsenal/... --content-file FILE --source URL [--no-index] [--json]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.workspace) throw new Error("--workspace is required");
  if (!args.path) throw new Error("--path is required");
  if (!args.contentFile && !args.content) {
    throw new Error("--content-file or --content is required");
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const path = normalizeVfsPath(args.path);

  if (!path.endsWith(".md")) {
    throw new Error("The path must end with .md");
  }
  if (!path.startsWith("/arsenal/") && !path.startsWith("/knowledge/")) {
    throw new Error("The path must be under /arsenal/ or /knowledge/");
  }

  const content = args.contentFile
    ? readFileSync(args.contentFile, "utf8")
    : String(args.content);

  const problems = validateDocument(content, args.source, path, args.workspace);
  if (problems.length > 0) {
    if (args.json) {
      console.log(JSON.stringify({ ok: false, path, problems }, null, 2));
    } else {
      console.error(`INVALID ${path}`);
      for (const problem of problems) console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  const file = physicalPath(path, args.workspace);
  const existed = existsSync(file);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");

  let index = null;
  if (args.index) {
    const built = buildIndex(args.workspace);
    index = {
      files: built.nodes.length,
      links: built.links.length,
      missing: built.missing.length,
    };
  }

  const result = {
    ok: true,
    path,
    action: existed ? "updated" : "created",
    characters: content.trim().length,
    index,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `${result.action} ${path} (${result.characters} chars)${index ? `, indexed ${index.files} files / ${index.links} links` : ""}`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
