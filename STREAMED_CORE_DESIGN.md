# Streamed high-performance core design

This document defines the requirements for consoles whose software images are too large for the buffered cartridge model in Wisp Emulator Core ABI 1. It is a design gate, not an accepted package ABI. Current WispOS must reject these packages until the corresponding runtime contract is implemented and verified.

## Motivation

ABI 1 copies a selected game into WebAssembly memory before execution. That model is appropriate for cartridge images measured in kilobytes or tens of megabytes. GameCube, Wii, Wii U, Switch, and Xbox 360 software can be gigabytes and requires random-access media, larger memories, GPU translation, and often dynamic recompilation or equivalent CPU translation.

These systems must not cross the WispOS kernel's bounded JSON IPC channel as executable or game-image byte arrays. They also must not force large downloads during WispOS boot.

## Required properties

A future streamed core ABI must provide all of the following:

- Demand-loaded execution in a dedicated worker or worker group.
- Bounded random-access reads over the user's selected game image.
- No Microsoft token, OneDrive provider object, filesystem root, or unrestricted network authority in the emulator core.
- WebGPU as the preferred translated GPU backend when the emulator architecture can support it, with explicit capability negotiation and a safe fallback or a clear unsupported result.
- Shared-memory/thread support only when cross-origin isolation is active and the selected core declares that requirement.
- Per-core memory and worker limits that are visible before launch.
- Persistent saves written through Games to the user's selected data source. Browser cache is disposable.
- Firmware, keys, and other user-supplied system material must be explicitly selected and must never ship in the Emulator Library.
- Core crashes, GPU device loss, malformed media, and worker termination must remain contained outside the kernel and unrelated applications.

## Media transport

The canonical game image remains in the user-selected data source. A trusted WispOS userspace service may materialize an authenticated range into a bounded device-local cache. For a dedicated worker, a synchronous core-facing read can be backed by already-present memory pages or a `FileSystemSyncAccessHandle` over disposable OPFS cache data. Cache misses are resolved by the trusted service between execution slices; the core never receives provider credentials.

The runtime should expose media as a logical immutable object with size and block-read semantics rather than a provider URL. A typical low-level shape is:

```c
uint64_t wisp_media_size(void);
int32_t  wisp_media_read(uint64_t offset, uint32_t dst, uint32_t bytes);
```

A production ABI must specify cache-miss behavior, cancellation, read alignment, maximum request size, and concurrency before these functions become stable.

## Execution profiles

The future package metadata should declare a bounded execution profile rather than guessing from a console name. Candidate fields include:

- minimum and preferred WebAssembly memory;
- maximum worker count;
- shared-memory requirement;
- SIMD requirement;
- WebGPU requirement and required limits/features;
- media access mode;
- firmware material types, when legally required from the user;
- optional persistent shader/cache budget.

WispOS may refuse launch when the browser cannot meet a declared hard requirement. It must not silently grant broader host authority.

## Console targets

- GameCube and Wii: Dolphin is the primary upstream architecture to evaluate.
- Wii U: Cemu is the primary upstream architecture to evaluate.
- Xbox 360: Xenia is the primary upstream architecture to evaluate.
- Switch: browser-native work is required before a functional package can be promised. Voland is useful as a WebAssembly/WebGPU architecture reference but is not treated as a functional compatibility core.

No target in this section is cataloged until it executes legal test software through the signed WispOS package boundary and passes performance, isolation, and recovery gates.
