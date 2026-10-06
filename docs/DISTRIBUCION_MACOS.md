# Distribucion macOS

Fecha: 2026-10-06. Version de entrega: 0.1.8.

## Firma disponible

La cuenta Apple Developer personal de Domingo Moreno esta activa. Identidad:
Developer ID Application: Domingo Moreno (MR7VK26RP8). Perfil de Llavero:
dotwo-notary. Tambien esta disponible Developer ID Installer; PKG no forma
parte de esta entrega. La espera institucional de junio es ahora historica.
Las claves privadas se conservan en el Llavero, sin exportarlas ni pedir
contrasenas por chat. Cadena G2 comprobada por firma y verificacion de Apple.

## Variantes

| Variante | Arquitectura | Electron | Minimo macOS |
| --- | --- | --- | --- |
| modern-arm64 | arm64 | 43.7.7 | 12.0 |
| modern-x64 | x86_64 | 43.7.7 | 12.0 |
| legacy-x64 | x86_64 | 26.6.10 | 10.13.0 |

Electron 43 sigue soportado hasta enero de 2027 segun el calendario oficial
consultado el 2026-10-06. Electron 26 queda congelado para los equipos antiguos.
Los minimos se comprueban en todos los Mach-O, no solo en Info.plist.
Cada variante contiene exclusivamente FFmpeg/FFprobe de su arquitectura.

## Flujo reanudable

Comandos de preparacion:

    npm ci
    npm run check
    npm test
    npm run check:mac-signing
    npm run build:dmg-background
    npm run release:mac:signed -- --all --prepare-only

El ultimo comando crea candidatos nuevos en release/signed/ y firma las apps.
Permite comprobarlas antes de enviarlas. Para continuar una variante:

    npm run release:mac:signed -- --resume /ruta/absoluta/al/candidato/variante

Sin --prepare-only, --all completa el flujo mientras Apple lo permita.
Cada consulta espera como maximo 45 segundos. Si Apple sigue procesando,
el candidato conserva su ID y estado incompleto; se reanuda el mismo directorio.
Una subida con resultado desconocido exige consultar history; no se repite
automaticamente. No se reutiliza un ticket si cambia el contenido.

Cada app se envia como ZIP de notarizacion. Solo tras Accepted se adjunta
el ticket y se crea el DMG desde la app aprobada. El DMG se firma, envia por
separado, grapa y comprueba. IDs y hashes antes/despues quedan en manifest.json.
El entregable obligatorio es app + DMG. Ningun PKG bloquea el flujo.

## Verificacion

scripts/sign-mac.cjs firma todos los Mach-O y bundles internos antes del bundle
principal, con hardened runtime y timestamp. allow-jit se aplica solo a Electron
y sus helpers, incluidos sus bundles .app. FFmpeg/FFprobe no reciben excepciones
JIT ni de validacion de bibliotecas. Los originales vendor no se modifican.

    npm run verify:mac-artifact -- "/ruta/DoTwo Compress.app"
    npm run verify:mac-artifact -- "/ruta/DoTwo-Compress-0.1.8-modern-arm64.dmg"

El DMG exige firma, equipo correcto, Gatekeeper con context:primary-signature,
ticket valido y verificacion de la app montada en solo lectura. --deep se usa
como verificacion adicional; no como sustituto de firma explicita.

## Instalacion y manual

Abrir el DMG adecuado, arrastrar la app a Aplicaciones, esperar la copia,
expulsar la imagen y abrir desde Aplicaciones. DMG UDZO/HFS+, icono de Compress,
enlace a /Applications, flecha e instrucciones en castellano. Fondo 640 x 420
con representacion Retina. No requiere Homebrew.

Manual A4 de dos paginas: fuentes y capturas reales en docs/manual/.

    python3 docs/manual/build_manual.py

Requiere ReportLab y Pillow. El PDF queda en output/pdf/, fuera de Git.
Ambas paginas se renderizan e inspeccionan y contienen texto seleccionable.

## Pruebas

Apple Silicon firmado: carga/copia, inspector, proxy/reproduccion, IN/OUT,
cola/orden/eliminacion, K2, H.264, guardado, log, limite por archivo y limpieza.
Datos sinteticos y --user-data-dir separado. El harness simula selector y
dialogo de guardado; el resto usa UI, IPC y ejecutables reales del bundle.

El host no tiene Rosetta: no ejecuta x64. Firmas, minimos y notarizacion Intel
comprobados; ejecucion Intel moderna y High Sierra, rendimiento e ingesta
Grass Valley quedan para campo. La prueba de Teleprompter no valida Compress.

## NAS y GitHub

Entrega nueva en release_archive/DoTwo_Compress_0.1.8_signed_20261006/, dentro de
/Volumes/BackUP_MacMini/DoTwo_Compress/. Incluye DMG, ZIP opcional de la app
aprobada y grapada, manual, instrucciones, IDs, resultados y sumas SHA256.
Se comparan hashes tras copiar y se conservan releases anteriores.

Backup limpio en repo_backups/: codigo, Git, documentacion y fuentes del manual;
excluye builds, PDF generado, binarios vendor, node_modules y credenciales.
Fuente 0.1.8 sincronizada con `main` de GitHub el 2026-10-06. Sin tags ni
GitHub Releases. Los manifiestos de los DMG existentes registran
`sourceDirty: true`; el push y el CI posterior no prueban procedencia exacta
de esos binarios. Conservarlos sin modificar y cerrar esa evidencia antes de
una publicacion definitiva.

## Referencias

- [Electron: calendario](https://releases.electronjs.org/schedule).
- [Electron: compatibilidad](https://www.electronjs.org/docs/latest/breaking-changes).
- [electron-builder 26](https://www.electron.build/v26/docs/mac/).
- [Apple: notarizacion](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).
- Guia del host: /Users/dotwo/Repos/APPLE_SIGNING_DMG_HANDOFF.md.
