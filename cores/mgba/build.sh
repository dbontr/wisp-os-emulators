#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${ROOT}/.tmp/mgba-src"
BUILD_DIR="${ROOT}/.tmp/mgba-build"
OUT_DIR="${ROOT}/build/mgba"
MGBA_REPO="${MGBA_REPO:-https://github.com/mgba-emu/mgba.git}"
MGBA_REF="${MGBA_REF:-c034660f007c543233f1cadeb0ca13c71afd8f41}"
JOBS="${MGBA_JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"

for command in git emcmake cmake emcc python3; do
    command -v "${command}" >/dev/null 2>&1 || { echo "missing build tool: ${command}" >&2; exit 1; }
done

mkdir -p "${ROOT}/.tmp" "${OUT_DIR}"
if [ ! -d "${SOURCE_DIR}/.git" ]; then
    git clone --filter=blob:none "${MGBA_REPO}" "${SOURCE_DIR}"
fi
git -C "${SOURCE_DIR}" fetch --quiet origin "${MGBA_REF}"
git -C "${SOURCE_DIR}" checkout --quiet --detach "${MGBA_REF}"
git -C "${SOURCE_DIR}" reset --quiet --hard "${MGBA_REF}"

python3 - "${SOURCE_DIR}" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])

def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one source match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    root / 'CMakeLists.txt',
    'elseif(UNIX)\n\tset(USE_PTHREADS ON)',
    'elseif(UNIX AND NOT CMAKE_SYSTEM_NAME STREQUAL "Emscripten")\n\tset(USE_PTHREADS ON)',
)
replace_once(
    root / 'src/util/vfs.c',
    '#elif defined(ENABLE_VFS_FD)\n\treturn VFileOpenFD(path, flags);\n#else\n#error "Can\'t build VFS subsystem without a VFile backend"',
    '#elif defined(ENABLE_VFS_FD)\n\treturn VFileOpenFD(path, flags);\n#elif defined(__EMSCRIPTEN__)\n\t(void) path;\n\t(void) flags;\n\treturn 0;\n#else\n#error "Can\'t build VFS subsystem without a VFile backend"',
)
replace_once(
    root / 'src/util/vfs.c',
    '#elif defined(HAVE_REALPATH)\n\tif (realpath(buf, out)) {',
    '#elif defined(HAVE_REALPATH) && !defined(__EMSCRIPTEN__)\n\tif (realpath(buf, out)) {',
)
replace_once(
    root / 'src/core/config.c',
    'void mCoreConfigPortableIniPath(char* out, size_t outLength) {\n#ifdef _WIN32',
    'void mCoreConfigPortableIniPath(char* out, size_t outLength) {\n#ifdef __EMSCRIPTEN__\n\tUNUSED(outLength);\n\tout[0] = \'\\0\';\n#elif defined(_WIN32)',
)
replace_once(
    root / 'src/core/config.c',
    'void mCoreConfigDirectory(char* out, size_t outLength) {\n\tchar portableDir[PATH_MAX];',
    'void mCoreConfigDirectory(char* out, size_t outLength) {\n#ifdef __EMSCRIPTEN__\n\tUNUSED(outLength);\n\tout[0] = \'\\0\';\n\treturn;\n#endif\n\tchar portableDir[PATH_MAX];',
)
PY
rm -rf "${BUILD_DIR}"

emcmake cmake \
    -S "${SOURCE_DIR}" \
    -B "${BUILD_DIR}" \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DCMAKE_C_FLAGS="-Oz -D_GNU_SOURCE -DDISABLE_THREADING" \
    -DBUILD_STATIC=ON \
    -DBUILD_SHARED=OFF \
    -DDISABLE_FRONTENDS=ON \
    -DDISABLE_DEPS=ON \
    -DBUILD_QT=OFF \
    -DBUILD_SDL=OFF \
    -DBUILD_LIBRETRO=OFF \
    -DBUILD_TEST=OFF \
    -DBUILD_SUITE=OFF \
    -DBUILD_GL=OFF \
    -DBUILD_GLES2=OFF \
    -DBUILD_GLES3=OFF \
    -DUSE_PTHREADS=OFF \
    -DUSE_ZLIB=OFF \
    -DUSE_MINIZIP=OFF \
    -DUSE_LIBZIP=OFF \
    -DUSE_PNG=OFF \
    -DUSE_SQLITE3=OFF \
    -DUSE_FFMPEG=OFF \
    -DUSE_ELF=OFF \
    -DUSE_LZMA=OFF \
    -DUSE_LUA=OFF \
    -DUSE_JSON_C=OFF \
    -DUSE_FREETYPE=OFF \
    -DUSE_EDITLINE=OFF \
    -DUSE_DISCORD_RPC=OFF \
    -DUSE_EPOXY=OFF \
    -DENABLE_SCRIPTING=OFF \
    -DENABLE_DEBUGGERS=OFF \
    >/dev/null

cmake --build "${BUILD_DIR}" --target mgba -j "${JOBS}"
LIB="$(find "${BUILD_DIR}" -name 'libmgba.a' -print -quit)"
[ -n "${LIB}" ] || { echo "libmgba.a was not produced" >&2; exit 1; }

FLAGS_MAKE="${BUILD_DIR}/CMakeFiles/mgba.dir/flags.make"
[ -f "${FLAGS_MAKE}" ] || { echo "mGBA compiler definitions were not produced" >&2; exit 1; }
CORE_DEFINES=()
while read -r define; do CORE_DEFINES+=("${define}"); done < <(
    grep -m1 '^C_DEFINES' "${FLAGS_MAKE}" | cut -d= -f2- | tr ' ' '\n' | grep '^-D'
)

EXPORTS=(
    wisp_core_api_version wisp_core_init wisp_core_load_game wisp_core_run
    wisp_core_reset wisp_core_unload wisp_core_deinit wisp_core_alloc wisp_core_free
    wisp_core_save_ram_size wisp_core_export_save_ram wisp_core_import_save_ram
    wisp_core_state_size wisp_core_serialize wisp_core_unserialize
)
LINK_EXPORTS=()
for symbol in "${EXPORTS[@]}"; do LINK_EXPORTS+=("-Wl,--export=${symbol}"); done

emcc \
    -Oz -std=gnu11 -D_GNU_SOURCE -DDISABLE_THREADING -DNDEBUG \
    -I"${SOURCE_DIR}/include" -I"${BUILD_DIR}/include" \
    "${CORE_DEFINES[@]}" \
    "${ROOT}/cores/mgba/wisp_core.c" \
    "${ROOT}/cores/mgba/vfs_stubs.c" \
    "${LIB}" \
    --no-entry \
    -sSTANDALONE_WASM=1 \
    -sFILESYSTEM=0 \
    -sINITIAL_MEMORY=134217728 \
    -sSTACK_SIZE=1048576 \
    -sMALLOC=emmalloc \
    -Wl,--allow-undefined-file="${ROOT}/scripts/wisp-core-imports.txt" \
    "${LINK_EXPORTS[@]}" \
    -o "${OUT_DIR}/core.wasm"

cp "${SOURCE_DIR}/LICENSE" "${OUT_DIR}/mGBA.license"
SIZE="$(wc -c < "${OUT_DIR}/core.wasm" | tr -d ' ')"
echo "mGBA Wisp core: ${SIZE} bytes"
if [ "${SIZE}" -gt 1572864 ]; then
    echo "mGBA Wisp core exceeds the 1.5 MiB target" >&2
    exit 1
fi
