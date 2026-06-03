# DoTwo Compress beta 0.1.0

Fecha de cierre: 2026-06-02

## Objetivo

Primera beta operativa para pruebas de campo en laboratorio y servidor Grass Valley K2.

## Variantes a probar

- Apple Silicon: `dist-arm64`
- Intel moderna: `dist-intel`
- Intel legacy macOS 10.13: `dist-legacy`

## Paquetes generados

```text
RELEASE_BETA_0_1/DoTwo_Compress_Beta_0.1.0_Apple_Silicon.zip
RELEASE_BETA_0_1/DoTwo_Compress_Beta_0.1.0_Intel_moderno.zip
RELEASE_BETA_0_1/DoTwo_Compress_Beta_0.1.0_Legacy_10.13_Intel.zip
```

Verificacion local:

- `npm run check`: OK.
- `zip -T` en los tres paquetes: OK.
- Apple Silicon: app `arm64`, minimo macOS `10.15.0`.
- Intel moderna: app `x86_64`, minimo macOS `10.15.0`.
- Legacy: app `x86_64`, minimo macOS `10.13.0`.
- FFmpeg incluido: `darwin-arm64` en Apple Silicon, `darwin-x64` en Intel moderna y legacy.

## Pruebas recomendadas

1. Abrir la app desde el ZIP descomprimido.
2. Cargar un archivo desde disco local.
3. Cargar un archivo desde pendrive lento o antiguo.
4. Confirmar que la copia local termina antes de procesar.
5. Revisar proxy en el player.
6. Revisar inspector y avisos de formato.
7. Procesar K2.
8. Ingerir salida K2 en Grass Valley.
9. Procesar H.264.
10. Probar lote de varios clips.
11. Probar recortes `IN`/`OUT`.
12. Anotar tiempos de copia, proxy, K2 y H.264.

## Feedback a recoger

- Si Grass Valley acepta o rechaza cada salida K2.
- Tiempo aproximado de ingesta en K2.
- Tiempo de copia local desde soportes lentos.
- Tiempo de generacion de proxy.
- Tiempo de procesado K2 y H.264.
- Si macOS 10.13 abre correctamente la app y carga CSS/assets.
- Si algun formato de entrada genera avisos confusos.
- Si el player no reproduce algun proxy.

## Limitaciones conocidas

- App sin firma/notarizacion Developer ID.
- Distribucion recomendada por ZIP, no copiando la `.app` suelta.
- Apple Silicon depende de binarios FFmpeg/FFprobe arm64 con minimo macOS 12.
- La beta no incluye instalador PKG ni DMG final de laboratorio.
