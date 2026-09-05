# WispOS Emulator Library

This repository is the signed distribution channel for optional WispOS emulator cores.

WispOS itself stays small. Emulator cores are installed on demand under `WispOS/Emulators/<core-id>/<version>/` and are not part of the base WispOS distribution budget. The Games app owns no console implementation; it consumes verified cores through the WispOS emulator service.

## Trust model

GitHub is transport only. `catalog.json` and every emulator package are authorized by the pinned WispOS ECDSA P-256 signing key. Package artifacts are SHA-256 verified before installation. WispOS downloads and verifies a complete core version before writing it to OneDrive, writes `package.json` last, and retains earlier verified versions for rollback.

Commercial ROMs, copyrighted BIOS files, firmware, keys, and personal save data do not belong in this repository.

## Core policy

Prefer one independently updateable plugin per console. A plugin may cover multiple systems only when one emulator implementation naturally represents a hardware family, for example Game Boy + Game Boy Color or Master System + Game Gear. Do not merge unrelated consoles merely to reduce catalog entries.

Every core package declares:

- `kind: "emulator"`
- `metadata.type: "emulator-core"`
- `metadata.coreAbi: 1`
- one or more system IDs, display names, and ROM extensions
- a signed WebAssembly entrypoint
- a signed artifact table
- no WispOS service permissions

See `CORE_ABI.md` and `CATALOG.md` for the stable contracts.
