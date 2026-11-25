#!/usr/bin/env node
/**
 * Manage OpenFranz brand files.
 *
 * Usage:
 *   node brand.mjs list --workspace DIR [--json]
 *   node brand.mjs read <slug> --workspace DIR [--json]
 *   node brand.mjs create --workspace DIR --name "Acme Coffee" [--slug acme-coffee] \
 *     [--summary ...] [--website ...] [--audience ...] [--tone ...] [--notes ...] \
 *     [--products-json '[...]' | --products-file products.json]
 *   node brand.mjs update <slug> --workspace DIR [fields...]
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

function parseArgs(argv) {
  const args = { json: false };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") args.workspace = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--name") args.name = argv[++index];
    else if (arg === "--slug") args.slug = argv[++index];
    else if (arg === "--summary") args.summary = argv[++index];
    else if (arg === "--website") args.website = argv[++index];
    else if (arg === "--audience") args.audience = argv[++index];
    else if (arg === "--tone") args.tone = argv[++index];
    else if (arg === "--notes") args.notes = argv[++index];
    else if (arg === "--products-json") args.productsJson = argv[++index];
    else if (arg === "--products-file") args.productsFile = argv[++index];
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node brand.mjs list|read|create|update ... --workspace DIR [--json]",
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

function parseBrand(content) {
  const brand = {
    name: "",
    slug: "",
    website: "",
    audience: "",
    tone: "",
    summary: "",
    notes: "",
    products: [],
  };

  const lines = content.split("\n");
  const title = lines.find((line) => line.startsWith("# "));
  if (title) brand.name = title.slice(2).trim();

  let section = null;
  let product = null;
  let inFeatures = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line.slice(3).trim().toLowerCase();
      product = null;
      inFeatures = false;
      continue;
    }

    if (line.startsWith("### ") && section === "products") {
      product = {
        name: line.slice(4).trim(),
        description: "",
        features: [],
        pricing: "",
      };
      brand.products.push(product);
      inFeatures = false;
      continue;
    }

    if (section === "products" && product) {
      const description = line.match(/^- description:\s*(.*)$/);
      const pricing = line.match(/^- pricing:\s*(.*)$/);
      const features = line.match(/^- features:\s*(.*)$/);

      if (description) {
        product.description = description[1].trim();
        inFeatures = false;
        continue;
      }
      if (pricing) {
        product.pricing = pricing[1].trim();
        inFeatures = false;
        continue;
      }
      if (features) {
        if (features[1].trim()) product.features.push(features[1].trim());
        inFeatures = true;
        continue;
      }
      if (inFeatures) {
        const item = line.match(/^\s+-\s+(.*)$/);
        if (item) product.features.push(item[1].trim());
      }
      continue;
    }

    if (section === "summary") {
      brand.summary += `${brand.summary ? "\n" : ""}${line}`;
      continue;
    }
    if (section === "notes") {
      brand.notes += `${brand.notes ? "\n" : ""}${line}`;
      continue;
    }

    if (!section) {
      const meta = line.match(/^- (slug|website|audience|tone):\s*(.*)$/);
      if (meta) brand[meta[1]] = meta[2].trim();
    }
  }

  brand.summary = brand.summary.trim();
  brand.notes = brand.notes.trim();
  return brand;
}

function renderBrand(brand) {
  const lines = [`# ${brand.name}`, ""];
  lines.push(`- slug: ${brand.slug}`);
  if (brand.website) lines.push(`- website: ${brand.website}`);
  if (brand.audience) lines.push(`- audience: ${brand.audience}`);
  if (brand.tone) lines.push(`- tone: ${brand.tone}`);
  lines.push("", "## Summary", "", brand.summary || "");
  lines.push("", "## Products", "");

  for (const product of brand.products) {
    lines.push(`### ${product.name}`, "");
    if (product.description) lines.push(`- description: ${product.description}`);
    if (product.features.length > 0) {
      lines.push("- features:");
      for (const feature of product.features) lines.push(`  - ${feature}`);
    }
    if (product.pricing) lines.push(`- pricing: ${product.pricing}`);
    lines.push("");
  }

  lines.push("## Notes", "", brand.notes || "");
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function brandPath(workspace, slug) {
  return join(resolve(workspace), "brands", `${slug}.md`);
}

function readBrand(workspace, slug) {
  const file = brandPath(workspace, slug);
  if (!existsSync(file)) throw new Error(`Brand not found: ${slug}`);
  return { file, brand: parseBrand(readFileSync(file, "utf8")) };
}

function listBrands(workspace) {
  const dir = join(resolve(workspace), "brands");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const file = join(dir, name);
      const brand = parseBrand(readFileSync(file, "utf8"));
      return {
        slug: brand.slug || name.replace(/\.md$/, ""),
        name: brand.name,
        summary: brand.summary,
        products: brand.products.map((product) => product.name),
      };
    });
}

function productsFromArgs(args) {
  if (args.productsJson) return JSON.parse(args.productsJson);
  if (args.productsFile) return readJson(args.productsFile, []);
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "list") {
    const brands = listBrands(args.workspace);
    if (args.json) {
      console.log(JSON.stringify(brands, null, 2));
    } else {
      for (const brand of brands) {
        console.log(`${brand.slug}  ${brand.name}  (${brand.products.join(", ") || "no products"})`);
      }
      if (brands.length === 0) console.log("No brands.");
    }
    return;
  }

  if (args.command === "read") {
    if (!args.slugArg) throw new Error("A brand slug is required");
    const { brand } = readBrand(args.workspace, args.slugArg);
    if (args.json) {
      console.log(JSON.stringify(brand, null, 2));
    } else {
      console.log(renderBrand(brand));
    }
    return;
  }

  if (args.command === "create") {
    if (!args.name) throw new Error("--name is required");
    const slug = slugify(args.slug || args.name, "brand");
    const file = brandPath(args.workspace, slug);
    if (existsSync(file)) throw new Error(`Brand already exists: ${slug}`);

    const products = productsFromArgs(args) ?? [];
    const brand = {
      name: args.name,
      slug,
      website: args.website ?? "",
      audience: args.audience ?? "",
      tone: args.tone ?? "",
      summary: args.summary ?? "",
      notes: args.notes ?? "",
      products,
    };

    mkdirSync(join(resolve(args.workspace), "brands"), { recursive: true });
    writeFileSync(file, renderBrand(brand), "utf8");
    console.log(args.json ? JSON.stringify(brand, null, 2) : `Created brands/${slug}.md`);
    return;
  }

  if (args.command === "update") {
    if (!args.slugArg) throw new Error("A brand slug is required");
    const { file, brand } = readBrand(args.workspace, args.slugArg);

    if (args.name !== undefined) brand.name = args.name;
    if (args.website !== undefined) brand.website = args.website;
    if (args.audience !== undefined) brand.audience = args.audience;
    if (args.tone !== undefined) brand.tone = args.tone;
    if (args.summary !== undefined) brand.summary = args.summary;
    if (args.notes !== undefined) brand.notes = args.notes;
    const products = productsFromArgs(args);
    if (products !== null) brand.products = products;

    writeFileSync(file, renderBrand(brand), "utf8");
    console.log(args.json ? JSON.stringify(brand, null, 2) : `Updated brands/${brand.slug}.md`);
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
