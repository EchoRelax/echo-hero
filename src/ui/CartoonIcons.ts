// Lucide SVGs; source and licenses: ./icons/lucide/README.md
import coinIconSvg from './icons/lucide/coins.svg?raw'
import bagIconSvg from './icons/lucide/backpack.svg?raw'
import emptyRuneIconSvg from './icons/lucide/gem.svg?raw'
import upgradeIconSvg from './icons/lucide/swords.svg?raw'
import settingsIconSvg from './icons/lucide/settings-2.svg?raw'
import pauseIconSvg from './icons/lucide/pause.svg?raw'
import closeIconSvg from './icons/lucide/x.svg?raw'
import rootIconSvg from './icons/lucide/leaf.svg?raw'
import fireIconSvg from './icons/lucide/flame.svg?raw'
import lightningIconSvg from './icons/lucide/zap.svg?raw'
import shieldIconSvg from './icons/lucide/shield.svg?raw'
import timerIconSvg from './icons/lucide/timer.svg?raw'

import heartIconSvg from './icons/lucide/heart.svg?raw'
import regenerationIconSvg from './icons/lucide/heart-pulse.svg?raw'
import attackSpeedIconSvg from './icons/lucide/gauge.svg?raw'
import pickupIconSvg from './icons/lucide/magnet.svg?raw'
import criticalChanceIconSvg from './icons/lucide/crosshair.svg?raw'
import criticalDamageIconSvg from './icons/lucide/sparkles.svg?raw'
import movementIconSvg from './icons/lucide/footprints.svg?raw'
import doubleAttackIconSvg from './icons/lucide/copy.svg?raw'
import tripleAttackIconSvg from './icons/lucide/copy-plus.svg?raw'

const icon = (svg: string) => svg.replace('<svg', '<svg class="ui-icon" aria-hidden="true" focusable="false"')

export const coinIcon = icon(coinIconSvg)
export const bagIcon = icon(bagIconSvg)
export const emptyRuneIcon = icon(emptyRuneIconSvg)
export const upgradeIcon = icon(upgradeIconSvg)
export const settingsIcon = icon(settingsIconSvg)
export const pauseIcon = icon(pauseIconSvg)
export const closeIcon = icon(closeIconSvg)
export const rootIcon = icon(rootIconSvg)
export const fireIcon = icon(fireIconSvg)
export const lightningIcon = icon(lightningIconSvg)
export const shieldIcon = icon(shieldIconSvg)
export const timerIcon = icon(timerIconSvg)

export const cartoonRuneIcons = { root: rootIcon, fire: fireIcon, lightning: lightningIcon }

export const heartIcon = icon(heartIconSvg)
export const regenerationIcon = icon(regenerationIconSvg)
export const attackSpeedIcon = icon(attackSpeedIconSvg)
export const pickupIcon = icon(pickupIconSvg)
export const criticalChanceIcon = icon(criticalChanceIconSvg)
export const criticalDamageIcon = icon(criticalDamageIconSvg)
export const movementIcon = icon(movementIconSvg)
export const doubleAttackIcon = icon(doubleAttackIconSvg)
export const tripleAttackIcon = icon(tripleAttackIconSvg)
