import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isRunDirectly } from './is-run-directly'

describe('isRunDirectly', () => {
  it('recognizes the entry script even with spaces and accents in the path', () => {
    const entry = resolve('Projetos', 'Auster Contábil', 'scripts', 'fill-user-emails.ts')
    expect(isRunDirectly(pathToFileURL(entry).href, entry)).toBe(true)
  })

  it('is false when the module is only imported (by a test, for instance)', () => {
    expect(isRunDirectly(pathToFileURL(resolve('scripts', 'fill-user-emails.ts')).href, resolve('node_modules', 'vitest', 'worker.js'))).toBe(false)
    expect(isRunDirectly(import.meta.url)).toBe(false)
  })

  it('is false without an entry path', () => {
    expect(isRunDirectly(pathToFileURL(resolve('scripts', 'fill-user-emails.ts')).href, undefined)).toBe(false)
  })
})
