import { describe, expect, it } from 'vitest'
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS } from './audit-entry'

describe('audit actions', () => {
  it('knows the stage 1 actions', () => {
    expect(AUDIT_ACTIONS).toContain('response_updated')
    expect(AUDIT_ACTIONS).toContain('legacy_imported')
  })

  it('labels every action in Portuguese', () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).toMatch(/^[a-zà-ú ]+$/)
  })
})
