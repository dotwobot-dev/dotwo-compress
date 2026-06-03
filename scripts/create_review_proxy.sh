#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

FFMPEG="${FFMPEG_BIN:-ffmpeg}"
FFPROBE="${FFPROBE_BIN:-ffprobe}"
require_cmd "$FFMPEG"
require_cmd "$FFPROBE"

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 ENTRADA SALIDA.mp4" >&2
  exit 2
fi

IN="$1"
OUT="$2"
[[ -f "$IN" ]] || die "No existe el archivo: $IN"

OUT_DIR="$(dirname "$OUT")"
mkdir -p "$OUT_DIR"

TMP_OUT="$OUT_DIR/.tmp.$(basename "${OUT%.*}").$$.mp4"
HAS_AUDIO="$("$FFPROBE" -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 "$IN" | head -1 || true)"
VIDEO_SIZE="$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$IN" | head -1 || true)"
SRC_WIDTH="${VIDEO_SIZE%x*}"
SRC_HEIGHT="${VIDEO_SIZE#*x}"
IS_VERTICAL=0

if [[ "$SRC_WIDTH" =~ ^[0-9]+$ && "$SRC_HEIGHT" =~ ^[0-9]+$ && "$SRC_HEIGHT" -gt "$SRC_WIDTH" ]]; then
  IS_VERTICAL=1
fi

make_filter() {
  local src="$1"

  if [[ "$IS_VERTICAL" -eq 1 ]]; then
    printf '[%s]split=2[bgsrc][fgsrc];[bgsrc]scale=1280:720:force_original_aspect_ratio=increase:flags=fast_bilinear,crop=1280:720,gblur=sigma=18:steps=1[bg];[fgsrc]scale=1280:720:force_original_aspect_ratio=decrease:flags=fast_bilinear[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]' "$src"
  else
    printf '[%s]scale=1280:720:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v]' "$src"
  fi
}

VIDEO_ARGS=(
  -c:v libx264
  -preset ultrafast
  -profile:v baseline
  -level:v 3.1
  -pix_fmt yuv420p
  -b:v 1200k
  -maxrate 1600k
  -bufsize 2400k
)

AUDIO_ARGS=(
  -c:a aac
  -b:a 96k
  -ar 48000
  -ac 2
)

cleanup() {
  rm -f "$TMP_OUT"
}
trap cleanup EXIT

echo "Entrada: $IN"
echo "Proxy temporal: $TMP_OUT"
echo "Proxy final: $OUT"
if [[ "$IS_VERTICAL" -eq 1 ]]; then
  echo "Aviso: proxy horizontal con video vertical centrado sobre fondo desenfocado."
fi

if [[ -n "$HAS_AUDIO" ]]; then
  VF="$(make_filter "0:v:0")"
  "$FFMPEG" -y -hide_banner \
    -i "$IN" \
    -filter_complex "$VF" \
    -map "[v]" \
    -map 0:a:0 \
    "${VIDEO_ARGS[@]}" \
    "${AUDIO_ARGS[@]}" \
    -map_metadata -1 \
    -movflags +faststart \
    -f mp4 \
    "$TMP_OUT"
else
  VF="$(make_filter "1:v:0")"
  "$FFMPEG" -y -hide_banner \
    -f lavfi -i anullsrc=r=48000:cl=stereo \
    -i "$IN" \
    -filter_complex "$VF" \
    -map "[v]" \
    -map 0:a:0 \
    -shortest \
    "${VIDEO_ARGS[@]}" \
    "${AUDIO_ARGS[@]}" \
    -map_metadata -1 \
    -movflags +faststart \
    -f mp4 \
    "$TMP_OUT"
fi

mv "$TMP_OUT" "$OUT"
trap - EXIT

echo "OK: $OUT"
