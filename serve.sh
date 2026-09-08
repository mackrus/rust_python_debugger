#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${1:-8000}"
echo "==> Serving RustPython Visual Debugger on http://localhost:${PORT}"
uv run python -m http.server "${PORT}" --directory web
