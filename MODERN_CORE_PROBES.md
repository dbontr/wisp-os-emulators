# Modern core probes

Modern-console support is developed as measured build probes before it becomes a WispOS emulator package. A successful upstream browser build proves toolchain feasibility only. It does not grant catalog eligibility.

## GameCube / Wii: Gecko web probe

Primary candidate: [ioncodes/gecko](https://github.com/ioncodes/gecko), pinned to `da39be17b22eb7316e772d2369da15df3a52f7f0` for the current probe.

Gecko is preferred for the first GameCube/Wii probe because it already maintains a browser build of the emulator. Its web crate uses `wasm32-unknown-unknown`, `wasm-bindgen`, and `wgpu` with the browser WebGPU backend. This avoids treating a desktop-only frontend as evidence of browser viability.

`probes/gecko-web/build.sh` reproduces the upstream release browser build at the pinned revision and emits `probe-report.json` with exact generated file sizes. Probe artifacts are CI output only and are not added to `catalog.json`.

Before Gecko can become a WispOS core, the Wisp adapter must remove or own all of the following browser authority currently present in the upstream web frontend:

- DOM/window/canvas ownership;
- browser file picker and `FileReader` access;
- direct game/system-file lifetime management;
- frontend input and UI state;
- persistence outside WispOS save/storage capabilities.

WebGPU execution may remain browser-backed, but Games/WispOS must own authorization and lifecycle. Large ISO/RVZ media must use the bounded streamed-media design rather than being copied through kernel IPC.

Dolphin remains a compatibility and architecture reference, not the first browser port target.

## Wii U: Cemu

Cemu is the primary compatibility reference. Its supported application targets are native 64-bit Windows, Linux, and macOS. Incidental `__EMSCRIPTEN__` references in bundled utility/frontend code do not constitute an emulator WebAssembly port. A WispOS core therefore requires a dedicated browser CPU/GPU/platform adaptation before package work is justified.

## Xbox 360: Xenia

Xenia is the primary compatibility reference. The upstream emulator is built around native 64-bit execution and D3D12/Vulkan-class GPU backends; there is no upstream Emscripten integration. The first useful WispOS work is CPU-translation and WebGPU feasibility, not a package wrapper around the desktop build.

## Nintendo Switch: Voland

Voland is the preferred browser-architecture research target because it is designed around a C core, WebAssembly, WebGPU, SharedArrayBuffer, and browser workers. It is not yet a functional compatibility core, so WispOS must not publish or advertise Switch compatibility from it until legal test software actually executes.

## Promotion gates

A modern probe becomes an installable WispOS core only after all of these are true:

1. The upstream revision is immutable and its license obligations are packaged.
2. The browser build is reproducible in WispOS CI.
3. WispOS, not the core, owns provider credentials, canonical storage, file selection, and save persistence.
4. Large game media uses bounded random-access streaming and disposable device-local cache.
5. Required WebGPU, shared-memory, SIMD, memory, and worker capabilities are declared before launch.
6. Core failure or GPU loss cannot crash the kernel, shell, VFS, or unrelated apps.
7. Legal homebrew/test software passes an end-to-end browser smoke test.
8. The signed package passes the WispOS installer and rollback path.
