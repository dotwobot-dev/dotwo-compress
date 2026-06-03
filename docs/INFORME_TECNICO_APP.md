# Informe tecnico de DoTwo Compress

Fecha: 2026-06-02

Version analizada: `0.1.6`

## Resumen

DoTwo Compress es una app local Electron para preparar videos de alumnos en dos perfiles:

- K2 Grass Valley: MOV XDCAM EX 1080i50, MPEG-2 `xdvc`, audio PCM 48 kHz estereo y timecode `tmcd`.
- H.264 MOV: 1080p progresivo, H.264 `avc1`, AAC 48 kHz estereo y bitrate controlado.

La app evita procesar directamente desde pendrives o discos lentos. Primero copia el original a almacenamiento local de la app, genera un proxy ligero para revision, permite marcar IN/OUT y procesa desde el temporal local.

## Arquitectura general

```text
Electron main process
  electron/main.cjs
  - ventanas y dialogos nativos
  - sesiones, cola y montaje
  - temporales en Application Support
  - llamadas a scripts y binarios FFmpeg
  - validacion con ffprobe

Electron preload
  electron/preload.cjs
  - puente seguro IPC entre UI y main process

UI web
  public/index.html
  public/styles.css
  public/app.js
  public/assets/brand/*
  - seleccion de archivos
  - cola de clips
  - player de proxy
  - marcas IN/OUT
  - inspector tecnico
  - progreso y log tecnico

Scripts
  scripts/*.sh
  - conversion K2
  - conversion H.264
  - proxy de revision
  - analisis y validacion

Binarios
  vendor/ffmpeg/*
  - ffmpeg y ffprobe x64
  - ffmpeg y ffprobe arm64
```

## Electron

Electron se usa como contenedor de aplicacion de escritorio. Aporta:

- ventana nativa macOS;
- dialogos de abrir/guardar archivo;
- acceso al sistema de ficheros desde el proceso principal;
- empaquetado `.app`;
- comunicacion segura entre UI y proceso principal mediante IPC;
- `app.getPath("userData")` para datos internos de usuario.

La UI no accede directamente a Node ni al sistema de archivos. La pagina web habla con `electron/preload.cjs`, y el preload expone funciones concretas mediante `contextBridge`.

## Flujo de procesamiento

1. El usuario anade uno o varios videos.
2. `electron/main.cjs` crea una sesion por clip.
3. El original se copia a:

```text
~/Library/Application Support/dotwo-compress/staging/<session-id>/ORIGINAL.ext
```

4. `ffprobe` analiza la copia local.
5. Se crea `REVIEW_PROXY.mp4` con `scripts/create_review_proxy.sh`.
6. La UI reproduce el proxy y permite marcar IN/OUT.
7. Al procesar K2 o H.264, Electron llama al script correspondiente.
8. La salida procesada queda primero en el temporal de la app.
9. `ffprobe` valida la salida.
10. El usuario pulsa guardar y la app copia el MOV final a la ubicacion elegida.

## Temporales

Ruta interna:

```text
~/Library/Application Support/dotwo-compress/staging
```

Politica actual:

- limpiar al arrancar;
- limpiar al cerrar;
- limpiar al iniciar nueva sesion;
- limpiar al limpiar cola;
- terminar procesos hijos antes de borrar al salir;
- bloquear doble instancia para evitar que una segunda app borre temporales de una primera.

No se eliminan originales ni exportaciones.

## Perfiles de salida

### K2 Grass Valley

Script:

```text
scripts/transcode_xdcam_ex_mov.sh
```

Parametros principales:

- contenedor MOV;
- `mpeg2video`;
- tag video `xdvc`;
- 1920x1080;
- 25 fps entrelazado / 50i;
- top field first;
- `yuv420p`;
- 35 Mb/s;
- audio `pcm_s16le`, 48 kHz, 2 canales;
- timecode `00:00:00:00`;
- marca QuickTime `qt  `;
- `movflags +faststart`.

Validacion:

```text
validateOutputWithNode()
```

Acepta audio tag `lpcm` o `sowt` si el audio real es PCM 16-bit little-endian, 48 kHz, estereo. La prueba real con Grass Valley ha sido positiva.

### H.264 MOV

Script:

```text
scripts/transcode_h264_mov.sh
```

Parametros principales:

- contenedor MOV;
- H.264 `libx264`;
- tag video `avc1`;
- 1920x1080 progresivo;
- `yuv420p`;
- audio AAC, 48 kHz, estereo, 160 kb/s;
- bitrate de fuente acotado entre 1.5 Mb/s y 8 Mb/s.

## Adaptacion de imagen

Si la fuente no es 1920x1080:

- K2 escala/pad a 1080i;
- H.264 escala/pad a 1080p.

