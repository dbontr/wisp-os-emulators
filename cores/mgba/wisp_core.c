/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

#include <mgba/core/config.h>
#include <mgba/core/core.h>
#include <mgba/core/log.h>
#include <mgba/internal/gba/input.h>
#include <mgba-util/audio-buffer.h>
#include <mgba-util/image.h>
#include <mgba-util/vfs.h>

#include <stdarg.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#if defined(__wasm__)
#define WISP_IMPORT(module, name) __attribute__((import_module(module), import_name(name)))
#define WISP_EXPORT __attribute__((visibility("default")))
#else
#define WISP_IMPORT(module, name)
#define WISP_EXPORT
#endif

WISP_IMPORT("wisp", "video_refresh")
extern void wisp_video_refresh(uint32_t rgba_ptr, uint32_t width, uint32_t height, uint32_t pitch_bytes);
WISP_IMPORT("wisp", "audio_batch")
extern void wisp_audio_batch(uint32_t s16_ptr, uint32_t frames, uint32_t sample_rate, uint32_t channels);
WISP_IMPORT("wisp", "input_state")
extern int32_t wisp_input_state(uint32_t port, uint32_t control);

#define VIDEO_WIDTH_MAX 256u
#define VIDEO_HEIGHT_MAX 224u
#define AUDIO_FRAMES_MAX 4096u

#define WISP_BUTTON_A 0u
#define WISP_BUTTON_B 1u
#define WISP_BUTTON_L 4u
#define WISP_BUTTON_R 5u
#define WISP_BUTTON_SELECT 8u
#define WISP_BUTTON_START 9u
#define WISP_BUTTON_UP 12u
#define WISP_BUTTON_DOWN 13u
#define WISP_BUTTON_LEFT 14u
#define WISP_BUTTON_RIGHT 15u

static struct mCore* core;
static mColor* native_video;
static uint32_t* rgba_video;
static int16_t* audio_samples;
static void* rom_bytes;
static void* save_snapshot;
static size_t save_snapshot_bytes;
static unsigned video_width;
static unsigned video_height;
static int core_initialized;

static void discard_log(struct mLogger* logger, int category, enum mLogLevel level,
                        const char* format, va_list args) {
    (void) logger;
    (void) category;
    (void) level;
    (void) format;
    (void) args;
}

static struct mLogger logger = { .log = discard_log, .filter = NULL };

static void release_core(void) {
    if (core) {
        core->unloadROM(core);
        mCoreConfigDeinit(&core->config);
        core->deinit(core);
    }
    core = NULL;
    free(native_video);
    free(rgba_video);
    free(audio_samples);
    free(rom_bytes);
    free(save_snapshot);
    native_video = NULL;
    rgba_video = NULL;
    audio_samples = NULL;
    rom_bytes = NULL;
    save_snapshot = NULL;
    save_snapshot_bytes = 0;
    video_width = 0;
    video_height = 0;
}

static unsigned read_keys(void) {
    unsigned keys = 0;
    if (wisp_input_state(0, WISP_BUTTON_A)) keys |= 1u << GBA_KEY_A;
    if (wisp_input_state(0, WISP_BUTTON_B)) keys |= 1u << GBA_KEY_B;
    if (wisp_input_state(0, WISP_BUTTON_SELECT)) keys |= 1u << GBA_KEY_SELECT;
    if (wisp_input_state(0, WISP_BUTTON_START)) keys |= 1u << GBA_KEY_START;
    if (wisp_input_state(0, WISP_BUTTON_RIGHT)) keys |= 1u << GBA_KEY_RIGHT;
    if (wisp_input_state(0, WISP_BUTTON_LEFT)) keys |= 1u << GBA_KEY_LEFT;
    if (wisp_input_state(0, WISP_BUTTON_UP)) keys |= 1u << GBA_KEY_UP;
    if (wisp_input_state(0, WISP_BUTTON_DOWN)) keys |= 1u << GBA_KEY_DOWN;
    if (wisp_input_state(0, WISP_BUTTON_R)) keys |= 1u << GBA_KEY_R;
    if (wisp_input_state(0, WISP_BUTTON_L)) keys |= 1u << GBA_KEY_L;
    return keys;
}

static uint32_t refresh_save_snapshot(void) {
    free(save_snapshot);
    save_snapshot = NULL;
    save_snapshot_bytes = 0;
    if (!core) return 0;
    save_snapshot_bytes = core->savedataClone(core, &save_snapshot);
    if (save_snapshot_bytes > UINT32_MAX) {
        free(save_snapshot);
        save_snapshot = NULL;
        save_snapshot_bytes = 0;
    }
    return (uint32_t) save_snapshot_bytes;
}

WISP_EXPORT uint32_t wisp_core_api_version(void) {
    return 1u;
}

WISP_EXPORT int32_t wisp_core_init(void) {
    mLogSetDefaultLogger(&logger);
    core_initialized = 1;
    return 1;
}

