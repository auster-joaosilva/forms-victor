import { describe, expect, it } from 'vitest'
import { sampleEvent, session } from '../testing/fixtures'
import { badgeClass, fileUrl, openSessions, sessionState } from './session-state'

describe('session state', () => {
  it('derives the badge and its class from the seats left', () => {
    expect(sessionState(session({ seats: 30, taken: 28 }))).toEqual({ remaining: 2, badge: 'Últimas 2 vagas', badgeClass: 'restam' })
    expect(sessionState(session({ seats: 30, taken: 30 }))).toEqual({ remaining: 0, badge: 'Sem vagas', badgeClass: 'esgotado' })
    expect(sessionState(session({ seats: null, taken: 90 }))).toEqual({ remaining: null, badge: null, badgeClass: '' })
    expect(badgeClass(40)).toBe('')
  })

  it('keeps only the sessions that still have a seat for the form', () => {
    const event = sampleEvent({ sessions: [session({ id: 1, seats: 2, taken: 2 }), session({ id: 2, seats: null }), session({ id: 3, seats: 5, taken: 1 })] })
    expect(openSessions(event).map((open) => open.id)).toEqual([2, 3])
  })

  it('turns a stored file reference into the /files address', () => {
    expect(fileUrl({ fileId: '0b8f9a2c-1d2e-4f50-9a6b-7c8d9e0f1a2b' })).toBe('/files/0b8f9a2c-1d2e-4f50-9a6b-7c8d9e0f1a2b')
    expect(fileUrl(null)).toBeNull()
    expect(fileUrl(undefined)).toBeNull()
  })
})
