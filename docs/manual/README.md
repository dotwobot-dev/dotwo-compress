# Fuentes del manual rapido

Version 0.1.8. Manual en castellano, dos paginas A4.

- content.json: texto editable y orden de secciones.
- build_manual.py: maquetacion ReportLab, con comprobacion de desbordes.
- assets/: capturas reales del bundle Apple Silicon firmado, con datos sinteticos.
- installation-finder.png: presentacion DMG comprobada en Finder.

Generar con Python, ReportLab y Pillow:

    python3 docs/manual/build_manual.py

Salida PDF ignorada por Git: output/pdf/DoTwo_Compress_Manual_Rapido_0.1.8.pdf.
Renderizar ambas paginas con pdftoppm e inspeccionarlas antes de entregar.
Comprobar exactamente dos paginas A4 y texto seleccionable.

Las capturas las genera scripts/smoke-electron.cjs usando Playwright para
Electron; los dialogos de seleccion/guardado se simulan, el resto es la app
y sus ejecutables reales. Nunca usar medios de alumnos ni el perfil de trabajo.
Conservar los originales: las capturas detail son recortes del elemento real,
no montajes de estado ni interfaces simuladas. No reutilizar imagenes de otra app.
