# Retomar el proyecto DoTwo Compress

Fecha de consolidacion: 2026-06-02

## Estado actual

Version consolidada: `0.1.6`

Build visible en log:

```text
0.1.6-temp-cleanup
```

La beta `0.1.6` es la version operativa actual. Mantiene la correccion K2 de macOS 10.13 y anade limpieza reforzada de temporales.

Resultado de campo confirmado:

- La app legacy abre y funciona en macOS 10.13.
- La codificacion K2 funciona.
- La exportacion funciona.
- Los MOV K2 generados han sido aceptados por el servidor Grass Valley.
- No se han necesitado permisos manuales en las pruebas del trabajo.

## Carpetas clave

```text
electron/                 Proceso principal Electron y preload.
public/                   UI HTML/CSS/JS y assets visibles.
scripts/                  FFmpeg: proxy, K2, H.264, validacion y utilidades.
config/                   Perfil tecnico objetivo.
vendor/ffmpeg/            FFmpeg/FFprobe empaquetados por arquitectura.
build/                    Icono, logo y recursos de empaquetado.
docs/                     Documentacion tecnica y operativa.
tests/                    Matriz de pruebas manuales.
RELEASE_BETA_0_1_6/       ZIPs operativos actuales.
```

## Entrega actual

```text
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Intel_moderno.zip
RELEASE_BETA_0_1_6/DoTwo_Compress_Beta_0.1.6_Apple_Silicon.zip
```

Para los equipos con macOS 10.13 usar:

```text
DoTwo_Compress_Beta_0.1.6_Legacy_10.13_Intel.zip
```

## Comandos basicos

Instalar dependencias npm si no existe `node_modules`:

```bash
npm install
```

Comprobar sintaxis:

```bash
npm run check
```

Abrir app en desarrollo:

```bash
npm run electron
```

Crear builds:

```bash
npm run pack:mac-legacy
npm run pack:mac-intel
npm run pack:mac-arm64
```

Crear ZIPs con electron-builder:

```bash
npm run zip:mac-legacy
npm run zip:mac-intel
npm run zip:mac-arm64
```

Si se parchea una app ya generada, actualizar `app.asar`, sincronizar `Resources/scripts`, ajustar `Info.plist` y crear ZIP con:

```bash
ditto -c -k --keepParent "dist-legacy/mac/DoTwo Compress.app" "DoTwo_Compress_Beta_X.Y.Z_Legacy_10.13_Intel.zip"
```

## Temporales

La app no escribe temporales dentro de la `.app`. Usa:

```text
~/Library/Application Support/dotwo-compress/staging
```

La beta `0.1.6` limpia esa carpeta:

- al abrir la app;
- al cerrar la app;
- al iniciar nueva sesion;
- al limpiar cola.

Si el equipo se apaga o la app se mata de forma forzada, la limpieza se hara al siguiente arranque.

## Documentacion principal

Leer en este orden:

1. `README.md`
2. `docs/RETOMAR_PROYECTO.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/INFORME_TECNICO_APP.md`
5. `docs/BUILD_MATRIX.md`
6. `docs/BINARY_DEPENDENCIES.md`
7. `docs/HOJA_DE_RUTA.md`

## Git y traslado

El repositorio tiene `.gitignore` preparado para no versionar:

- `node_modules/`
- `dist-*`
- `.DS_Store`
- logs y temporales

`vendor/ffmpeg/` si debe conservarse porque forma parte de la app autocontenida.

Los ZIPs de `RELEASE_BETA_0_1_6/` pueden guardarse como artefactos de release. Para un repositorio Git limpio, lo recomendable es versionar codigo, docs, assets, scripts, config, `package-lock.json` y `vendor/ffmpeg`; y publicar los ZIPs como release externa o backup.

## Estado de firma

La build actual no esta firmada ni notarizada:

```json
"identity": null
```

En campo no ha pedido permisos manuales, pero la firma/notarizacion sigue siendo una tarea pendiente antes de una distribucion amplia de laboratorio.
