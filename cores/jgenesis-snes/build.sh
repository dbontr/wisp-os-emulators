#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${ROOT}/.tmp/jgenesis-src"
TARGET_DIR="${ROOT}/.tmp/jgenesis-snes-target"
OUT_DIR="${ROOT}/build/jgenesis-snes"
JGENESIS_REPO="${JGENESIS_REPO:-https://github.com/jsgroth/jgenesis.git}"
JGENESIS_REF="${JGENESIS_REF:-0b26611fa23007f2632d32b7cdbdb6369b01eb91}"

for command in git cargo rustup; do
    command -v "${command}" >/dev/null 2>&1 || { echo "missing build tool: ${command}" >&2; exit 1; }
done

mkdir -p "${ROOT}/.tmp" "${OUT_DIR}"
if [ ! -d "${SOURCE_DIR}/.git" ]; then
    git clone --filter=blob:none "${JGENESIS_REPO}" "${SOURCE_DIR}"
fi
git -C "${SOURCE_DIR}" fetch --quiet origin "${JGENESIS_REF}"
git -C "${SOURCE_DIR}" checkout --quiet --detach "${JGENESIS_REF}"
git -C "${SOURCE_DIR}" reset --quiet --hard "${JGENESIS_REF}"

rustup target add wasm32-unknown-unknown >/dev/null
rm -rf "${TARGET_DIR}"
RUSTFLAGS='--cfg getrandom_backend="custom"' \
CARGO_TARGET_DIR="${TARGET_DIR}" cargo build \
    --manifest-path "${ROOT}/cores/jgenesis-snes/Cargo.toml" \
    --target wasm32-unknown-unknown \
    --release

WASM="${TARGET_DIR}/wasm32-unknown-unknown/release/wisp_jgenesis_snes.wasm"
[ -f "${WASM}" ] || { echo "SNES WASM was not produced" >&2; exit 1; }
cp "${WASM}" "${OUT_DIR}/core.wasm"
cp "${SOURCE_DIR}/LICENSE" "${OUT_DIR}/jgenesis.license"
SIZE="$(wc -c < "${OUT_DIR}/core.wasm" | tr -d ' ')"
echo "jgenesis SNES Wisp core: ${SIZE} bytes"
if [ "${SIZE}" -gt 2097152 ]; then
    echo "SNES Wisp core exceeds the 2 MiB target" >&2
    exit 1
fi
