# Streamed high-performance core design

This document defines the requirements for consoles whose software images are too large for the buffered cartridge model in Wisp Emulator Core ABI 1. It is a design gate, not an accepted package ABI. Current WispOS must reject these packages until the corresponding runtime contract is implemented and verified.

## Motivation

ABI 1 copies a selected game into WebAssembly memory before execution. That model is appropriate for cartridge images measured in kilobytes or tens of megabytes. GameCube, Wii, Wii U, Switch, and Xbox 360 software can be gigabytes and requires random-access media, larger memories, GPU translation, and often dynamic recompilation or equivalent CPU translation.

These systems must not cross the WispOS kernel's bounded JSON IPC channel as executable or game-image byte arrays. They also must not force large downloads during WispOS boot.

## Required properties

A future streamed core ABI must provide all of the following:

- Demand-loaded execution in an isolated runtime owned by WispOS, not in the Games application global scope.
- Bounded random-access reads over the user's selected game image.
- No Microsoft token, OneDrive provider object, filesystem root, Games service bridge, or unrestricted network authority in the emulator core.
- WebGPU as the preferred translated GPU backend when the emulator architecture can support it, with explicit capability negotiation and a safe fallback or a clear unsupported result.
- Shared-memory/thread support only when cross-origin isolation is active and the selected core declares that requirement.
- Per-core memory and worker limits that are visible before launch.
- Persistent saves written through Games to the user's selected data source. Browser cache is disposable.
- Firmware, keys, and other user-supplied system material must be explicitly selected and must never ship in the Emulator Library.
- Core crashes, GPU device loss, malformed media, and worker termination must remain contained outside the kernel and unrelated applications.

## Media transport

The canonical game image remains in the user-selected data source. A trusted WispOS userspace service may materialize authenticated ranges into a bounded device-local cache. The core sees a logical immutable media object with size and block-read semantics, never a provider URL or credential.

For a worker-oriented core, synchronous guest reads may be backed by already-present memory pages or a `FileSystemSyncAccessHandle` over disposable OPFS cache data. Cache misses are resolved by the trusted WispOS side between execution slices or through a bounded request queue.

A typical low-level shape is:

```c
uint64_t wisp_media_size(uint32_t media_id);
int32_t  wisp_media_read(uint32_t media_id, uint64_t offset, uint32_t dst, uint32_t bytes);
```

The production contract must specify cache-miss behavior, cancellation, read alignment, maximum request size, queue depth, and concurrency before these functions become stable.

## Execution containment

Modern upstream browser frontends may contain JavaScript/wasm-bindgen glue, DOM code, file pickers, or storage access. WispOS must not execute that code directly in the Games app global scope.

The target design is a Wisp-owned isolated runtime with a single transferred `MessagePort` (or an equivalent narrow binary channel) plus explicitly granted render/input/audio primitives. The core receives no Wisp app-service bridge. Network access is denied by runtime policy. Executable JavaScript, if a particular upstream requires it, must be signed as part of the core package and executed only inside this isolated runtime; merely adding `.js` to the existing ABI 1 artifact allowlist is not acceptable.

The first implementation should prefer raw WebAssembly where practical. A browser-native upstream that requires generated JavaScript glue is a candidate for the streamed runtime, not ABI 1.

## Execution profiles

Future package metadata should declare a bounded execution profile rather than guessing from a console name. Candidate fields include:

- minimum and preferred WebAssembly memory;
- maximum worker count;
- shared-memory requirement;
- SIMD requirement;
- WebGPU requirement and required limits/features;
- media access mode and maximum read request;
- firmware/system-material slots, when legally required from the user;
- optional disposable shader/JIT/cache budget;
- whether signed loader JavaScript is required.

WispOS may refuse launch when the browser cannot meet a declared hard requirement. It must not silently grant broader host authority.

## Console targets

- GameCube and Wii: Gecko is the primary browser-port candidate because its upstream project already builds the emulator for WebAssembly/WebGPU. Dolphin remains the mature compatibility and architecture reference.
- Wii U: Cemu is the primary compatibility reference; a dedicated browser CPU/GPU/platform adaptation is required before packaging.
- Xbox 360: Xenia is the primary compatibility reference; CPU translation and WebGPU feasibility come before packaging.
- Switch: Voland is the preferred browser-architecture research target, but it is not treated as a functional compatibility core until legal test software actually executes.

See `STREAMED_CORE_ABI_DRAFT.md` for the first concrete host/runtime contract and `MODERN_CORE_PROBES.md` for measured upstream build probes.

No target in this section is cataloged until it executes legal test software through the signed WispOS package boundary and passes performance, isolation, recovery, and licensing gates.
