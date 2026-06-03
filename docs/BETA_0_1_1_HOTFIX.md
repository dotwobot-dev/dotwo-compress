# DoTwo Compress beta 0.1.1 hotfix

Fecha: 2026-06-02

## Correccion

Se corrige el error:

```text
Error invoking remote method 'queue:add': ReferenceError: stagedPath is not defined
```

## Causa

En `electron/main.cjs`, `prepareSession` creaba la ruta temporal dentro de `session.stagedPath`, pero durante la copia y el analisis llamaba a `stagedPath`, una variable que no existe dentro de esa funcion.

## Impacto

La app fallaba al cargar archivo desde `Añadir archivo` antes de copiar el video a temporal local. El fallo no estaba relacionado con mover el material antiguo al disco LaCie; el cambio de organizacion solo hizo aparecer el bug en la beta actual.

## Validacion

- `npm run check`: OK.
- Busqueda de `stagedPath`: ya no queda uso sin `session.` salvo la declaracion local dentro de `createSession`.

## Paquetes

Los paquetes corregidos se generan como beta `0.1.1` en:

```text
RELEASE_BETA_0_1_1/
```
