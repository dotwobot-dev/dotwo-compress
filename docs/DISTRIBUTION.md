# Distribution

As of 2026-10-06, version 0.1.8 is delivered locally/NAS as Developer ID signed,
Apple-notarized apps and DMGs with stapled tickets. Earlier unsigned ZIP beta
packages remain historical. No GitHub publication is part of this task.

Three separate variants: modern ARM64 and Intel x64 (Electron 43.7.7, macOS 12+),
and frozen Intel legacy (Electron 26.6.10, macOS 10.13+).

    npm ci
    npm run check
    npm test
    npm run check:mac-signing
    npm run build:dmg-background
    npm run release:mac:signed -- --all

The resumable workflow persists Apple submission IDs before bounded waits.
If processing continues, resume the same candidate with --resume /absolute/path.
Never modify submitted apps or repeat uploads with unknown outcomes automatically.
The local Keychain profile is dotwo-notary; private keys are never exported.

Installation: open the correct DMG, drag the app to Applications, eject the DMG,
then open the installed app. Each variant carries only its own FFmpeg/FFprobe
with signed code, timestamps, hardened runtime and third-party license notices.

Editable Spanish manual and real screenshots: docs/manual/. Generated PDF
stays outside Git. See DISTRIBUCION_MACOS.md, BUILD_MATRIX.md and
MANIFIESTO_0_1_8_FIRMADO.md for verification and field-test limitations.
