# Wisp Emulator Core ABI 1

The Wisp Emulator Core ABI is a small WebAssembly boundary between Games and independently signed cartridge-oriented console cores. A core contains console emulation only. WispOS retains storage, package verification, UI, input, audio, and lifecycle authority.

ABI 1 is for game images that can be buffered into core memory before execution. Large disc and modern-console images use the streamed high-performance design and are not valid ABI 1 workloads.

## Execution boundary

- The package entrypoint is a standalone WebAssembly reactor.
- Games calls an exported `_initialize` function once when the toolchain emits it, then verifies `wisp_core_api_version()` before any other core operation.
- Games copies the selected cartridge image into core memory and calls `wisp_core_load_game`.
- A core never receives OneDrive credentials, provider APIs, DOM authority, unrestricted filesystem authority, or arbitrary network access.
- The `emulators` system service verifies and materializes a core before Games receives its session-local blob URL.
- The core ABI is versioned independently from the WispOS kernel ABI.

A core may use `wasi_snapshot_preview1` reactor imports required by its C/C++ runtime. WispOS provides no preopened host directories or sockets. Console behavior must not depend on host filesystem or network access.

## Required exports

A core exports linear `memory` plus these C-compatible functions:

```c
uint32_t wisp_core_api_version(void);          /* must return 1 */
int32_t  wisp_core_init(void);
int32_t  wisp_core_load_game(uint32_t ptr, uint32_t bytes);
void     wisp_core_run(void);                  /* exactly one emulated frame */
void     wisp_core_reset(void);
void     wisp_core_unload(void);
void     wisp_core_deinit(void);
uint32_t wisp_core_alloc(uint32_t bytes);
void     wisp_core_free(uint32_t ptr);
```

`wisp_core_load_game` receives a copy of the selected game image in core memory. A positive return indicates success.

## Wisp host imports

A core imports the callbacks it needs from module `wisp`:

```c
void     video_refresh(uint32_t rgba_ptr, uint32_t width, uint32_t height, uint32_t pitch_bytes);
void     audio_batch(uint32_t s16_ptr, uint32_t frames, uint32_t sample_rate, uint32_t channels);
int32_t  input_state(uint32_t port, uint32_t control);
uint64_t monotonic_time_us(void);
```

Video is RGBA8888. Audio is interleaved signed 16-bit PCM. `input_state` returns zero for released and nonzero for active controls.

## Standard controls

The common gamepad controls use browser-standard button positions so Games can map keyboard and Gamepad API input once and let each core translate those logical controls into console-native inputs.

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

Core-specific controls above this range require a future ABI extension. Analog axes are not part of ABI 1.

## Battery save and save-state exports

Cores with persistent cartridge memory implement:

```c
uint32_t wisp_core_save_ram_size(void);
uint32_t wisp_core_export_save_ram(uint32_t ptr, uint32_t capacity);
int32_t  wisp_core_import_save_ram(uint32_t ptr, uint32_t bytes);
```

Optional deterministic save states use:

```c
uint32_t wisp_core_state_size(void);
uint32_t wisp_core_serialize(uint32_t ptr, uint32_t capacity);
int32_t  wisp_core_unserialize(uint32_t ptr, uint32_t bytes);
```

Games stores resulting save bytes in the user's selected data folder. Browser cache is never canonical save storage.

## Compatibility

A package with `metadata.coreAbi: 1` must satisfy this complete ABI. Additive or breaking ABI changes require a new integer `coreAbi`; WispOS must never infer compatibility from package version or console name.
