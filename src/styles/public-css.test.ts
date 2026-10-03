import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A folha pública reescreve body, h2, p, main e footer: sem o escopo .pub ela mudaria o
// diagnóstico, a adesão e o backoffice, que dividem o mesmo app.css.
const css = readFileSync('src/styles/public.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const selectorGroups = [...css.matchAll(/([^{}]+)\{/g)].map((match) => (match[1] ?? '').trim()).filter((group) => !group.startsWith('@'))

describe('public.css', () => {
  it('has rules', () => {
    expect(selectorGroups.length).toBeGreaterThan(100)
  })

  it.each(selectorGroups)('keeps "%s" inside .pub', (group) => {
    for (const selector of group.split(',').map((part) => part.trim())) {
      expect(selector.startsWith('.pub') || selector.startsWith('html:has(.pub)')).toBe(true)
    }
  })

  it('declares one rule per cover theme the panel offers', () => {
    for (const theme of ['marca', 'solido', 'foto', 'aurora', 'onda']) expect(css).toContain(`.pub .tema-${theme}{`)
  })
})
