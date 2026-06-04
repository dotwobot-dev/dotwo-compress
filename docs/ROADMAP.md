# Roadmap

This public roadmap summarizes the active direction of DoTwo Compress. The
fuller Spanish roadmap remains in `docs/HOJA_DE_RUTA.md`.

Near-term priorities:

- Keep K2/XDCAM and H.264 conversion reliable for lab workflows.
- Keep FFmpeg/FFprobe outside public Git history and fetch them with verified
  hashes.
- Improve public packaging notes and unsigned beta distribution.
- Prepare signed and notarized macOS builds when Apple Developer ID is ready.

Distribution roadmap:

- Unsigned ZIP beta builds.
- Signed app bundle.
- Apple notarization.
- Signed ZIP, DMG, or PKG release.

Architecture note:

- Electron remains the primary product for now, using each lab host for local
  processing.
- The local server prototype is parked as a future path for an internal SaaS
  model if university-hosted processing capacity becomes available.
