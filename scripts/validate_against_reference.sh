#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd jq

FFPROBE="${FFPROBE_BIN:-ffprobe}"
require_cmd "$FFPROBE"

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 ARCHIVO.mov" >&2
  exit 2
fi

INPUT="$1"
[[ -f "$INPUT" ]] || die "No existe el archivo: $INPUT"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

"$FFPROBE" -v error -show_format -show_streams -print_format json "$INPUT" > "$TMP"

failures=0
warnings=0

check_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "OK   $label = $actual"
  else
    echo "FAIL $label = $actual, esperado $expected"
    failures=$((failures + 1))
  fi
}

check_warn_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "OK   $label = $actual"
  else
    echo "WARN $label = $actual, referencia $expected"
    warnings=$((warnings + 1))
  fi
}

check_audio_tag() {
  local actual="$1"
  if [[ "$actual" == "lpcm" || "$actual" == "sowt" ]]; then
    echo "OK   audio.tag = $actual"
  else
    echo "FAIL audio.tag = $actual, esperado lpcm o sowt"
    failures=$((failures + 1))
  fi
}

json_get='
  def video: (.streams[] | select(.codec_type == "video")) // {};
  def audio: (.streams[] | select(.codec_type == "audio")) // {};
  {
    major_brand: (.format.tags.major_brand // ""),
    video_codec: (video.codec_name // ""),
    video_tag: (video.codec_tag_string // ""),
    video_profile: (video.profile // ""),
    width: (video.width // 0),
    height: (video.height // 0),
    pix_fmt: (video.pix_fmt // ""),
    field_order: (video.field_order // ""),
    r_frame_rate: (video.r_frame_rate // ""),
    avg_frame_rate: (video.avg_frame_rate // ""),
    video_timecode: (video.tags.timecode // ""),
    audio_codec: (audio.codec_name // ""),
    audio_tag: (audio.codec_tag_string // ""),
    audio_sample_rate: (audio.sample_rate // ""),
    audio_channels: (audio.channels // 0),
    audio_bits: (audio.bits_per_sample // 0),
    tmcd_count: ([.streams[] | select(.codec_tag_string == "tmcd")] | length),
    first_stream_type: (.streams[0].codec_type // ""),
    second_stream_type: (.streams[1].codec_type // "")
  }
'

DATA="$(jq -r "$json_get" "$TMP")"

get_field() {
  jq -r ".$1" <<< "$DATA"
}

echo "Validando: $INPUT"
echo

check_eq "major_brand" "$(get_field major_brand)" "qt  "
check_eq "stream_0" "$(get_field first_stream_type)" "audio"
check_eq "stream_1" "$(get_field second_stream_type)" "video"
check_eq "video.codec" "$(get_field video_codec)" "mpeg2video"
check_eq "video.tag" "$(get_field video_tag)" "xdvc"
check_eq "video.width" "$(get_field width)" "1920"
check_eq "video.height" "$(get_field height)" "1080"
check_eq "video.pix_fmt" "$(get_field pix_fmt)" "yuv420p"
check_eq "video.r_frame_rate" "$(get_field r_frame_rate)" "25/1"
check_eq "video.avg_frame_rate" "$(get_field avg_frame_rate)" "25/1"
check_warn_eq "video.field_order" "$(get_field field_order)" "tb"
check_eq "audio.codec" "$(get_field audio_codec)" "pcm_s16le"
check_audio_tag "$(get_field audio_tag)"
check_eq "audio.sample_rate" "$(get_field audio_sample_rate)" "48000"
check_eq "audio.channels" "$(get_field audio_channels)" "2"
check_eq "audio.bits_per_sample" "$(get_field audio_bits)" "16"
check_eq "timecode.tmcd_count" "$(get_field tmcd_count)" "1"
check_warn_eq "video.timecode" "$(get_field video_timecode)" "00:00:00:00"

echo
if [[ "$failures" -gt 0 ]]; then
  echo "RESULTADO: FAIL ($failures fallo(s), $warnings aviso(s))"
  exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
  echo "RESULTADO: WARN ($warnings aviso(s))"
  exit 0
fi

echo "RESULTADO: OK"
