#!/usr/bin/env node
/**
 * Validate an OpenFranz library document.
 *
 * Checks the same shape as the app's ingestion validator, plus link targets:
 * 300-6000 characters, an H1, the exact source URL, at least one H2, no
 * placeholder text, and every internal link resolving to an existing file.
 *
 * Usage:
 *   node validate_document.mjs <file> --workspace DIR --source URL
 */

import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_PATH_LENGTH = 1024;
const MIN_DOCUMENT_CHARS = 300;
const MAX_DOCUMENT_CHARS = 6000;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--source") args.source = argv[++index];
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node validate_document.mjs <file> --workspace DIR --source URL",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      args.file = arg;
    }
  }
  if (!args.file) throw new Error("A document path is required");
  if (!args.workspace) throw new Error("--workspace is required");
  return args;
}

function normalizeVfsPath(input) {
  if (typeof input !== "string") throw new Error("A path must be a string.");
  if (input.includes("\0")) throw new Error("Paths cannot contain null bytes.");
  const segments = input.replace(/\\/g, "/").split("/");
  const stack = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  const path = `/${stack.join("/")}`;
  if (path.length > MAX_PATH_LENGTH) {
    throw new Error(`Paths cannot exceed ${MAX_PATH_LENGTH} characters.`);
  }
  return path;
}

function parentVfsPath(input) {
  const path = normalizeVfsPath(input);
  if (path === "/") return "/";
  const separator = path.lastIndexOf("/");
  return separator <= 0 ? "/" : path.slice(0, separator);
}

function joinVfsPath(parent, child) {
  return normalizeVfsPath(`${normalizeVfsPath(parent)}/${child}`);
}

function isExternalTarget(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

function extractLinks(content) {
  const links = new Map();
  const wiki = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  const markdown = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const match of content.matchAll(wiki)) {
    const target = match[1]?.trim();
    if (!target || isExternalTarget(target)) continue;
    links.set(`wiki:${target}`, { target, kind: "wiki" });
  }
  for (const match of content.matchAll(markdown)) {
    if (match.index !== undefined && content[match.index - 1] === "!") continue;
    const target = match[1]?.trim();
    if (!target || isExternalTarget(target)) continue;
    links.set(`markdown:${target}`, { target, kind: "markdown" });
  }
  return [...links.values()];
}

function resolveLink(sourcePath, target) {
  const raw = target.trim();
  if (!raw || isExternalTarget(raw)) return null;
  const withoutFragment = raw.split("#")[0]?.split("?")[0]?.trim();
  if (!withoutFragment) return null;
  let decoded = withoutFragment;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    decoded = withoutFragment;
  }
  return decoded.startsWith("/")
    ? normalizeVfsPath(decoded)
    : joinVfsPath(parentVfsPath(sourcePath), decoded);
}

function toVfsPath(file, workspace) {
  const libraryRoot = resolve(workspace, "library");
  const absolute = resolve(file);
  const rel = relative(libraryRoot, absolute).replace(/\\/g, "/");
  if (rel.startsWith("..")) return null;
  return normalizeVfsPath(`/${rel}`);
}

function physicalPath(vfsPath, workspace) {
  return join(resolve(workspace, "library"), vfsPath.replace(/^\//, ""));
}

export function validateDocument(content, sourceUrl, vfsPath, workspace) {
  const problems = [];
  const trimmed = content.trim();

  if (trimmed.length < MIN_DOCUMENT_CHARS) {
    problems.push(
      `The document is too thin (${trimmed.length} chars). Include concrete evidence and a specific application.`,
    );
  }
  if (trimmed.length > MAX_DOCUMENT_CHARS) {
    problems.push(
      `The document is too long (${trimmed.length} chars). Keep it under ${MAX_DOCUMENT_CHARS} and one idea per document.`,
    );
  }
  if (!trimmed.startsWith("# ")) {
    problems.push("The document must start with a level-1 Markdown heading.");
  }
  if (sourceUrl && !trimmed.includes(sourceUrl)) {
    problems.push(`The document must include the source URL: ${sourceUrl}`);
  }
  if (!sourceUrl && !/^Source:\s*\S+/m.test(trimmed)) {
    problems.push("The document must include a Source: line.");
  }
  if (!/^##\s+/m.test(trimmed)) {
    problems.push("The document must include at least one level-2 section.");
  }
  if (/\b(to be created|TBD|TODO|lorem ipsum)\b/i.test(trimmed)) {
    problems.push("Remove placeholder text before writing.");
  }
  if (!vfsPath) {
    problems.push(
      "The document must live under library/arsenal/ or library/knowledge/.",
    );
  } else if (!vfsPath.endsWith(".md")) {
    problems.push("The document must be a .md file.");
  } else if (
    !vfsPath.startsWith("/arsenal/") &&
    !vfsPath.startsWith("/knowledge/")
  ) {
    problems.push("The document must be under /arsenal/ or /knowledge/.");
  }

  if (vfsPath) {
    const missing = [];
    for (const link of extractLinks(trimmed)) {
      const target = resolveLink(vfsPath, link.target);
      if (!target) continue;
      if (!existsSync(physicalPath(target, workspace))) {
        missing.push(target);
      }
    }
    if (missing.length > 0) {
      problems.push(`Links target missing files: ${missing.join(", ")}`);
    }
  }

  return problems;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const content = readFileSync(args.file, "utf8");
  const vfsPath = toVfsPath(args.file, args.workspace);
  const problems = validateDocument(content, args.source, vfsPath, args.workspace);

  if (problems.length === 0) {
    console.log(`OK ${args.file}${vfsPath ? ` (${vfsPath})` : ""}`);
    return;
  }

  console.error(`INVALID ${args.file}`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
