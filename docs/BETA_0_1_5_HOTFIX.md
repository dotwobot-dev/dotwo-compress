# Beta 0.1.5 - compatibilidad Bash macOS 10.13

Fecha: 2026-06-02

## Motivo

En macOS 10.13 la conversion K2 abortaba antes de lanzar FFmpeg con:

```text
TRIM_INPUT_ARGS[@]: unbound variable
```

El fallo venia de una expansion de array vacio con `set -u` en Bash 3.2, la version incluida en macOS 10.13.

## Cambio

- Se elimina el array vacio `TRIM_INPUT_ARGS`.
- Se sustituye por una funcion que inserta `-ss` y `-t` solo cuando hay marcas IN/OUT.
- El arreglo se aplica a:
  - `scripts/transcode_xdcam_ex_mov.sh`
  - `scripts/transcode_h264_mov.sh`
- La build visible en log pasa a `0.1.5-bash-3-trim-fix`.

## Verificacion local

- `npm run check`
- `bash -n` en ambos scripts de conversion
- Prueba sintetica con `FFMPEG_BIN=/usr/bin/true` y `FFPROBE_BIN=/usr/bin/true` para confirmar que el script ya no aborta por `unbound variable`.

La prueba sintetica termina en `mv` porque no se genera un video real, pero eso confirma que la invocacion de FFmpeg ya se alcanza.
