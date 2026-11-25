#!/usr/bin/env node
/**
 * Manage the OpenFranz content plan.
 *
 * Usage:
 *   node plan.mjs list --workspace DIR [--json]
 *   node plan.mjs add --workspace DIR --title "..." --platform instagram \
 *     --date 2026-12-01 [--format reel] [--brand ...] [--time 19:00] \
 *     [--status planned] [--rationale "..."] [--script-id ...] [--json]
 *   node plan.mjs update --workspace DIR --id UUID [fields...] [--json]
 *   node plan.mjs delete --workspace DIR --id UUID [--json]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { readJson } from "./lib.mjs";

const PLATFORMS = ["instagram", "youtube", "tiktok", "linkedin", "x", "other"];
const STATUSES = ["planned", "drafted", "published"];

function parseArgs(argv) {
  const args = { json: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--title") args.title = argv[++index];
    else if (arg === "--platform") args.platform = argv[++index];
    else if (arg === "--format") args.format = argv[++index];
    else if (arg === "--brand") args.brand = argv[++index];
    else if (arg === "--date") args.date = argv[++index];
    else if (arg === "--time") args.time = argv[++index];
    else if (arg === "--status") args.status = argv[++index];
    else if (arg === "--rationale") args.rationale = argv[++index];
    else if (arg === "--script-id") args.scriptId = argv[++index];
    else if (arg === "--id") args.id = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node plan.mjs list|add|update|delete --workspace DIR [fields...] [--json]",
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
  return args;
}

function planFile(workspace) {
  return join(resolve(workspace), "plans", "plan.json");
}

function readPlan(workspace) {
  const file = planFile(workspace);
  if (!existsSync(file)) return { items: [] };
  const plan = readJson(file, { items: [] });
  return Array.isArray(plan.items) ? plan : { items: [] };
}

function writePlan(workspace, plan) {
  const file = planFile(workspace);
  mkdirSync(join(resolve(workspace), "plans"), { recursive: true });
  writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function validateItem(item) {
  if (!item.title || item.title.length > 200) {
    throw new Error("title is required and must be at most 200 characters");
  }
  if (!PLATFORMS.includes(item.platform)) {
    throw new Error(`platform must be one of: ${PLATFORMS.join(", ")}`);
  }
  if (!isIsoDate(item.date)) {
    throw new Error("date must be a real calendar date in YYYY-MM-DD form");
  }
  if (!STATUSES.includes(item.status)) {
    throw new Error(`status must be one of: ${STATUSES.join(", ")}`);
  }
}

function itemFromArgs(args, existing = {}) {
  return {
    id: existing.id ?? randomUUID(),
    title: args.title ?? existing.title ?? "",
    platform: args.platform ?? existing.platform ?? "",
    format: args.format ?? existing.format ?? "",
    brand: args.brand ?? existing.brand ?? "",
    date: args.date ?? existing.date ?? "",
    time: args.time ?? existing.time ?? "",
    status: args.status ?? existing.status ?? "planned",
    rationale: args.rationale ?? existing.rationale ?? "",
    scriptId: args.scriptId ?? existing.scriptId ?? null,
  };
}

function printItems(items, json) {
  if (json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  for (const item of items) {
    console.log(
      `${item.date}  ${item.platform.padEnd(10)} ${item.status.padEnd(9)} ${item.title}${item.brand ? ` [${item.brand}]` : ""}`,
    );
  }
  if (items.length === 0) console.log("The plan is empty.");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = readPlan(args.workspace);

  if (args.command === "list") {
    const items = [...plan.items].sort(
      (left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title),
    );
    printItems(items, args.json);
    return;
  }

  if (args.command === "add") {
    const item = itemFromArgs(args);
    validateItem(item);
    plan.items.push(item);
    writePlan(args.workspace, plan);
    console.log(args.json ? JSON.stringify(item, null, 2) : `Added ${item.id} (${item.date})`);
    return;
  }

  if (args.command === "update") {
    if (!args.id) throw new Error("--id is required");
    const index = plan.items.findIndex((item) => item.id === args.id);
    if (index === -1) throw new Error(`Plan item not found: ${args.id}`);
    const item = itemFromArgs(args, plan.items[index]);
    validateItem(item);
    plan.items[index] = item;
    writePlan(args.workspace, plan);
    console.log(args.json ? JSON.stringify(item, null, 2) : `Updated ${item.id}`);
    return;
  }

  if (args.command === "delete") {
    if (!args.id) throw new Error("--id is required");
    const before = plan.items.length;
    plan.items = plan.items.filter((item) => item.id !== args.id);
    if (plan.items.length === before) throw new Error(`Plan item not found: ${args.id}`);
    writePlan(args.workspace, plan);
    console.log(args.json ? JSON.stringify({ deleted: args.id }, null, 2) : `Deleted ${args.id}`);
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
