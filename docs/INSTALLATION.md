# Instalacion de DoTwo Compress 0.1.8

Entrega interna firmada con Developer ID de Domingo Moreno, Team MR7VK26RP8,
notarizada por Apple y con tickets adjuntos.

| Equipo | Archivo recomendado | Sistema minimo |
| --- | --- | --- |
| Apple Silicon (M1 o posterior) | DoTwo-Compress-0.1.8-modern-arm64.dmg | macOS 12 |
| Intel moderno | DoTwo-Compress-0.1.8-modern-x64.dmg | macOS 12 |
| Intel antiguo / High Sierra | DoTwo-Compress-0.1.8-legacy-x64.dmg | macOS 10.13 |

1. Abrir el DMG correspondiente al equipo.
2. Arrastrar DoTwo Compress al enlace Aplicaciones.
3. Esperar la copia completa y expulsar la imagen montada.
4. Abrir DoTwo Compress desde Aplicaciones.

Los ZIP opcionales contienen la misma app firmada y con ticket; no necesitan
instalacion de FFmpeg ni Homebrew. No mezclar arquitecturas ni intentar abrir
una variante moderna en High Sierra.

Antes de sustituir una version anterior, cerrar la app y guardar cualquier
exportacion pendiente. Nunca guardar solo dentro de un temporal de la app.
No se requiere desactivar Gatekeeper, retirar cuarentena ni cambiar confianza
de certificados. Si macOS bloquea la app, entregar el aviso y el SHA256 al tecnico.

Manual de dos paginas: DoTwo_Compress_Manual_Rapido_0.1.8.pdf en esta entrega.
Pruebas realizadas y pendientes: MANIFIESTO_0_1_8_FIRMADO.md y metadata/.
Solo Apple Silicon ha sido ejecutado en este host; Intel y Grass Valley requieren
las pruebas reales de laboratorio. La legacy conserva un runtime fuera de soporte.
