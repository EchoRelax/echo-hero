# Golem and Chaosbes game assets

The original GLBs are archived here as `golem-original.glb` and
`chaosbes-original.glb`. Runtime files are in `public/models`.

Both meshes use UV-preserving collapse decimation to **5,990 triangles** each.
This is automatic mesh reduction, not hand-built quad topology. Source textures,
UVs, orientation and dimensions are retained. Textures remain at original
resolution, so the GLBs are still approximately 25 MB each.

Editable authoring files: `golem-game.blend`, `chaosbes-game.blend`.

## Golem animation

17-bone skeleton; heat-diffusion skin with rigid head/chest/foot regions;
at most four normalized bone influences per vertex.

| Clip | Duration | Playback |
| --- | --- | --- |
| Idle | 2 seconds | Loop |
| Walk | 1.6 seconds | Loop; in place |
| Attack | 1.5 seconds | Once; overhead two-fist strike |

Attack anticipation ends around 0.72 seconds; impact is around 0.96 seconds.
The clip returns to its starting pose. Horizontal movement is driven by gameplay.
Chaosbes has no rig or animation in this delivery.

## Runtime integration

`GolemModel` clones the skin with SkeletonUtils for each instance. Guardians
(Stone Guardian, Basalt Sentinel and Kiln Warden) use a 1.5-unit golem. The Ash
Golem boss now uses the separate boss2 asset. Walk follows enemy movement. Attack samples
the clip against combat charge/impact so damage lands at the authored strike.

Ash Imp and Cinder Imp use Chaosbes, with hovering, windup and dash movement
from the existing enemy controller. Source facing is game +Z.

`tools/check_enemy_assets.mjs` checks the real game in an isolated Playwright
browser at `ECHO_QA_URL` (default `http://127.0.0.1:5176/`). It verifies model
assignment, independent skeletons, walking, damage synchronization, hit flash
isolation, death/reset and boss attacks, then captures in-game screenshots in
`art/enemies/integration-qa`.

## Rebuild and validation

Run `tools/prepare_golem_chaosbes.py` with Blender background Python. It always
reads archived originals. `tools/verify_golem_chaosbes.py` reimports the exported
GLBs and checks the triangle budget, embedded images, UVs, skin weights, motion,
finite coordinates and matching start/end poses. Results are recorded in
`golem-chaosbes-validation.json`.

`tools/encode_golem_previews.py` assembles rendered frames into GIF previews.
