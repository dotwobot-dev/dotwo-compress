# DoTwo Compress - leer primero

Version de entrega: `0.1.8`

Entrega firmada y notarizada con DMG, manual y verificaciones:

```text
/Volumes/BackUP_MacMini/DoTwo_Compress/release_archive/DoTwo_Compress_0.1.8_signed_20261006/
```

Apple Silicon: flujo local probado. Intel y High Sierra: pruebas de campo pendientes. La beta 0.1.6 fue validada historicamente en Grass Valley, no la nueva 0.1.8.

Para macOS 10.13 usar:

```text
DoTwo-Compress-0.1.8-legacy-x64.dmg
```

Para retomar el proyecto en otra maquina, leer:

```text
docs/RETOMAR_PROYECTO.md
```

Informes principales:

```text
docs/PROJECT_STATUS.md
docs/INFORME_TECNICO_APP.md
docs/HOJA_DE_RUTA.md
docs/ADMINISTRACION_REPO.md
docs/DISTRIBUTION.md
docs/DISTRIBUCION_MACOS.md
docs/MANIFIESTO_0_1_8_FIRMADO.md
docs/MANIFIESTO_BETA_0_1_7.md
docs/MANIFIESTO_BETA_0_1_6.md
```

Comprobacion basica:

```bash
npm run check
```

Notas importantes:

- Los temporales internos viven en `~/Library/Application Support/dotwo-compress/staging`.
- Entrega 0.1.8: Developer ID y notarizacion Apple comprobados; no hay publicacion GitHub en este encargo.
- Los ZIPs de release deben moverse como ZIP, no copiando la `.app` suelta.
- `node_modules/` y `dist-*` estan ignorados por Git.
- Licencia publica: Apache-2.0 + NOTICE.
- Los binarios de FFmpeg/FFprobe no se versionan en el Git publico; se preparan con `npm run fetch:ffmpeg`.
