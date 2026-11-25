# Domains: brands, scripts, strategies, and plans

The library is the research surface. These four domains are the working surface around it. They are plain files so the agent can read and edit them without a database.

## Brands

A brand file lives at `brands/<slug>.md`. The slug is lowercase ASCII with hyphens, for example `acme-coffee.md`.

Use this shape:

```md
# Acme Coffee

- slug: acme-coffee
- website: https://acme.example
- audience: Home coffee drinkers who want cafe-quality cold brew without a cafe price.
- tone: Dry, practical, specific. No hype.

## Summary

Acme Coffee makes small-batch cold brew concentrate. The flagship product steeps for 18 hours.

## Products

### Cold Brew Concentrate

- description: A 1:3 concentrate for home dilution.
- features:
  - 18-hour steep
  - single origin
  - no added sugar
- pricing: $18 for a 750 ml bottle.

### Decaf Cold Brew

- description: The same process with Swiss-water decaf beans.
- features:
  - 18-hour steep
  - decaffeinated
- pricing: $20 for a 750 ml bottle.

## Notes

- The founder's proof point: "We tested 40 steep times. Eighteen hours won."
- Avoid claiming health benefits.
```

Rules:

- The `slug` must match the filename.
- The audience and tone are mandatory for useful copy.
- Products are embedded sections, not a separate file.
- Never invent a product, price, feature, or audience detail. If a field is missing, say so.
- Only update a brand file when the user explicitly asks.

A chat message may carry a hidden marker:

```text
[[brand:acme-coffee|Acme Coffee|Cold Brew Concentrate]] Write three hooks...
```

The third segment is the product. Read the brand file and use that product's facts. If the product is absent, use the brand-level facts and ask which product if the answer depends on it.

Commands:

```bash
# List brands
"$OPENFRANZ_SKILL/scripts/brand.mjs" list --workspace "$OPENFRANZ_WORKSPACE"

# Read one brand as Markdown or JSON
"$OPENFRANZ_SKILL/scripts/brand.mjs" read acme-coffee --workspace "$OPENFRANZ_WORKSPACE"
"$OPENFRANZ_SKILL/scripts/brand.mjs" read acme-coffee --workspace "$OPENFRANZ_WORKSPACE" --json

# Create a brand
"$OPENFRANZ_SKILL/scripts/brand.mjs" create --workspace "$OPENFRANZ_WORKSPACE" \
  --name "Acme Coffee" --slug acme-coffee \
  --summary "Small-batch cold brew." \
  --audience "Home coffee drinkers." \
  --tone "Dry and practical." \
  --products-json '[{"name":"Cold Brew Concentrate","description":"A 1:3 concentrate.","features":["18-hour steep"],"pricing":"$18 / 750 ml"}]'

# Update fields
"$OPENFRANZ_SKILL/scripts/brand.mjs" update acme-coffee --workspace "$OPENFRANZ_WORKSPACE" \
  --tone "Dry, practical, and a little contrarian."
```

## Scripts

A script lives in `scripts/<slug>/`:

```text
scripts/
└─ cold-brew-launch/
   ├─ meta.json
   ├─ v1.md
   └─ v2.md
```

`meta.json`:

```json
{
  "id": "cold-brew-launch",
  "slug": "cold-brew-launch",
  "title": "Cold Brew Launch",
  "brand": "acme-coffee",
  "createdAt": "2026-11-25T12:00:00.000Z",
  "updatedAt": "2026-11-25T12:10:00.000Z",
  "versions": [
    {
      "version": 1,
      "file": "v1.md",
      "source": "agent",
      "note": "First version",
      "createdAt": "2026-11-25T12:00:00.000Z"
    },
    {
      "version": 2,
      "file": "v2.md",
      "source": "agent",
      "note": "Tighter first three seconds",
      "createdAt": "2026-11-25T12:10:00.000Z"
    }
  ]
}
```

Rules:

- Versions are immutable. A revision creates a new `vN.md`; it does not overwrite an old version.
- The latest version is the highest `version` number.
- `source` is `"agent"` or `"user"`.
- `note` is a one-line description of what changed.
- The script content is the same Markdown that appeared inside the `script` fence, including the fence.
- To restore an old version, read it and save it as a new version with the note `Restored from vN.`.

`save_script.mjs` validates the script contract before writing. Use `validate_script.mjs` to check a script without saving it. Use `--no-validate` only for legacy scripts.

Commands:

```bash
# Save a new script
"$OPENFRANZ_SKILL/scripts/save_script.mjs" \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --title "Cold Brew Launch" \
  --brand "acme-coffee" \
  --content-file /tmp/script.md \
  --note "First version"

# Add a version to an existing script
"$OPENFRANZ_SKILL/scripts/save_script.mjs" \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --id-or-slug "cold-brew-launch" \
  --title "Cold Brew Launch" \
  --brand "acme-coffee" \
  --content-file /tmp/script-v2.md \
  --note "Tighter first three seconds"

# List scripts
"$OPENFRANZ_SKILL/scripts/save_script.mjs" list --workspace "$OPENFRANZ_WORKSPACE"
```

Never claim a script was saved unless the command returned a version.

## Strategies

A strategy lives at `strategies/<slug>.md`:

