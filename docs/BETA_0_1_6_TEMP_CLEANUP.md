# Beta 0.1.6 - limpieza de temporales

Fecha: 2026-06-02

## Motivo

La app procesa desde una copia local en `userData/staging`. Si un alumno cierra la app durante una copia, proxy o conversion, o si el equipo se apaga, podian quedar temporales locales hasta que se iniciara una nueva sesion.

## Cambio

- Limpieza de `staging` al arrancar la app.
- Limpieza de `staging` al iniciar una nueva sesion o limpiar cola.
- Limpieza de `staging` al salir de la app.
- Registro de procesos hijos de FFmpeg/FFprobe/scripts.
- Al salir, se envia `SIGTERM` a procesos activos antes de borrar temporales.
- Bloqueo de instancia unica para evitar que una segunda app borre temporales de otra instancia que este procesando.

## Alcance

La limpieza solo afecta a temporales internos de la app:

```text
~/Library/Application Support/dotwo-compress/staging
```

No elimina originales ni archivos exportados por el usuario.

## Limitacion esperada

Si el equipo se apaga o la app se mata de forma forzada, la limpieza de salida no se ejecuta. En ese caso, la limpieza se realiza en el siguiente arranque.
