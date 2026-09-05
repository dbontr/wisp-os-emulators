# Emulator core targets

WispOS keeps console implementations out of the base operating-system image. Each target is an independently installable core package and does not affect WispOS boot size unless the user installs it.

A target is catalog-eligible only after its pinned build is reproducible, the resulting package satisfies its Wisp core ABI, license obligations are included, and a functional browser smoke test passes with legal test software. A source adapter or successful compile alone is not a compatibility claim.

| Systems | Package target | Execution tier | Upstream | Package size goal | Gate |
| --- | --- | --- | --- | ---: | --- |
| Game Boy / Game Boy Color / Game Boy Advance | `mgba` | ABI 1 cartridge | mGBA | <= 1.5 MiB | Build implemented; ABI and browser smoke gates required |
| Mega Drive / Genesis | `jgenesis-genesis` | ABI 1 cartridge | jgenesis | <= 2 MiB | ABI verified; browser smoke gate required |
| Super Nintendo / Super Famicom | `jgenesis-snes` | ABI 1 cartridge | jgenesis | <= 1 MiB | ABI verified; browser smoke gate required |
| GameCube / Wii | `dolphin` | streamed high-performance | Dolphin | measured, no artificial cap | Streamed ABI and browser execution research required |
| Wii U | `cemu` | streamed high-performance | Cemu | measured, no artificial cap | Streamed ABI and browser execution research required |
| Xbox 360 | `xenia` | streamed high-performance | Xenia | measured, no artificial cap | Streamed ABI and browser execution research required |
| Nintendo Switch | `switch` | streamed high-performance | browser-native research; Voland as an architecture reference | measured, no artificial cap | Research target; no functional catalog core yet |

## Size policy

`Lightweight` means two different things depending on the hardware generation:

- Cartridge-era cores are small standalone WebAssembly modules with no bundled frontend, ROMs, BIOS files, shaders, fonts, or general emulator shell.
- Disc and modern-console cores remain completely optional and demand-loaded. Their package size is measured and minimized, but correctness is not traded for an arbitrary tiny binary target.

The WispOS base image must never absorb an emulator implementation merely to reduce the number of optional files.

## Porting rules

1. Pin each upstream revision. Do not build catalog packages from a moving branch or `tip` archive.
2. Remove upstream desktop UI, updater, debugger, telemetry, file picker, network, and unrelated platform backends from the runtime package.
3. Keep game content, firmware, keys, BIOS files, and personal saves outside this repository.
4. Use the Wisp input/video/audio/save boundary rather than giving a core DOM, OneDrive, Microsoft Graph, or arbitrary network authority.
5. Keep cartridge cores on ABI 1. Large random-access media requires the streamed execution design and must not be copied through kernel IPC or entirely duplicated in core memory.
6. Include the upstream license and an immutable Corresponding Source reference in every distributed core package.
7. Do not add a core to `catalog.json` until its signed package is functional and independently verified.
