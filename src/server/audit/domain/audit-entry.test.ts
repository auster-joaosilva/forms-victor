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

  it('knows the password reset actions', () => {
    expect(AUDIT_ACTIONS).toContain('password_reset_requested')
    expect(AUDIT_ACTIONS).toContain('password_reset_completed')
    expect(AUDIT_ACTIONS).toContain('password_reset_links_sent')
    expect(AUDIT_ACTIONS).toContain('user_email_changed')
    expect(AUDIT_ACTIONS).toContain('passwords_set_in_batch')
  })
})
