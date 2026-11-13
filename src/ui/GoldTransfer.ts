import { coinIcon } from './CartoonIcons'

export class GoldTransfer {
  private layer = document.createElement('div')
  private animations = new Set<Animation>()
  private generation = 0

  constructor(private root: HTMLElement, private target: HTMLElement) {
    this.layer.className = 'gold-transfer'
    this.layer.setAttribute('aria-hidden', 'true')
    root.append(this.layer)
  }

  play(x: number, y: number, amount: number, arrived: (amount: number) => void) {
    if (amount <= 0) return
    const pulse = () => this.target.animate([
      { filter: 'brightness(1)', transform: 'scale(1)' },
      { filter: 'brightness(1.5)', transform: 'scale(1.08)', offset: .35 },
      { filter: 'brightness(1)', transform: 'scale(1)' },
    ], { duration: 320, easing: 'ease-out' })
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const bounds = this.root.getBoundingClientRect()
    const target = this.target.querySelector('svg')!.getBoundingClientRect()
    const endX = target.x + target.width / 2 - bounds.x - 12
    const endY = target.y + target.height / 2 - bounds.y - 12
    const count = Math.min(amount, 30 - this.animations.size, reduced ? 3 : Math.min(12, Math.max(6, Math.ceil(Math.log2(amount + 1)) + 2)))
    if (count <= 0) { arrived(amount); pulse(); return }
    const generation = this.generation
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('span')
      coin.className = 'flying-coin'
      coin.innerHTML = coinIcon
      this.layer.append(coin)
      const scatter = reduced ? 0 : (i - (count - 1) / 2) * 10
      const share = Math.floor(amount / count) + (i < amount % count ? 1 : 0)
      const animation = coin.animate([
        { transform: `translate(${x - 12}px,${y - 12}px) scale(.8)`, opacity: 0 },
        { transform: `translate(${x - 12 + scatter}px,${y - (reduced ? 12 : 35 + i % 3 * 9)}px) scale(1)`, opacity: 1, offset: .18 },
        { transform: `translate(${endX}px,${endY}px) scale(.9)`, opacity: 1, offset: .96 },
        { transform: `translate(${endX}px,${endY}px) scale(.7)`, opacity: 0 },
      ], { duration: reduced ? 600 : 1100, delay: i * (reduced ? 40 : 65), easing: 'cubic-bezier(.3,.2,.5,1)', fill: 'both' })
      this.animations.add(animation)
      void animation.finished.then(() => {
        if (generation !== this.generation) return
        arrived(share)
        if (i === count - 1) pulse()
      }).catch(() => {}).finally(() => { this.animations.delete(animation); coin.remove() })
    }
  }

  clear() {
    this.generation++
    for (const animation of this.animations) animation.cancel()
    this.animations.clear()
    this.layer.replaceChildren()
  }
}