```md
---
title: Launch Quarter
active: true
updated: 2026-11-25
---

## Cadence

Three Reels per week: Monday, Wednesday, Friday, evening.

## Platforms

Instagram Reels and TikTok. No LinkedIn for this quarter.

## Priorities

1. Launch the cold brew concentrate.
2. Build the founder's proof-point series.
3. Test the "failed attempt" hook across three products.

## Formats

- 20-30 second Reels.
- One carousel per week.
- No long-form video this quarter.

## Constraints

- Do not claim health benefits.
- Do not discount in the first month.
- Every product claim needs a proof point from the brand file.
```

Rules:

- Exactly one strategy should have `active: true`.
- If no strategy is active, ask the user how they want to plan, then save one.
- When the user defines or changes a strategy, update the file and keep the same slug.
- A plan item should be traceable to the active strategy's cadence, platforms, and constraints.
- If a request fights the strategy, say so and explain the tradeoff.

Commands:

```bash
# List strategies; the active one is marked with *
"$OPENFRANZ_SKILL/scripts/strategy.mjs" list --workspace "$OPENFRANZ_WORKSPACE"

# Read the active strategy, or a specific one
"$OPENFRANZ_SKILL/scripts/strategy.mjs" read --workspace "$OPENFRANZ_WORKSPACE"
"$OPENFRANZ_SKILL/scripts/strategy.mjs" read launch-quarter --workspace "$OPENFRANZ_WORKSPACE"

# Create and activate a strategy
"$OPENFRANZ_SKILL/scripts/strategy.mjs" create --workspace "$OPENFRANZ_WORKSPACE" \
  --title "Launch Quarter" --content-file /tmp/strategy.md --active

# Switch the active strategy
"$OPENFRANZ_SKILL/scripts/strategy.mjs" activate launch-quarter --workspace "$OPENFRANZ_WORKSPACE"
```

## Plans

The plan lives at `plans/plan.json`:

```json
{
  "items": [
    {
      "id": "0f5c2f0e-6d1a-4a5e-9c3b-2f6a1d4e8b7c",
      "title": "Cold brew launch reel",
      "platform": "instagram",
      "format": "reel",
      "brand": "acme-coffee",
      "date": "2026-12-01",
      "time": "19:00",
      "status": "planned",
      "rationale": "Launch week, evening attention peak, proof-point hook.",
      "scriptId": "cold-brew-launch"
    }
  ]
}
```

Fields:

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | UUID, generated by the script |
| `title` | string | 1-200 characters |
| `platform` | enum | `instagram`, `youtube`, `tiktok`, `linkedin`, `x`, `other` |
| `format` | string | Free text, for example `reel`, `carousel`, `story`, `long-form` |
| `brand` | string | Brand slug, optional |
| `date` | string | Real calendar date in `YYYY-MM-DD` |
| `time` | string | Optional hint, for example `19:00` or `weekday evening` |
| `status` | enum | `planned`, `drafted`, `published` |
| `rationale` | string | One line naming why the day and slot work |
| `scriptId` | string | Optional saved script id |

Commands:

```bash
# List the plan, soonest first
"$OPENFRANZ_SKILL/scripts/plan.mjs" list --workspace "$OPENFRANZ_WORKSPACE"

# Add an item
"$OPENFRANZ_SKILL/scripts/plan.mjs" add \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --title "Cold brew launch reel" \
  --platform instagram \
  --format reel \
  --brand acme-coffee \
  --date 2026-12-01 \
  --time 19:00 \
  --rationale "Launch week, evening attention peak" \
  --script-id cold-brew-launch

# Update an item
"$OPENFRANZ_SKILL/scripts/plan.mjs" update \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --id "<uuid>" \
  --date 2026-12-02 \
  --status drafted

# Delete an item
"$OPENFRANZ_SKILL/scripts/plan.mjs" delete \
  --workspace "$OPENFRANZ_WORKSPACE" --id "<uuid>"
```

Rules:

- Read the active strategy before planning.
- List the plan before adding, so you do not double-book a day.
- Use real dates. `2026-02-30` is rejected.
- Every item needs a one-line rationale naming the mechanism or source.
- When an item delivers a saved script, pass its id with `--script-id`.
- Do not invent engagement statistics. If you cite a best time, cite a source or label it as a hypothesis.

## Cross-domain workflows

### Brand-aware writing

1. Read `brands/<slug>.md`.
2. Search the library for the audience problem and the technique.
3. Write three variants using the brand's actual products, audience, and tone.
4. Never invent a product fact.

### Strategy-driven planning

1. Read the active strategy.
2. List the existing plan.
3. Propose items that fit the cadence, platforms, and constraints.
4. Save each item with a rationale.
5. Flag gaps where the plan does not meet the strategy.

### Script save and revise

1. Write the script inside one `script` fence.
2. Save it with `save_script.mjs`.
3. To revise, read the latest version, write the new version, and save with `--id-or-slug`.
4. To restore, read the old version and save it as a new version with a `Restored from vN.` note.

### Deep mode

A `[[deep]]` message means the user wants the deeper workflow. Ask 3 to 5 focused questions before writing. See `references/writing.md`.

## Templates

The `assets/` directory contains starting points:

- `assets/brand-template.md`
- `assets/script-template.md`
- `assets/strategy-template.md`
- `assets/plan-template.json`
- `assets/document-template.md`

Copy a template into the workspace, fill it in, and keep the same shape. Do not invent new fields without a reason; the scripts and the writing workflow expect these names.
