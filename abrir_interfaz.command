#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo "Abriendo DoTwo Compress en http://127.0.0.1:8787"
echo
node server.mjs
