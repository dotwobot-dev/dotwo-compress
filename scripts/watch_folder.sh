#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

BASE="${BASE:-/Users/dotwo/VideoTranscoder}"
IN="$BASE/ENTRADA"
PROC="$BASE/PROCESANDO"
OUT="$BASE/SALIDA_GRASSVALLEY"
DONE="$BASE/PROCESADOS_ORIGINALES"
ERR="$BASE/ERROR"
LOG="$BASE/LOGS"

mkdir -p "$IN" "$PROC" "$OUT" "$DONE" "$ERR" "$LOG"

echo "Vigilando: $IN"
echo "Salida: $OUT"

while true; do
  find "$IN" -maxdepth 1 -type f \( \
    -iname "*.mov" -o \
    -iname "*.mp4" -o \
    -iname "*.m4v" -o \
    -iname "*.mkv" -o \
    -iname "*.avi" -o \
    -iname "*.mxf" \
  \) | while IFS= read -r src; do
    is_stable_file "$src" 5 || continue

    name="$(basename "$src")"
    safe="$(sanitize_name "$name")"
    work="$PROC/$name"
    dst="$OUT/${safe}_VALIDADO.mov"
    logfile="$LOG/${safe}_$(date +%Y%m%d_%H%M%S).log"

    mv "$src" "$work"

    {
      echo "=== Procesando: $work ==="
      date
      echo
    } | tee "$logfile"

    if "$SCRIPT_DIR/transcode_xdcam_ex_mov.sh" "$work" "$dst" >> "$logfile" 2>&1; then
      "$SCRIPT_DIR/validate_against_reference.sh" "$dst" >> "$logfile" 2>&1 || true
      mv "$work" "$DONE/$name"
      echo "OK: $dst" | tee -a "$logfile"
    else
      rm -f "$dst"
      mv "$work" "$ERR/$name"
      echo "ERROR: $name" | tee -a "$logfile"
    fi
  done

  sleep 10
done
