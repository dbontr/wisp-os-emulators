# Core family policy

The Emulator Library defaults to one independently updateable plugin per console. A plugin can expose multiple system IDs only when the selected emulator implementation naturally represents one hardware family in the same compact runtime.

The current mGBA package is the accepted family example: one core exposes Game Boy, Game Boy Color, and Game Boy Advance without duplicating the same emulator runtime. Mega Drive / Genesis and Super Nintendo / Super Famicom remain independent jgenesis packages.

A family package must declare its complete signed `systems` table. System IDs and file extensions are unique across the signed catalog so Games can select one core deterministically without a preference database or console-specific logic in WispOS.

Unrelated consoles are never combined only to reduce catalog entries.