# References

- [WebAssembly Core Specification](https://webassembly.github.io/spec/core/) — WebAssembly Community Group. Used for: executable module format, import/export inspection, and Wisp emulator plugin ABI behavior.
- [Emscripten standalone WebAssembly](https://emscripten.org/docs/tools_reference/settings_reference.html#standalone-wasm) — Emscripten project. Used for: compiling C/C++ emulator libraries as reactor-style standalone WebAssembly without shipping a desktop frontend.
- [Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/) — W3C. Used for: SHA-256 artifact hashes and ECDSA P-256 package/catalog verification.
- [Gamepad specification](https://w3c.github.io/gamepad/) — W3C Web Applications Working Group. Used for: common controller identities owned by Games rather than individual console cores.
- [Web Audio API](https://www.w3.org/TR/webaudio-1.1/) — W3C Web Applications Working Group. Used for: Games audio output from bounded core PCM batches.
- [Origin Private File System](https://fs.spec.whatwg.org/) — WHATWG File System Standard. Used for: candidate disposable range cache for streamed high-performance cores; it is not canonical game or save storage.
- [mGBA](https://github.com/mgba-emu/mgba) — mGBA project, MPL-2.0. Used for: GB/GBC/GBA emulation and the compact ABI 1 core build.
- [mGBA-wasm](https://github.com/wasm-gaming/mGBA-wasm) — wasm-gaming. Used for: reference Emscripten configuration for a frontend-free mGBA WebAssembly build and direct `mCore` browser adapter.
- [jgenesis](https://github.com/jsgroth/jgenesis) — jsgroth, GPL-3.0. Used for: compact Mega Drive/Genesis and SNES ABI 1 cores at a pinned source revision.
- [Dolphin](https://github.com/dolphin-emu/dolphin) — Dolphin Emulator project, GPL-2.0-or-later. Used for: GameCube/Wii streamed-core architecture target.
- [Cemu](https://github.com/cemu-project/Cemu) — Cemu project, MPL-2.0. Used for: Wii U streamed-core architecture target.
- [Xenia](https://github.com/xenia-project/xenia) — Xenia project, BSD-3-Clause. Used for: Xbox 360 streamed-core architecture target.
- [Voland](https://github.com/voland-emu/Voland) — Voland project, GPL-2.0. Used for: browser-native WebAssembly/WebGPU architecture research for a future Switch target; it is not treated as a functional compatibility core.
- [GitHub repository contents](https://docs.github.com/en/rest/repos/contents) — GitHub. Used for: signed catalog and package transport. GitHub is not a WispOS trust root.
