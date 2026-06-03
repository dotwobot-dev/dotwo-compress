# DoTwo Compress beta 0.1.2 hotfix

Fecha: 2026-06-02

## Correccion

Se corrige el error al procesar K2:

```text
ERROR: No se pudo localizar la salida generada
```

## Causa

La conversion K2 podia terminar y generar el MOV previsto, pero Electron intentaba localizar la salida buscando una linea `OK:` dentro del log de FFmpeg/script. Con ciertos logs de FFmpeg, esa linea puede no quedar al inicio de una linea limpia por los retornos de carro del progreso.

## Cambio

Electron ahora usa primero la ruta de salida prevista (`plannedOutput`) si existe en disco. La lectura de `OK:` queda como fallback para flujos sin salida planificada.

## Paquetes

Los paquetes corregidos se generan como beta `0.1.2` en:

```text
RELEASE_BETA_0_1_2/
```
