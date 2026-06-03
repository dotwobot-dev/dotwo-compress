# Distribucion macOS

Fecha: 2026-06-03

## Decision recomendada

Mantener tres niveles de entrega:

1. `zip` para beta tecnica rapida.
2. `dmg` para instalacion manual por usuarios no gestionados.
3. `pkg` para laboratorios, despliegue automatizado y administracion centralizada.

Para los laboratorios, el objetivo debe ser `pkg` firmado y notarizado. Es el formato que mejor encaja con instalacion por Terminal, MDM, Jamf, Munki, Apple Remote Desktop o scripts de administracion.

## Decision provisional

Hasta recibir respuesta del servicio de informatica de la Universidad de Malaga, la beta operativa se mantiene como `zip` sin firmar.

Motivo:

- La app sigue en pruebas de campo.
- Las pruebas inmediatas son carga, tiempos, exportacion e ingesta Grass Valley.
- No hay certificados Developer ID instalados en este host.
- La cuenta Apple Developer debe gestionarse preferentemente a nivel institucional, no como cuenta personal.

Si los ZIPs sin firmar provocan demasiada friccion en laboratorio, se revisaran alternativas temporales antes de cerrar el flujo definitivo.

## Gestion institucional pendiente

Entidad recomendada para el programa:

```text
Universidad de Malaga
```

No se recomienda registrar la app con Apple ID personal ni como una unidad no confirmada juridicamente, como facultad/departamento, salvo que la UMA o Apple confirmen que esa unidad puede actuar como entidad legal.

Pendiente con el servicio de informatica:

- Confirmar si la Universidad de Malaga ya dispone de Apple Developer Program institucional.
- Si existe, solicitar acceso como `Admin` o `Developer`, o que emitan los certificados necesarios.
- Si no existe, valorar alta institucional y solicitud de exencion de cuota educativa.
- Confirmar quien custodia certificados, credenciales de notarizacion y renovaciones.

Texto base para consulta:

```text
Necesitamos distribuir una aplicacion macOS interna para laboratorios de la Facultad de Ciencias de la Comunicacion. No se publicaria en App Store.

Para instalarla correctamente y automatizar despliegues, Apple recomienda firmar con Developer ID y notarizar. ¿La Universidad de Malaga dispone ya de una cuenta Apple Developer Program institucional?

En caso afirmativo, necesitariamos acceso como Admin/Developer o que se emitan certificados Developer ID Application y Developer ID Installer para firmar la app y el instalador PKG.

En caso negativo, habria que valorar el alta como organizacion Universidad de Malaga y solicitar la exencion de cuota para institucion educativa acreditada.
```

## Estado de este host

Herramientas disponibles:

```bash
xcrun --find notarytool
xcrun --find stapler
xcode-select -p
```

Estado comprobado: Command Line Tools disponibles.

Certificados disponibles:

```bash
security find-identity -v -p codesigning
```

Estado comprobado: `0 valid identities found`.

Conclusion: este host puede preparar y empaquetar builds sin firmar, pero no puede crear una distribucion final firmada/notarizada hasta instalar certificados Developer ID.

## Certificados necesarios

Para distribucion fuera de Mac App Store:

- `Developer ID Application`: firma la `.app` y sus binarios internos.
- `Developer ID Installer`: firma el `.pkg`.

El `.pkg` no debe firmarse con el certificado de aplicacion. Apple avisa de que puede parecer valido durante el firmado, pero fallar en destino.

## Notarizacion

Para macOS moderno, la ruta correcta es:

1. Firmar la app con Hardened Runtime.
2. Crear el contenedor final (`zip`, `dmg` o `pkg`).
3. Enviar a notarizacion con `notarytool` o mediante `electron-builder`.
4. Grapar el ticket con `stapler`.
5. Validar con `spctl`.

La notarizacion es especialmente importante para macOS 10.15 o superior. En macOS 10.13 no se exige igual que en Catalina y posteriores, pero una firma Developer ID correcta sigue reduciendo friccion de Gatekeeper.

## Entitlements

Se han preparado:

```text
build/entitlements.mac.plist
build/entitlements.mac.inherit.plist
```

Son entitlements minimos para Electron con Hardened Runtime. No activan sandbox ni permisos de camara/microfono porque la app no los necesita.

Punto critico: FFmpeg y FFprobe van dentro de la app como binarios ejecutables. Tras firmar/notarizar hay que verificar que tambien quedan firmados correctamente.

## Scripts disponibles

ZIP beta actual:

```bash
npm run zip:mac-arm64
npm run zip:mac-intel
npm run zip:mac-legacy
```

DMG manual:

```bash
npm run dmg:mac-arm64
npm run dmg:mac-intel
npm run dmg:mac-legacy
```

PKG laboratorio:

```bash
npm run pkg:mac-arm64
npm run pkg:mac-intel
npm run pkg:mac-legacy
```

Verificacion de artefacto:

```bash
npm run verify:mac-artifact -- "dist-legacy/DoTwo Compress-0.1.6.pkg"
npm run verify:mac-artifact -- "dist-legacy/mac/DoTwo Compress.app"
```

## Flujo objetivo para laboratorios

1. Instalar certificados Developer ID en el llavero del host de build.
2. Configurar credenciales de notarizacion mediante `notarytool store-credentials` o variables de entorno seguras.
3. Generar `pkg:mac-legacy` como primera variante critica para macOS 10.13 Intel.
4. Validar instalacion local:

```bash
sudo installer -verbose -pkg "dist-legacy/DoTwo Compress-0.1.6.pkg" -target /
```

5. Abrir `/Applications/DoTwo Compress.app`.
6. Ejecutar prueba real:
   - carga de archivo;
   - proxy;
   - exportacion K2;
   - exportacion H.264;
   - guardado;
   - ingesta Grass Valley.
7. Validar firma:

```bash
npm run verify:mac-artifact -- "/Applications/DoTwo Compress.app"
npm run verify:mac-artifact -- "dist-legacy/DoTwo Compress-0.1.6.pkg"
```

## Criterio de eleccion

ZIP:

- Bueno para beta y traslado rapido.
- Poco instalable en laboratorio.
- Puede arrastrar friccion de permisos/cuarentena si se manipula mal.

DMG:

- Bueno para usuarios que instalan manualmente.
- Presentacion mas familiar.
- No es ideal para despliegue automatico masivo.

PKG:

- Mejor para laboratorios.
- Instalable por linea de comandos y herramientas de gestion.
- Permite futuras tareas de instalacion o limpieza.
- Requiere certificado `Developer ID Installer` para distribucion final.

## Pendientes concretos

- Esperar respuesta del servicio de informatica de la UMA sobre cuenta Apple Developer institucional.
- Instalar certificados Developer ID.
- Decidir nombre del perfil de notarizacion en llavero.
- Probar si `electron-builder` firma correctamente FFmpeg/FFprobe como `extraResources`.
- Generar primer `pkg` legacy.
- Instalar en un equipo de laboratorio con macOS 10.13.
- Confirmar si hace falta un `postinstall` para limpiar versiones previas o basta con sobrescribir `/Applications/DoTwo Compress.app`.

## Fuentes de referencia

- Apple Developer ID: https://developer.apple.com/support/developer-id/
- Apple Notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple PKG signing: https://help.apple.com/xcode/mac/current/en.lproj/deve51ce7c3d.html
- Electron code signing: https://www.electronjs.org/docs/latest/tutorial/code-signing
- electron-builder macOS: https://www.electron.build/docs/mac
- electron-builder PKG: https://www.electron.build/docs/pkg
