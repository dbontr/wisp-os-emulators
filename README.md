# WispOS Emulator Library

This repository is the signed distribution channel and build source for optional WispOS emulator cores.

WispOS itself stays small. Emulator cores install on demand under `WispOS/Emulators/<core-id>/<version>/` and are not part of the base WispOS distribution budget. Games owns the library/player experience and consumes verified cores through the WispOS emulator service.

## Core tiers

- **ABI 1 cartridge cores** are compact standalone WebAssembly reactors. Build adapters currently cover mGBA for GB/GBC/GBA and jgenesis for Mega Drive/Genesis and SNES.
- **Streamed high-performance cores** cover large-media systems such as GameCube/Wii, Wii U, Xbox 360, and Switch. They remain completely optional and require a separate bounded media/GPU/thread execution contract before catalog publication. GameCube/Wii currently has a pinned Gecko browser-build probe because Gecko already targets WebAssembly/WebGPU upstream.

See `CORE_TARGETS.md`, `CORE_ABI.md`, `STREAMED_CORE_DESIGN.md`, and `MODERN_CORE_PROBES.md` for the current contracts and gates.

## Trust model

GitHub is transport only. `catalog.json` and every distributed emulator package are authorized by the pinned WispOS ECDSA P-256 signing key. Package artifacts are SHA-256 verified before installation. WispOS downloads and verifies a complete core version before writing it to OneDrive, writes that version's `package.json` last, and retains earlier verified versions for rollback.

Commercial ROMs, copyrighted BIOS files, console firmware, decryption keys, and personal save data do not belong in this repository.

## Core policy

Prefer one independently updateable plugin per console. A plugin may cover multiple systems when the chosen implementation naturally represents one hardware family and bundling avoids duplicating the same runtime. Do not merge unrelated consoles merely to reduce catalog entries.

Every published ABI 1 package declares:

- `kind: "emulator"`
- `metadata.type: "emulator-core"`
- `metadata.coreAbi: 1`
- one or more system IDs, display names, and cartridge extensions
- immutable upstream source revision and license metadata
- a signed WebAssembly entrypoint
- a signed artifact table containing the applicable upstream license
- no WispOS service permissions

The catalog remains conservative: source, an upstream browser build, or a build recipe is not enough. A core appears in `catalog.json` only after its built package is functional in the browser, license-complete, signed, isolated behind WispOS capabilities, and verified.
