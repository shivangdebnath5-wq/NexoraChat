# elements/ — Frosted Midnight sprite folders

Keep this folder next to index.html (it is loaded as `elements/<folder>/<name>.png`).

| Folder     | Contents                                                              |
|------------|-----------------------------------------------------------------------|
| trees/     | pines, sapling, snow-base pine, bare tree. `far/` and `mid/` hold smaller, navy-tinted copies used for depth |
| bushes/    | snowy bushes, holly bush                                              |
| snow/      | snowbanks and rock mounds. `mid/` holds tinted copies for the back rows |
| snowmen/   | santa, top hat, earmuffs, broom, sitting, sleeping, small, mound      |
| props/     | fence, signs, banner, lantern, barrel, crate, sled, stone wall/arch   |
| crystals/  | ice crystals                                                          |
| christmas/ | seasonal Christmas overlay sprites (tree, wreath, garland, gift pile, stockings, candy canes) — used only when Frosted Midnight's Christmas mode is active (see `isChristmasMode()` in script.js); the base Frosted Midnight scene never references these |

Add a sprite: drop the PNG in the right folder, then add its width/height to `SPRITE_DIMS` in script.js
(search `SPRITE_DIMS`) and one `spr('folder/name', left%, bottom px, scale)` line in `frostedDecor()`.
Pruned to the sprites the scene actually uses. sprite_24 and sprite_33 (multi-sprite sheets) were never used.
