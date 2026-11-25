#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${OPENFRANZ_WORKSPACE:-$PWD/openfranz-workspace}"
SOURCE=""
STT="local"
LANG="en"
MODEL="openai/whisper-base"
MAX_FRAMES=24

usage() {
  cat <<'EOF'
Usage:
  ingest.sh <instagram-url-or-local-file> [options]

Options:
  --workspace DIR       Workspace directory (default: $OPENFRANZ_WORKSPACE or ./openfranz-workspace)
  --stt local|sarvam
                        local: local Whisper (preferred, default, no key)
                        sarvam: Sarvam saaras:v3 (opt-in, requires SARVAM_API_KEY)
  --lang CODE           Language code for local Whisper (default: en)
  --model ID            Local Whisper model (default: openai/whisper-base)
  --max-frames N        Maximum reel frames (default: 24)
  -h, --help            Show this help

The script downloads with yt-dlp, extracts audio, transcribes, plans frames,
extracts JPEGs, and writes inbox/<id>/context.md.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --workspace) WORKSPACE="$2"; shift 2 ;;
    --stt) STT="$2"; shift 2 ;;
    --lang) LANG="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --max-frames) MAX_FRAMES="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *) SOURCE="$1"; shift ;;
  esac
done

if [ -z "$SOURCE" ]; then
  usage
  exit 1
fi

# Load optional cloud keys from the workspace .env.
# shellcheck source=env.sh
. "$SCRIPT_DIR/env.sh"

if [ ! -d "$WORKSPACE/library" ]; then
  "$SCRIPT_DIR/setup.sh" "$WORKSPACE"
fi

BASE="$(basename "$SOURCE")"
SLUG="$(printf '%s' "$BASE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40)"
[ -n "$SLUG" ] || SLUG="source"
ID="$(date +%Y%m%d-%H%M%S)-$SLUG"
DIR="$WORKSPACE/inbox/$ID"
mkdir -p "$DIR/frames"

MEDIA_TYPE=""
VIDEO=""
IMAGES=()

