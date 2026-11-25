#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${1:-${OPENFRANZ_WORKSPACE:-$PWD/openfranz-workspace}}"

# shellcheck source=env.sh
. "$SCRIPT_DIR/env.sh"

say() { printf '%s\n' "$*"; }
problems=0

say "OpenFranz doctor"
say "Workspace: $WORKSPACE"
say ""

for tool in ffmpeg ffprobe node python3 jq; do
  if command -v "$tool" >/dev/null 2>&1; then
    say "  ok      $tool"
  else
    say "  MISSING $tool"
    problems=$((problems + 1))
  fi
done

if command -v yt-dlp >/dev/null 2>&1; then
  say "  ok      yt-dlp"
else
  say "  optional yt-dlp (needed for Instagram URLs)"
fi

if python3 -c 'import transformers, torch' >/dev/null 2>&1; then
  say "  ok      local Whisper"
else
  say "  optional local Whisper (pip3 install transformers torch)"
fi

for dir in library/arsenal library/knowledge brands scripts strategies plans inbox index; do
  if [ -d "$WORKSPACE/$dir" ]; then
    say "  ok      $dir"
  else
    say "  MISSING $dir"
    problems=$((problems + 1))
  fi
done

say ""
say "Rebuilding the index..."
node "$SCRIPT_DIR/library_index.mjs" --workspace "$WORKSPACE"

INDEX="$WORKSPACE/index/links.json"
if [ -f "$INDEX" ]; then
  MISSING="$(jq '.missing | length' "$INDEX" 2>/dev/null || echo 0)"
  FILES="$(jq '.nodes | length' "$INDEX" 2>/dev/null || echo 0)"
  LINKS="$(jq '.links | length' "$INDEX" 2>/dev/null || echo 0)"
  say ""
  say "Library: $FILES files, $LINKS links, $MISSING missing targets"
  if [ "$MISSING" -gt 0 ]; then
    say "Missing targets:"
    jq -r '.missing[] | "  \(.source) -> \(.target)"' "$INDEX" | head -20
    problems=$((problems + 1))
  fi

  NEWEST="$(find "$WORKSPACE/library" -type f -name '*.md' -newer "$INDEX" -print -quit 2>/dev/null || true)"
  if [ -n "$NEWEST" ]; then
    say "Index is stale: $NEWEST is newer than index/links.json"
    problems=$((problems + 1))
  fi
fi

# Validate saved scripts.
for script in "$WORKSPACE"/scripts/*/v*.md; do
  [ -f "$script" ] || continue
  if ! node "$SCRIPT_DIR/validate_script.mjs" "$script" >/dev/null 2>&1; then
    say "Invalid script: $script"
    problems=$((problems + 1))
  fi
done

say ""
"$SCRIPT_DIR/configure.sh" "$WORKSPACE"

say ""
if [ "$problems" -gt 0 ]; then
  say "Doctor found $problems problem(s)."
  exit 1
fi
say "Doctor found no problems."
