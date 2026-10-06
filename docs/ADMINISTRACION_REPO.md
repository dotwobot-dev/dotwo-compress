# Administracion del repositorio

Inventario historico: 2026-06-03. Actualizacion operativa: 2026-10-06.

Este repositorio debe tratarse como la fuente de trabajo de DoTwo Compress. Los paquetes generados para entrega no deben formar parte del historial Git normal, porque pesan mucho y se pueden reconstruir desde el codigo, la configuracion y los binarios declarados.

## Estado actual

Entrega actual: `0.1.8`, app y DMG firmados. Los tamanos y releases 0.1.0-0.1.6 de este inventario se conservan como historia, no como ubicacion actual.

Candidatos generados en `release/signed/`, PDF/QA en `output/`; todo ignorado por Git. Entrega NAS nueva en `release_archive/DoTwo_Compress_0.1.8_signed_20261006/`. Backups limpios excluyen dependencias, builds, PDF generado y binarios vendor. `.DS_Store` se ignora como metadato normal de macOS, sin limpieza manual recurrente.

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
- `vendor/ffmpeg/README.md` y metadatos de descarga: los binarios se preparan localmente y no entran en Git publico.
- `docs/`: estado, roadmap, manifiestos y guia de continuidad.
- `tests/`: matriz de pruebas.
- `package.json` y `package-lock.json`.

## Que no debe vivir en Git

- `node_modules/`: se regenera con `npm install`.
- `dist/`, `dist-arm64/`, `dist-intel/`, `dist-legacy/`, `dist-hotfix-legacy/`: salidas de `electron-builder`.
- `RELEASE_BETA_*/`: paquetes ZIP entregables de cada beta.
- `artifacts/`: carpeta local opcional para guardar entregables fuera del historial.
- `.DS_Store`, logs, temporales y reportes generados.

## Peso detectado en el inventario de junio

Principales consumidores de espacio:

- Releases beta `0.1.0` a `0.1.6`: unos `4.18 GB`.
- `dist-arm64`: unos `1.2 GB`.
- `dist-intel`: unos `711 MB`.
- `dist-legacy`: unos `682 MB`.
- `node_modules`: unos `571 MB`.
- `vendor/ffmpeg`: unos `274 MB`.

El codigo, documentacion, scripts, configuracion e interfaz ocupan muy poco comparado con los artefactos generados.

## Politica vigente de entregas

La entrega nueva `0.1.8` esta en `release/signed/` y en
`release_archive/DoTwo_Compress_0.1.8_signed_pkg_20261006/` del NAS. Contiene
tres DMG y tres PKG firmados/notarizados, ZIP opcionales, manual, QA arm64
vinculada al candidato y sumas SHA-256. La entrega inicial app+DMG sin PKG
permanece en su carpeta anterior. GitHub sigue sin tag ni release hasta cerrar
pruebas de campo y aprobacion. Consultar `docs/DISTRIBUCION_MACOS.md` y
`docs/BUILD_MATRIX.md` antes de distribuir. El manifiesto
`docs/MANIFIESTO_0_1_8_FIRMADO.md` pertenece a la entrega anterior.

Conservar candidatos, evidencias y versiones anteriores. Un manifiesto
`sourceDirty: true` no acredita que un binario proceda exactamente de un commit
posterior, aunque el codigo runtime se haya comparado durante la entrega.

## Politica historica de betas ZIP (junio de 2026)

En junio se recomendaba mantener como beta activa:

```text
RELEASE_BETA_0_1_6/
```

Se recomendaba conservar de forma archivada, fuera del repositorio de trabajo,
las releases anteriores para trazabilidad historica:

```text
RELEASE_BETA_0_1/
RELEASE_BETA_0_1_1/
RELEASE_BETA_0_1_2/
RELEASE_BETA_0_1_3/
RELEASE_BETA_0_1_4/
RELEASE_BETA_0_1_5/
```

Cada release antigua ya incluye su `README_BETA_...md` y, salvo la `0.1.6`, un aviso `NO_USAR_USAR_...md`. Eso permite archivarlas sin perder contexto.

## Limpieza local: inventario historico, no orden vigente

En junio se identificaron como regenerables estas carpetas de build:

```text
dist-arm64/
dist-intel/
dist-legacy/
dist-hotfix-legacy/
node_modules/
```

La nota antigua sugeria reinstalar `node_modules/` con:

```bash
npm install
```

Y preparaba paquetes ZIP sin firma con:

```bash
npm run check
npm run zip:mac-arm64
npm run zip:mac-intel
npm run zip:mac-legacy
```

Estos comandos son el flujo historico de betas, no el de entrega firmada 0.1.8.

## Tratamiento historico recomendado para las betas ZIP

1. Hacer un commit inicial solo con fuente y documentacion necesaria.
2. No meter releases ZIP ni carpetas `dist-*` en Git.
3. Guardar paquetes de beta en una carpeta externa de archivo, por ejemplo:

```text
/Volumes/BackUP_MacMini/DoTwo_Compress/release_archive/
```

4. En el repo de trabajo, dejar como maximo la beta activa si se quiere tenerla a mano, pero ignorada por Git.
5. Cuando se cerraba una nueva beta, crear su carpeta de release, copiar los ZIPs finales y documentarla con un manifiesto.
6. Mantener `docs/PROJECT_STATUS.md` como estado vivo del proyecto y `docs/ADMINISTRACION_REPO.md` como norma de administracion.

## Estimacion historica de limpieza (junio, no ejecutar por rutina)

Liberacion que se estimo entonces sin tocar codigo:

- Borrar `dist-arm64/`, `dist-intel/`, `dist-legacy/` y `dist-hotfix-legacy/`: libera unos `2.6 GB`.
- Borrar `node_modules/`: libera unos `571 MB`, reinstalable.
- Archivar fuera del repo las releases `0.1.0` a `0.1.5`: mueve unos `3.58 GB`.
- Mantener `RELEASE_BETA_0_1_6/` como beta operativa de aquel momento: unos `601 MB`.

No borrar `vendor/ffmpeg/` sin comprobar antes el mecanismo documentado de
descarga/verificacion: sus binarios locales siguen siendo necesarios para
reproducir builds y no se versionan en Git publico. Antes de cualquier limpieza
actual, inventariar rutas exactas y proteger candidatos firmados, evidencias y
entregas NAS de `0.1.8` y versiones anteriores.
