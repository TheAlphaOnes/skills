---
name: openfranz
description: Run a creative-intelligence workflow for social content. Use this skill whenever the user wants to learn from public Instagram Reels or posts, download and process media, transcribe speech, analyze frames, build a linked Markdown knowledge library (arsenal + knowledge), extract hooks/structures/phrases/techniques, or write grounded hooks, scripts, CTAs, captions, strategies, and content plans from that library. Trigger it for requests like "ingest this reel", "build my swipe file", "learn from this creator", "write a script from my library", or "make a content plan".
---

# OpenFranz

OpenFranz is a creative-intelligence loop: ingest a source, extract the craft, file it into a linked library, then write from that library. It runs on ordinary files and command-line tools, so it works in any agent environment.

The library is the product. Ingest and writing exist to make the library more useful to a future writing session. Treat every step that way.

## When to use this skill

Use it when the user wants to:

- ingest a public Instagram Reel or post, a local video, or a set of images;
- build a swipe file, hook bank, or reusable content library;
- extract hooks, structures, phrases, visual moves, or principles from a creator's work;
- write hooks, scripts, CTAs, captions, or rewrites grounded in stored material;
- define a brand, a content strategy, or a dated content plan.

Public content only. Do not use it for private posts, stories, profiles, mass scraping, or anything that violates a platform's terms.

## The workspace

Everything lives in one directory. The default is `./openfranz-workspace`; the user can set `OPENFRANZ_WORKSPACE` or pass `--workspace`.

```text
openfranz-workspace/
├─ library/
│  ├─ arsenal/                 reusable material a writer can lift directly
│  │  ├─ hooks-attention/
│  │  ├─ language-bank/
│  │  ├─ storytelling/
│  │  ├─ frameworks-templates/
│  │  ├─ creative-techniques/
│  │  └─ swipe-files/
│  └─ knowledge/               ideas that improve judgment
│     ├─ psychology-attention/
│     ├─ writing-copywriting/
│     ├─ storytelling-retention/
│     ├─ content-strategy/
│     ├─ creative-thinking/
│     └─ audience-insights/
├─ brands/                     one Markdown file per brand
├─ scripts/                    one folder per script, with versioned Markdown
├─ strategies/                 one Markdown file per strategy
├─ plans/plan.json             dated content plan
├─ inbox/                      downloaded media, audio, transcripts, frames
└─ index/                      links.json and graph.json
```

The library paths used inside documents are `/arsenal/...` and `/knowledge/...`. The physical files are under `library/arsenal/...` and `library/knowledge/...`. The scripts translate between the two.

## First run

The skill is installed locally by default at `.agents/skills/openfranz` in the current project. Use `--global` only if you want it available everywhere; use `--claude` to also install into `.claude/skills/openfranz`.

Set the skill directory and workspace, then run setup:

```bash
export OPENFRANZ_SKILL="${OPENFRANZ_SKILL:-$PWD/.agents/skills/openfranz}"
export OPENFRANZ_WORKSPACE="${OPENFRANZ_WORKSPACE:-$PWD/openfranz-workspace}"

"$OPENFRANZ_SKILL/scripts/setup.sh" "$OPENFRANZ_WORKSPACE"
```

Setup checks for `ffmpeg`, `ffprobe`, `yt-dlp`, `node`, `python3`, and `jq`, checks for the Python `transformers` and `torch` packages used by local Whisper, and creates the workspace skeleton with a README in every library folder.

The scripts live next to this `SKILL.md`. If the skill is installed somewhere else, set `OPENFRANZ_SKILL` to that directory.

Setup creates an empty library skeleton with a README in every folder. The agent and the user fill it from their own sources.

## Providers and keys

The skill always prefers local tools that need no key. Local is the default; cloud is opt-in.

| Capability | Local (preferred, default) | Cloud (opt-in) | Key |
|------------|----------------------------|----------------|-----|
| Speech to text | Local Whisper (`transformers` + `torch`) | Sarvam `saaras:v3` | `SARVAM_API_KEY` |
| Instagram download | `yt-dlp` | `@jerrycoder/instagram-api` fallback for carousels | none |

