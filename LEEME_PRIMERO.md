# DoTwo Compress - leer primero

Version consolidada: `0.1.6`

La beta operativa actual esta en:

```text
RELEASE_BETA_0_1_6/
```

Para macOS 10.13 usar:

```text
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
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
docs/MANIFIESTO_BETA_0_1_6.md
```

Comprobacion basica:

```bash
npm run check
```

Notas importantes:

- Los temporales internos viven en `~/Library/Application Support/dotwo-compress/staging`.
- La app no esta firmada ni notarizada todavia.
- Los ZIPs de release deben moverse como ZIP, no copiando la `.app` suelta.
- `node_modules/` y `dist-*` estan ignorados por Git.
- Licencia publica: Apache-2.0 + NOTICE.
- Los binarios de FFmpeg/FFprobe no se versionan en el Git publico; se preparan con `npm run fetch:ffmpeg`.
