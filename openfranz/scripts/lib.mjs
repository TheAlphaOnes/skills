/**
 * Shared helpers for the OpenFranz library scripts.
 *
 * The path and link rules are ports of the app's shared/utils/vfs-path.ts and
 * shared/utils/vfs-links.ts. Keeping them in one place means the index, the
 * search, and the validator agree on what a path and a link mean.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

export const MAX_PATH_LENGTH = 1024;

export function normalizeVfsPath(input) {
  if (typeof input !== "string") {
    throw new Error("A filesystem path must be a string.");
  }
  if (input.includes("\0")) {
    throw new Error("Filesystem paths cannot contain null bytes.");
  }

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
    throw new Error(`Filesystem paths cannot exceed ${MAX_PATH_LENGTH} characters.`);
  }
  return path;
}

export function parentVfsPath(input) {
  const path = normalizeVfsPath(input);
  if (path === "/") return "/";
  const separator = path.lastIndexOf("/");
  return separator <= 0 ? "/" : path.slice(0, separator);
}

export function joinVfsPath(parent, child) {
  return normalizeVfsPath(`${normalizeVfsPath(parent)}/${child}`);
}

export function isExternalTarget(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

export function extractLinks(content) {
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

export function resolveLink(sourcePath, target) {
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

export function toVfsPath(file, workspace) {
  const libraryRoot = resolve(workspace, "library");
  const absolute = resolve(file);
  const rel = relative(libraryRoot, absolute).replace(/\\/g, "/");
  if (rel.startsWith("..")) return null;
  return normalizeVfsPath(`/${rel}`);
}

export function physicalPath(vfsPath, workspace) {
  return join(resolve(workspace, "library"), vfsPath.replace(/^\//, ""));
}

export function walkMarkdown(root) {
  const results = [];
  if (!existsSync(root)) return results;

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) results.push(full);
    }
  }

  walk(root);
  return results.sort();
}

export function titleOf(content, path) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return basename(path).replace(/\.md$/, "");
}

export function slugify(value, fallback = "item") {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || fallback;
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  mkdirSync(resolve(file, ".."), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function fileStat(file) {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}
