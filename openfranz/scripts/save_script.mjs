#!/usr/bin/env node
/**
 * Save or version an OpenFranz script.
 *
 * Usage:
 *   node save_script.mjs --workspace DIR --title "..." --brand "..." \
 *     --content-file FILE [--note "..."] [--source agent|user] [--json]
 *   node save_script.mjs --workspace DIR --id-or-slug "existing-slug" \
 *     --title "..." --content-file FILE [--note "..."] [--json]
 *   node save_script.mjs list --workspace DIR [--json]
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { readJson, slugify } from "./lib.mjs";
import { validateScript } from "./validate_script.mjs";

function parseArgs(argv) {
  const args = { json: false, source: "agent" };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--title") args.title = argv[++index];
    else if (arg === "--brand") args.brand = argv[++index];
    else if (arg === "--content-file") args.contentFile = argv[++index];
    else if (arg === "--content") args.content = argv[++index];
    else if (arg === "--id-or-slug") args.idOrSlug = argv[++index];
    else if (arg === "--note") args.note = argv[++index];
    else if (arg === "--source") args.source = argv[++index];
    else if (arg === "--no-validate") args.noValidate = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node save_script.mjs --workspace DIR --title ... --content-file FILE [--id-or-slug ...] [--note ...] [--json]\n       node save_script.mjs list --workspace DIR [--json]",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (!args.workspace) throw new Error("--workspace is required");
  args.command = positional[0] ?? "save";
  return args;
}

function scriptsDir(workspace) {
  return join(resolve(workspace), "scripts");
}

function scriptDir(workspace, slug) {
  return join(scriptsDir(workspace), slug);
}

function listScripts(workspace) {
  const dir = scriptsDir(workspace);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => {
      const meta = join(dir, name, "meta.json");
      return existsSync(meta);
    })
    .sort()
    .map((name) => {
      const meta = readJson(join(dir, name, "meta.json"), null);
      return meta ? { ...meta, slug: meta.slug ?? name } : null;
    })
    .filter(Boolean);
}

function contentFromArgs(args) {
  if (args.contentFile) return readFileSync(args.contentFile, "utf8");
  if (args.content) return args.content;
  throw new Error("--content-file or --content is required");
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "list") {
    const scripts = listScripts(args.workspace);
    if (args.json) {
      console.log(JSON.stringify(scripts, null, 2));
    } else {
      for (const script of scripts) {
        console.log(
          `${script.slug}  ${script.title}  (${script.versions?.length ?? 0} versions, ${script.brand || "no brand"})`,
        );
      }
      if (scripts.length === 0) console.log("No scripts.");
    }
    return;
  }

  if (!args.title) throw new Error("--title is required");
  const content = contentFromArgs(args);
  if (!content.trim()) throw new Error("The script content is empty");

  if (!args.noValidate) {
    const problems = validateScript(content);
    if (problems.length > 0) {
      console.error("The script does not pass validation:");
      for (const problem of problems) console.error(`  - ${problem}`);
      console.error(
        "Fix the script, or pass --no-validate for a legacy script.",
      );
      process.exit(1);
    }
  }

  let slug;
  let meta;

  if (args.idOrSlug) {
    slug = slugify(args.idOrSlug, "script");
    const metaFile = join(scriptDir(args.workspace, slug), "meta.json");
    if (!existsSync(metaFile)) {
      throw new Error(
        `Script not found: ${slug}. Omit --id-or-slug to create a new script.`,
      );
    }
    meta = readJson(metaFile, null);
    if (!meta) throw new Error(`Invalid script metadata: ${metaFile}`);
  } else {
    slug = slugify(args.title, "script");
    const dir = scriptDir(args.workspace, slug);
    if (existsSync(join(dir, "meta.json"))) {
      throw new Error(
        `Script already exists: ${slug}. Pass --id-or-slug to add a version.`,
      );
    }
    meta = {
      id: slug,
      slug,
      title: args.title,
      brand: args.brand ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
    };
  }

  const version = (meta.versions ?? []).reduce(
    (max, item) => Math.max(max, Number(item.version) || 0),
    0,
  ) + 1;

  const dir = scriptDir(args.workspace, slug);
  mkdirSync(dir, { recursive: true });
  const file = `v${version}.md`;
  writeFileSync(
    join(dir, file),
    content.endsWith("\n") ? content : `${content}\n`,
    "utf8",
  );

  meta.title = args.title;
  if (args.brand !== undefined) meta.brand = args.brand;
  meta.updatedAt = new Date().toISOString();
  meta.versions = [
    ...(meta.versions ?? []),
    {
      version,
      file,
      source: args.source,
      note: args.note ?? "",
      createdAt: new Date().toISOString(),
    },
  ];

  writeFileSync(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");

  const result = {
    id: meta.id,
    slug,
    title: meta.title,
    brand: meta.brand,
    version,
    file: join(dir, file),
    versionCount: meta.versions.length,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Saved ${slug} as version ${version} (${meta.versions.length} total) -> ${result.file}`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
