#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

FFMPEG="${FFMPEG_BIN:-ffmpeg}"
FFPROBE="${FFPROBE_BIN:-ffprobe}"
require_cmd "$FFMPEG"
require_cmd "$FFPROBE"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Uso: $0 ENTRADA [SALIDA.mov]" >&2
  echo "Si no se indica SALIDA, crea NOMBRE_VALIDADO.mov en la misma carpeta." >&2
  exit 2
fi

IN="$1"
[[ -f "$IN" ]] || die "No existe el archivo: $IN"

if [[ $# -eq 2 ]]; then
  OUT="$2"
else
  OUT="$(default_validated_output "$IN")"
fi

OUT_DIR="$(dirname "$OUT")"
mkdir -p "$OUT_DIR"

TMP_OUT="$OUT_DIR/.tmp.$(basename "${OUT%.mov}").$$.mov"
TIMECODE_START="${TIMECODE_START:-00:00:00:00}"
PAD_OR_CROP="${PAD_OR_CROP:-pad}"
K2_TRIM_START="${K2_TRIM_START:-}"
K2_TRIM_DURATION="${K2_TRIM_DURATION:-}"

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
    printf '[%s]split=2[bgsrc][fgsrc];[bgsrc]scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,gblur=sigma=28:steps=2[bg];[fgsrc]scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=50,interlace=scan=tff,format=yuv420p,setfield=tff[v]' "$src"
    return
  fi

  if [[ "$PAD_OR_CROP" == "crop" ]]; then
    printf '[%s]scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,fps=50,interlace=scan=tff,format=yuv420p,setfield=tff[v]' "$src"
  else
    printf '[%s]scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=50,interlace=scan=tff,format=yuv420p,setfield=tff[v]' "$src"
  fi
}

ffmpeg_with_video_input() {
  local before=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    before+=("$1")
    shift
  done
  [[ $# -gt 0 ]] || die "Falta separador interno de argumentos FFmpeg"
  shift

  if [[ -n "$K2_TRIM_START" && -n "$K2_TRIM_DURATION" ]]; then
    "$FFMPEG" "${before[@]}" -ss "$K2_TRIM_START" -t "$K2_TRIM_DURATION" -i "$IN" "$@"
  elif [[ -n "$K2_TRIM_START" ]]; then
    "$FFMPEG" "${before[@]}" -ss "$K2_TRIM_START" -i "$IN" "$@"
  elif [[ -n "$K2_TRIM_DURATION" ]]; then
    "$FFMPEG" "${before[@]}" -t "$K2_TRIM_DURATION" -i "$IN" "$@"
  else
    "$FFMPEG" "${before[@]}" -i "$IN" "$@"
  fi
}

COMMON_VIDEO=(
  -c:v mpeg2video
  -pix_fmt yuv420p
  -b:v 35M
  -maxrate:v 35M
  -bufsize:v 16M
  -g 12
  -bf 2
  -flags +ildct+ilme
  -top 1
  -alternate_scan 1
  -dc 10
  -color_primaries bt709
  -color_trc bt709
  -colorspace bt709
  -tag:v xdvc
  -metadata:s:v:0 encoder="XDCAM EX 1080i50 (35 Mbps)"
  -metadata:s:v:0 handler_name="Core Media Video"
)

COMMON_AUDIO=(
  -c:a pcm_s16le
  -ar 48000
  -ac 2
  -tag:a lpcm
  -metadata:s:a:0 handler_name="Core Media Audio"
)

cleanup() {
  rm -f "$TMP_OUT"
}
trap cleanup EXIT

echo "Entrada: $IN"
echo "Salida temporal: $TMP_OUT"
echo "Salida final: $OUT"
if [[ -n "$K2_TRIM_START" || -n "$K2_TRIM_DURATION" ]]; then
  echo "Recorte: inicio ${K2_TRIM_START:-0}s, duracion ${K2_TRIM_DURATION:-hasta el final}s"
fi
if [[ "$IS_VERTICAL" -eq 1 ]]; then
  echo "Aviso: video vertical detectado (${SRC_WIDTH}x${SRC_HEIGHT}); se centrara sobre fondo ampliado y desenfocado."
fi

if [[ -n "$HAS_AUDIO" ]]; then
  VF="$(make_filter "0:v:0")"
  ffmpeg_with_video_input -y -hide_banner -- \
    -filter_complex "$VF" \
    -map 0:a:0 \
    -map "[v]" \
    "${COMMON_AUDIO[@]}" \
    "${COMMON_VIDEO[@]}" \
    -map_metadata -1 \
    -timecode "$TIMECODE_START" \
    -write_tmcd on \
    -brand "qt  " \
    -video_track_timescale 25000 \
    -movflags +faststart \
    -f mov \
    "$TMP_OUT"
else
  VF="$(make_filter "1:v:0")"
  ffmpeg_with_video_input -y -hide_banner \
    -f lavfi -i anullsrc=r=48000:cl=stereo -- \
    -filter_complex "$VF" \
    -map 0:a:0 \
    -map "[v]" \
    -shortest \
    "${COMMON_AUDIO[@]}" \
    "${COMMON_VIDEO[@]}" \
    -map_metadata -1 \
    -timecode "$TIMECODE_START" \
    -write_tmcd on \
    -brand "qt  " \
    -video_track_timescale 25000 \
    -movflags +faststart \
    -f mov \
    "$TMP_OUT"
fi

mv "$TMP_OUT" "$OUT"
trap - EXIT

echo "OK: $OUT"
