#!/usr/bin/env bash
# Source the workspace .env if present. Call after WORKSPACE is set.
if [ -n "${WORKSPACE:-}" ] && [ -f "$WORKSPACE/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$WORKSPACE/.env"
  set +a
fi
