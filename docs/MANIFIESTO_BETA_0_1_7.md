# Manifiesto beta 0.1.7

Fecha: 2026-06-04

## Estado

Beta tecnica para pruebas de campo posteriores a `0.1.6`.

Base funcional:

- conversion K2/XDCAM EX 1080i50 MOV;
- conversion H.264 MOV 1080p;
- cola multiarchivo;
- marcas `IN`/`OUT`;
- montaje final;
- temporales locales;
- proxy interno de revision;
- limpieza de temporales al abrir/cerrar/limpiar cola.

## Cambios principales

- Limites operativos iniciales para evitar desbordes:
  - `25 GB` por archivo de entrada;
  - `60 GB` acumulados en cola;
  - `5 GB` libres despues de copiar/guardar.
- Variables de entorno para ajustar limites en pruebas tecnicas:

```bash
DOTWO_MAX_INPUT_GB=40 DOTWO_MAX_QUEUE_GB=100 DOTWO_MIN_FREE_GB=10 npm run electron
```

- Bloqueo de cambios en cola mientras hay copia, proxy, conversion, validacion, guardado o montaje en marcha.
- Proteccion al guardar para evitar sobrescribir el temporal interno de la app.
- Favicon en la interfaz.
- Captura de interfaz incluida en el `README.md`.
- Endurecimiento del servidor local prototipo:
  - bloqueo de traversal fuera de `public/`;
  - bloqueo de descargas arbitrarias;
  - `server.mjs` queda aparcado como base futura para servicio centralizado, no como producto principal.

## Distribucion

Formato de beta:

```text
ZIP sin firmar ni notarizar
```

Objetivo posterior:

```text
PKG firmado y notarizado para laboratorios
```

La firma Developer ID queda pendiente de respuesta del servicio de informatica de la Universidad de Malaga.

## Builds esperadas

```text
RELEASE_BETA_0_1_7/DoTwo_Compress_Beta_0.1.7_Apple_Silicon.zip
RELEASE_BETA_0_1_7/DoTwo_Compress_Beta_0.1.7_Intel_moderno.zip
RELEASE_BETA_0_1_7/DoTwo_Compress_Beta_0.1.7_Legacy_10.13_Intel.zip
RELEASE_BETA_0_1_7/README_BETA_0.1.7.md
```

## Validacion minima antes de entregar

```bash
npm run check
npm run zip:mac-arm64
npm run zip:mac-intel
npm run zip:mac-legacy
```

Comprobar despues:

- abrir `.app` legacy en macOS 10.13;
- cargar archivo normal;
- probar limite de archivo grande cuando sea viable;
- procesar K2;
- procesar H.264;
- guardar resultado;
- validar ingesta K2 en Grass Valley.