if [[ "$SOURCE" =~ ^https?:// ]]; then
  if [[ ! "$SOURCE" =~ ^https?://(www\.)?instagram\.com/(p|reel|reels|tv|share)/ ]]; then
    echo "Only public Instagram post or Reel URLs are supported." >&2
    exit 1
  fi
  if ! command -v yt-dlp >/dev/null 2>&1; then
    echo "yt-dlp is required for URL ingest. Install it with: brew install yt-dlp" >&2
    exit 1
  fi
  echo "Downloading $SOURCE"
  yt-dlp --no-playlist --write-info-json --write-thumbnail \
    -o "$DIR/source.%(ext)s" "$SOURCE"
else
  if [ ! -f "$SOURCE" ]; then
    echo "File not found: $SOURCE" >&2
    exit 1
  fi
  EXT="${SOURCE##*.}"
  [ "$EXT" != "$SOURCE" ] || EXT="bin"
  cp "$SOURCE" "$DIR/source.$EXT"
fi

VIDEO="$(find "$DIR" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.webm' -o -iname '*.mkv' \) | head -1)"

if [ -n "$VIDEO" ]; then
  MEDIA_TYPE="reel"
else
  while IFS= read -r image; do
    IMAGES+=("$image")
  done < <(find "$DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) | sort)

  # If yt-dlp wrote a thumbnail alongside carousel images, drop the thumbnail.
  if [ "${#IMAGES[@]}" -gt 1 ]; then
    FILTERED=()
    for image in "${IMAGES[@]}"; do
      base="$(basename "$image")"
      if [ "$base" = "source.jpg" ] || [ "$base" = "source.webp" ] || [ "$base" = "source.png" ]; then
        continue
      fi
      FILTERED+=("$image")
    done
    IMAGES=("${FILTERED[@]}")
  fi

  if [ "${#IMAGES[@]}" -eq 0 ]; then
    echo "No video or images were downloaded." >&2
    exit 1
  fi

  if [ "${#IMAGES[@]}" -gt 12 ]; then
    IMAGES=("${IMAGES[@]:0:12}")
  fi

  for image in "${IMAGES[@]}"; do
    bytes="$(wc -c < "$image" | tr -d ' ')"
    if [ "$bytes" -gt $((15 * 1024 * 1024)) ]; then
      echo "Image is over 15 MB: $image" >&2
      exit 1
    fi
  done

  MEDIA_TYPE="post"
fi

TRANSCRIPT_TEXT=""
FRAME_LINES=""
STT_LABEL=""
VISION_LABEL="agent (view the frames directly)"

if [ "$MEDIA_TYPE" = "reel" ]; then
  DURATION="$(ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "$VIDEO" 2>/dev/null || echo 0)"
  if ! [[ "$DURATION" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    DURATION=0
  fi

  echo "Extracting audio (${DURATION}s)"
  ffmpeg -y -loglevel error -i "$VIDEO" -vn -ac 1 -ar 16000 -f wav "$DIR/audio.wav"

  USE_SARVAM=0
  if [ "$STT" = "sarvam" ]; then
    USE_SARVAM=1
  fi

  if [ "$USE_SARVAM" -eq 1 ]; then
    if [ -z "${SARVAM_API_KEY:-}" ]; then
      echo "Sarvam was selected but SARVAM_API_KEY is not set." >&2
      echo "Set it in your shell or in $WORKSPACE/.env, or use --stt local." >&2
      exit 2
    fi
    echo "Transcribing with Sarvam saaras:v3"
    node "$SCRIPT_DIR/transcribe_sarvam.mjs" "$DIR/audio.wav" "$DIR/transcript.json" "$DURATION"
    STT_LABEL="Sarvam saaras:v3"
  else
    echo "Transcribing with local Whisper ($MODEL)"
    python3 "$SCRIPT_DIR/transcribe.py" "$DIR/audio.wav" "$DIR/transcript.json" \
      --model "$MODEL" --language "$LANG"
    STT_LABEL="local Whisper ($MODEL)"
  fi

  node "$SCRIPT_DIR/frame_plan.mjs" \
    --transcript "$DIR/transcript.json" \
    --duration "$DURATION" \
    --max "$MAX_FRAMES" \
    --out "$DIR/frames.json"

  INDEX=0
  while IFS= read -r TIME; do
    ffmpeg -y -loglevel error -ss "$TIME" -i "$VIDEO" -frames:v 1 \
      -vf scale=768:-1 -q:v 3 "$DIR/frames/frame-$INDEX.jpg"
    FRAME_LINES="${FRAME_LINES}- frames/frame-$INDEX.jpg at ${TIME}s"$'\n'
    INDEX=$((INDEX + 1))
  done < <(jq -r '.[]' "$DIR/frames.json")

  TRANSCRIPT_TEXT="$(jq -r '.transcript // ""' "$DIR/transcript.json")"
fi

if [ "$MEDIA_TYPE" = "post" ]; then
  for image in "${IMAGES[@]}"; do
    FRAME_LINES="${FRAME_LINES}- $(basename "$image")"$'\n'
  done
fi

SOURCE_TITLE=""
SOURCE_UPLOADER=""
SOURCE_LIKES=""
SOURCE_COMMENTS=""
SOURCE_DESCRIPTION=""
if [ -f "$DIR/source.info.json" ]; then
  SOURCE_TITLE="$(jq -r '.title // ""' "$DIR/source.info.json")"
  SOURCE_UPLOADER="$(jq -r '.uploader // ""' "$DIR/source.info.json")"
  SOURCE_LIKES="$(jq -r '.like_count // ""' "$DIR/source.info.json")"
  SOURCE_COMMENTS="$(jq -r '.comment_count // ""' "$DIR/source.info.json")"
  SOURCE_DESCRIPTION="$(jq -r '.description // ""' "$DIR/source.info.json")"
fi
SOURCE_DESCRIPTION_ESCAPED="$(printf '%s' "$SOURCE_DESCRIPTION" | sed 's/\\/\\\\/g; s/\$/\\$/g; s/`/\\`/g')"

cat > "$DIR/context.md" <<OPENFRANZ_CONTEXT_EOF
# Ingest Context

- Source: $SOURCE
- Media type: $MEDIA_TYPE
- Workspace: $WORKSPACE
- Inbox: $DIR
- Speech to text: $STT_LABEL
- Vision: $VISION_LABEL

## Source metadata

- Title: ${SOURCE_TITLE:-unknown}
- Creator: ${SOURCE_UPLOADER:-unknown}
- Likes: ${SOURCE_LIKES:-unknown}
- Comments: ${SOURCE_COMMENTS:-unknown}
- Info JSON: source.info.json

### Caption

${SOURCE_DESCRIPTION_ESCAPED:-(no caption)}

The caption is evidence for the creator's own framing and exact wording. Engagement counts are context, not proof that the technique works.

## Transcript

$TRANSCRIPT_TEXT

## Frames

$FRAME_LINES

## Next step

1. View every frame with your image tool. If you cannot, say so and work from the transcript alone.
2. Write a specific visual analysis: visible text, demonstrations, editing patterns, transitions, and how the visuals connect to the speech. Use the caption for the creator's exact wording and framing.
3. Read the openfranz skill's references/ingestion.md.
4. Search the library before writing. Update an existing document instead of creating a near-duplicate.
5. Write zero to three documents. Validate each one with scripts/library_write.mjs or scripts/validate_document.mjs.
6. Rebuild the index with scripts/library_index.mjs.
OPENFRANZ_CONTEXT_EOF

echo ""
echo "Context: $DIR/context.md"
echo "Frames:  $DIR/frames"
echo "Next: read context.md, view the frames, then follow references/ingestion.md."
