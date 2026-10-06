# Roadmap

This public roadmap summarizes the active direction of DoTwo Compress. The
fuller Spanish roadmap remains in `docs/HOJA_DE_RUTA.md`.

Near-term priorities:

- Keep K2/XDCAM and H.264 conversion reliable for lab workflows.
- Keep FFmpeg/FFprobe outside public Git history and fetch them with verified
  hashes.
- Validate signed 0.1.8 DMG installation on actual lab Macs and Grass Valley.
- Maintain resumable signing/notarization and the editable two-page Spanish guide.

Distribution roadmap:

- 0.1.8: signed apps, Apple notarization and stapled DMGs completed locally/NAS.
- Modern ARM64/x64 require macOS 12; frozen x64 legacy retains macOS 10.13.
- Managed PKG remains a separate future option. No GitHub publication in this task.

Architecture note:

- Electron remains the primary product for now, using each lab host for local
  processing.
- The local server prototype is parked as a future path for an internal SaaS
  model if university-hosted processing capacity becomes available.
