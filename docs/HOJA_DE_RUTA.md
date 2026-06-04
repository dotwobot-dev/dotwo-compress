# Hoja de ruta

Fecha: 2026-06-02

## Prioridad 1 - Depuracion de campo

- Mantener beta `0.1.6` como base estable.
- Registrar cualquier fallo con:
  - version visible en log;
  - sistema operativo;
  - tipo de entrada;
  - perfil usado, K2 o H.264;
  - captura del registro tecnico;
  - si el K2 ingiere o rechaza el archivo.
- Medir tiempos reales:
  - copia local;
  - proxy;
  - conversion K2;
  - conversion H.264;
  - guardado/exportacion;
  - ingesta Grass Valley.
- Registrar tamanos reales de archivos de estudiantes para ajustar limites de seguridad.
- Probar lotes de varios clips con IN/OUT.
- Probar entradas problematicas:
  - pendrives lentos;
  - videos verticales;
  - resoluciones no 1920x1080;
  - FPS no PAL;
  - archivos sin audio;
  - H.265/HEVC;
  - bitrates muy altos;
  - MOV/MP4/MKV/AVI/MXF.

## Prioridad 2 - Firma, instalacion y distribucion

- Mantener ZIP sin firmar como formato de beta tecnica hasta recibir respuesta del servicio de informatica de la UMA.
- Consultar si existe Apple Developer Program institucional de la Universidad de Malaga.
- Evitar registrar certificados con Apple ID personal salvo decision explicita de la institucion.
- Preparar DMG para instalacion manual.
- Preparar PKG como formato objetivo para laboratorios.
- Instalar certificados Apple Developer:
  - `Developer ID Application` para firmar `.app` y binarios internos;
  - `Developer ID Installer` para firmar `.pkg`.
- Configurar notarizacion con `notarytool`.
- Comprobar si Gatekeeper cambia el comportamiento en:
  - macOS 10.13;
  - Intel moderno;
  - Apple Silicon.
- Verificar que FFmpeg y FFprobe internos funcionan tras firma/notarizacion.
- Validar firma y notarizacion con `scripts/verify_macos_artifact.sh`.
- Probar instalacion PKG con:
  - instalacion manual por Finder;
  - `sudo installer -pkg ... -target /`;
  - despliegue automatizado de laboratorio si existe herramienta de gestion.
- Crear un diagnostico inicial de arranque:
  - version app;
  - arquitectura;
  - ruta FFmpeg;
  - ruta FFprobe;
  - permisos de temporales;
  - espacio libre en disco.
- Documento guia: `docs/DISTRIBUCION_MACOS.md`.

## Prioridad 3 - Repositorio definitivo y backups

- Hacer commit inicial limpio en la maquina definitiva.
- Decidir politica de artefactos:
  - versionar solo codigo/docs/vendor;
  - guardar ZIPs de release fuera del repo Git;
  - publicar releases si se decide abrir distribucion.
- Configurar backups automaticos del repositorio.
- Guardar hashes de releases publicadas.
- Mantener changelog por version.
- Revisar si `node_modules/` debe mantenerse solo como copia offline o regenerarse con `npm install`.

## Prioridad 4 - Optimizacion de tamano

- Separar binarios FFmpeg por build:
  - legacy/intel: solo `darwin-x64`;
  - Apple Silicon: solo `darwin-arm64`.
- Revisar si se puede reducir `Electron Framework` con opciones de empaquetado.
- Revisar compresion de assets de logo/icono sin perder calidad.
- Eliminar duplicados accidentales de builds locales antes de archivar.

## Prioridad 5 - Calidad de conversion

- Confirmar con Grass Valley:
  - orden de campos;
  - audio estereo;
  - timecode;
  - duracion;
  - reproduccion en playlist;
  - comportamiento de clips con recorte.
- Crear clips fixture pequenos para pruebas repetibles.
- Automatizar:
  - conversion K2 de fixture;
  - conversion H.264 de fixture;
  - validacion ffprobe;
  - comprobacion de nombres ASCII.

## Prioridad 6 - Producto y UX

- Mejorar mensajes pedagogicos del inspector segun feedback de alumnos.
- Revisar limites operativos iniciales:
  - `25 GB` por archivo;
  - `60 GB` acumulados en cola;
  - `5 GB` libres despues de copiar/guardar.
- Anadir indicador visible de espacio libre antes de copiar/procesar.
- Anadir estimacion de tiempo restante si los logs de FFmpeg lo permiten con fiabilidad.
- Mejorar flujo de errores:
  - boton copiar log;
  - boton abrir carpeta temporal solo para tecnicos;
  - codigo corto de error.
- Revisar accesibilidad visual:
  - contraste;
  - tamanos de boton;
  - estados deshabilitados.

## Prioridad 7 - Funciones futuras

- Carpeta caliente real para laboratorio.
- Preferencias persistentes:
  - destino por defecto;
  - perfil por defecto;
  - comportamiento pad/crop;
  - timecode inicial.
- Cola con pausa/cancelacion.
- Historial de exportaciones.
- Panel tecnico de auditoria por archivo.
- Instalador con limpieza de versiones anteriores.

## Linea futura - Servicio centralizado

El modo servidor local queda aparcado como prototipo tecnico, no como prioridad de producto inmediata.

Decision actual:

- Priorizar Electron para que cada host de laboratorio procese con su propia CPU/GPU/almacenamiento local.
- Priorizar instalador macOS correcto: ZIP beta, luego PKG firmado/notarizado cuando este resuelto Developer ID.
- Mantener `server.mjs` como base recuperable para una posible evolucion posterior.

Escenario futuro:

- Si la Universidad de Malaga ofrece VPS, servidor local o capacidad de proceso compartida, valorar convertir DoTwo Compress en un servicio interno tipo SaaS.
- Objetivo del servicio: recibir peticiones de conversion, procesar en paralelo en una maquina mas potente y devolver MOV K2/H.264 a los usuarios.
- Ese camino exigiria una revision especifica de arquitectura:
  - cola de trabajos persistente;
  - subida de archivos grandes;
  - limites por usuario;
  - limpieza de temporales;
  - autenticacion institucional;
  - auditoria de trabajos;
  - concurrencia FFmpeg;
  - almacenamiento compartido;
  - seguridad de descarga.

Mientras no exista esa capacidad centralizada, el servidor queda como herramienta de desarrollo/prototipo y la app Electron sigue siendo el producto principal.
