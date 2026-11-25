#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${1:-${OPENFRANZ_WORKSPACE:-$PWD/openfranz-workspace}}"
mkdir -p "$WORKSPACE"

if [ ! -f "$WORKSPACE/.env.example" ]; then
  cat > "$WORKSPACE/.env.example" <<'EOF'
# Optional cloud providers. Leave blank to use the local defaults.
# Copy this file to .env and fill in only the providers you want.
# Never commit .env.
SARVAM_API_KEY=
SARVAM_BASE_URL=https://api.sarvam.ai
EOF
fi

if [ ! -f "$WORKSPACE/.gitignore" ]; then
  cat > "$WORKSPACE/.gitignore" <<'EOF'
.env
inbox/
index/
EOF
fi

if [ -f "$WORKSPACE/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$WORKSPACE/.env"
  set +a
fi

say() { printf '%s\n' "$*"; }

say "Provider status for $WORKSPACE"
say ""
say "Speech to text:"
if python3 -c 'import transformers, torch' >/dev/null 2>&1; then
  say "  local Whisper   ready (preferred, default, no key)"
else
  say "  local Whisper   missing (pip3 install transformers torch)"
fi
if [ -n "${SARVAM_API_KEY:-}" ]; then
  say "  Sarvam          configured (opt-in, saaras:v3)"
else
  say "  Sarvam          optional (opt-in; set SARVAM_API_KEY)"
fi
say ""
say "Vision:"
say "  agent vision    always available (no key)"
say ""
say "Download:"
if command -v yt-dlp >/dev/null 2>&1; then
  say "  yt-dlp          ready (preferred, default, no key)"
else
  say "  yt-dlp          missing (brew install yt-dlp)"
fi
say "  Instagram API   optional fallback for carousels"
say ""
say "Web:"
say "  agent web tools always available (no key)"
say ""
say "Local is the default. Cloud is opt-in."
say "To enable a cloud provider, either export the key in your shell:"
say "  export SARVAM_API_KEY=..."
say "or copy $WORKSPACE/.env.example to $WORKSPACE/.env and fill it in."
say "Never commit .env. The workspace .gitignore already excludes it."
say ""
say "The agent should use local by default and request a key only when"
say "you explicitly ask for a cloud provider or local is unavailable."
