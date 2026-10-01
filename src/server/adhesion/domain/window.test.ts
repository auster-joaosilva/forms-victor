import { describe, expect, it } from 'vitest'
import { adhesionWindow } from './window'

describe('adhesion window', () => {
  it('is open through the whole last day in Brasília', () => {
    // 30/10/2026 23:59:59 em Brasília = 31/10/2026 02:59:59Z
    expect(adhesionWindow(new Date('2026-10-31T02:59:59Z'))).toEqual({ state: 'open', end: '2026-10-30' })
  })

  it('closes at midnight in Brasília, not at midnight UTC', () => {
    expect(adhesionWindow(new Date('2026-10-31T03:00:00Z'))).toEqual({ state: 'closed', end: '2026-10-30' })
    // 21h do último dia em Brasília: o servidor em UTC já está em 31/10, e a janela segue aberta
    expect(adhesionWindow(new Date('2026-10-31T00:00:00Z')).state).toBe('open')
  })

  it('is open today and closed afterwards', () => {
    expect(adhesionWindow(new Date('2026-10-01T12:00:00Z')).state).toBe('open')
    expect(adhesionWindow(new Date('2026-12-01T12:00:00Z')).state).toBe('closed')
  })
})
