# Estado del proyecto DoTwo Compress

Fecha: 2026-06-02

Nombre de producto: **DoTwo Compress**.

La app mantiene el perfil tecnico K2/XDCAM como salida broadcast principal y añade H.264 como salida de normalizacion. La identidad visual sigue la linea de DoTwo Teleprompter, con icono D2C, gorra azul y barra verde.

## Beta operativa 0.1.6

Estado: beta operativa en pruebas de campo. Codificacion K2 y exportacion confirmadas en macOS 10.13, con ingesta positiva en Grass Valley.

Hotfix `0.1.6`:

- Limpieza reforzada de temporales en `~/Library/Application Support/dotwo-compress/staging`.
- Limpia al abrir, cerrar, iniciar nueva sesion y limpiar cola.
- Termina procesos hijos antes de borrar temporales al salir.
- Bloquea doble instancia para evitar conflictos de temporales.

Hotfix `0.1.5`:

- Corrige incompatibilidad de Bash 3.2 en macOS 10.13.
- Causa: expansion de array vacio `TRIM_INPUT_ARGS[@]` con `set -u`.
- Impacto: el script K2 podia abortar antes de lanzar FFmpeg.

Hotfix `0.1.4`:

- Anade diagnostico visible de version, script, entrada local, salida prevista y MOV detectados.
- Hace visible el log de conversion tambien cuando el estado final es `Error`.

Hotfix `0.1.3`:

- Endurece la deteccion de salida tras procesar K2.
- Busca la salida prevista y, si hace falta, recupera el MOV generado en el temporal.

Hotfix `0.1.2`:

- Corrige `ERROR: No se pudo localizar la salida generada` tras procesar K2.
- Causa: Electron dependia de parsear `OK:` en el log para ubicar la salida, aunque ya conocia la ruta final prevista.
- Cambio: si `plannedOutput` existe en disco, se usa directamente como salida generada.

Hotfix `0.1.1`:

- Corrige `ReferenceError: stagedPath is not defined` al cargar archivo.
- Causa: `prepareSession` usaba una variable local inexistente en vez de `session.stagedPath`.
- Impacto: afectaba a `Añadir archivo` y carga en cola antes de copiar a temporal local.

Alcance cerrado en esta beta:

- conversion K2/XDCAM EX 1080i50 MOV;
- conversion H.264 MOV 1080p compatible;
- copia previa a temporal local antes de procesar;
- proxy ligero para revision;
- inspector tecnico con avisos pedagogicos;
- cola multiarchivo;
- ordenacion y eliminacion de clips;
- marcas `IN`/`OUT` por clip;
- montaje final multiarchivo;
- log tecnico plegado por defecto;
- marca DoTwo Compress, logo en interfaz e icono macOS oscuro.

Paquetes de entrega:

```text
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Apple_Silicon.zip
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Intel_moderno.zip
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
```

Decision provisional de distribucion: las betas de campo se mantienen como ZIP sin firmar hasta recibir respuesta del servicio de informatica de la Universidad de Malaga sobre cuenta Apple Developer institucional, Developer ID y posible exencion educativa. El objetivo de instalacion para laboratorios sigue siendo PKG firmado y notarizado cuando el flujo institucional este resuelto.

## Resultado de pruebas

Las pruebas reales en servidor Grass Valley K2 han sido positivas:

- Los videos convertidos han sido aceptados por el K2.
- La app legacy empaquetada ha abierto y funcionado en macOS 10.13.
- La build legacy 0.1.6 ha quedado funcionando tras los hotfixes de carga, salida K2, Bash 3.2 y limpieza de temporales.

## Perfil validado

Formato operativo elegido:

- Contenedor: QuickTime MOV.
- Video: MPEG-2 / XDCAM EX 1080i50.
- FourCC/tag video: `xdvc`.
- Resolucion: 1920x1080.
- Cadencia: 25 fps entrelazado / 50i.
- Campo: top field first.
- Pixel format: `yuv420p`.
- Audio: PCM signed 16-bit little-endian, 48 kHz, estereo.
- Timecode: pista `tmcd`, inicio `00:00:00:00`.
- Nombre de salida: ASCII, mayusculas, guiones bajos, sufijo `_VALIDADO.mov`.

## Perfil H.264

Perfil añadido para normalizar entregas que no van al K2:

