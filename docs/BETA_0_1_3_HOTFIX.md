# DoTwo Compress beta 0.1.3 hotfix

Fecha: 2026-06-02

## Correccion

Endurece la deteccion de salida tras procesar K2.

## Cambio

Tras ejecutar el script de conversion, Electron intenta localizar la salida en este orden:

1. Ruta planificada por la app.
2. Ruta leida desde `OK:` en el log.
3. Busqueda del MOV generado mas reciente dentro del temporal del clip.

Si aun asi falla, el log incluye la ruta prevista no encontrada.

## Motivo

En campo, la beta `0.1.2` seguia mostrando:

```text
No se pudo localizar la salida generada
```

La app queda ahora preparada para recuperar una salida aunque el script la haya dejado con otra ruta/nombre dentro del temporal.

## Paquetes

```text
RELEASE_BETA_0_1_3/
```
