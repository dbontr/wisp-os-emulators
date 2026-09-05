# Wisp streamed core ABI draft

**Status: draft only.** This contract is intentionally rejected by current WispOS. It exists to make the GameCube/Wii, Wii U, Xbox 360, and Switch work testable before a stable ABI number is accepted.

## Goals

The streamed runtime must support large media, WebGPU, dynamic CPU translation, user-supplied system material, and multi-worker execution without giving an emulator core WispOS storage/provider authority.

The trusted boundary is:

```text
Games / WispOS trusted services
        |
        | verified package + narrow host channel
        v
isolated core runtime
        |
        +-- WebAssembly / signed loader glue
        +-- WebGPU surface
        +-- bounded workers / shared memory when declared
```

The core cannot access Microsoft Graph, OneDrive credentials, the Games service bridge, arbitrary Wisp VFS paths, or unrestricted networking.

## Candidate package metadata

A future package may declare a streamed execution profile similar to:

```json
{
  "metadata": {
    "type": "emulator-core",
    "coreAbi": 2,
    "execution": {
      "profile": "streamed-web",
      "entrypoint": "loader.js",
      "wasm": "core.wasm",
      "memoryMiB": { "minimum": 256, "preferred": 512, "maximum": 1024 },
      "workers": { "maximum": 4, "sharedMemory": true },
      "simd": true,
      "webgpu": { "required": true },
      "media": { "mode": "random-access", "maxReadBytes": 1048576 },
      "cacheMiB": 512
    }
  }
}
```

This is illustrative. Current package verification must reject `coreAbi: 2`; the shape is not stable until an end-to-end prototype passes the gates below.

## Runtime channel

The isolated runtime gets one host-controlled message channel. It does not receive a WispOS service object. Messages are versioned and size-bounded.

Host-to-core candidate messages:

- `INIT`: immutable execution profile and logical system-material descriptors.
- `MEDIA_READY`: logical media ID, byte size, block size, and read constraints.
- `MEDIA_DATA`: response to one bounded media request.
- `INPUT`: timestamped digital/analog controller state.
- `PAUSE`, `RESUME`, `RESET`, `STOP`.
- `SAVE_DATA`: previously persisted save or state bytes after an explicit core request.
- `GPU_LOST`: device-loss notification requiring core recovery or termination.

Core-to-host candidate messages:

- `READY` and `FAULT`.
- `MEDIA_READ`: media ID, offset, byte count, request ID.
- `SAVE_WRITE`: named bounded save/state payload.
- `RUMBLE`: bounded controller output request.
- `METRICS`: optional bounded frame-time/memory counters, never telemetry to a network endpoint.

Messages carrying bulk bytes use transferable buffers or shared bounded rings rather than JSON arrays.

## Random-access media

Large game images are immutable logical media objects. The core never receives the provider URL. A request must satisfy all declared bounds:

```text
0 <= offset < media_size
0 < bytes <= max_read_bytes
offset + bytes <= media_size
outstanding_requests <= queue_depth
```

The trusted media service may satisfy reads from a disposable OPFS cache or fetch the required provider range. Cache files are not canonical data and may be deleted at any time.

A synchronous emulator I/O API may be implemented over a shared request ring only when cross-origin isolation and the package's declared shared-memory requirement are both satisfied. Otherwise the adapter must schedule asynchronous cache fills between execution slices.

## System material

Firmware, BIOS, keys, NAND/system files, and similar material are typed slots declared by the core. WispOS provides only user-selected material and never distributes vendor-owned system data in this repository.

Each slot declares:

- stable ID and human-readable purpose;
- required/optional;
- maximum byte size or random-access mode;
- whether content is immutable during a session;
- expected hashes only when they describe known user-dumped material and do not expose copyrighted content.

The runtime receives logical material handles, not arbitrary filesystem paths.

## GPU and presentation

WebGPU capability is negotiated before core creation. The package declares hard requirements; WispOS rejects launch if unavailable rather than falling back to broader authority.

The core may receive a Wisp-owned canvas/surface or an `OffscreenCanvas` transferred to its isolated runtime. It may not discover or manipulate unrelated WispOS DOM.

GPU device loss must terminate or recreate only the emulator runtime. It must not crash Games, the shell, kernel, or other apps.

## JavaScript glue

ABI 1 remains WebAssembly-only. Streamed cores may need generated JavaScript glue (for example wasm-bindgen) during experimentation.

If signed JavaScript is admitted in the eventual streamed ABI:

1. It is an explicit signed artifact with a hash in the package manifest.
2. It executes only inside the isolated core runtime.
3. It has no Games app bridge or provider credentials.
4. Runtime network policy denies `fetch`, WebSocket, EventSource, and equivalent external communication regardless of package code.
5. Persistent browser storage is not canonical save storage.
6. Package verification uses a separate streamed-core artifact allowlist; ABI 1 is not broadened.

## Resource limits

Before launch WispOS evaluates the package-declared hard limits against the browser/device. At minimum:

- maximum WebAssembly memory;
- worker count;
- shared-memory requirement;
- SIMD requirement;
- WebGPU requirement and limits;
- disposable cache budget;
- maximum media request and queue depth;
- maximum save/state payload.

A core exceeding a hard limit is stopped rather than silently granted more resources.

## Promotion gates

The draft can become a stable ABI only after one real modern core, preferably the pinned Gecko GameCube/Wii probe, demonstrates all of the following with legal homebrew/test software:

1. Reproducible signed package build.
2. No provider credential or direct Wisp VFS access in the core runtime.
3. Network-denial test passes.
4. Bounded random-access media works without copying the entire image through kernel IPC.
5. WebGPU rendering works and device loss is contained.
6. Input, audio, persistent saves, reset, stop, and crash recovery work.
7. Worker and memory ceilings are enforced.
8. User-supplied system material is handled only through typed logical slots.
9. Reinstall/update/rollback preserves canonical saves and does not require a System rebuild.
10. Browser performance is measured on representative hardware before the core is added to the catalog.

Until then, `coreAbi: 2` is documentation, not a supported package format.
