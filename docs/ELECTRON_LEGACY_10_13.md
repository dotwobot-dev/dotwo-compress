# App Electron legacy para macOS 10.13

Este proyecto puede empaquetarse como `.app` siguiendo el mismo esquema del teleprompter.

## Decisión técnica

Para macOS 10.13 High Sierra no se debe usar Electron moderno. La build legacy usa:

```text
Electron 26.6.10
arquitectura x64
macOS minimo 10.13.0
```

Script:

```bash
npm run pack:mac-legacy
```

Salida esperada:

```text
dist-legacy/mac/DoTwo Compress.app
```

## Dependencias internas

La app no debe depender de Homebrew en los laboratorios. Hay que incluir:

```text
vendor/ffmpeg/darwin-x64/ffmpeg
vendor/ffmpeg/darwin-x64/ffprobe
```

Binarios descargados para esta build:

```text
Fuente: https://evermeet.cx/ffmpeg/
FFmpeg: https://evermeet.cx/ffmpeg/getrelease/zip
FFprobe: https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip
Version: 8.1.1-tessus
Arquitectura: x86_64
Minimo declarado: Mac OS X 10.13
```

Estos binarios deben:

- ser `x86_64`;
- funcionar en macOS 10.13;
- tener permiso de ejecucion;
- incluir soporte para `mpeg2video`, `mov`, `pcm_s16le`, `aac`, `h264`, `hevc` si se van a convertir fuentes variadas.

El FFmpeg instalado en este equipo por Homebrew es `arm64`, por tanto no sirve para la build legacy Intel/macOS 10.13.

Los binarios incluidos en `vendor/ffmpeg/darwin-x64` se han verificado con:

```text
file -> Mach-O 64-bit executable x86_64
otool -> LC_VERSION_MIN_MACOSX version 10.13
ffmpeg -version -> 8.1.1-tessus
ffprobe -version -> 8.1.1-tessus
```

Comprobaciones recomendadas:

```bash
file vendor/ffmpeg/darwin-x64/ffmpeg
otool -l vendor/ffmpeg/darwin-x64/ffmpeg | grep -A3 -E "LC_VERSION_MIN_MACOSX|LC_BUILD_VERSION"
vendor/ffmpeg/darwin-x64/ffmpeg -version
vendor/ffmpeg/darwin-x64/ffprobe -version
```

## Desarrollo

Instalar dependencias:

```bash
npm install
```

Arrancar app Electron:

```bash
npm run electron
```

Validar sintaxis:

```bash
npm run check
```

## Empaquetado

Build moderna para la maquina actual:

```bash
npm run pack
```

Build legacy para macOS 10.13 Intel:

```bash
npm run pack:mac-legacy
```

## Diferencia con la version web local

La app Electron no usa `server.mjs` ni `osascript`.

Usa:

- `dialog.showOpenDialog` para cargar archivo;
- `child_process.spawn` para lanzar `scripts/transcode_xdcam_ex_mov.sh`;
- `ffprobe` + validacion en Node, sin depender de `jq`;
- `process.resourcesPath` para localizar `ffmpeg` y `ffprobe` dentro del `.app`.

`server.mjs` se mantiene solo como modo web/prototipo.

## Riesgos conocidos

- Si el binario FFmpeg se compila para un macOS minimo superior, no arrancara en 10.13.
- Si la app se distribuye sin firmar, Gatekeeper puede bloquearla o mostrar avisos.
- Si se firma/notariza, hay que revisar permisos y que los binarios internos queden incluidos correctamente.
- La build legacy Electron 26 no esta en soporte moderno; debe tratarse como build congelada para equipos antiguos.
