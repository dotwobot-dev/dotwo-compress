# Roadmap de edicion basica

Objetivo: convertir la app en una preparadora de entregas para laboratorio. No pretende sustituir a un editor no lineal, sino resolver los problemas mas frecuentes antes de entregar al K2 o generar un H.264 compatible.

## Fase 1: IN/OUT por archivo

Estado: implementado.

Flujo:

- cargar archivo;
- generar proxy de revision;
- revisar en el player;
- marcar `IN` y/o `OUT`;
- procesar K2 o H.264 solo con el tramo seleccionado;
- si no hay marcas, procesar el archivo completo.

Uso previsto:

- quitar colas de grabacion;
- eliminar negro o intentos al principio/final;
- entregar una pieza limpia sin abrir un editor externo.

Implementacion:

- la interfaz guarda marcas en segundos del proxy;
- Electron valida que `OUT` sea posterior a `IN`;
- los scripts reciben `K2_TRIM_START` y `K2_TRIM_DURATION`;
- FFmpeg recorta desde la copia local antes de normalizar formato, resolucion, FPS y audio.

## Fase 2: Cola simple de clips

Estado: implementado.

Flujo previsto:

- cargar varios archivos;
- generar proxy e inspector por cada clip;
- marcar `IN`/`OUT` por clip;
- ordenar clips;
- quitar clips de la cola;
- procesar todo como una unica salida K2 o H.264.

Criterio tecnico:

- normalizar cada clip a un temporal comun;
- concatenar temporales ya normalizados;
- validar la salida final.

Esto evita problemas al juntar moviles, camaras, resoluciones, FPS, codecs y audios distintos.

Detalle de salida:

- H.264: concatena los temporales por copia cuando ya comparten codec, resolucion, audio y contenedor.
- K2: re-encodea el montaje final desde los temporales normalizados para mantener `25/1`, orden de pistas audio/video, timecode `tmcd` y validacion Grass Valley.

## Fase 3: Montaje minimo

Estado: pendiente.

Funciones candidatas:

- arrastrar clips para reordenar, ademas de subir/bajar;
- duplicar clip;
- estimar duracion final;
- mostrar espacio libre necesario;
- guardar/cargar proyecto `.k2job`;
- conservar temporales cuando falle un proceso para diagnostico tecnico.

Quedan descartados de momento:

- timeline multipista;
- mezcla de audio avanzada;
- titulos;
- transiciones complejas;
- correccion de color.

## Principio de producto

La app debe seguir siendo una herramienta de entrega y normalizacion. La interfaz tiene que ayudar a alumnos perdidos a entender que archivo traen, revisar lo basico, recortar colas y entregar en un formato seguro.
