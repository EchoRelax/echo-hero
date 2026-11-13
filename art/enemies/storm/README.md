# Storm assets and boss fight

The archived sources (`stormwisp-original.glb`, `boss3-original.glb`) each have
50,000 triangles. UV-preserving automatic collapse reduction produces runtime
`stormwisp.glb` at **3,990 triangles** and `boss3.glb` at **7,988 triangles**.
Source textures are embedded at original resolution. Editable authoring files
are `stormwisp-game.blend` and `boss3-game.blend` in this directory.

The current Stormwisp source is the replacement supplied on 2026-11-06 (round
floating face). The previous source is retained as `stormwisp-first-original.glb`.
Use `tools/prepare_storm_assets.py -- --only stormwisp` with Blender to rebuild
just this model. The runtime cache revision is `4k-2`.

Stormwisp replaces all 13 wisp-family enemies in the third biome, retaining
their existing stats and hovering behavior.

## Boss animations

Boss3 has a 15-bone rig with a three-segment floating tail, no legs, and at most
four normalized skin influences per vertex. Runtime height is 3.5 units, with
the lower tip suspended 0.4 units above the floor.

| Clip | Duration | Use |
| --- | --- | --- |
| Hover | 2 s | Idle floating loop |
| Fly | 1.6 s | Forward flight, no footsteps |
| Melee | 1.2 s | Right-hand strike; contact at 62% |
| VortexCast | 2 s | Raise hands, spread arms; summon at 65% |
| StormCast | 1 s | Lift hands into the channel pose |
| StormChannel | 1 s | Loop while calling lightning |

StormCast's endpoint exactly matches StormChannel's endpoints. Recovery plays
StormCast backwards. Windups and contacts are sampled against combat timing.

## New abilities

The old Thunder Lance and Tempest Field are replaced by:

- **Roaming Tempests:** 1.3-second anticipation with six floor markers,
  followed by six shader tornadoes travelling across the arena, including its
  center. Starting positions use different radii and headings. Storms cross
  the floor at different times and reflect off the 5.8-radius travel boundary;
  they retain their speed and do not teleport at turns. Crossing phases are
  offset to keep both outer and inner areas occupied throughout the ability.
  They persist for **10 seconds after summon**. Each has a visible 0.85-radius
  footprint. Contact damage has a shared 0.8-second cooldown and 0.25-second
  startup grace. Visuals include spiral cloud ribbons and electrical filaments.
- **Lightning Rain:** a **five-second** channel with **three groups of six**
  randomized targets, spawned at 0, 1.7 and 3.4 seconds. At most six circles
  are active in normal operation. Each circle grows for approximately 1.15
  seconds; the bolt strikes only when it reaches the final **1.1 radius**.
  Targets stay fixed. One target per group is near the player's initial
  position; others are distributed throughout the 6.7-radius arena with spacing.
  Each bolt damages only once. The flash and aftermath are cosmetic.

Lightning uses two crossed shader planes with jagged channels, forks, white
cores and a blue glow. Tornadoes use two transparent funnel surfaces and a
ground footprint. All objects are pooled; no per-frame mesh allocation.

The boss floats between attacks, uses a telegraphed hand strike, and retains
the existing 15,000 HP, rewards and lightning rune unlock. Casting durations,
tornado lifetime and bolt count stay fixed in enrage. Basic/vortex anticipation
can accelerate. All hazards clear on death, reset, leash or encounter change.

## Testing

- `tools/prepare_storm_assets.py`: Blender background rebuild; `-- --inspect`
  inspects archived sources without changing the runtime assets.
- `tools/verify_storm_assets.py`: reimports the GLBs and verifies budgets,
  embedded textures, UVs, weights, clips and animation continuity.
- `tools/check_storm_boss.mjs`: real-game browser checks, shader compilation,
  timing, all 18 bolts, dodging, ten-second vortex lifetime, cleanup and victory.
  Set `ECHO_RECORD_PREVIEW=1` to record twelve simulated seconds as PNG frames.
- The **F2 dev panel** supplies gold, XP, runes and invincibility directly
  in the current game. It has no isolated fight mode.

Only the ordinary build (`npm run build`) is generated for this work.
