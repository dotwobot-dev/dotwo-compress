# Entrega firmada 0.1.8

Fecha: 2026-10-06. App ID: `com.dotwo.compress`.
Producto: DoTwo Compress. Developer ID: Domingo Moreno, Team `MR7VK26RP8`.

## Candidato entregado

`release/signed/0.1.8-2026-10-06T15-39-08-893Z/`.

| Variante | Electron | macOS minimo | ID Apple app | ID Apple DMG |
| --- | --- | --- | --- | --- |
| modern-arm64 | 43.7.7 | 12.0 | 37973dc3-0535-412b-bdc5-ed85f5ddd3f8 | 0efd6f2a-5c5d-4d37-a0c7-08a84509f470 |
| modern-x64 | 43.7.7 | 12.0 | 2d4b19a4-b150-4db3-84c3-d9df8d5cac80 | 8bb81938-b152-430c-bc8f-bcc044a9ed8c |
| legacy-x64 | 26.6.10 | 10.13.0 | a627f6de-6a29-4652-a928-db0fb97f1fd8 | be4556a5-5168-44f0-8ec7-4de583a29a18 |

Las seis solicitudes estan Accepted. Las apps y DMG llevan tickets adjuntos;
firmas, timestamps, hardened runtime, equipo y Gatekeeper verificados.
17 Mach-O inspeccionados por variante, incluidos FFmpeg/FFprobe y bibliotecas.
Solo se empaqueta la arquitectura correspondiente. UDZO con HFS+ y fondo Retina.

## Cambios

- Runtime moderno soportado 43.7.7; legacy conserva 26.6.10 y High Sierra.
- Flujo CJS compatible con type: module, preflight de Llavero y reanudacion.
- IDs guardados antes de esperar; hash de app completa para evitar reutilizar
  tickets sobre una app editada; espera limitada por consulta.
- Firma explicita de codigo interno antes del bundle; JIT solo en Electron.
- Fondo DMG castellano: iconos, flecha, Aplicaciones, expulsar y abrir.
- Perfil --user-data-dir aislado para pruebas de app empaquetada.
- Validacion de salida fallida ya no se marca como trabajo correcto.
- Manual de dos paginas A4 con capturas reales, JSON y generador editables.

## Pruebas locales

Host: Apple Silicon, macOS 26.7.1; version registrada en resultados JSON de QA.

Apple Silicon: arranque; herramientas internas; copia local; inspector/avisos;
proxy y reproduccion; marcas IN/OUT; agregar/seleccionar/ordenar/quitar clips;
conversion individual y montaje K2/H.264; validacion ffprobe; guardado; registro;
limpieza al vaciar cola y al cerrar. Rechazo de archivo disperso 26 GiB con
limite por defecto 25 GiB. Cola y falta de espacio probadas con limites de
entorno reducidos/elevados. No se copio un archivo real de 26 GiB.

La prueba automatizada usa selector y dialogo de guardado simulados, y el
frontend, IPC, conversiones y copias reales de la app firmada. Capturas de
datos sinteticos, sin medios privados ni datos de estudiantes. Instalacion
de trabajo y su perfil no se modifican.

DMG: firmas del contenedor y app; spctl; stapler; montado en solo lectura;
app comparada con candidato; enlace Aplicaciones; Finder sin solapamientos;
TIFF 640x420 y 1280x840. Los metadatos finales incluyen hashes comparados en NAS.

Manual: dos paginas A4, texto seleccionable, renderizado con Poppler e
inspeccion visual de ambas paginas. Fuente en docs/manual/; PDF fuera de Git.

## Pendiente de campo

- Abrir e instalar las variantes Intel moderna y legacy en sus equipos reales.
- Ejecutar High Sierra/macOS 10.13 y comprobar Finder/Gatekeeper de ese sistema.
- Ingesta K2 real, audio, campos, timecode, duracion y playlist Grass Valley.
- Rendimiento con archivos reales, pendrives, lotes largos y espacio justo.

Este host no dispone de Rosetta: el intento de ejecutar FFmpeg x64 termina
con arquitectura no disponible (-86). No se afirma validacion funcional Intel.
Legacy mantiene Electron fuera de soporte y es solo para equipos antiguos internos.

## Candidato descartado

El candidato 0.1.8-2026-10-06T15-21-29-620Z se descarto por perdida de permiso
JIT al firmar bundles helper, detectada antes de entrega. Sus solicitudes
Intel moderna (app d61196f7-daee-4170-941a-b44f7110902c y DMG
1ebe1f61-714d-42ff-bda6-aaee10886bbb) fueron aceptadas por Apple, pero no
constituyen una app probada ni entregable. Se conservan sus IDs como trazabilidad.
Se genero un candidato nuevo sin editar la app ya enviada ni reutilizar tickets.
La compilacion 15-24-35 paso las pruebas y Apple, pero fue sustituida por la
compilacion final 15-39-08 con los avisos de terceros y metadatos actualizados.

## Toolchain

Se conserva electron-builder 26.8.1 y su esquema mac.*. Audit de dependencias
de desarrollo: 18 avisos (4 moderados, 13 altos, 1 critico). No se aplico una
actualizacion mayor automatica del builder. npm audit --omit=dev no reporta
vulnerabilidades; la app no empaqueta dependencias npm de desarrollo. Los
avisos del tooling y el runtime legacy fuera de soporte requieren seguimiento.

## Entrega

NAS: `/Volumes/BackUP_MacMini/DoTwo_Compress/release_archive/DoTwo_Compress_0.1.8_signed_20261006/`.
Apps aprobadas dentro de DMG y ZIP opcional; manual PDF; instrucciones;
manifiestos; evidencias de QA; sumas SHA256. Releases anteriores conservadas.

Backup limpio de codigo, Git y documentacion en repo_backups/, excluyendo
builds, dependencias, binarios vendor, PDF generado y credenciales.
Sin push, tags ni releases GitHub. Commit local revisado antes de solicitar sync.
