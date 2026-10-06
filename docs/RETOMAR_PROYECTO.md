# Retomar DoTwo Compress

Fecha: 2026-10-06. Version de entrega: 0.1.8.
Repo: /Users/dotwo/Repos/apps/DoTwo_Compress.
App ID: com.dotwo.compress. Build diagnostico: 0.1.8-signed-dmg.

## Estado actual

Apps y DMG firmados, notarizados y con ticket adjunto, en tres variantes.
Developer ID de Domingo Moreno, Team MR7VK26RP8; perfil de Llavero dotwo-notary.
La antigua espera institucional de junio queda resuelta para este flujo
mediante la cuenta personal activa. No exportar claves ni pedir contrasenas.

- Apple Silicon: Electron 43.7.7, macOS 12.0+, flujo funcional local comprobado.
- Intel moderna: Electron 43.7.7, macOS 12.0+, ejecucion de campo pendiente.
- Intel legacy: Electron 26.6.10, macOS 10.13.0+, High Sierra pendiente.

Electron 26 es una variante congelada fuera de soporte. La aceptacion historica
de beta 0.1.6 en Grass Valley no valida automaticamente esta nueva entrega.
El host actual no tiene Rosetta; no se han ejecutado binarios x64.

## Continuidad

Leer PROJECT_STATUS.md, BUILD_MATRIX.md, DISTRIBUCION_MACOS.md y
MANIFIESTO_0_1_8_FIRMADO.md dentro de docs/.
Manual editable y capturas reales: docs/manual/.
Los PDF generados, QA y artefactos quedan fuera de Git.

Entrega NAS:

    /Volumes/BackUP_MacMini/DoTwo_Compress/release_archive/DoTwo_Compress_0.1.8_signed_20261006/

Backups limpios de codigo y Git:

    /Volumes/BackUP_MacMini/DoTwo_Compress/repo_backups/

## Desarrollo y firma

    npm ci
    npm run check
    npm test
    npm run check:mac-signing
    npm run build:dmg-background
    npm run release:mac:signed -- --all --prepare-only

Se pueden probar apps firmadas antes de enviarlas. Para completar/reanudar:

    npm run release:mac:signed -- --resume /ruta/al/candidato/variante

Conservar manifest.json y sus IDs. No repetir subidas con resultado desconocido,
ni editar una app enviada ni cambiar protecciones de macOS.
La firma del codigo interno precede al bundle exterior. Los FFmpeg originales
se mantienen intactos; hashes en BINARY_DEPENDENCIES.md.

Las pruebas usan --user-data-dir con ruta absoluta separada. Los temporales
viven en staging bajo ese perfil y se limpian al abrir, limpiar cola y cerrar.
La instalacion de trabajo no se sustituye para probar.

## Limites y perfiles

Valores iniciales: 25 GiB por archivo, 60 GiB por cola y 5 GiB libres despues
de copiar/guardar. Ajustables con DOTWO_MAX_INPUT_GB, DOTWO_MAX_QUEUE_GB y
DOTWO_MIN_FREE_GB para pruebas. No cubren todo el pico de espacio de conversion;
dejar margen para proxy, segmentos y salida.

K2 sigue siendo MOV XDCAM EX 1080i50, MPEG-2 xdvc, audio PCM 48 kHz estereo,
timecode y nombres ASCII. H.264 normaliza a MOV 1080p con AAC.
Preservar Bash 3.2 para los scripts legacy.

## Git

Codigo, docs, assets y lockfile se versionan. FFmpeg/FFprobe se preparan
localmente; no se incluyen en Git publico. Builds, PDF generado, dependencias,
logs, .DS_Store y credenciales quedan fuera.
La fuente 0.1.8 se sincronizo con GitHub `main` el 2026-10-06 tras autorizacion
de Do. No hay tags ni GitHub Releases. Ningun nuevo push, build, firma,
notarizacion o publicacion se deduce de esa autorizacion: presentar el siguiente
paso concreto y validarlo con Do. Los DMG actuales tienen `sourceDirty: true`;
consultar `docs/PROJECT_STATUS.md` y `docs/DISTRIBUCION_MACOS.md`.
El siguiente candidato de 0.1.8 exige app, DMG y PKG por variante; el PKG
instala en `/Applications` y se firma con Developer ID Installer. La carpeta
NAS anterior no contiene PKG y permanece como entrega historica separada.
