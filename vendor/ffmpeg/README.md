# FFmpeg para builds locales

Para que la app funcione en laboratorio sin Homebrew, las builds empaquetadas necesitan binarios ejecutables de FFmpeg/FFprobe en:

```text
vendor/ffmpeg/
├── darwin-x64/
│   ├── ffmpeg
│   └── ffprobe
└── darwin-arm64/
    ├── ffmpeg
    └── ffprobe
```

Los binarios no se versionan en el Git publico. Se descargan localmente con:

```bash
npm run fetch:ffmpeg
```

El script descarga los ZIPs, extrae los binarios, aplica permisos de ejecucion y verifica los hashes SHA256 esperados. Si una fuente publica actualiza su build, el script fallara por hash hasta que se revise y actualice esta documentacion.

FFmpeg y FFprobe son herramientas de terceros. No estan cubiertas por la licencia Apache-2.0 de DoTwo Compress. Consulta `THIRD_PARTY_NOTICES.md` y la salida de `ffmpeg -L` de los binarios descargados antes de redistribuir builds que los incluyan.

## Intel / legacy macOS 10.13

Los binarios `darwin-x64` actuales se han descargado desde:

```text
https://evermeet.cx/ffmpeg/getrelease/zip
https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip
```

Verificacion local:

```text
Mach-O 64-bit executable x86_64
LC_VERSION_MIN_MACOSX version 10.13
ffmpeg/ffprobe 8.1.1-tessus
```

Se usan para:

- Intel moderna.
- Intel legacy macOS 10.13 High Sierra.

Para macOS 10.13 hace falta `darwin-x64` compatible con High Sierra. No sirve cualquier build moderna si se ha compilado con un `LC_BUILD_VERSION` o runtime minimo superior.

## Apple Silicon

Los binarios `darwin-arm64` actuales se han descargado desde:

```text
https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip
https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip
```

Verificacion local:

```text
Mach-O 64-bit executable arm64
LC_BUILD_VERSION minos 12.0
ffmpeg/ffprobe 8.1.1-https://www.martin-riedl.de
```

Se usan para:

- Apple Silicon.

Con estos binarios, la build Apple Silicon queda orientada a macOS 12 o superior. Si hiciera falta Apple Silicon para macOS 11, habria que buscar otra build arm64 o compilar FFmpeg/FFprobe especificamente con ese minimo.

## Hashes SHA256

```text
3a0ea97adddecfbf87b865da3bcbb321edfce4bab18a98ae1ba4ba9f0bd1f93a  vendor/ffmpeg/darwin-x64/ffmpeg
a976306bcb8c9c50b2ac4e91f5aac4e45395e1f9063c46aecf1e1213e41c631b  vendor/ffmpeg/darwin-x64/ffprobe
ef4fe121377039053b0d7bed4a9aa46e7912918f5ba6424a1dd155f4eed625b0  vendor/ffmpeg/darwin-arm64/ffmpeg
3ec76ddd72068162294249465c36257d6c1add564f9b078e31e173837832967d  vendor/ffmpeg/darwin-arm64/ffprobe
```

## Permisos

Los binarios deben tener permiso de ejecucion:

```bash
chmod +x vendor/ffmpeg/darwin-x64/ffmpeg vendor/ffmpeg/darwin-x64/ffprobe
chmod +x vendor/ffmpeg/darwin-arm64/ffmpeg vendor/ffmpeg/darwin-arm64/ffprobe
```
