# Matriz de builds

El proyecto se distribuye en tres variantes para la beta `0.1.6`.

## 1. Apple Silicon

Uso:

```bash
npm run zip:mac-arm64
```

Salida:

```text
dist-arm64/DoTwo Compress-0.1.6-arm64-mac.zip
dist-arm64/mac-arm64/DoTwo Compress.app
```

Requisitos:

- Mac Apple Silicon con macOS 12 o superior para los binarios FFmpeg/FFprobe actuales.
- Electron moderno.
- FFmpeg/FFprobe `darwin-arm64` incluidos en:

```text
vendor/ffmpeg/darwin-arm64/ffmpeg
vendor/ffmpeg/darwin-arm64/ffprobe
```

Estado actual:

- Script preparado.
- Binarios `darwin-arm64` integrados como dependencia interna autocontenida.
- Conversion de prueba realizada con `darwin-arm64` y validacion tecnica correcta.
- Si se necesita Apple Silicon en macOS 11, habra que buscar otra build arm64 o compilar FFmpeg/FFprobe con minimo inferior.

## 2. Intel moderna

Uso:

```bash
npm run zip:mac-intel
```

Salida:

```text
dist-intel/DoTwo Compress-0.1.6-mac.zip
dist-intel/mac/DoTwo Compress.app
```

Requisitos:

- Mac Intel moderno.
- Electron moderno.
- FFmpeg/FFprobe `darwin-x64`.

Estado actual:

- Script preparado.
- Binarios `darwin-x64` integrados.
- No es la build recomendada para macOS 10.13.

## 3. Intel legacy macOS 10.13

Uso:

```bash
npm run zip:mac-legacy
```

Salida:

```text
dist-legacy/DoTwo Compress-0.1.6-mac.zip
dist-legacy/mac/DoTwo Compress.app
```

Requisitos:

- Mac Intel con macOS 10.13 High Sierra o superior.
- Electron `26.6.10`.
- FFmpeg/FFprobe `darwin-x64` compilados con minimo `10.13`.

Estado actual:

- Build generada y probada en macOS 10.13.
- Usa los mismos binarios `darwin-x64`, verificados con minimo macOS `10.13`.
- ZIP validado:

```text
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
```

## Reglas de distribucion

- No copiar la `.app` suelta por red o USB si hay problemas de permisos.
- Distribuir como `.zip` creado con `ditto --keepParent`.
- Para laboratorio, priorizar `.pkg` cuando el flujo este cerrado.
- Para instalacion manual fuera de laboratorio, valorar `.dmg`.
- La beta se genera sin firma Developer ID (`mac.identity: null`) y puede mostrar avisos de Gatekeeper.
- Ver dependencias binarias y hashes en `docs/BINARY_DEPENDENCIES.md`.
- Ver plan de firma, notarizacion e instalacion en `docs/DISTRIBUCION_MACOS.md`.

## Checklist de beta

- Abrir la app en el sistema objetivo.
- Cargar un archivo desde disco local.
- Cargar un archivo desde pendrive o soporte externo.
- Confirmar que termina la copia local antes de activar procesado.
- Confirmar que se genera proxy y se reproduce en el player.
- Procesar K2 y validar ingesta en Grass Valley.
- Procesar H.264 y validar reproduccion normal.
- Probar cola con varios clips y recortes `IN`/`OUT`.

## Carpeta de entrega

Los ZIPs de beta se recopilan tambien con nombres claros en:

```text
RELEASE_BETA_0_1_6/
```

Contenido esperado:

```text
DoTwo_Compress_Beta_0.1.6_Apple_Silicon.zip
DoTwo_Compress_Beta_0.1.6_Intel_moderno.zip
DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
README_BETA_0.1.6.md
```
