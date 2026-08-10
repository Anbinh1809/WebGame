# Animation assets and quality policy

The game loads all animation assets from local `/public/assets` paths. A player never hotlinks an asset provider at runtime.

## Bundled CC0 sources

- `public/assets/animation/cc0/animals/deer.glb` and `stag.glb` come from Quaternius' [Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html), published under CC0. Each source contains Idle, Eat, Walk, Gallop, Attack, Jump, and Death clips; Aetheria currently uses the calm Idle/Eating/Walk set.
- `public/assets/animation/cc0/settlers/*` comes from Kenney's [Animated Characters 1](https://opengameart.org/content/animated-characters-1), published under CC0. The bundle includes a rigged resident and Idle, Run, and Jump clips. The source `LICENSE-KENNEY.txt` stays beside the runtime files.

## Runtime budget

`AnimatedFaunaLayer` and `AnimatedSettlerLayer` reserve skinned animation for close hero actors only:

| Quality | Rigged fauna | Rigged settlers |
| --- | ---: | ---: |
| Low | 0 | 0 |
| Medium | 1 | 1 |
| High / Ultra | 2 | 2 |

The remaining wildlife and residents retain the instanced procedural layers. This keeps a colony view scalable and avoids replacing hundreds of inexpensive instances with CPU-heavy skinned meshes. With `prefers-reduced-motion`, foreground actors hold their idle pose.

## 1K / 2K / 4K / 8K honesty

These actor sources use embedded geometry and vertex colours; their `gltf-transform inspect` report has no texture maps. They therefore share one rig/animation source across every graphics pack. The 1K/2K/4K/8K distinction remains applicable to environment PBR, HDR, and other texture-backed assets. No upscaled copy is labeled as a fake 2K, 4K, or 8K actor texture.