- Contenedor: QuickTime MOV.
- Video: H.264 `avc1`, 1920x1080 progresivo, `yuv420p`.
- Audio: AAC, 48 kHz, estereo.
- Bitrate: respeta la fuente con limite superior de 8 Mb/s.
- Nombre de salida: sufijo `_H264.mov`.

## Audio PCM QuickTime

FFmpeg puede escribir la etiqueta QuickTime del PCM como `sowt`, mientras Compressor la escribe como `lpcm`. En las pruebas con Grass Valley K2, los archivos convertidos fueron aceptados. La validacion considera validos ambos tags cuando el audio es PCM signed 16-bit little-endian, 48 kHz, estereo.

## App legacy probada

Build actual:

```text
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
```

Propiedades:

- Electron legacy: `26.6.10`.
- Arquitectura: `x86_64`.
- Minimo macOS: `10.13.0`.
- FFmpeg/FFprobe incluidos: `8.1.1-tessus`, `x86_64`, minimo `10.13`.

## Dependencias recopiladas

Binarios incluidos en el repositorio:

- `vendor/ffmpeg/darwin-x64/ffmpeg`
- `vendor/ffmpeg/darwin-x64/ffprobe`
- `vendor/ffmpeg/darwin-arm64/ffmpeg`
- `vendor/ffmpeg/darwin-arm64/ffprobe`

El detalle de fuentes, versiones, minimos de macOS y hashes SHA256 queda en:

```text
docs/BINARY_DEPENDENCIES.md
vendor/ffmpeg/README.md
```

La variante Apple Silicon queda preparada con FFmpeg/FFprobe arm64, aunque esos binarios requieren macOS 12.0 o superior.

## Cambio de flujo de entrada

La app Electron ya no procesa directamente desde la ruta original. El flujo actual es:

- seleccionar archivo;
- copiar a temporal local de la app con progreso;
- comprobar la copia local con `ffprobe`;
- crear un proxy MP4 ligero para revision en la propia app;
- mostrar un inspector con semaforo, datos tecnicos y avisos pedagogicos;
- permitir marcar `IN` y `OUT` en el player para recortar colas;
- permitir cargar varios clips, seleccionarlos, ordenarlos, quitarlos y procesarlos como una unica salida;
- habilitar `Procesar K2` y `Procesar H.264`;
- convertir desde temporal local hacia salida temporal local con barra de progreso;
- habilitar `Guardar procesado`.

Esto evita que una lectura lenta o inestable desde pendrive, red o soporte externo afecte directamente a la conversion.

El log tecnico de terminal queda plegado por defecto para no distraer a alumnos; se puede desplegar desde la interfaz cuando haga falta diagnostico.

Si el archivo cargado no es 1920x1080, la app avisa de que se escalara a 1080i en K2 y a 1080p en H.264. Los videos verticales se adaptan a horizontal centrando la imagen y usando una copia ampliada/desenfocada como fondo.

El inspector avisa tambien de FPS fuera del entorno PAL 25/50, posible frame rate variable, codecs que pueden ralentizar conversion, fuentes sin comprimir o muy pesadas, bitrates altos, archivos grandes y audio ausente o fuera de 48 kHz/estereo.

El roadmap de cola multiarchivo y montaje minimo queda documentado en `docs/ROADMAP_EDICION_BASICA.md`.

En montajes multiarchivo, H.264 concatena segmentos normalizados por copia. K2 re-encodea la salida final desde segmentos ya normalizados para preservar validacion `xdvc`, `25/1`, orden audio/video y pista `tmcd`.

## Documentos de continuidad

Para retomar el proyecto desde otra maquina:

```text
docs/RETOMAR_PROYECTO.md
docs/INFORME_TECNICO_APP.md
docs/HOJA_DE_RUTA.md
docs/MANIFIESTO_BETA_0_1_6.md
```

## Pendiente

- Seguir probando en campo la ingesta K2 con lotes y formatos variados.
- Medir tiempos de copia local, proxy y procesado en equipos de laboratorio.
- Validar Apple Silicon, Intel moderna e Intel legacy con usuarios reales.
- Esperar respuesta de informatica UMA sobre Apple Developer Program institucional.
- Mejorar instalacion para laboratorios: firma/notarizacion, DMG/PKG y diagnostico inicial.
