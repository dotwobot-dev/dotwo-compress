#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

FFPROBE="${FFPROBE_BIN:-ffprobe}"
require_cmd "$FFPROBE"

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 ARCHIVO_REFERENCIA.mov" >&2
  exit 2
fi

INPUT="$1"
[[ -f "$INPUT" ]] || die "No existe el archivo: $INPUT"

ROOT="$(project_root)"
REPORT_DIR="$ROOT/reports/reference"
mkdir -p "$REPORT_DIR"

BASENAME="$(basename "$INPUT")"
SAFE_NAME="$(sanitize_name "$BASENAME")"

"$FFPROBE" -hide_banner \
  -show_format \
  -show_streams \
  -show_programs \
  -show_chapters \
  -show_frames \
  -select_streams v:0 \
  -read_intervals "%+10" \
  -print_format json \
  "$INPUT" > "$REPORT_DIR/${SAFE_NAME}_ffprobe_full_first_10s.json"

"$FFPROBE" -hide_banner \
  -show_format \
  -show_streams \
  -show_chapters \
  -print_format json \
  "$INPUT" > "$REPORT_DIR/${SAFE_NAME}_ffprobe_streams.json"

"$FFPROBE" -hide_banner \
  -select_streams v:0 \
  -show_frames \
  -read_intervals "%+5" \
  -show_entries frame=pict_type,interlaced_frame,top_field_first,repeat_pict,pkt_duration_time,best_effort_timestamp_time \
  -of csv=p=1 \
  "$INPUT" > "$REPORT_DIR/${SAFE_NAME}_frame_pattern.csv"

"$SCRIPT_DIR/analyze_file.sh" "$INPUT" "$REPORT_DIR" >/dev/null

echo "Referencia analizada en: $REPORT_DIR"
