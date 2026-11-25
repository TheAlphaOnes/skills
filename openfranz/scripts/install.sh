#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MODE="${1:-local}"
PROJECT="${2:-$PWD}"

install_to() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  cp -R "$SKILL_DIR" "$dest"
  find "$dest" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
  find "$dest" -name '.DS_Store' -delete 2>/dev/null || true
  echo "Installed: $dest"
}

if [ "$MODE" = "--global" ] || [ "$MODE" = "global" ]; then
  install_to "$HOME/.agents/skills/openfranz"
  echo "Global install complete."
  exit 0
fi

# Local install is the default: the project's .agents/skills folder.
install_to "$PROJECT/.agents/skills/openfranz"

if [ "$MODE" = "--claude" ] || [ "$MODE" = "claude" ]; then
  install_to "$PROJECT/.claude/skills/openfranz"
fi

echo "Local install complete. Use --global for ~/.agents/skills/openfranz."
echo "Use --claude to also install into .claude/skills/openfranz."