Vision and web research use the agent itself. They have no separate provider and no key.

How to configure a cloud provider:

1. Use local by default. Do not ask for a key unless the user explicitly asks for a cloud provider or the local option is unavailable.
2. If the user asks for a cloud provider, tell them to set the key in their shell:

   ```bash
   export SARVAM_API_KEY=...
   ```

   or to copy `$OPENFRANZ_WORKSPACE/.env.example` to `$OPENFRANZ_WORKSPACE/.env` and fill it in. The workspace `.gitignore` excludes `.env`.
3. Never write the key into the skill, a library document, a script, or a commit. Do not echo it back.
4. Run `scripts/configure.sh "$OPENFRANZ_WORKSPACE"` to see which providers are configured.

If a cloud option is selected without its key, the scripts exit with a clear message and the local option remains available.

## The loop

### 1. Ingest

```bash
"$OPENFRANZ_SKILL/scripts/ingest.sh" "<instagram-url-or-local-file>" \
  --workspace "$OPENFRANZ_WORKSPACE"
```

The script:

1. Validates the source. Public Instagram post, Reel, `/reels/`, `/tv/`, and `/share/` links are accepted; local video and image files are accepted.
2. Downloads with `yt-dlp` into `inbox/<id>/`, keeping the info JSON and thumbnail.
3. For a video: probes the duration, extracts a 16 kHz mono WAV, transcribes it, plans frames, and extracts JPEG frames.
4. For images: collects up to 12 images and records them.
5. Writes `inbox/<id>/context.md` with the source, media type, transcript, frame paths, and the next step.

Transcription defaults to local Whisper through `transformers` (`openai/whisper-base`). If `SARVAM_API_KEY` is set, pass `--stt sarvam` to use Sarvam `saaras:v3` instead. Sarvam is better for Indic languages and long clips; local Whisper is free and offline after the model download.

Read `references/media.md` for the full media contract, limits, and troubleshooting.

### 2. Analyze the frames

Read `inbox/<id>/context.md`, then view every frame with your image tool. Write a specific visual analysis: visible text, demonstrations, editing patterns, transitions, on-screen structure, and how the visuals connect to the speech. Do not invent details that are not visible.

If you do not have an image tool, say so and work from the transcript alone, marking the limitation in the document.

### 3. File the material

Read `references/ingestion.md` before writing. It contains the full ingestion contract: the evidence rule, the folder guide, what to extract, what to skip, the document template, dedupe rules, and link rules.

Write zero to three documents. One strong document is better than three weak ones. A source with no transferable technique should produce no documents.

Before writing each document, gather the strongest existing material in one call:

```bash
"$OPENFRANZ_SKILL/scripts/library_context.mjs" "the technique or phrase" \
  --workspace "$OPENFRANZ_WORKSPACE" --limit 3
```

If you need a narrower search, use `library_search.mjs`.

Write the document to a temp file, then validate, write, and reindex in one call:

```bash
"$OPENFRANZ_SKILL/scripts/library_write.mjs" \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --path /arsenal/hooks-attention/foo.md \
  --content-file /tmp/doc.md \
  --source "<exact source URL>"
```

`library_write.mjs` rejects a document that fails validation and rebuilds the index on success. If you prefer separate steps, use `validate_document.mjs` and `library_index.mjs`.

### 4. Write from the library

Read `references/writing.md` before writing. It contains the full writing contract: the research phases, the three-variant rule, the script card format, Deep mode, brand grounding, and the self-check.

The short version:

1. Read the brief. Ask up to three focused questions only if something material is missing.
2. If a brand is named, read `brands/<slug>.md` first.
3. Search the library at least twice with different angles, once for `/arsenal` and once for `/knowledge`. Use `library_context.mjs` to search and read the top files in one call.
4. Read at least three files in full. Follow at least one link hop with `library_search.mjs links` or `related`.
5. Do not write until you can name at least three concrete pieces of evidence.
6. Write three variants, each with a different angle. After each, name the mechanism that makes it work.
7. End with a `Library:` line naming the files you actually used.
8. If the user asked to save a script, save it with `save_script.mjs`.

