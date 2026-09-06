# WispOS Emulator Library

This repository is the signed distribution channel and reproducible build source for optional WispOS emulator cores.

WispOS keeps console implementations outside the base operating-system image. Users install cores on demand under `WispOS/Emulators/<core-id>/<version>/`. Games provides the library and player UI and receives only verified core bytes through the WispOS emulator service.

## Supported architecture

Wisp Emulator Core ABI 1 is the stable package boundary. It is for cartridge-oriented systems whose complete game image can be buffered into WebAssembly memory before launch. The catalog currently ships:

- mGBA for Game Boy, Game Boy Color, and Game Boy Advance.
- jgenesis Genesis for Mega Drive / Genesis.
- jgenesis SNES for Super Nintendo / Super Famicom.

Large random-access media, firmware-heavy systems, dynamic translation, and GPU-specific console runtimes are outside ABI 1. WispOS does not advertise or reserve a speculative ABI for them. A later ABI is accepted only with a functional core, a bounded host contract, legal test software, and complete isolation and recovery evidence.

See `CORE_ABI.md`, `CORE_TARGETS.md`, and `CATALOG.md` for the accepted contracts.

## Trust model

GitHub is transport only. `catalog.json` and every distributed emulator package are authorized by the pinned WispOS ECDSA P-256 signing key. Package URLs pin an immutable Git commit. Artifact size and SHA-256 values are signed and verified before installation. WispOS writes a complete verified version before its `package.json` and retains a bounded rollback version.

Commercial ROMs, copyrighted BIOS files, console firmware, decryption keys, and personal save data do not belong in this repository.

## Core policy

Prefer one independently updateable plugin per console. A plugin can cover a hardware family when one compact upstream runtime naturally supports that family without unrelated code.

Every published package declares a signed WebAssembly entrypoint, ABI version, system IDs and file extensions, immutable corresponding source, license metadata, and no WispOS service permissions. A build recipe or upstream web frontend is not sufficient for catalog publication. The built package must execute legal test software through the WispOS boundary and pass package, isolation, and integration verification.