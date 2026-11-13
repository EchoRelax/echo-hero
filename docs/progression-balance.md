# Level rewards and balance pass

## Player progression

- Each level adds 8 maximum HP, restores health, and adds 1 percentage point of base physical damage.
- Damage is rounded to the nearest integer once; a level does not turn 1 damage into 2. Small bonuses accumulate until the next integer threshold.
- Every fifth level grants one permanent talent choice. Warrior adds 3 percentage points of base damage, Resilience adds 5% of untalented maximum HP, Gatherer adds 8% of untalented capacity. Repeated selections add their percentages; they do not compound.
- Talent choices live inside Upgrades. Unspent choices survive reload and a badge marks availability. Combat is not interrupted by a selection dialog.
- Every fifth level also banks 20 gold. Existing milestone payments are retained and never replayed.
- XP to next level: 30 + 15 × (level − 1) + 4 × max(0, level − 5)². The extra curve slows repeated late-game level-ups and full heals.

## Economy and encounters

- Basic damage/health upgrade prices keep the first 20 purchases unchanged. Subsequent price growth is 7.5% for the next 20 purchases, then 4.5%, replacing the old 13% and 16% growth.
- Capacity gains rise by 20 coins per purchase for each completed block of 10 capacity upgrades: the first ten add 20 each, the next ten add 40 each, then 60, etc. Ranks 0/10/20/30/40 therefore carry 20/220/620/1220/2020 before talents.
- Root Guardian / Ash Golem / Storm Lord health is 480 / 2600 / 15000. Attack damage and telegraphs are unchanged. This provides room for level bonuses and existing runes without increasing incoming damage at the same time.
- Storm Ruins camp health is 750 / 1300 / 2300 / 4000, smoothing the previous 750 / 1400 / 2600 / 5000 curve. Earlier camp health, all gold drops, and attack damage remain at their existing values.

## Reproducible checks

Run the Vite dev server on 127.0.0.1:5173, then run:

```powershell
node tools/check_progression.mjs
node tools/check_talents.mjs
node tools/check_level_up.mjs
node tools/check_ui.mjs
node tools/check_localization.mjs
npm run build
```

The progression model chooses a gold-efficient camp in the unlocked biome and buys the cheapest still-needed upgrade. Reference preparation targets are damage 22/100/600, health 180/450/950, capacity 120/800/2500 and attack-speed ranks 0/8/20. These are simulation checkpoints, not level locks or mandatory builds.

It includes armour, individual normal attacks, a small pickup allowance, banking trips and automatic talent spending. It excludes multi-target sweeps, rune damage, critical hits, double/triple attacks, enemy attack AI, dodging, deaths and player navigation. Travel uses a direct route. Estimated minutes are a model comparison, not a measured completion time. Boss seconds count uninterrupted normal strikes only. Actual results need player playtesting.

| Talent preference | Zone | Level | Damage | HP | Capacity | Basic boss seconds | Model minutes (cumulative) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| warrior | valley | 9 | 22 | 214 | 120 | 24 | 9 |
| warrior | canyon | 20 | 106 | 502 | 800 | 25 | 33 |
| warrior | ruins | 35 | 615 | 1002 | 2520 | 23 | 75 |
| resilience | valley | 9 | 22 | 225 | 120 | 24 | 9 |
| resilience | canyon | 20 | 101 | 566 | 800 | 26 | 34 |
| resilience | ruins | 35 | 618 | 1191 | 2520 | 23 | 75 |
| gatherer | valley | 9 | 22 | 214 | 130 | 24 | 9 |
| gatherer | canyon | 20 | 101 | 502 | 977 | 26 | 35 |
| gatherer | ruins | 35 | 618 | 1012 | 2902 | 23 | 78 |

The three talent preferences reach the final checkpoint at level 35 in this model, with close overall results. They should be compared again during manual play, especially Gatherer on long routes and Resilience under actual enemy pressure.

## Save compatibility

Save version 6 accepts versions 1–5. Existing levels, XP, gold, upgrades, bosses and runes are retained. Missing talent data becomes an empty record, so old characters receive floor(level / 5) available choices. Malformed or overspent talent ranks are clamped to the earned budget. Talent ranks are copied in snapshots and validated on load.