```bash
"$OPENFRANZ_SKILL/scripts/save_script.mjs" \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --title "Cold brew launch reel" \
  --brand "acme-coffee" \
  --content-file /tmp/script.md \
  --note "First version"
```

Pass `--id-or-slug` to add a version to an existing script instead of creating a duplicate.

### 5. Plan

Read `references/domains.md` for the brand, script, strategy, and plan formats.

A content plan follows the active strategy. Read `strategies/` first, then list the existing plan so you do not double-book a day. Save each item with `plan.mjs`:

```bash
"$OPENFRANZ_SKILL/scripts/plan.mjs" add \
  --workspace "$OPENFRANZ_WORKSPACE" \
  --title "Cold brew launch reel" \
  --platform instagram \
  --format reel \
  --brand acme-coffee \
  --date 2026-12-01 \
  --time 19:00 \
  --rationale "Launch week, evening attention peak"
```

## Hard rules

These are the rules that keep the library worth using. Follow them even when the user is in a hurry.

1. **Evidence over invention.** Every claim in a library document must be traceable to the transcript, the frames, or the source metadata. Label inferences with `Inference:`. Do not add generic production advice, invented CTAs, invented timings, or invented psychology.
2. **Two roots, one purpose each.** `/arsenal` holds material a writer can lift directly: hooks, lines, CTAs, structures, visual moves, swipe examples. `/knowledge` holds ideas that improve judgment: psychology, principles, strategy, audience insight.
3. **Links must resolve.** A document may link only to files that already exist. Use `/arsenal/...` or `/knowledge/...` paths. Never write "to be created" or a placeholder link.
4. **One idea per document.** 250 to 700 words. A specific title. No clickbait, no invented numbers, no emojis.
5. **Dedupe before writing.** Search the library. Update the strongest existing document instead of creating a near-duplicate.
6. **Three variants.** Every creative deliverable gets three variants with different angles, not three rewordings of the same idea.
7. **Scripts use the script fence.** Put the whole script inside one `script` fence with `title` and optional `brand` attributes, one beat per line in the form `0-2s | on-screen: ... | spoken: ... | visual: ...`. The script must pass `validate_script.mjs`; `save_script.mjs` runs it automatically.
8. **Brand facts are facts.** Never invent a product, price, feature, audience, or proof point. If the brand file is incomplete, say which field is missing.
9. **Public content only.** Do not bypass logins, paywalls, private accounts, or platform restrictions.
10. **No silent saves.** Never claim a document or script was saved unless the write succeeded and, for scripts, `save_script.mjs` returned a version.

## Commands

