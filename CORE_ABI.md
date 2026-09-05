# Wisp Emulator Core ABI 1

The Wisp Emulator Core ABI is a small WebAssembly boundary between the Games app and independently signed console cores. A core contains console emulation only; WispOS retains storage, package verification, UI, input, audio, and lifecycle authority.

## Execution boundary

- Core entrypoints are WebAssembly modules.
- Cores receive ROM bytes supplied by Games after the user selects a game from an authorized personal-data folder.
- Cores never receive OneDrive credentials, provider APIs, DOM authority, or arbitrary network access.
- The `emulators` system service verifies and materializes a core before Games can fetch its session-local blob URL.
- The core ABI is versioned independently from the WispOS kernel ABI.

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

`wisp_core_load_game` receives a copy of the selected ROM in core memory. A nonzero return indicates success.

## Required host imports

The module imports callbacks from the `wisp` namespace:

```c
void     video_refresh(uint32_t rgba_ptr, uint32_t width, uint32_t height, uint32_t pitch_bytes);
void     audio_batch(uint32_t s16_ptr, uint32_t frames, uint32_t sample_rate, uint32_t channels);
int32_t  input_state(uint32_t port, uint32_t control);
uint64_t monotonic_time_us(void);
```

Video is tightly specified as RGBA8888. Audio is interleaved signed 16-bit PCM. `input_state` returns zero for released and nonzero for active controls; console adapters translate Wisp control IDs into native controller semantics.

## Battery save and save-state exports

Cores that expose persistent cartridge/save memory implement:

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

Games stores resulting save bytes in the user's selected game-data folder. Browser cache is never canonical save storage.

## Compatibility

A package with `metadata.coreAbi: 1` must satisfy this complete ABI. Additive or breaking ABI changes require a new integer `coreAbi`; WispOS must never guess compatibility from the package version.
