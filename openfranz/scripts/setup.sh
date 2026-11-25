#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${1:-${OPENFRANZ_WORKSPACE:-$PWD/openfranz-workspace}}"
mkdir -p "$(dirname "$WORKSPACE")"
WORKSPACE="$(cd "$(dirname "$WORKSPACE")" && pwd)/$(basename "$WORKSPACE")"

say() { printf '%s\n' "$*"; }

say "OpenFranz workspace: $WORKSPACE"

# Required tools for the media pipeline.
missing_required=0
for tool in ffmpeg ffprobe node python3 jq; do
  if command -v "$tool" >/dev/null 2>&1; then
    say "  ok      $tool"
  else
    say "  MISSING $tool"
    missing_required=1
  fi
done

# Optional tools.
if command -v yt-dlp >/dev/null 2>&1; then
  say "  ok      yt-dlp ($(yt-dlp --version 2>/dev/null | head -1))"
else
  say "  optional yt-dlp (needed for Instagram URLs; brew install yt-dlp)"
fi

if python3 -c 'import transformers, torch' >/dev/null 2>&1; then
  say "  ok      local Whisper (transformers + torch)"
else
  say "  optional local Whisper (pip3 install transformers torch)"
fi

if [ -n "${SARVAM_API_KEY:-}" ]; then
  say "  ok      Sarvam (SARVAM_API_KEY is set)"
else
  say "  optional Sarvam (set SARVAM_API_KEY to use saaras:v3)"
fi

# Create the workspace skeleton.
mkdir -p \
  "$WORKSPACE/library/arsenal/hooks-attention" \
  "$WORKSPACE/library/arsenal/language-bank" \
  "$WORKSPACE/library/arsenal/storytelling" \
  "$WORKSPACE/library/arsenal/frameworks-templates" \
  "$WORKSPACE/library/arsenal/creative-techniques" \
  "$WORKSPACE/library/arsenal/swipe-files" \
  "$WORKSPACE/library/knowledge/psychology-attention" \
  "$WORKSPACE/library/knowledge/writing-copywriting" \
  "$WORKSPACE/library/knowledge/storytelling-retention" \
  "$WORKSPACE/library/knowledge/content-strategy" \
  "$WORKSPACE/library/knowledge/creative-thinking" \
  "$WORKSPACE/library/knowledge/audience-insights" \
  "$WORKSPACE/brands" \
  "$WORKSPACE/scripts" \
  "$WORKSPACE/strategies" \
  "$WORKSPACE/plans" \
  "$WORKSPACE/inbox" \
  "$WORKSPACE/index"

# The library starts empty. The agent and the user fill it from their own
# sources. Use scripts/import_from_postgres.mjs if you already have a VFS
# export to import.

ensure_readme() {
  local dir="$1"
  local title="$2"
  local body="$3"
  local file="$dir/README.md"
  if [ ! -f "$file" ]; then
    {
      printf '# %s\n\n' "$title"
      printf '%s\n' "$body"
      printf '\nThis folder is part of the OpenFranz library. Keep one idea per Markdown file.\n'
    } > "$file"
  fi
}

ensure_readme "$WORKSPACE/library/arsenal/hooks-attention" "Hooks and attention" "Opening lines, first-frame ideas, pattern interrupts, curiosity triggers, and visual hooks."
ensure_readme "$WORKSPACE/library/arsenal/language-bank" "Language bank" "Phrases, CTAs, opening and closing lines, transitions, power words, and reusable sentence patterns."
ensure_readme "$WORKSPACE/library/arsenal/storytelling" "Storytelling" "Story structures, narrative patterns, setups, tension, payoff, and transformation examples."
ensure_readme "$WORKSPACE/library/arsenal/frameworks-templates" "Frameworks and templates" "Script frameworks, copywriting formulas, reusable outlines, and fill-in structures."
ensure_readme "$WORKSPACE/library/arsenal/creative-techniques" "Creative techniques" "Visual devices, editing ideas, transitions, demonstrations, and production techniques."
ensure_readme "$WORKSPACE/library/arsenal/swipe-files" "Swipe files" "Strong scripts, creator examples, references, and breakdowns of why a specific post worked."
ensure_readme "$WORKSPACE/library/knowledge/psychology-attention" "Psychology and attention" "Human behaviour, curiosity, emotion, attention, persuasion, and why people keep watching or stop."
ensure_readme "$WORKSPACE/library/knowledge/writing-copywriting" "Writing and copywriting" "Copywriting principles, voice, tonality, clarity, rhythm, and communication techniques."
ensure_readme "$WORKSPACE/library/knowledge/storytelling-retention" "Storytelling and retention" "Narrative theory, pacing, retention, story arcs, curiosity loops, and payoff design."
ensure_readme "$WORKSPACE/library/knowledge/content-strategy" "Content strategy" "Content pillars, audience research, positioning, platform behaviour, and repeatable content systems."
ensure_readme "$WORKSPACE/library/knowledge/creative-thinking" "Creative thinking" "Ideation, creative principles, pattern recognition, originality, and non-obvious angles."
ensure_readme "$WORKSPACE/library/knowledge/audience-insights" "Audience insights" "Audience interests, pain points, feedback, trends, expectations, and the language people use."

if [ ! -f "$WORKSPACE/README.md" ]; then
  cat > "$WORKSPACE/README.md" <<'EOF'
# OpenFranz workspace

This workspace is a local OpenFranz library.

- `library/arsenal/` holds reusable writing material.
- `library/knowledge/` holds ideas that improve judgment.
- `brands/` holds one Markdown file per brand.
- `scripts/` holds versioned scripts.
- `strategies/` holds content strategies.
- `plans/plan.json` holds the dated content plan.
- `inbox/` holds downloaded media, transcripts, and frames.
- `index/` holds the generated link graph.

Start with the `openfranz` skill. Ingest a source with `scripts/ingest.sh`, file the material with `references/ingestion.md`, and write from the library with `references/writing.md`.
EOF
fi

say ""
say "Workspace ready."
say "Next: ingest a public Instagram URL or a local video:"
say "  $SCRIPT_DIR/ingest.sh <url-or-file> --workspace \"$WORKSPACE\""
say ""
"$SCRIPT_DIR/configure.sh" "$WORKSPACE"

if [ "$missing_required" -ne 0 ]; then
  say ""
  say "One or more required tools are missing. Install them before ingesting media."
  exit 1
fi
