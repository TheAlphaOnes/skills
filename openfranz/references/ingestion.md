# Ingestion: turning a source into library documents

Read this before writing anything into `library/`. The goal is not to summarize the source. The goal is to extract the reusable craft and file it so a future writing session can find and apply it.

## The evidence rule

The transcript, the frames, and the source metadata are the only evidence you have.

- Every claim in a document must be traceable to them.
- If the source does not show or say something, do not write it.
- Do not add generic production advice, invented CTAs, invented timings, or invented psychology.
- Quote the creator's exact wording when the wording is the asset.
- When you draw an inference, label it `Inference:`.

A document that sounds useful but cannot be traced back to the source is worse than no document. It pollutes the library and makes future writing less grounded.

## The two roots

`/arsenal` holds material a writer can lift directly. If a writer can copy it into a script, it belongs here.

`/knowledge` holds ideas that improve judgment. If the value is understanding why something works, it belongs here.

### Arsenal folders

| Folder | What belongs there |
|--------|--------------------|
| `/arsenal/hooks-attention` | Opening lines, first-frame ideas, pattern interrupts, curiosity triggers, visual hooks |
| `/arsenal/language-bank` | Phrases, CTAs, opening and closing lines, transitions, power words, reusable sentence patterns |
| `/arsenal/storytelling` | Story structures, narrative patterns, setups, tension, payoff, transformation examples |
| `/arsenal/frameworks-templates` | Script frameworks, copywriting formulas, reusable outlines, fill-in structures |
| `/arsenal/creative-techniques` | Visual devices, editing ideas, transitions, demonstrations, production techniques |
| `/arsenal/swipe-files` | Strong scripts, creator examples, references, breakdowns of why a specific post worked |

### Knowledge folders

| Folder | What belongs there |
|--------|--------------------|
| `/knowledge/psychology-attention` | Human behaviour, curiosity, emotion, attention, persuasion, why people keep watching or stop |
| `/knowledge/writing-copywriting` | Copywriting principles, voice, tonality, clarity, rhythm, communication techniques |
| `/knowledge/storytelling-retention` | Narrative theory, pacing, retention, story arcs, curiosity loops, payoff design |
| `/knowledge/content-strategy` | Content pillars, audience research, positioning, platform behaviour, repeatable content systems |
| `/knowledge/creative-thinking` | Ideation, creative principles, pattern recognition, originality, non-obvious angles |
| `/knowledge/audience-insights` | Audience interests, pain points, feedback, trends, expectations, the language people use |

Only the two-root rule is structural. The twelve subfolders are a convention. Put a document in the folder that best matches its use, not the folder that matches the topic word.

## What to extract

- A hook, line, or phrase the creator actually used, with the exact wording when possible.
- A repeatable structure the creator followed, described step by step.
- A visual or editing move that is visible in the frames.
- A concept the creator explained, with the mechanism they gave.
- A concrete example that transfers to another topic.
- A number, timing, or demonstration that makes the technique specific.

## What to skip

- A generic opinion, motivation, or summary with no method.
- A well-known concept illustrated only by a generic example, unless the source adds a specific mechanism, number, or demonstration.
- A source whose only value is the visual itself and has no transferable technique.
- A duplicate of an existing document with nothing new.
- A claim you cannot support from the transcript or frames.
- A raw transcript or a raw visual analysis. Those belong in `inbox/`, not the library.

A good result can be one excellent document. A good result can also be no documents at all. Do not fill every folder. Do not create a document just to have an output.

## Before writing: search and read

Search the library before every write. The goal is to update the strongest existing document, not to create a near-duplicate.

```bash
"$OPENFRANZ_SKILL/scripts/library_search.mjs" "the technique or phrase" \
  --workspace "$OPENFRANZ_WORKSPACE" --limit 10
```

Read the strongest matches in full. Use `library_search.mjs links <path>` to see what they link to, and `library_search.mjs related <path> --depth 2` to follow the graph.

If an existing document covers the technique:

