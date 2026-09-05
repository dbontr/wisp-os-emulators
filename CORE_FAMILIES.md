# Core family policy

The Emulator Library defaults to one plugin per console. Multiple console IDs may share a plugin only when they are a close hardware family and the selected emulator implementation natively treats them as one core. Bundling is an implementation decision, not a way to hide unrelated systems behind one download.

## Natural family candidates

These are packaging targets, not promises that a particular upstream emulator has already been selected or licensed for distribution.

| Plugin family | System IDs | Reason to bundle |
| --- | --- | --- |
| Game Boy family | `gb`, `gbc` | Closely related hardware and cartridge ecosystem. |
| Sega 8-bit family | `sms`, `gg` | Game Gear is closely derived from Master System hardware. |
| Neo Geo Pocket family | `ngp`, `ngpc` | Monochrome and Color models are one handheld family. |
| WonderSwan family | `ws`, `wsc` | Monochrome and Color models are one handheld family. |

Everything else starts as an independent core unless the chosen implementation provides strong technical justification for a family package. In particular, newer generations, add-on hardware, and unrelated consoles should not be pulled into a bundle just because one upstream project happens to emulate all of them.

## Catalog identity

The catalog lists a plugin once and exposes its exact signed `systems` set. Games selects a core by system ID and ROM extension. Users install/update/remove the plugin family as one unit.
