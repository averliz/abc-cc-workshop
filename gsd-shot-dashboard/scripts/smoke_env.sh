#!/usr/bin/env bash
set -eu
echo "=== Environment smoke check ==="
command -v docker >/dev/null || { echo "MISSING: docker"; exit 1; }
docker --version
command -v node >/dev/null || { echo "MISSING: node"; exit 1; }
node --version
command -v python >/dev/null || { echo "MISSING: python"; exit 1; }
python --version
command -v uv >/dev/null || { echo "MISSING: uv (install: pip install uv)"; exit 1; }
uv --version
echo "All tools present."
