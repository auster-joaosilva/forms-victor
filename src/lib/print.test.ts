// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FONT_WAIT_CEILING_MS, printWhenReady } from './print'

afterEach(() => vi.useRealTimers())

describe('printWhenReady', () => {
  it('waits for the fonts, prints with the file name as title and restores it afterwards', async () => {
    const print = vi.fn()
    window.print = print
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
    document.title = 'Diagnóstico'
    await printWhenReady('Plano-De-Acao-SN-Empresa')
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('Plano-De-Acao-SN-Empresa')
    window.dispatchEvent(new Event('afterprint'))
    expect(document.title).toBe('Diagnóstico')
  })

  it('does not wait more than 1.5 s for fonts that never arrive', async () => {
    vi.useFakeTimers()
    const print = vi.fn()
    window.print = print
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise(() => undefined) } })
    const done = printWhenReady('X')
    await vi.advanceTimersByTimeAsync(FONT_WAIT_CEILING_MS + 50)
    await done
    expect(print).toHaveBeenCalledTimes(1)
  })
})
