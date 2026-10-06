# Matriz de builds

Fecha: 2026-10-06. Entrega firmada: 0.1.8.

| Variante | Electron | Arquitectura | Minimo app | FFmpeg/FFprobe | Estado |
| --- | --- | --- | --- | --- | --- |
| modern-arm64 | 43.7.7 | arm64 | macOS 12.0 | 8.1.1, min 12.0 | Firma, Apple, ticket, Gatekeeper y flujo local comprobados |
| modern-x64 | 43.7.7 | x86_64 | macOS 12.0 | 8.1.1-tessus, min 10.13 | Firma, Apple, ticket y Gatekeeper comprobados; ejecucion Intel pendiente |
| legacy-x64 | 26.6.10 | x86_64 | macOS 10.13.0 | 8.1.1-tessus, min 10.13 | Firma, Apple, ticket y Gatekeeper comprobados; High Sierra pendiente |

Los minimos se inspeccionan en todos los Mach-O empaquetados, no solo en
Info.plist. No se incluyen binarios de la otra arquitectura.

    npm run release:mac:signed -- --all --prepare-only
    npm run release:mac:signed -- --resume /ruta/al/candidato/modern-arm64
    npm run release:mac:signed -- --resume /ruta/al/candidato/modern-x64
    npm run release:mac:signed -- --resume /ruta/al/candidato/legacy-x64

Cada candidato vive en release/signed/ con manifest.json, app y DMG. Se entrega
en una carpeta nueva del NAS, con hashes comparados. Los ZIP sin firmar 0.1.7
se conservan como historico; no son la entrega actual.

## Pruebas de campo pendientes

- Instalar desde DMG y abrir en Intel moderno y macOS 10.13.
- Repetir carga desde disco/pendrive, proxy, cola, IN/OUT, K2/H.264 y guardado.
- Medir copia, proxy, conversion y guardado con archivos reales.
- Comprobar ingesta, campos, audio, timecode y duracion en Grass Valley K2.

Legacy usa Electron fuera de soporte y debe limitarse a los equipos antiguos
del laboratorio. La prueba historica de 0.1.6 no sustituye la de 0.1.8.
Este host Apple Silicon carece de Rosetta y no ejecuta x64.

Guia: docs/DISTRIBUCION_MACOS.md. Manual editable: docs/manual/.
