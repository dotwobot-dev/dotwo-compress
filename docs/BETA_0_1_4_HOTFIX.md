# Beta 0.1.4 - diagnostico de salida K2

Fecha: 2026-06-02

## Motivo

En las pruebas de campo la app cargaba el archivo, generaba el proxy y reproducia el player, pero al procesar K2 podia terminar con:

```text
ERROR: No se pudo localizar la salida generada
```

La beta 0.1.3 ya buscaba la salida prevista y hacia fallback a otros MOV del temporal, pero en estado de error la interfaz podia ocultar parte del log del job K2 y mostrar solo el log de sesion.

## Cambio

- Se anade identificador visible de build: `0.1.4-k2-output-diagnostics`.
- Al lanzar K2 se imprime en el registro tecnico:
  - version real de la app,
  - script usado,
  - entrada local,
  - salida prevista.
- Si no se encuentra la salida, se imprime en el mismo registro visible:
  - si existe o no la salida prevista,
  - carpeta temporal,
  - MOV detectados en el temporal con tamano y fecha,
  - cola del log de conversion.
- La interfaz conserva el log del job tambien cuando el estado final es `error`.

## Uso en pruebas

Usar la beta 0.1.4. Si vuelve a fallar, hacer foto del final del registro tecnico donde aparezca `Build diagnostico: 0.1.4-k2-output-diagnostics` y el bloque `=== Diagnostico salida K2 ===`.

Ese bloque permite distinguir si FFmpeg no genero nada, si genero con otro nombre, o si la app esta abriendo una build antigua.
