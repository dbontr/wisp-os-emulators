#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${ROOT}/.tmp/gecko-src"
OUT_DIR="${ROOT}/build/gecko-web"
GECKO_REPO="${GECKO_REPO:-https://github.com/ioncodes/gecko.git}"
GECKO_REF="${GECKO_REF:-da39be17b22eb7316e772d2369da15df3a52f7f0}"

for command in git wasm-pack python3; do
    command -v "${command}" >/dev/null 2>&1 || { echo "missing build tool: ${command}" >&2; exit 1; }
done

mkdir -p "${ROOT}/.tmp"
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

if [ ! -d "${SOURCE_DIR}/.git" ]; then
    git clone --filter=blob:none --no-checkout "${GECKO_REPO}" "${SOURCE_DIR}"
fi

git -C "${SOURCE_DIR}" fetch --quiet origin "${GECKO_REF}"
git -C "${SOURCE_DIR}" checkout --quiet --detach "${GECKO_REF}"
git -C "${SOURCE_DIR}" reset --quiet --hard "${GECKO_REF}"
git -C "${SOURCE_DIR}" submodule update --init --depth 1 --recursive \
    submodules/chipi-spec submodules/solstice

wasm-pack build "${SOURCE_DIR}/crates/web" \
    --target web \
    --out-dir "${OUT_DIR}" \
    --out-name gecko_web \
    --release

test -f "${OUT_DIR}/gecko_web_bg.wasm"
test -f "${OUT_DIR}/gecko_web.js"

python3 - "${OUT_DIR}" "${GECKO_REF}" <<'PY'
from pathlib import Path
import json
import sys

out = Path(sys.argv[1])
revision = sys.argv[2]
files = {}
for path in sorted(out.iterdir()):
    if path.is_file():
        files[path.name] = path.stat().st_size
report = {
    "upstream": "https://github.com/ioncodes/gecko",
    "revision": revision,
    "files": files,
    "runtimeBytes": sum(size for name, size in files.items() if name.endswith((".wasm", ".js"))),
}
(out / "probe-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
PY
