#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Uso: $0 ruta-a-app-dmg-pkg"
  exit 64
fi

ARTIFACT="$1"

if [ ! -e "$ARTIFACT" ]; then
  echo "ERROR: no existe: $ARTIFACT" >&2
  exit 66
fi

case "$ARTIFACT" in
  *.app)
    echo "== codesign =="
    codesign --verify --deep --strict --verbose=2 "$ARTIFACT"
    echo
    echo "== spctl execute =="
    spctl -a -vv --type execute "$ARTIFACT"
    echo
    echo "== stapler =="
    xcrun stapler validate "$ARTIFACT"
    ;;
  *.pkg)
    echo "== pkgutil =="
    pkgutil --check-signature "$ARTIFACT"
    echo
    echo "== spctl install =="
    spctl -a -vv --type install "$ARTIFACT"
    echo
    echo "== stapler =="
    xcrun stapler validate "$ARTIFACT"
    ;;
  *.dmg)
    echo "== spctl open =="
    spctl -a -vv --type open "$ARTIFACT"
    echo
    echo "== stapler =="
    xcrun stapler validate "$ARTIFACT"
    ;;
  *)
    echo "ERROR: formato no soportado. Usa .app, .pkg o .dmg" >&2
    exit 65
    ;;
esac
