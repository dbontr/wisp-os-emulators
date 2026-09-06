# References

- [WebAssembly Core Specification](https://webassembly.github.io/spec/core/) — WebAssembly Community Group. Used for: executable module format, import/export inspection, and the Wisp emulator core ABI.
- [WASI Preview 1](https://github.com/WebAssembly/WASI/blob/main/legacy/preview1/docs.md) — WebAssembly Community Group. Used for: the bounded reactor imports accepted by the ABI 1 host.
- [Emscripten standalone WebAssembly](https://emscripten.org/docs/tools_reference/settings_reference.html#standalone-wasm) — Emscripten project. Used for: compiling C/C++ emulator libraries as reactor-style standalone WebAssembly.
- [Gamepad specification](https://w3c.github.io/gamepad/) — W3C Web Applications Working Group. Used for: logical controller input owned by Games rather than console cores.
- [Web Audio API](https://www.w3.org/TR/webaudio-1.1/) — W3C Web Audio Working Group. Used for: Games audio output from bounded PCM batches.
- [mGBA](https://github.com/mgba-emu/mgba) — mGBA project, MPL-2.0. Used for: Game Boy, Game Boy Color, and Game Boy Advance emulation at the pinned package revision.
- [mGBA-wasm](https://github.com/wasm-gaming/mGBA-wasm) — wasm-gaming. Used for: Emscripten configuration reference for a frontend-free mGBA WebAssembly build.
- [jgenesis](https://github.com/jsgroth/jgenesis) — jsgroth, GPL-3.0. Used for: compact Mega Drive / Genesis and Super Nintendo / Super Famicom cores at the pinned package revision.
- [GitHub repository contents](https://docs.github.com/en/rest/repos/contents) — GitHub. Used for: signed catalog and immutable package transport. GitHub is not a WispOS trust root.