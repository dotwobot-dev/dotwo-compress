# Distribution

Current public builds are intended as unsigned beta ZIPs for technical users
and internal testing.

## Current status

- The app can be built locally from source.
- Generated ZIPs are not signed with Apple Developer ID.
- Generated ZIPs are not notarized by Apple.
- macOS Gatekeeper can show security warnings for downloaded builds.
- FFmpeg/FFprobe binaries are not versioned in public Git history.

## Build from source

Install dependencies and fetch the expected FFmpeg/FFprobe binaries:

```bash
npm ci
npm run fetch:ffmpeg
npm run check
```

Package examples:

```bash
npm run pack:mac-arm64
npm run pack:mac-intel
npm run pack:mac-legacy
```

Release ZIP examples:

```bash
npm run zip:mac-arm64
npm run zip:mac-intel
npm run zip:mac-legacy
```

See also:

- `docs/BUILD_MATRIX.md`
- `docs/DISTRIBUCION_MACOS.md`
- `docs/BINARY_DEPENDENCIES.md`

## Future signing plan

The intended next distribution step is:

- Apple Developer ID certificate.
- Signed app bundles.
- Apple notarization.
- Signed ZIP/DMG/PKG release artifacts.
- Institutional deployment notes if the app is distributed in lab machines.

Until that is in place, public releases should be labelled clearly as unsigned
beta builds.
