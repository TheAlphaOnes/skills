#!/usr/bin/env node
/**
 * Manage OpenFranz content strategies.
 *
 * Usage:
 *   node strategy.mjs list --workspace DIR [--json]
 *   node strategy.mjs read [slug] --workspace DIR [--json]
 *   node strategy.mjs create --workspace DIR --title "..." --content-file FILE [--active]
 *   node strategy.mjs update <slug> --workspace DIR [--title ...] [--content-file FILE] [--active true|false]
 *   node strategy.mjs activate <slug> --workspace DIR
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { slugify } from "./lib.mjs";

function parseArgs(argv) {
  const args = { json: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--title") args.title = argv[++index];
    else if (arg === "--content-file") args.contentFile = argv[++index];
    else if (arg === "--content") args.content = argv[++index];
    else if (arg === "--active") args.active = argv[++index] !== "false";
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node strategy.mjs list|read|create|update|activate ... --workspace DIR [--json]",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (!args.workspace) throw new Error("--workspace is required");
  args.command = positional[0] ?? "list";
  args.slugArg = positional[1] ?? "";
  return args;
}

function parseStrategy(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { title: "", active: false, updated: "", content: content.trim() };
  }

  const meta = {};
  for (const line of match[1].split("\n")) {
    const entry = line.match(/^(\w+):\s*(.*)$/);
    if (entry) meta[entry[1]] = entry[2].trim();
  }

  return {
    title: meta.title ?? "",
    active: meta.active === "true",
    updated: meta.updated ?? "",
    content: match[2].trim(),
  };
}

function renderStrategy(strategy) {
  return `---\ntitle: ${strategy.title}\nactive: ${strategy.active}\nupdated: ${strategy.updated}\n---\n\n${strategy.content}\n`;
}

function strategyDir(workspace) {
  return join(resolve(workspace), "strategies");
}

function strategyPath(workspace, slug) {
  return join(strategyDir(workspace), `${slug}.md`);
}

function listStrategies(workspace) {
  const dir = strategyDir(workspace);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const slug = name.replace(/\.md$/, "");
      const strategy = parseStrategy(readFileSync(join(dir, name), "utf8"));
      return { slug, ...strategy };
    });
}

function readStrategy(workspace, slug) {
  const file = strategyPath(workspace, slug);
  if (!existsSync(file)) throw new Error(`Strategy not found: ${slug}`);
  return { file, strategy: parseStrategy(readFileSync(file, "utf8")) };
}

function activeStrategy(workspace) {
  return listStrategies(workspace).find((strategy) => strategy.active) ?? null;
}

function contentFromArgs(args) {
  if (args.contentFile) return readFileSync(args.contentFile, "utf8").trim();
  if (args.content) return args.content.trim();
  return null;
}

function writeStrategy(workspace, slug, strategy) {
  mkdirSync(strategyDir(workspace), { recursive: true });
  strategy.updated = new Date().toISOString().slice(0, 10);
  writeFileSync(strategyPath(workspace, slug), renderStrategy(strategy), "utf8");
}

function deactivateAll(workspace, exceptSlug) {
  for (const strategy of listStrategies(workspace)) {
    if (strategy.slug === exceptSlug) continue;
    if (!strategy.active) continue;
    writeStrategy(workspace, strategy.slug, { ...strategy, active: false });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "list") {
    const strategies = listStrategies(args.workspace);
    if (args.json) {
      console.log(JSON.stringify(strategies, null, 2));
    } else {
      for (const strategy of strategies) {
        console.log(
          `${strategy.active ? "*" : " "} ${strategy.slug}  ${strategy.title}  (${strategy.updated})`,
        );
      }
      if (strategies.length === 0) console.log("No strategies.");
    }
    return;
  }

  if (args.command === "read") {
    const strategy = args.slugArg
      ? readStrategy(args.workspace, args.slugArg).strategy
      : activeStrategy(args.workspace);
    if (!strategy) {
      console.log(args.json ? JSON.stringify({ found: false }, null, 2) : "No active strategy.");
      return;
    }
    if (args.json) {
      console.log(JSON.stringify({ found: true, ...strategy }, null, 2));
    } else {
      console.log(renderStrategy(strategy));
    }
    return;
  }

  if (args.command === "create") {
    if (!args.title) throw new Error("--title is required");
    const content = contentFromArgs(args);
    if (!content) throw new Error("--content-file or --content is required");

    const slug = slugify(args.title, "strategy");
    if (existsSync(strategyPath(args.workspace, slug))) {
      throw new Error(`Strategy already exists: ${slug}`);
    }

    const shouldActivate = args.active === true || activeStrategy(args.workspace) === null;
    if (shouldActivate) deactivateAll(args.workspace, slug);

    const strategy = {
      title: args.title,
      active: shouldActivate,
      updated: "",
      content,
    };
    writeStrategy(args.workspace, slug, strategy);
    console.log(
      args.json
        ? JSON.stringify({ slug, ...strategy }, null, 2)
        : `Created strategies/${slug}.md${shouldActivate ? " (active)" : ""}`,
    );
    return;
  }

  if (args.command === "update") {
    if (!args.slugArg) throw new Error("A strategy slug is required");
    const { strategy } = readStrategy(args.workspace, args.slugArg);
    if (args.title !== undefined) strategy.title = args.title;
    const content = contentFromArgs(args);
    if (content !== null) strategy.content = content;
    if (args.active !== undefined) {
      strategy.active = args.active;
      if (args.active) deactivateAll(args.workspace, args.slugArg);
    }
    writeStrategy(args.workspace, args.slugArg, strategy);
    console.log(
      args.json
        ? JSON.stringify({ slug: args.slugArg, ...strategy }, null, 2)
        : `Updated strategies/${args.slugArg}.md`,
    );
    return;
  }

  if (args.command === "activate") {
    if (!args.slugArg) throw new Error("A strategy slug is required");
    const { strategy } = readStrategy(args.workspace, args.slugArg);
    deactivateAll(args.workspace, args.slugArg);
    strategy.active = true;
    writeStrategy(args.workspace, args.slugArg, strategy);
    console.log(`Activated strategies/${args.slugArg}.md`);
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
