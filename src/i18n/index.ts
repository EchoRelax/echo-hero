import { ru } from './ru'

export type Language = 'ru' | 'en'
let language: Language = 'en'
const listeners = new Set<() => void>()

export function getLanguage() { return language }
export function setLanguage(value: Language) {
  language = value
  document.documentElement.lang = value
  document.title = t('Echo Hunt · Wild Relics')
  for (const refresh of listeners) refresh()
}
export function onLanguageChange(refresh: () => void) { listeners.add(refresh) }

/** English source strings are the keys; tagged templates keep parameters out of translations. */
export function t(source: string | TemplateStringsArray, ...values: unknown[]): string {
  const key = typeof source === 'string' ? source : source.reduce((text, part, i) => text + (i ? `{${i - 1}}` : '') + part, '')
  const translated = language === 'ru' ? ru[key] ?? key : key
  return typeof source === 'string' ? translated : translated.replace(/\{(\d+)\}/g, (_, index) => t(String(values[Number(index)])))
}

/** Bind static template text and accessible labels once, without replacing controls or focus. */
export function localize(root: HTMLElement) {
  const updates: (() => void)[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const source = node.textContent ?? ''
    const key = source.trim()
    if (key in ru) updates.push(() => { node.textContent = source.replace(key, t(key)) })
  }
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    for (const attribute of ['aria-label', 'title']) {
      const source = element.getAttribute(attribute)
      if (source && source in ru) updates.push(() => element.setAttribute(attribute, t(source)))
    }
  }
  const refresh = () => updates.forEach(update => update())
  onLanguageChange(refresh)
  refresh()
}
