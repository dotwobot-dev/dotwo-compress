# Administracion del repositorio

Fecha de inventario: 2026-06-03

Este repositorio debe tratarse como la fuente de trabajo de DoTwo Compress. Los paquetes generados para entrega no deben formar parte del historial Git normal, porque pesan mucho y se pueden reconstruir desde el codigo, la configuracion y los binarios declarados.

## Estado actual

Version consolidada: `0.1.6`.

Comprobacion basica validada:

```bash
npm run check
```

Resultado: correcto.

## Que debe vivir en Git

- `electron/`: proceso principal y preload.
- `public/`: interfaz de la app.
- `scripts/`: conversion, analisis, proxy y validacion.
- `config/`: perfil objetivo K2.
- `build/`: iconos, marca y recursos de build.
- `vendor/ffmpeg/`: FFmpeg/FFprobe internos necesarios para builds reproducibles.
- `docs/`: estado, roadmap, manifiestos y guia de continuidad.
- `tests/`: matriz de pruebas.
- `package.json` y `package-lock.json`.

## Que no debe vivir en Git

- `node_modules/`: se regenera con `npm install`.
- `dist/`, `dist-arm64/`, `dist-intel/`, `dist-legacy/`, `dist-hotfix-legacy/`: salidas de `electron-builder`.
- `RELEASE_BETA_*/`: paquetes ZIP entregables de cada beta.
- `artifacts/`: carpeta local opcional para guardar entregables fuera del historial.
- `.DS_Store`, logs, temporales y reportes generados.

## Peso detectado

Principales consumidores de espacio:

- Releases beta `0.1.0` a `0.1.6`: unos `4.18 GB`.
- `dist-arm64`: unos `1.2 GB`.
- `dist-intel`: unos `711 MB`.
- `dist-legacy`: unos `682 MB`.
- `node_modules`: unos `571 MB`.
- `vendor/ffmpeg`: unos `274 MB`.

El codigo, documentacion, scripts, configuracion e interfaz ocupan muy poco comparado con los artefactos generados.

## Politica recomendada de releases

Mantener como entrega activa:

```text
RELEASE_BETA_0_1_6/
```

Conservar de forma archivada, fuera del repositorio de trabajo, las releases antiguas si se necesita trazabilidad historica:

```text
RELEASE_BETA_0_1/
RELEASE_BETA_0_1_1/
RELEASE_BETA_0_1_2/
RELEASE_BETA_0_1_3/
RELEASE_BETA_0_1_4/
RELEASE_BETA_0_1_5/
```

Cada release antigua ya incluye su `README_BETA_...md` y, salvo la `0.1.6`, un aviso `NO_USAR_USAR_...md`. Eso permite archivarlas sin perder contexto.

## Politica recomendada de limpieza local

Se pueden borrar y regenerar cuando haga falta:

```text
dist-arm64/
dist-intel/
dist-legacy/
dist-hotfix-legacy/
node_modules/
```

Antes de borrar `node_modules/`, confirmar que se puede reinstalar con:

```bash
npm install
```

Antes de generar paquetes nuevos:

```bash
npm run check
npm run zip:mac-arm64
npm run zip:mac-intel
npm run zip:mac-legacy
```

## Tratamiento recomendado

1. Hacer un commit inicial solo con fuente, documentacion y binarios necesarios.
2. No meter releases ZIP ni carpetas `dist-*` en Git.
3. Guardar paquetes de beta en una carpeta externa de archivo, por ejemplo:

```text
/Volumes/BackUP_MacMini/DoTwo_Compress/release_archive/
```

4. En el repo de trabajo, dejar como maximo la release activa si se quiere tenerla a mano, pero ignorada por Git.
5. Cuando se cierre una nueva beta, crear su carpeta de release, copiar los ZIPs finales y documentarla con un manifiesto.
6. Mantener `docs/PROJECT_STATUS.md` como estado vivo del proyecto y `docs/ADMINISTRACION_REPO.md` como norma de administracion.

## Limpieza sugerida para este momento

Liberacion posible sin tocar codigo:

- Borrar `dist-arm64/`, `dist-intel/`, `dist-legacy/` y `dist-hotfix-legacy/`: libera unos `2.6 GB`.
- Borrar `node_modules/`: libera unos `571 MB`, reinstalable.
- Archivar fuera del repo las releases `0.1.0` a `0.1.5`: mueve unos `3.58 GB`.
- Mantener `RELEASE_BETA_0_1_6/` como release operativa actual: unos `601 MB`.

No borrar `vendor/ffmpeg/` sin sustituirlo por un mecanismo documentado de descarga/verificacion, porque ahora forma parte de la reproducibilidad de builds.
