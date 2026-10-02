import { describe, expect, it } from 'vitest'
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS } from './audit-entry'

describe('audit actions', () => {
  it('knows the stage 1 actions', () => {
    expect(AUDIT_ACTIONS).toContain('response_updated')
    expect(AUDIT_ACTIONS).toContain('legacy_imported')
  })

  it('records the reset of the hml test data', () => {
    expect(AUDIT_ACTION_LABELS.test_data_reset).toBe('dados de teste apagados')
  })

  it('labels every action in Portuguese', () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).toMatch(/^[a-zà-ú ]+$/)
  })
})
