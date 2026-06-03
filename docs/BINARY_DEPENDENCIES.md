# Dependencias binarias

Fecha de recopilacion: 2026-06-01

La app empaquetada no depende de Homebrew ni de instalaciones del sistema. Electron llama a los binarios preparados en `vendor/ffmpeg` mediante las rutas internas de la `.app`.

Los binarios de FFmpeg/FFprobe no se versionan en el Git publico. Para prepararlos localmente:

```bash
npm run fetch:ffmpeg
```

El script descarga los ZIPs, extrae los binarios, aplica permisos de ejecucion y verifica los hashes SHA256 esperados.

## FFmpeg / FFprobe

| Variante | Ruta | Fuente | Version | Minimo macOS | Uso |
| --- | --- | --- | --- | --- | --- |
| Intel x64 | `vendor/ffmpeg/darwin-x64/ffmpeg` | `https://evermeet.cx/ffmpeg/getrelease/zip` | `8.1.1-tessus` | `10.13` | Intel moderna y legacy |
| Intel x64 | `vendor/ffmpeg/darwin-x64/ffprobe` | `https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip` | `8.1.1-tessus` | `10.13` | Intel moderna y legacy |
| Apple Silicon arm64 | `vendor/ffmpeg/darwin-arm64/ffmpeg` | `https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip` | `8.1.1-https://www.martin-riedl.de` | `12.0` | Apple Silicon |
| Apple Silicon arm64 | `vendor/ffmpeg/darwin-arm64/ffprobe` | `https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip` | `8.1.1-https://www.martin-riedl.de` | `12.0` | Apple Silicon |

## SHA256

```text
3a0ea97adddecfbf87b865da3bcbb321edfce4bab18a98ae1ba4ba9f0bd1f93a  vendor/ffmpeg/darwin-x64/ffmpeg
a976306bcb8c9c50b2ac4e91f5aac4e45395e1f9063c46aecf1e1213e41c631b  vendor/ffmpeg/darwin-x64/ffprobe
ef4fe121377039053b0d7bed4a9aa46e7912918f5ba6424a1dd155f4eed625b0  vendor/ffmpeg/darwin-arm64/ffmpeg
3ec76ddd72068162294249465c36257d6c1add564f9b078e31e173837832967d  vendor/ffmpeg/darwin-arm64/ffprobe
```

## Comprobaciones realizadas

- `file`: confirma `x86_64` para Intel y `arm64` para Apple Silicon.
- `otool`: confirma minimo `10.13` en x64 y `12.0` en arm64.
- `chmod +x`: permisos de ejecucion aplicados.
- Conversion de prueba con `darwin-arm64` sobre `colasT2.mov`: completada.
- Validacion tecnica de la salida arm64: correcta. El tag PCM `sowt` queda aceptado como valido porque la prueba real con Grass Valley K2 ha sido positiva.

## Nota importante

FFmpeg y FFprobe son dependencias binarias de terceros y no estan cubiertas por la licencia Apache-2.0 de DoTwo Compress. Antes de redistribuir builds que los incluyan, revisar la licencia exacta de los binarios descargados:

```bash
vendor/ffmpeg/darwin-x64/ffmpeg -L
vendor/ffmpeg/darwin-arm64/ffmpeg -L
```

La build Apple Silicon queda preparada con los binarios arm64 disponibles, pero su minimo real de sistema para FFmpeg/FFprobe es macOS 12.0. La build legacy para macOS 10.13 debe seguir siendo Intel x64 con Electron `26.6.10`.