- If the source adds nothing new, skip it.
- If the source adds a better example, clearer phrasing, or a new application, update the existing document in place.
- Treat the whole file as yours: remove unsupported claims, duplicate sections, and filler. Do not just append a new section.
- If two existing documents cover the same idea, improve the stronger one instead of creating a third.

Never create near-duplicates with slightly different titles.

For a one-call research pass, use `library_context.mjs`:

```bash
"$OPENFRANZ_SKILL/scripts/library_context.mjs" "the technique or phrase" \
  --workspace "$OPENFRANZ_WORKSPACE" --limit 3
```

When you are ready to save, use `library_write.mjs` to validate, write, and reindex in one call:

```bash
"$OPENFRANZ_SKILL/scripts/library_write.mjs" \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --path /arsenal/hooks-attention/foo.md \
  --content-file /tmp/doc.md \
  --source "<exact source URL>"
```

## Document template

Use this exact shape:

```md
# <specific title>

Source: <the exact URL or local file>

## What the source shows

- <the exact line, visible frame, number, or step>
- <another concrete piece of evidence>

## <the technique or concept>

<the reusable idea, explained precisely. Quote the creator's wording when it matters.>

## Apply it

- <a concrete way to use this in a future script, with the mechanism named>
- <another concrete application>

## Related

- [Existing document](/arsenal/... or /knowledge/...)
```

Rules for the document:

- 250 to 700 words. One idea per document.
- A plain, specific title. No clickbait. No numbers unless the source actually contains that many items.
- Use plain ASCII hyphens and quotes in titles and paths.
- Do not save the raw transcript or the raw visual analysis.
- Do not use emojis.
- Link to at least one existing related document when one exists.
- Never link to a file that does not exist. Verify with `library_search.mjs` or by reading the file.
- Never write "to be created" or a placeholder link.
- Re-read the document before finishing and remove any sentence that is not supported by the source or by a labelled inference.

## Validation

Run the validator before saving:

```bash
"$OPENFRANZ_SKILL/scripts/validate_document.mjs" "<path-to-doc>" \
  --workspace "$OPENFRANZ_WORKSPACE" --source "<exact source URL>"
```

It checks:

- 300 to 6,000 characters;
- starts with a level-1 heading;
- contains the exact source URL;
- contains at least one level-2 section;
- does not contain `to be created`, `TBD`, `TODO`, or `lorem ipsum`;
- every internal link resolves to an existing file.

Fix the problems it prints. Do not save a document that fails validation.

After saving, rebuild the index:

```bash
"$OPENFRANZ_SKILL/scripts/library_index.mjs" --workspace "$OPENFRANZ_WORKSPACE"
```

## Finish

When the ingest is done, report:

- the evidence you used (the transcript, the frames, the metadata);
- each document created or updated, with its path;
- why anything was skipped;
- any limitation, such as no audio, no vision, or a frame that was too dark to read.

Do not claim a document was saved unless the file exists and the validator passed.

## Worked example

Source: a 12-second Reel that opens on a finished pour, rewinds to a failed attempt, and says "Here is what nobody tells you about the first attempt."

Possible documents:

1. `/arsenal/hooks-attention/result-first-rewind-hook.md`:
   - What the source shows: the first frame is the finished pour; the next cut is the failed attempt; the spoken line is the exact quote.
   - The technique: open on the result, then rewind to the failure so the viewer has a reason to stay for the explanation.
   - Apply it: use the same move for a product demo, a transformation, or a tutorial.
   - Related: link to an existing hook document if one exists.

2. `/knowledge/psychology-attention/curiosity-gap-from-failure.md`:
   - What the source shows: the failure is shown before the explanation.
   - The concept: the viewer sees the gap between the failed attempt and the finished result, which creates a curiosity gap.
   - Apply it: pair a visible failure with a promised mechanism, not a vague promise.

Do not write both if they repeat the same idea. Pick the stronger one, or make the second one about a genuinely different mechanism.
