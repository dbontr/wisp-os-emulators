# WispOS Emulator Library

This repository is the signed distribution channel and build source for optional WispOS emulator cores.

WispOS itself stays small. Emulator cores install on demand under `WispOS/Emulators/<core-id>/<version>/` and are not part of the base WispOS distribution budget. Games owns the library/player experience and consumes verified cores through the WispOS emulator service.

## Core tiers

- **ABI 1 cartridge cores** are compact standalone WebAssembly reactors. GB/GBC/GBA is the first build target, followed by selected 16-bit systems.
- **Streamed high-performance cores** cover large-media systems such as GameCube/Wii, Wii U, Xbox 360, and Switch. They remain completely optional and require a separate bounded media/GPU/thread execution contract before catalog publication.

See `CORE_TARGETS.md`, `CORE_ABI.md`, and `STREAMED_CORE_DESIGN.md` for the current contracts and gates.

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
- a signed WebAssembly entrypoint
- a signed artifact table
- no WispOS service permissions

The catalog remains conservative: source or a build recipe is not enough. A core appears in `catalog.json` only after its built package is functional, license-complete, signed, and verified.
