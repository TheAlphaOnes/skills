# The local library

The library is a directory of Markdown files with a link index. It is deliberately plain: any agent can read it, any editor can open it, and git can diff it.

## Layout

```text
library/
├─ arsenal/
│  ├─ hooks-attention/
│  ├─ language-bank/
│  ├─ storytelling/
│  ├─ frameworks-templates/
│  ├─ creative-techniques/
│  └─ swipe-files/
└─ knowledge/
   ├─ psychology-attention/
   ├─ writing-copywriting/
   ├─ storytelling-retention/
   ├─ content-strategy/
   ├─ creative-thinking/
   └─ audience-insights/
```

The document paths used inside the library are `/arsenal/...` and `/knowledge/...`. The physical paths are `library/arsenal/...` and `library/knowledge/...`. The scripts map between them.

Only `/arsenal` and `/knowledge` may exist at the root. The twelve subfolders are a convention, not a hard constraint. Put a document where a future writer would look for it.

## File naming

- Use lowercase ASCII, hyphens between words, and a `.md` extension.
- Make the filename describe the idea, not the source: `result-first-rewind-hook.md`, not `reel-2026-11-25.md`.
- Keep the filename under 80 characters.
- Do not use spaces, emojis, or punctuation other than hyphens.
- If a filename is taken, add `-2`, `-3`, and so on. Do not overwrite a different idea.

## Document shape

Every library document follows the same shape:

```md
# <specific title>

Source: <the exact URL or local file>

## What the source shows

- <concrete evidence>

## <the technique or concept>

<the reusable idea>

## Apply it

- <a concrete application>

## Related

- [Existing document](/arsenal/... or /knowledge/...)
```

The `Source:` line is mandatory. It preserves provenance. If a document synthesizes several sources, list them all on separate `Source:` lines or in a `## Sources` section, but keep at least one exact source.

## Links

Two link syntaxes are supported:

- Wiki links: `[[/arsenal/hooks-attention/result-first-rewind-hook.md]]` or `[[/arsenal/...|a readable alias]]`.
- Markdown links: `[a readable alias](/arsenal/hooks-attention/result-first-rewind-hook.md)`.

Rules:

- Absolute targets start with `/arsenal/` or `/knowledge/`.
- Relative targets resolve against the source file's directory. `../language-bank/opening-lines.md` from `/arsenal/hooks-attention/foo.md` resolves to `/arsenal/language-bank/opening-lines.md`.
- Fragments and query strings are stripped before resolution.
- External URLs, `mailto:`, and fragment-only links are ignored by the index.
- Images are ignored.
- A link must point to a file that already exists. The validator checks this.
- Never write "to be created" or a placeholder link.

## The index

`library_index.mjs` scans every `.md` file under `library/` and writes:

- `index/links.json`: nodes, links, backlinks, and missing targets.
- `index/graph.json`: the same graph in a `{ nodes, edges }` shape for visualization.

`index/links.json` shape:

```json
{
  "generatedAt": "2026-11-25T12:00:00.000Z",
  "nodes": [
    { "path": "/arsenal/hooks-attention/foo.md", "title": "Foo", "updatedAt": "...", "size": 1234 }
  ],
  "links": [
    { "source": "/arsenal/hooks-attention/foo.md", "target": "/knowledge/psychology-attention/bar.md", "kind": "markdown" }
  ],
  "backlinks": {
    "/knowledge/psychology-attention/bar.md": ["/arsenal/hooks-attention/foo.md"]
  },
  "missing": [
    { "source": "/arsenal/hooks-attention/foo.md", "target": "/arsenal/missing.md" }
  ]
}
```

Rebuild the index after every batch of writes:

```bash
"$OPENFRANZ_SKILL/scripts/library_index.mjs" --workspace "$OPENFRANZ_WORKSPACE"
```

## Search

Fuzzy path search:

```bash
"$OPENFRANZ_SKILL/scripts/library_search.mjs" "rewind hook" \
  --workspace "$OPENFRANZ_WORKSPACE" --limit 10
```

Content search:

```bash
"$OPENFRANZ_SKILL/scripts/library_search.mjs" "curiosity gap" \
  --workspace "$OPENFRANZ_WORKSPACE" --content --limit 10
```

Restrict to one root:

```bash
"$OPENFRANZ_SKILL/scripts/library_search.mjs" "opening line" \
  --workspace "$OPENFRANZ_WORKSPACE" --root arsenal
```

The path score prefers exact matches, then basename matches, then substring matches, then subsequence matches. Content search is a case-insensitive substring scan. This is lexical, not semantic. Try the creator's exact phrase, the technique name, and the audience problem as separate searches.

## One-call helpers

The agent can do the common operations in one command instead of chaining search, read, validate, and index:

```bash
# Search and read the strongest files in one call
"$OPENFRANZ_SKILL/scripts/library_context.mjs" "curiosity gap for a launch" \
  --workspace "$OPENFRANZ_WORKSPACE" --limit 3

# Read a file by its library path
"$OPENFRANZ_SKILL/scripts/library_read.mjs" \
  /arsenal/hooks-attention/foo.md --workspace "$OPENFRANZ_WORKSPACE"

# List a folder
"$OPENFRANZ_SKILL/scripts/library_read.mjs" --list /arsenal/hooks-attention \
  --workspace "$OPENFRANZ_WORKSPACE"

# Validate, write, and reindex in one call
"$OPENFRANZ_SKILL/scripts/library_write.mjs" \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --path /arsenal/hooks-attention/foo.md \
  --content-file /tmp/doc.md \
  --source "https://www.instagram.com/reel/ABC123/"
```

`library_write.mjs` rejects a document that fails validation and rebuilds the index on success. Use `validate_document.mjs` and `library_index.mjs` separately when you want to inspect each step.

## Links, backlinks, related, and paths

```bash
# Outgoing links and backlinks for one file
"$OPENFRANZ_SKILL/scripts/library_search.mjs" links \
  /arsenal/hooks-attention/foo.md --workspace "$OPENFRANZ_WORKSPACE"

# Files connected through the graph, up to N hops
"$OPENFRANZ_SKILL/scripts/library_search.mjs" related \
  /arsenal/hooks-attention/foo.md --workspace "$OPENFRANZ_WORKSPACE" --depth 2

# Shortest directed link path
"$OPENFRANZ_SKILL/scripts/library_search.mjs" path \
  /arsenal/hooks-attention/foo.md /knowledge/psychology-attention/bar.md \
  --workspace "$OPENFRANZ_WORKSPACE"
```

Use `related` to follow at least one link hop during research. Use `path` when you need to explain how two ideas connect.

## Dedupe

Before writing:

1. Search the exact phrase, the technique name, and the topic.
2. Read the strongest matches.
3. If an existing document covers the technique, update it in place.
4. If the source adds nothing new, skip it.
5. If two documents cover the same idea, improve the stronger one instead of creating a third.

Near-duplicates with different titles are the most common way a library becomes useless. The index will not save you from them; the search-and-read step will.

## Validation

```bash
"$OPENFRANZ_SKILL/scripts/validate_document.mjs" \
  library/arsenal/hooks-attention/foo.md \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --source "https://www.instagram.com/reel/ABC123/"
```

The validator checks length, the H1, the source URL, at least one H2, placeholder text, and link targets. It prints every problem and exits non-zero if any remain.

## Git-friendly practice

- Commit the library as text. Do not commit `inbox/` media or `index/` unless the user wants the index versioned.
- Keep one idea per file so diffs are readable.
- Use the `Source:` line and the `Related` section to preserve provenance.
- If the user wants a snapshot, tag the commit; do not duplicate the library into a second folder.
