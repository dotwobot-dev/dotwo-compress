# Guia de repositorio

Esta carpeta es la base de repositorio de la app DoTwo Compress.

Git esta inicializado en esta carpeta. Aun no hay commit inicial; conviene hacerlo cuando cerremos la primera tanda de cambios de producto.

Version consolidada actual: `0.1.6`.

Punto de entrada recomendado para retomar el proyecto:

```text
docs/RETOMAR_PROYECTO.md
docs/ADMINISTRACION_REPO.md
docs/DISTRIBUCION_MACOS.md
```

## Incluido en el repositorio

- `electron/`: proceso principal y preload de Electron.
- `public/`: interfaz HTML/CSS/JS.
- `build/brand/`: icono y logo de producto.
- `scripts/`: scripts de conversion K2/H.264, analisis y validacion.
- `config/`: perfil objetivo del formato Grass Valley K2.
- `vendor/ffmpeg/`: binarios internos FFmpeg/FFprobe por arquitectura.
- `docs/`: documentacion tecnica y de build.
- `tests/`: matriz de pruebas reales.

## No recomendado en repositorio

- `dist/`, `dist-intel/`, `dist-arm64/`, `dist-legacy/`.
- `RELEASE_BETA_*/`.
- `artifacts/`.
- `logs/`.
- `reports/` generados.
- `node_modules/`.
- `.DS_Store`.

## Dependencias

Dependencias npm declaradas en `package.json`:

- `electron`
- `electron-builder`

Dependencias binarias incluidas:

- `vendor/ffmpeg/darwin-x64/ffmpeg`
- `vendor/ffmpeg/darwin-x64/ffprobe`
- `vendor/ffmpeg/darwin-arm64/ffmpeg`
- `vendor/ffmpeg/darwin-arm64/ffprobe`

El detalle de origen, version, minimo de macOS y hashes SHA256 esta en:

```text
docs/BINARY_DEPENDENCIES.md
vendor/ffmpeg/README.md
```

Dependencias npm bloqueadas:

- `package-lock.json`

## Validacion basica

```bash
npm run check
```

## Flujo Electron actual

El proceso principal gestiona una sesion activa:

- `file:prepare`: copia el original a temporal local, lanza `ffprobe`, construye el inspector y crea un proxy MP4 ligero.
- `job:start`: procesa desde el temporal local si la sesion esta lista, recibe perfil `k2` o `h264`, recibe opcionalmente marcas `IN`/`OUT`, y actualiza progreso a partir de la salida de FFmpeg.
- `queue:add`: añade uno o varios clips a la cola y prepara cada temporal.
- `queue:start`: procesa todos los clips listos, aplicando IN/OUT por clip, generando segmentos normalizados y creando una unica salida final.
- `file:save-output`: guarda la salida procesada en la ruta elegida por el usuario.

Los temporales se guardan en la carpeta `userData` de Electron:

```text
~/Library/Application Support/dotwo-compress/staging
```

Desde la beta `0.1.6` se limpian al arrancar, cerrar, iniciar nueva sesion y limpiar cola.

La interfaz mantiene el log tecnico plegado por defecto; el panel se abre con `Ver log`.

Scripts principales:

- `scripts/transcode_xdcam_ex_mov.sh`: MOV XDCAM EX 1080i50 para Grass Valley K2.
- `scripts/transcode_h264_mov.sh`: MOV H.264 1080p ligero/compatible.
- `scripts/create_review_proxy.sh`: MP4 H.264/AAC ligero para previsualizacion e inspector.

Los scripts de salida aceptan recorte opcional mediante variables de entorno:

```bash
K2_TRIM_START=3.5 K2_TRIM_DURATION=20 scripts/transcode_xdcam_ex_mov.sh entrada.mov salida.mov
```

El montaje multiarchivo reutiliza esos scripts para crear segmentos temporales. Despues:

- H.264 concatena por copia con FFmpeg.
- K2 re-encodea el montaje final desde los segmentos para mantener validacion estricta Grass Valley.

## Build legacy confirmada

```bash
npm run pack:mac-legacy
```

Entrega validada:

```text
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
```

## Empaquetar ZIP manualmente

```bash
ditto -c -k --keepParent "dist-legacy/mac/DoTwo Compress.app" "DoTwo Compress Legacy macOS 10.13 Intel.zip"
```

## Cierre de beta

Antes de generar paquetes:

```bash
npm run check
npm run zip:mac-arm64
npm run zip:mac-intel
npm run zip:mac-legacy
```

Entregar los `.zip` resultantes de `dist-arm64`, `dist-intel` y `dist-legacy`. Para mover por USB o red, preferir siempre ZIP antes que copiar la `.app` suelta.

La release consolidada actual esta documentada en:

```text
docs/MANIFIESTO_BETA_0_1_6.md
```
