# Emulator core targets

The signed catalog contains only cores that pass the complete WispOS package and execution gate. Optional cores do not affect WispOS boot size unless a user installs them.

| Systems | Core | Upstream | Raw WASM | Imports | Status |
| --- | --- | --- | ---: | ---: | --- |
| Game Boy / Game Boy Color / Game Boy Advance | `mgba` | mGBA | 660,628 B | 8 | Published and verified |
| Mega Drive / Genesis | `jgenesis-genesis` | jgenesis | 1,330,585 B | 3 | Published and verified |
| Super Nintendo / Super Famicom | `jgenesis-snes` | jgenesis | 688,457 B | 4 | Published and verified |

The verification gate rebuilds each pinned source, checks the ABI and import boundary, executes a generated legal synthetic cartridge, produces multiple video/audio frames, resets the core, and exercises supported persistent-state paths. WispOS also installs each signed package from its immutable catalog URL and executes all three cores through Games.

No commercial or third-party test ROM is stored in this repository. Test cartridges are generated in memory.

## Size and package policy

- Cartridge cores contain no desktop frontend, updater, debugger, ROM, BIOS, shader pack, font bundle, or general emulator shell.
- Each upstream revision is immutable and recorded in signed package metadata.
- Each package includes its applicable upstream license and corresponding-source reference.
- Game content, firmware, keys, BIOS files, and personal saves remain outside this repository.
- Cores receive Wisp input, video, audio, and save callbacks rather than DOM, OneDrive, Microsoft Graph, or network authority.
- A new console enters the catalog only after its signed package executes legal test software through the WispOS integration boundary.

ABI 1 deliberately stops at fully buffered cartridge-style media. A system that needs large random-access media or a broader execution model requires a new ABI justified by a working implementation; it is not part of this catalog contract.