#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:?usage: prepare.sh <jgenesis-source-dir>}"
python3 - "${SOURCE_DIR}" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
manifest = root / 'common/jgenesis-common/Cargo.toml'
timeutils = root / 'common/jgenesis-common/src/timeutils.rs'

def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one source match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    manifest,
    "\n[target.'cfg(target_arch = \"wasm32\")'.dependencies]\njs-sys = { workspace = true }\n",
    "\n",
)

replace_once(
    timeutils,
    "use time::{Date, Month, Weekday};\n",
    "use time::{Date, Month, Weekday};\n\n"
    "#[cfg(target_arch = \"wasm32\")]\n"
    "#[link(wasm_import_module = \"wisp\")]\n"
    "unsafe extern \"C\" {\n"
    "    #[link_name = \"monotonic_time_us\"]\n"
    "    fn wisp_monotonic_time_us() -> u64;\n"
    "}\n",
)

replace_once(
    timeutils,
    "        target_arch = \"wasm32\" => {\n"
    "            let current_time_ms = js_sys::Date::now();\n"
    "            (current_time_ms * 1_000_000.0) as u128\n"
    "        }\n",
    "        target_arch = \"wasm32\" => {\n"
    "            // Wisp cores have no browser-JS authority. Session-monotonic time is sufficient\n"
    "            // for frame pacing and avoids wasm-bindgen/js-sys in the raw core package.\n"
    "            unsafe { u128::from(wisp_monotonic_time_us()) * 1_000 }\n"
    "        }\n",
)
PY
