#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ $# -lt 1 || $# -gt 3 ]]; then
  echo "Uso: $0 ENTRADA [SETTING.compressorsetting] [DIRECTORIO_SALIDA]" >&2
  exit 2
fi

IN="$1"
SETTING="${2:-/Users/dotwo/Desktop/VIDEO K2.app/Settings/VIDEO Para K2.compressorsetting}"
DEST="${3:-$(dirname "$IN")}"
COMPRESSOR="/Applications/Compressor.app/Contents/MacOS/Compressor"

[[ -f "$IN" ]] || die "No existe el archivo: $IN"
[[ -f "$SETTING" ]] || die "No existe el preset: $SETTING"
[[ -x "$COMPRESSOR" ]] || die "No encuentro Compressor ejecutable en: $COMPRESSOR"

echo "Fallback Compressor"
echo "Entrada: $IN"
echo "Preset: $SETTING"
echo "Destino: $DEST"
echo
echo "Nota: si esta sintaxis cambia con la version local de Compressor, ejecutar:"
echo "$COMPRESSOR -help"
echo

"$COMPRESSOR" \
  -jobpath "$IN" \
  -settingpath "$SETTING" \
  -locationpath "$DEST"
