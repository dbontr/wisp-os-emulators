# Wisp Emulator Core ABI 1

Wisp Emulator Core ABI 1 is the stable WebAssembly boundary between Games and independently signed cartridge-oriented console cores. A core contains console emulation only. WispOS retains package verification, storage, UI, input, audio, and lifecycle authority.

ABI 1 buffers the complete selected game image into core memory before execution. Large random-access media is outside this ABI and requires a separately versioned contract backed by a functional implementation.

## Execution boundary

- The package entrypoint is a standalone WebAssembly reactor.
- Games calls an exported `_initialize` function once when the toolchain emits it.
- Games then verifies `wisp_core_api_version()` and initializes the core.
- Games copies the selected game image into core memory and calls `wisp_core_load_game`.
- The `emulators` service re-verifies the installed signed entrypoint, exposes it through a short-lived process-owned chunk transfer, and the trusted app worker transfers the reconstructed `ArrayBuffer` to the sandboxed Games surface.
- A core receives no OneDrive credential, provider API, DOM authority, host filesystem root, or arbitrary network access.
- The core ABI is versioned independently from the WispOS kernel ABI.

A core can use only the declared `wisp` imports and the small `wasi_snapshot_preview1` reactor subset implemented by Games. WispOS provides no preopened directories or sockets. Unknown imports fail closed.

## Required exports

A core exports linear `memory` and these C-compatible functions:

```c
uint32_t wisp_core_api_version(void);
int32_t  wisp_core_init(void);
int32_t  wisp_core_load_game(uint32_t ptr, uint32_t bytes);
void     wisp_core_run(void);
void     wisp_core_reset(void);
void     wisp_core_unload(void);
void     wisp_core_deinit(void);
uint32_t wisp_core_alloc(uint32_t bytes);
void     wisp_core_free(uint32_t ptr);
```

`wisp_core_api_version()` returns `1`. `wisp_core_run()` advances exactly one emulated video frame. A positive `wisp_core_load_game` return indicates success.

## Wisp host imports

```c
void     video_refresh(uint32_t rgba_ptr, uint32_t width, uint32_t height, uint32_t pitch_bytes);
void     audio_batch(uint32_t s16_ptr, uint32_t frames, uint32_t sample_rate, uint32_t channels);
int32_t  input_state(uint32_t port, uint32_t control);
uint64_t monotonic_time_us(void);
```

Video is RGBA8888. Audio is interleaved signed 16-bit PCM. `input_state` returns zero for released and nonzero for active controls. `port` is the logical controller port, starting at zero.

## Standard controls

| ID | Control |
| ---: | --- |
| 0 | A / primary south |
| 1 | B / primary east |
| 2 | X / primary west |
| 3 | Y / primary north |
| 4 | Left shoulder |
| 5 | Right shoulder |
| 6 | Left trigger |
| 7 | Right trigger |
| 8 | Select / Back |
| 9 | Start |
| 10 | Left stick press |
| 11 | Right stick press |
| 12 | D-pad up |
| 13 | D-pad down |
| 14 | D-pad left |
| 15 | D-pad right |
| 16 | Home / Guide |

ABI 1 does not define analog axes or console-specific controls outside this table.

## Persistent cartridge memory

Cores with persistent cartridge memory implement:

```c
uint32_t wisp_core_save_ram_size(void);
uint32_t wisp_core_export_save_ram(uint32_t ptr, uint32_t capacity);
int32_t  wisp_core_import_save_ram(uint32_t ptr, uint32_t bytes);
```

Optional deterministic state serialization can use:

```c
uint32_t wisp_core_state_size(void);
uint32_t wisp_core_serialize(uint32_t ptr, uint32_t capacity);
int32_t  wisp_core_unserialize(uint32_t ptr, uint32_t bytes);
```

Games stores persistent bytes in the user's selected game-data source. Browser cache is not canonical storage.

## Compatibility

A package with `metadata.coreAbi: 1` must satisfy this complete ABI. Additive or breaking ABI changes require a new integer `coreAbi`. WispOS never infers compatibility from package version, console name, or file extension alone.