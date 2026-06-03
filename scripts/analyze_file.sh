#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd jq

FFPROBE="${FFPROBE_BIN:-ffprobe}"
require_cmd "$FFPROBE"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Uso: $0 ARCHIVO [DIRECTORIO_REPORTE]" >&2
  exit 2
fi

INPUT="$1"
[[ -f "$INPUT" ]] || die "No existe el archivo: $INPUT"

ROOT="$(project_root)"
REPORT_DIR="${2:-$ROOT/reports}"
mkdir -p "$REPORT_DIR"

BASENAME="$(basename "$INPUT")"
SAFE_NAME="$(sanitize_name "$BASENAME")"
JSON_OUT="$REPORT_DIR/${SAFE_NAME}_ffprobe.json"
SUMMARY_OUT="$REPORT_DIR/${SAFE_NAME}_summary.txt"

"$FFPROBE" -v error \
  -show_format \
  -show_streams \
  -show_chapters \
  -print_format json \
  "$INPUT" > "$JSON_OUT"

jq -r '
  def stream($t): (.streams[] | select(.codec_type == $t)) // {};
  "file: \(.format.filename)",
  "duration: \(.format.duration // "unknown")",
  "container_bitrate: \(.format.bit_rate // "unknown")",
  "major_brand: \(.format.tags.major_brand // "unknown")",
  "",
  "[video]",
  "codec: \(stream("video").codec_name // "missing")",
  "tag: \(stream("video").codec_tag_string // "missing")",
  "profile: \(stream("video").profile // "unknown")",
  "size: \((stream("video").width // "?")|tostring)x\((stream("video").height // "?")|tostring)",
  "pix_fmt: \(stream("video").pix_fmt // "unknown")",
  "field_order: \(stream("video").field_order // "unknown")",
  "r_frame_rate: \(stream("video").r_frame_rate // "unknown")",
  "avg_frame_rate: \(stream("video").avg_frame_rate // "unknown")",
  "time_base: \(stream("video").time_base // "unknown")",
  "video_bitrate: \(stream("video").bit_rate // "unknown")",
  "encoder: \(stream("video").tags.encoder // "unknown")",
  "timecode: \(stream("video").tags.timecode // "missing")",
  "",
  "[audio]",
  "codec: \(stream("audio").codec_name // "missing")",
  "tag: \(stream("audio").codec_tag_string // "missing")",
  "sample_rate: \(stream("audio").sample_rate // "missing")",
  "channels: \((stream("audio").channels // "missing")|tostring)",
  "bits_per_sample: \((stream("audio").bits_per_sample // "missing")|tostring)",
  "audio_bitrate: \(stream("audio").bit_rate // "unknown")",
  "",
  "[timecode stream]",
  "tmcd_streams: \([.streams[] | select(.codec_tag_string == "tmcd")] | length)"
' "$JSON_OUT" > "$SUMMARY_OUT"

echo "JSON: $JSON_OUT"
echo "Resumen: $SUMMARY_OUT"
