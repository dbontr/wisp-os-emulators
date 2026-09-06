# Emulator catalog contract

`catalog.json` is the signed WispOS Emulator Library index. GitHub transports the file; the WispOS ECDSA P-256 trust root authorizes its contents.

Each catalog entry contains `id`, `name`, `version`, `description`, `systems`, and `packageUrl`. Core IDs, system IDs, and file extensions are globally unique. `packageUrl` must use `raw.githubusercontent.com`, name a 40-character Git commit, and point to `packages/<id>/<version>/package.json`.

Each signed emulator package contains:

- `kind: "emulator"`;
- `metadata.type: "emulator-core"`;
- `metadata.coreAbi: 1`;
- one or more system IDs, display names, and file extensions;
- immutable upstream repository, revision, license, and corresponding-source metadata;
- a signed `.wasm` entrypoint;
- a signed artifact table that includes the applicable upstream license;
- no WispOS service permissions.

Only WebAssembly and bounded metadata, documentation, and license artifacts are valid in ABI 1 packages. A core is published only after legal synthetic test software executes through its signed WispOS package boundary.