WISP_EXPORT int32_t wisp_core_load_game(uint32_t ptr, uint32_t bytes) {
    if (!core_initialized) wisp_core_init();
    if (!ptr || !bytes) return 0;
    release_core();

    rom_bytes = malloc(bytes);
    if (!rom_bytes) return 0;
    memcpy(rom_bytes, (const void*) (uintptr_t) ptr, bytes);

    struct VFile* rom = VFileFromMemory(rom_bytes, bytes);
    if (!rom) {
        release_core();
        return 0;
    }

    core = mCoreFindVF(rom);
    if (!core) {
        rom->close(rom);
        release_core();
        return 0;
    }

    mCoreInitConfig(core, NULL);
    if (!core->init(core)) {
        rom->close(rom);
        release_core();
        return 0;
    }

    struct mCoreOptions defaults = {
        .useBios = false,
        .skipBios = true,
        .volume = 0x100,
        .logLevel = mLOG_FATAL | mLOG_ERROR,
    };
    mCoreConfigLoadDefaults(&core->config, &defaults);
    mCoreLoadForeignConfig(core, &core->config);

    native_video = calloc(VIDEO_WIDTH_MAX * VIDEO_HEIGHT_MAX, sizeof(mColor));
    rgba_video = calloc(VIDEO_WIDTH_MAX * VIDEO_HEIGHT_MAX, sizeof(uint32_t));
    audio_samples = calloc(AUDIO_FRAMES_MAX * 2u, sizeof(int16_t));
    if (!native_video || !rgba_video || !audio_samples) {
        rom->close(rom);
        release_core();
        return 0;
    }

    core->setVideoBuffer(core, native_video, VIDEO_WIDTH_MAX);
    core->setAudioBufferSize(core, 0x4000);
    if (!core->loadROM(core, rom)) {
        rom->close(rom);
        release_core();
        return 0;
    }

    core->reset(core);
    core->currentVideoSize(core, &video_width, &video_height);
    return 1;
}

WISP_EXPORT void wisp_core_run(void) {
    if (!core) return;
    core->setKeys(core, read_keys());
    core->runFrame(core);
    core->currentVideoSize(core, &video_width, &video_height);

    const unsigned width = video_width > VIDEO_WIDTH_MAX ? VIDEO_WIDTH_MAX : video_width;
    const unsigned height = video_height > VIDEO_HEIGHT_MAX ? VIDEO_HEIGHT_MAX : video_height;
    for (unsigned y = 0; y < height; ++y) {
        const mColor* src = native_video + y * VIDEO_WIDTH_MAX;
        uint32_t* dst = rgba_video + y * width;
        for (unsigned x = 0; x < width; ++x) dst[x] = (uint32_t) src[x] | 0xff000000u;
    }
    wisp_video_refresh((uint32_t) (uintptr_t) rgba_video, width, height, width * 4u);

    struct mAudioBuffer* audio = core->getAudioBuffer(core);
    size_t available = mAudioBufferAvailable(audio);
    while (available) {
        const size_t batch = available > AUDIO_FRAMES_MAX ? AUDIO_FRAMES_MAX : available;
        const size_t read = mAudioBufferRead(audio, audio_samples, batch);
        if (!read) break;
        wisp_audio_batch((uint32_t) (uintptr_t) audio_samples, (uint32_t) read,
                         (uint32_t) core->audioSampleRate(core), 2u);
        available -= read;
    }
}

WISP_EXPORT void wisp_core_reset(void) {
    if (core) core->reset(core);
}

WISP_EXPORT void wisp_core_unload(void) {
    release_core();
}

WISP_EXPORT void wisp_core_deinit(void) {
    release_core();
    core_initialized = 0;
}

WISP_EXPORT uint32_t wisp_core_alloc(uint32_t bytes) {
    return (uint32_t) (uintptr_t) malloc(bytes);
}

WISP_EXPORT void wisp_core_free(uint32_t ptr) {
    free((void*) (uintptr_t) ptr);
}

WISP_EXPORT uint32_t wisp_core_save_ram_size(void) {
    return refresh_save_snapshot();
}

WISP_EXPORT uint32_t wisp_core_export_save_ram(uint32_t ptr, uint32_t capacity) {
    if (!ptr) return 0;
    if (!save_snapshot && !refresh_save_snapshot()) return 0;
    if (capacity < save_snapshot_bytes) return 0;
    memcpy((void*) (uintptr_t) ptr, save_snapshot, save_snapshot_bytes);
    return (uint32_t) save_snapshot_bytes;
}

WISP_EXPORT int32_t wisp_core_import_save_ram(uint32_t ptr, uint32_t bytes) {
    if (!core || !ptr || !bytes) return 0;
    return core->savedataRestore(core, (const void*) (uintptr_t) ptr, bytes, true) ? 1 : 0;
}

WISP_EXPORT uint32_t wisp_core_state_size(void) {
    if (!core) return 0;
    const size_t bytes = core->stateSize(core);
    return bytes > UINT32_MAX ? 0 : (uint32_t) bytes;
}

WISP_EXPORT uint32_t wisp_core_serialize(uint32_t ptr, uint32_t capacity) {
    if (!core || !ptr) return 0;
    const uint32_t needed = wisp_core_state_size();
    if (!needed || capacity < needed) return 0;
    return core->saveState(core, (void*) (uintptr_t) ptr) ? needed : 0;
}

WISP_EXPORT int32_t wisp_core_unserialize(uint32_t ptr, uint32_t bytes) {
    if (!core || !ptr || bytes != wisp_core_state_size()) return 0;
    return core->loadState(core, (const void*) (uintptr_t) ptr) ? 1 : 0;
}
