# Emulator catalog contract

`catalog.json` is the stable WispOS Emulator Library index. It is canonical-JSON signed by the same WispOS trust root that authorizes System, apps, and UI packs.

Each catalog core contains `id`, `name`, `version`, `description`, `systems`, and an HTTPS GitHub `packageUrl`. The package URL points to a signed `package.json`; sibling artifact paths resolve relative to that URL.

A core package has the normal WispOS signed artifact table plus:

```json
{
  "format": 1,
  "id": "example-core",
  "name": "Example Core",
  "version": "1.0.0",
  "kind": "emulator",
  "entrypoint": "core.wasm",
  "artifacts": [],
  "permissions": [],
  "metadata": {
    "type": "emulator-core",
    "coreAbi": 1,
    "systems": [
      { "id": "gb", "name": "Game Boy", "extensions": ["gb"] },
      { "id": "gbc", "name": "Game Boy Color", "extensions": ["gbc"] }
    ]
  },
  "signature": {}
}
```

Only `.wasm`, JSON/text documentation, Markdown, and license artifacts are accepted. Emulator packages cannot request WispOS service permissions.