Si la fuente es vertical:

- se escala el video para centrarlo en horizontal;
- se genera fondo con el mismo video ampliado y desenfocado.

## Dependencias npm

Runtime directo de la app:

- Electron empaquetado dentro de la app.
- No hay servidor externo necesario para el modo Electron.

Dependencias declaradas:

```text
electron: ^31.7.7
electron-builder: ^26.8.1
```

Build legacy:

- usa Electron `26.6.10` via comando `pack:mac-legacy`;
- minimo macOS `10.13.0`.

## Binarios incluidos

Los binarios estan en `vendor/ffmpeg/` y se copian a `Contents/Resources/bin` dentro de la app.

Inventario logico:

| Binario | Tamano |
| --- | ---: |
| `vendor/ffmpeg/darwin-x64/ffmpeg` | 80,126,240 bytes |
| `vendor/ffmpeg/darwin-x64/ffprobe` | 79,939,848 bytes |
| `vendor/ffmpeg/darwin-arm64/ffmpeg` | 63,505,584 bytes |
| `vendor/ffmpeg/darwin-arm64/ffprobe` | 63,314,208 bytes |

El detalle de origen, version, minimo macOS y hashes esta en `docs/BINARY_DEPENDENCIES.md`.

## Tamano del ejecutable

Medicion sobre `dist-legacy/mac/DoTwo Compress.app`:

| Parte | Tamano aproximado |
| --- | ---: |
| App legacy completa | 491 MB |
| Electron Framework | 212 MB |
| `Contents/Resources/bin` | 274 MB |
| `Contents/Resources/app.asar` | 3.2 MB |
| `Contents/Resources/icon.icns` | 1.6 MB |
| Scripts empaquetados | 44 KB |
| Config empaquetada | 8 KB |

Builds actuales:

| Variante | App `.app` | ZIP |
| --- | ---: | ---: |
| Legacy 10.13 Intel | 491 MB | 206,550,665 bytes |
| Intel moderno | 512 MB | 214,779,110 bytes |
| Apple Silicon | 504 MB | 208,622,535 bytes |

Nota tecnica: actualmente cada variante incluye binarios FFmpeg x64 y arm64. Eso simplifica empaquetado, pero aumenta `Resources/bin`. Una mejora futura seria copiar solo la arquitectura necesaria en cada build.

## Tamano de UI web y assets

| Parte | Tamano |
| --- | ---: |
| `public/` completo | 3.2 MB |
| `public/app.js` | 25,294 bytes |
| `public/styles.css` | 10,238 bytes |
| `public/index.html` | 4,680 bytes |
| `public/assets/brand/dotwo-compress-logo.png` | 1,585,247 bytes |
| `public/assets/brand/dotwo-compress-icon.png` | 1,672,759 bytes |

La UI como codigo es pequena. El peso de `public/` viene casi entero de los assets de marca.

## Tamano de repositorio de trabajo

Medicion local actual:

| Parte | Tamano aproximado |
| --- | ---: |
| Repositorio completo de trabajo | 4.7 GB |
| `node_modules/` | 333 MB |
| `vendor/` | 76 MB |
| `public/` | 3.2 MB |
| `electron/` | 56 KB |
| `scripts/` | 24 KB |
| `docs/` | 56 KB antes de esta consolidacion |
| `dist-legacy/` | 682 MB |
| `dist-intel/` | 710 MB |
| `dist-arm64/` | 1.2 GB |
| `RELEASE_BETA_0_1_6/` | 624 MB |

Para Git, `node_modules/` y `dist-*` estan ignorados. `vendor/ffmpeg/` debe conservarse si se quiere que la app sea autocontenida.

## Firma y distribucion

Estado actual:

```json
"identity": null
```

La app se empaqueta sin firma Developer ID y sin notarizacion. En las pruebas actuales ha abierto sin pedir permisos manuales, pero para despliegue amplio conviene revisar:

- certificado Apple Developer ID Application;
- `electron-builder` con identidad real;
- notarizacion Apple;
- posible DMG o PKG;
- verificacion de que FFmpeg/FFprobe internos quedan firmados o aceptados;
- pruebas en macOS 10.13, Intel moderno y Apple Silicon tras firmar.

## Riesgos tecnicos pendientes

- La validacion final sigue necesitando prueba real en Grass Valley para formatos raros.
- Apple Silicon usa FFmpeg/FFprobe arm64 con minimo macOS 12.
- La build legacy depende de Electron 26.6.10 para macOS 10.13.
- Los bundles incluyen binarios de ambas arquitecturas y se pueden optimizar.
- Falta flujo formal de firma/notarizacion.
- Falta automatizar pruebas de conversion con fixtures pequenos.
