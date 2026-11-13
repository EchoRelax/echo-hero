# Boss2 — Stone boss

Source: `boss2-original.glb` (50,000 triangles). Runtime:
`public/models/boss2.glb` (7,988 triangles). Editable: `boss2-game.blend`.

UV-preserving automatic collapse decimation, original embedded textures,
18-bone skin with at most four normalized influences per vertex. Original
orientation and dimensions are retained in the GLB; runtime height is 3.5 units.

| Clip | Duration | Combat timing |
| --- | --- | --- |
| Idle | 2 s | Loop |
| Walk | 1.6 s | Loop, in place; controller moves at 1.05 units/s |
| Melee | 1.1 s | Contact at 62% |
| GroundSlam | 2 s | Contact at 64% |
| Charge | 1.6 s | Neutral to charged hold; reverse to recover |
| WaveRelease | 0.6 s | Charged hold to push and back; contact at 35% |

Runtime attack poses are sampled from combat phase, so changing windup speed
does not move damage away from the animated contact. The Charge endpoint
matches both endpoints of WaveRelease. The root moves in world Z after
converting to bone-local coordinates for crouching and weight shifts.

## Fight

- Basic: face the target, wind up 0.65 s, check range and direction at contact,
  then recover. The player can leave range during anticipation.
- Stone Eruption: lock five telegraphed circles (one at the front, one at the
  player's initial position, three around the boss), wind up 1.5 s, slam and
  erupt simultaneously. Overlapping circles deal damage only once. Rocks
  crumble after 1.6 s and are cosmetic after their initial eruption.
- Rolling Stone Waves: charge the chest core for 1.6 s, then release six piles
  of tumbling rocks at 0.72 s intervals, turning 60 degrees per wave. Every
  direction is warned before launch. Waves travel at 7.5 units/s to 9.6 units;
  hitboxes follow their swept movement and each wave hits at most once.
- Enrage: subsequent attacks use 85% timing below 50% HP. Tempo is captured at
  attack start so crossing the threshold cannot skip wave launches.
- Walk only between attacks, within 3.2 units of home. Leash reset at 12.5
  units clears all hazards. Death and encounter changes also clear hazards.

Health (2,600), rewards (400 XP, 600 gold) and fire rune unlock use the existing
boss progression. The ordinary guardian enemies retain the separate golem GLB.

## Tools

- `tools/prepare_boss2.py`: Blender background rebuild and pose previews;
  optional `-- --inspect` only renders the original model.
- `tools/verify_boss2.py`: reimport and inspect the shipped GLB; writes
  `validation.json` (mesh budget, UVs, textures, weights, animation motion,
  matching endpoints and Charge/WaveRelease continuity).
- `tools/check_boss2.mjs`: isolated Playwright test against the actual game at
  `ECHO_QA_URL` (default `http://127.0.0.1:5176/`). Covers damage timing,
  dodging, six sequential directions, death/reset/leash and enrage.
  `ECHO_RECORD_PREVIEW=1` also captures twelve simulated seconds of combat.
- `tools/encode_boss2_previews.py`: encodes rendered frames as GIF previews.