| Command | Purpose |
|---------|---------|
| `scripts/install.sh [--global\|--claude] [project]` | Install locally to `.agents/skills/openfranz` by default; `--global` for `~/.agents/skills/openfranz`; `--claude` to also install into `.claude/skills/openfranz` |
| `scripts/setup.sh [workspace]` | Check dependencies and create an empty workspace skeleton |
| `scripts/configure.sh [workspace]` | Show provider status and create `.env.example` / `.gitignore` |
| `scripts/doctor.sh [workspace]` | Check tools, folders, missing links, and index freshness |
| `scripts/ingest.sh <url-or-file> [--workspace DIR] [--stt local\|sarvam] [--lang en] [--model openai/whisper-base] [--max-frames 24]` | Download, transcribe, plan frames, extract frames, write context |
| `scripts/transcribe.py <audio> <out.json> [--model ...] [--language en]` | Local Whisper transcription with timestamps |
| `scripts/transcribe_sarvam.mjs <audio> <out.json> <duration>` | Sarvam REST or batch transcription |
| `scripts/frame_plan.mjs --transcript <json> --duration <sec> --max 24 --out <json>` | Plan frame timestamps |
| `scripts/library_context.mjs <query> --workspace DIR [--focus both\|arsenal\|knowledge] [--limit 3]` | Search and read the strongest files in one call |
| `scripts/library_read.mjs <path> --workspace DIR [--list]` | Read or list library files by path |
| `scripts/library_write.mjs --workspace DIR --path /arsenal/... --content-file FILE --source URL` | Validate, write, and reindex in one call |
| `scripts/library_index.mjs --workspace DIR` | Rebuild `index/links.json` and `index/graph.json` |
| `scripts/library_search.mjs <query> --workspace DIR [--limit 20] [--content]` | Fuzzy path and content search |
| `scripts/library_search.mjs links <path> --workspace DIR` | Outgoing links and backlinks |
| `scripts/library_search.mjs related <path> --workspace DIR --depth 2` | Files connected through the graph |
| `scripts/library_search.mjs path <from> <to> --workspace DIR` | Shortest directed link path |
| `scripts/validate_document.mjs <file> --workspace DIR --source URL` | Enforce the document contract |
| `scripts/validate_script.mjs <file>` | Check the script fence, three variants, angle, beats, and why-it-works |
| `scripts/save_script.mjs --workspace DIR --title ... --content-file ...` | Save or version a script; validates the script contract by default |
| `scripts/save_script.mjs list --workspace DIR` | List saved scripts |
| `scripts/plan.mjs list\|add\|update\|delete --workspace DIR ...` | Manage the dated content plan |
| `scripts/brand.mjs list\|read\|create\|update ... --workspace DIR` | Manage brand files |
| `scripts/strategy.mjs list\|read\|create\|update\|activate ... --workspace DIR` | Manage strategies |
| `scripts/make_sample.sh [out.mp4]` | Generate a small sample Reel for testing |

## References

Read the reference that matches the task. Do not load all of them at once.

| File | Read it when |
|------|--------------|
| `references/ingestion.md` | Turning a source into library documents |
| `references/writing.md` | Writing hooks, scripts, CTAs, captions, rewrites, or strategy |
| `references/library.md` | Creating, linking, searching, or validating library files |
| `references/media.md` | Downloading, transcribing, extracting frames, or troubleshooting media |
| `references/domains.md` | Brands, scripts, strategies, plans, and their file formats |

## Quality bar

Evidence, provenance, dedupe, links, three variants, and brand grounding.

## Troubleshooting

- **`yt-dlp` cannot download an Instagram URL.** Confirm the post is public and the URL is a post or Reel, not a profile or story. Try `yt-dlp --cookies-from-browser safari "<url>"` if the user is logged in and the content is public but age-gated. Do not use cookies to access private content.
- **No audio or empty transcript.** Check `ffprobe` for an audio stream. Some Reels are music-only; transcribe what is there and rely on the frames. If the audio is silent, say so in the document.
- **Whisper is slow or missing.** The first run downloads the model. Use `--model openai/whisper-base` for speed, or `--stt sarvam` with a key. If `transformers` or `torch` is missing, install them with `pip3 install transformers torch`.
- **Frames are too dark or blurry.** The frame planner samples one frame every two seconds, with a minimum of six and a maximum of 24. Increase `--max-frames` for long, visually dense Reels.
- **The library search misses a synonym.** Search is lexical and fuzzy, not semantic. Try the creator's exact phrase, the technique name, and the audience problem as separate searches.
- **A document fails validation.** Read the printed problems. The usual causes are a missing `Source:` line, a missing `##` section, a thin body under 300 characters, or a link to a file that does not exist.

## Definition of done

An ingest is done when:

- `inbox/<id>/context.md` exists with the source, transcript, and frame list;
- every frame has been viewed or the limitation is stated;
- zero to three documents are written, each validated and linked;
- `index/links.json` is rebuilt and the new documents appear in it.

A writing task is done when:

- the library was searched at least twice and at least three files were read;
- the deliverable has three variants with different angles;
- every claim is grounded in the library, the brand file, a web source, or the user's brief;
- the answer ends with a `Library:` line;
- any script the user asked to save is saved with a version.

A plan is done when:

- the active strategy was read;
- existing plan items were checked for double-booking;
- every item has a real `YYYY-MM-DD` date, a platform, a format, and a one-line rationale;
- the plan file is valid JSON and the items are visible with `plan.mjs list`.
