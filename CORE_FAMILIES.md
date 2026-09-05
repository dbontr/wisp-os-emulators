# Core family policy

The Emulator Library defaults to one plugin per console. Multiple console IDs may share a plugin only when they form a coherent hardware line and the selected emulator implementation already ships them through the same compact runtime. Bundling is an implementation decision, not a way to hide unrelated systems behind one download.

## Natural family candidates

| Plugin family | System IDs | Reason to bundle |
| --- | --- | --- |
| Game Boy line | `gb`, `gbc`, `gba` | mGBA exposes all three through one `mCore` library; one stripped package avoids duplicating the same runtime. |
| Sega 8-bit family | `sms`, `gg` | Game Gear is closely derived from Master System hardware. |
| Neo Geo Pocket family | `ngp`, `ngpc` | Monochrome and Color models are one handheld family. |
| WonderSwan family | `ws`, `wsc` | Monochrome and Color models are one handheld family. |

Everything else starts as an independent core unless the chosen implementation provides strong technical justification for a family package. Newer generations, add-on hardware, and unrelated consoles are never bundled merely because one upstream project emulates all of them.

## Catalog identity

The catalog lists a plugin once and exposes its exact signed `systems` set. Games selects a core by system ID and game-image extension. Users install, update, and remove the plugin family as one unit.
